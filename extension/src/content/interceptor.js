/**
 * CLAUDE TOKEN TRACKER - INTERCEPTOR
 * Intercepts fetch requests and SSE streams from Claude.ai
 */

const Interceptor = {
  
  // Current round data being collected
  currentRound: null,
  
  /**
   * Initialize interceptor
   */
  init() {
    // Inject into page context (not content script isolated world)
    this.injectPageScript();
  },
  
  /**
   * Inject script into page context
   */
  injectPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/page-injected.js');
    script.onload = function() {
      this.remove();
    };
    
    (document.head || document.documentElement).appendChild(script);
    
    // Listen for messages from page
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'CLAUDE_TRACKER_COMPLETION_REQUEST') {
        this.handleCompletionRequest(event.data);
      }
      
      if (event.data.type === 'CLAUDE_TRACKER_SSE_EVENT') {
        this.handleSSEEvent(event.data.event);
      }
      
      if (event.data.type === 'CLAUDE_TRACKER_ERROR') {
        this.handleError(event.data);
      }
    });
  },
  
  /**
   * Handle SSE events (like Tampermonkey version)
   */
  handleSSEEvent(data) {
    if (!this.currentRound) return;
    
    const round = this.currentRound.round;
    
    // content_block_delta - text/thinking chunks
    if (data.type === 'content_block_delta') {
      const delta = data.delta;
      
      if (delta.type === 'text_delta' && delta.text) {
        round.assistant.text += delta.text;
        round.assistant.chars = round.assistant.text.length;
      }
      
      if (delta.type === 'thinking_delta' && delta.thinking) {
        round.thinking.text += delta.thinking;
        round.thinking.chars = round.thinking.text.length;
        round.hasThinking = true;
      }
      
      if (delta.type === 'input_json_delta' && delta.partial_json) {
        round.toolContent.text += delta.partial_json;
        round.toolContent.chars = round.toolContent.text.length;
      }
    }
    
    // message_delta - stop reason indicates completion
    if (data.type === 'message_delta') {
      if (data.delta?.stop_reason) {
        console.log('🏁 Message complete, stop reason:', data.delta.stop_reason);
        this.finishRound();
      }
    }
  },
  /**
   * Handle completion request
   */
  handleCompletionRequest(data) {
    // Get current chat info
    const chatInfo = Utils.extractChatInfo(window.location.href);
    
    // Detect model from DOM
    const model = this.detectModel();
    
    // Initialize round
    this.currentRound = {
      chatId: chatInfo.id,
      chatUrl: chatInfo.url,
      chatTitle: this.detectChatTitle(),
      chatType: chatInfo.type,
      
      round: {
        timestamp: new Date().toISOString(),
        model: model,
        hasThinking: false,
        
        user: {
          chars: data.promptText ? data.promptText.length : 0
        },
        documents: data.documents || {
          chars: 0,
          count: 0
        },
        thinking: {
          text: '',
          chars: 0
        },
        assistant: {
          text: '',
          chars: 0
        },
        toolContent: {
          text: '',
          chars: 0
        }
      }
    };
  },
  
  /**
   * Handle error from page context
   */
  handleError(data) {
    if (!this.currentRound) {
      console.log('⚠️ Error received but no active round:', data.error);
      return;
    }
    
    console.log('🚨 Round error detected:', data.error);
    
    // Mark round as error
    this.currentRound.round.error = data.error;
    this.currentRound.round.errorMessage = data.message;
    
    // Finish round immediately (will be saved with error flag)
    this.finishRound();
  },
  
  
  /**
   * Finish round and send to worker
   */
  async finishRound() {
    if (!this.currentRound) return;
    
    // Update character counts
    this.currentRound.round.thinking.chars = this.currentRound.round.thinking.text.length;
    this.currentRound.round.assistant.chars = this.currentRound.round.assistant.text.length;
    this.currentRound.round.toolContent.chars = this.currentRound.round.toolContent.text.length;
    
    // Log status
    if (this.currentRound.round.error) {
      console.log('⚠️ Saving error round:', this.currentRound.round.error);
    }
    
    // Send to service worker
    try {
      const response = await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.ROUND_COMPLETED,
        data: this.currentRound
      });
      
      if (response.success) {
        if (this.currentRound.round.error) {
          console.log('✅ Error round saved (not counted in stats)');
        } else {
          console.log('✅ Round saved');
        }
      } else {
        console.error('❌ Error saving round:', response.error);
      }
    } catch (error) {
      console.error('❌ Error sending message to worker:', error);
    }
    
    // Clear current round
    this.currentRound = null;
  },
  
  /**
   * Detect model from DOM
   */
  detectModel() {
    try {
      const modelButton = document.querySelector(CONSTANTS.SELECTORS.MODEL_BUTTON);
      if (modelButton) {
        return modelButton.textContent?.trim() || 'unknown';
      }
    } catch(e) {
      // Ignore
    }
    return 'unknown';
  },
  
  /**
   * Detect chat title from <title> tag
   */
  detectChatTitle() {
    try {
      // Try DOM selector first (more reliable for Claude.ai)
      const titleDiv = document.querySelector('.min-w-0.flex-1 .truncate.font-base-bold');
      if (titleDiv && titleDiv.textContent) {
        const title = titleDiv.textContent.trim();
        if (title && title.length > 0) {
          console.log('✅ Title from DOM:', title);
          return title;
        }
      }
      
      // Fallback to <title> tag
      const titleElement = document.querySelector('title');
      if (titleElement) {
        const fullTitle = titleElement.textContent?.trim() || '';
        console.log('🔍 Full page title:', fullTitle);
        
        // Claude.ai format: "Chat Title | Claude"
        const parts = fullTitle.split('|');
        console.log('🔍 Title parts:', parts);
        
        if (parts.length > 0) {
          const title = parts[0].trim();
          console.log('🔍 Extracted title:', title);
          
          if (title && title.length > 0 && title !== 'Claude') {
            console.log('✅ Using title from <title> tag:', title);
            return title;
          }
        }
      }
    } catch(e) {
      console.error('❌ Error detecting title:', e);
    }
    console.log('⚠️ Returning default: Untitled Chat');
    return 'Untitled Chat';
  }
};

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    Interceptor.init();
  });
} else {
  Interceptor.init();
}