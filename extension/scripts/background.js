// ===================================================================
// CLAUDE TOKEN TRACKER - Background Script
// Handles API calls to Anthropic Token Counting API
// ===================================================================

console.log('🔧 Claude Token Tracker Background Service loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'countTokens') {
    handleTokenCounting(message.data, sender.tab.id);
  }
});

// Handle token counting via Anthropic API
async function handleTokenCounting(data, tabId) {
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get(['apiKey']);
    
    if (!result.apiKey) {
      console.log('⚠️ No API key configured for exact token counting');
      return;
    }
    
    const { roundNumber, texts } = data;
    
    console.log(`🔄 Counting exact tokens for round #${roundNumber}...`);
    
    // Build messages array
    const messages = [];
    
    // User message (with documents if present)
    if (texts.documents && texts.documents.trim() !== '') {
      messages.push({
        role: 'user',
        content: texts.user + '\n\n' + texts.documents
      });
    } else {
      messages.push({
        role: 'user',
        content: texts.user
      });
    }
    
    // Assistant message (with thinking if present)
    const assistantContent = [];
    
    if (texts.thinking && texts.thinking.trim() !== '') {
      assistantContent.push({
        type: 'thinking',
        thinking: texts.thinking
      });
    }
    
    if (texts.assistant && texts.assistant.trim() !== '') {
      assistantContent.push({
        type: 'text',
        text: texts.assistant
      });
    }
    
    if (assistantContent.length > 0) {
      messages.push({
        role: 'assistant',
        content: assistantContent
      });
    }
    
    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
      method: 'POST',
      headers: {
        'x-api-key': result.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        messages: messages
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const apiData = await response.json();
    const exactTokens = apiData.input_tokens;
    
    console.log(`✅ Exact token count received: ${exactTokens.toLocaleString()} tokens`);
    
    // Send result back to content script
    chrome.tabs.sendMessage(tabId, {
      action: 'exactTokensUpdate',
      data: {
        roundNumber: roundNumber,
        exactTokens: exactTokens
      }
    });
    
  } catch (error) {
    console.error('❌ Error counting exact tokens:', error);
    
    // If API key is invalid, clear it
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.error('🔑 Invalid API key - clearing from storage');
      await chrome.storage.local.remove('apiKey');
    }
  }
}

// Extension installed/updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 Claude Token Tracker installed!');
    // Set default state
    chrome.storage.local.set({
      isActive: true,
      trackerData: {
        global: {
          totalChars: 0,
          totalTokens: 0,
          totalUserChars: 0,
          totalUserTokens: 0,
          totalDocChars: 0,
          totalDocTokens: 0,
          totalThinkingChars: 0,
          totalThinkingTokens: 0,
          totalAssistantChars: 0,
          totalAssistantTokens: 0,
          roundCount: 0
        },
        rounds: [],
        last: null
      }
    });
  }
  
  if (details.reason === 'update') {
    console.log('📦 Claude Token Tracker updated to version:', chrome.runtime.getManifest().version);
  }
});

console.log('✅ Background service initialized');