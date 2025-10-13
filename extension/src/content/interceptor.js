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
    console.log('Interceptor initializing...');
    this.interceptFetch();
    console.log('Interceptor ready');
  },
  
  /**
   * Intercept fetch requests
   */
  interceptFetch() {
    const _originalFetch = window.fetch;
    
    window.fetch = async function(url, options = {}) {
      // Log ALL fetch requests for debugging
      const urlString = typeof url === 'string' ? url : url.toString();
      console.log('🌐 Fetch:', urlString);
      
      // Check if this is a completion request
      if (urlString.includes(CONSTANTS.ENDPOINTS.COMPLETION)) {
        console.log('🟢 Completion request detected');
        
        // Extract data from request
        if (options && options.body) {
          try {
            const body = JSON.parse(options.body);
            const promptText = body.prompt || '';
            
            // Start new round
            Interceptor.startNewRound(promptText, body);
            
          } catch(e) {
            console.error('Error parsing request body:', e);
          }
        }
      }
      
      // Call original fetch
      const response = await _originalFetch(url, options);
      
      // Process completion response
      if (urlString.includes(CONSTANTS.ENDPOINTS.COMPLETION)) {
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/event-stream')) {
          const clonedResponse = response.clone();
          Interceptor.processSSEStream(clonedResponse.body);
        }
      }
      
      return response;
    };
  },
  
  /**
   * Start new round
   */
  startNewRound(promptText, body) {
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
          chars: promptText.length
        },
        documents: {
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
    
    // Check for documents
    this.extractDocuments(body);
    
    console.log('Round started:', this.currentRound);
  },
  
  /**
   * Extract documents from request body
   */
  extractDocuments(body) {
    let docChars = 0;
    let docCount = 0;
    
    // Check attachments
    if (body.attachments && Array.isArray(body.attachments)) {
      body.attachments.forEach((att) => {
        if (att.extracted_content) {
          docChars += att.extracted_content.length;
          docCount++;
        }
        if (att.content) {
          docChars += att.content.length;
          docCount++;
        }
      });
    }
    
    // Check files
    if (body.files && Array.isArray(body.files)) {
      body.files.forEach((file) => {
        if (file.content) {
          docChars += file.content.length;
          docCount++;
        }
        if (file.extracted_content) {
          docChars += file.extracted_content.length;
          docCount++;
        }
      });
    }
    
    if (docChars > 0) {
      this.currentRound.round.documents.chars = docChars;
      this.currentRound.round.documents.count = docCount;
      console.log(`📄 Documents: ${docChars} chars, ${docCount} file(s)`);
    }
  },
  
  /**
   * Process SSE stream
   */
  async processSSEStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              this.processSSEEvent(data);
            } catch(e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch(e) {
      console.error('Error reading stream:', e);
    }
  },
  
  /**
   * Process SSE event
   */
  processSSEEvent(data) {
    if (!this.currentRound) return;
    
    // Capture thinking
    if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
      const text = data.delta.thinking || '';
      this.currentRound.round.thinking.text += text;
      this.currentRound.round.hasThinking = true;
    }
    
    // Capture text (assistant response)
    if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
      const text = data.delta.text || '';
      this.currentRound.round.assistant.text += text;
    }
    
    // Capture tool content (files/artifacts)
    if (data.type === 'content_block_delta' && data.delta?.type === 'input_json_delta') {
      const text = data.delta.partial_json || '';
      this.currentRound.round.toolContent.text += text;
    }
    
    // Detect end of message
    if (data.type === 'message_delta' && data.delta?.stop_reason) {
      console.log('🏁 Response completed');
      setTimeout(() => {
        this.finishRound();
      }, CONSTANTS.SAVE_DELAY_MS);
    }
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
    
    console.log('Sending round to worker:', this.currentRound);
    
    // Send to service worker
    try {
      const response = await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.ROUND_COMPLETED,
        data: this.currentRound
      });
      
      if (response.success) {
        console.log('✅ Round saved successfully');
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
   * Detect chat title from DOM
   */
  detectChatTitle() {
    try {
      // Try various selectors
      const selectors = [
        'h1.font-tiempos',
        '[data-testid="chat-title"]',
        'h1',
        '.chat-title'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const title = element.textContent?.trim();
          if (title && title.length > 0 && title.length < 200) {
            return title;
          }
        }
      }
    } catch(e) {
      // Ignore
    }
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