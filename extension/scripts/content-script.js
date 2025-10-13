// ===================================================================
// CLAUDE TOKEN TRACKER - Content Script
// Runs on claude.ai pages
// ===================================================================

console.log('🔍 Claude Token Tracker Extension loaded');

// === TRACKER STATE ===
let trackerState = {
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
  last: null,
  currentRound: {
    user: { text: '', chars: 0, tokens: 0 },
    documents: { text: '', chars: 0, tokens: 0, count: 0 },
    thinking: { text: '', chars: 0, tokens: 0 },
    assistant: { text: '', chars: 0, tokens: 0 },
    timestamp: null,
    active: false
  },
  isActive: true
};

// Load saved state
chrome.storage.local.get(['trackerData', 'isActive'], (result) => {
  if (result.trackerData) {
    trackerState = { ...trackerState, ...result.trackerData };
  }
  if (result.isActive !== undefined) {
    trackerState.isActive = result.isActive;
  }
  console.log('✅ Tracker state loaded:', trackerState.isActive ? 'ACTIVE' : 'INACTIVE');
});

// === TOKEN ESTIMATION ===
function estimateTokens(chars) {
  if (typeof chars === 'string') {
    chars = chars.length;
  }
  return Math.ceil(chars / 2.6);
}

// === SAVE STATE ===
function saveState() {
  chrome.storage.local.set({ trackerData: trackerState });
}

// === SAVE ROUND ===
function saveRound() {
  const round = trackerState.currentRound;
  
  if (!round.active || !trackerState.isActive) return;
  
  const thinkingChars = round.thinking.text.length;
  const thinkingTokens = estimateTokens(thinkingChars);
  const assistantChars = round.assistant.text.length;
  const assistantTokens = estimateTokens(assistantChars);
  
  const totalChars = round.user.chars + round.documents.chars + thinkingChars + assistantChars;
  const totalTokens = round.user.tokens + round.documents.tokens + thinkingTokens + assistantTokens;
  
  const savedRound = {
    roundNumber: trackerState.global.roundCount + 1,
    timestamp: round.timestamp || new Date().toLocaleTimeString(),
    user: {
      chars: round.user.chars,
      tokens: round.user.tokens
    },
    documents: {
      chars: round.documents.chars,
      tokens: round.documents.tokens,
      count: round.documents.count
    },
    thinking: {
      chars: thinkingChars,
      tokens: thinkingTokens
    },
    assistant: {
      chars: assistantChars,
      tokens: assistantTokens
    },
    total: {
      chars: totalChars,
      tokens: totalTokens
    }
  };
  
  trackerState.rounds.push(savedRound);
  trackerState.last = savedRound;
  
  // Update global stats
  trackerState.global.roundCount++;
  trackerState.global.totalUserChars += round.user.chars;
  trackerState.global.totalUserTokens += round.user.tokens;
  trackerState.global.totalDocChars += round.documents.chars;
  trackerState.global.totalDocTokens += round.documents.tokens;
  trackerState.global.totalThinkingChars += thinkingChars;
  trackerState.global.totalThinkingTokens += thinkingTokens;
  trackerState.global.totalAssistantChars += assistantChars;
  trackerState.global.totalAssistantTokens += assistantTokens;
  trackerState.global.totalChars += totalChars;
  trackerState.global.totalTokens += totalTokens;
  
  printRoundSummary(savedRound);
  
  // Save to storage
  saveState();
  
  // Check for API key and request exact count
  chrome.storage.local.get(['apiKey'], (result) => {
    if (result.apiKey) {
      // Send to background for exact counting
      chrome.runtime.sendMessage({
        action: 'countTokens',
        data: {
          roundNumber: savedRound.roundNumber,
          texts: {
            user: round.user.text,
            documents: round.documents.text,
            thinking: round.thinking.text,
            assistant: round.assistant.text
          }
        }
      });
    }
  });
  
  // Clear texts from memory
  clearCurrentRoundTexts();
  
  // Reset current round
  trackerState.currentRound = {
    user: { text: '', chars: 0, tokens: 0 },
    documents: { text: '', chars: 0, tokens: 0, count: 0 },
    thinking: { text: '', chars: 0, tokens: 0 },
    assistant: { text: '', chars: 0, tokens: 0 },
    timestamp: null,
    active: false
  };
}

// === CLEAR TEXTS ===
function clearCurrentRoundTexts() {
  trackerState.currentRound.user.text = '';
  trackerState.currentRound.documents.text = '';
  trackerState.currentRound.thinking.text = '';
  trackerState.currentRound.assistant.text = '';
}

// === PRINT ROUND SUMMARY ===
function printRoundSummary(round) {
  const g = trackerState.global;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ ROUND #${round.roundNumber} COMPLETED @ ${round.timestamp}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📤 USER:      ${round.user.chars.toLocaleString()} chars (~${round.user.tokens.toLocaleString()} tokens)`);
  
  if (round.documents.count > 0) {
    console.log(`📄 DOCUMENTS (${round.documents.count}): ${round.documents.chars.toLocaleString()} chars (~${round.documents.tokens.toLocaleString()} tokens)`);
  }
  
  console.log(`🧠 THINKING:  ${round.thinking.chars.toLocaleString()} chars (~${round.thinking.tokens.toLocaleString()} tokens)`);
  console.log(`💬 ASSISTANT: ${round.assistant.chars.toLocaleString()} chars (~${round.assistant.tokens.toLocaleString()} tokens)`);
  console.log('');
  console.log(`📊 ROUND TOTAL: ${round.total.chars.toLocaleString()} chars (~${round.total.tokens.toLocaleString()} tokens)`);
  console.log('───────────────────────────────────────────────────────');
  console.log('🌍 GLOBAL TOTALS:');
  console.log(`   Total rounds: ${g.roundCount}`);
  console.log(`   User:      ${g.totalUserChars.toLocaleString()} chars (~${g.totalUserTokens.toLocaleString()} tokens)`);
  console.log(`   Documents: ${g.totalDocChars.toLocaleString()} chars (~${g.totalDocTokens.toLocaleString()} tokens)`);
  console.log(`   Thinking:  ${g.totalThinkingChars.toLocaleString()} chars (~${g.totalThinkingTokens.toLocaleString()} tokens)`);
  console.log(`   Assistant: ${g.totalAssistantChars.toLocaleString()} chars (~${g.totalAssistantTokens.toLocaleString()} tokens)`);
  console.log('   ─────────────────────────────────────');
  console.log(`   TOTAL:     ${g.totalChars.toLocaleString()} chars (~${g.totalTokens.toLocaleString()} tokens)`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

// === FETCH INTERCEPTOR ===
const _originalFetch = window.fetch;

window.fetch = async function(url, options = {}) {
  
  if (!trackerState.isActive) {
    return _originalFetch(url, options);
  }
  
  // === INTERCEPT COMPLETION REQUESTS ===
  if (typeof url === 'string' && url.includes('/completion')) {
    
    if (options && options.body) {
      try {
        const body = JSON.parse(options.body);
        
        const promptText = body.prompt || '';
        
        // Start new round
        trackerState.currentRound.active = true;
        trackerState.currentRound.timestamp = new Date().toLocaleTimeString();
        trackerState.currentRound.user.text = promptText;
        trackerState.currentRound.user.chars = promptText.length;
        trackerState.currentRound.user.tokens = estimateTokens(promptText.length);
        
        console.log('');
        console.log('🟢 NEW ROUND STARTED...');
        console.log(`📤 USER message: ${promptText.length} chars (~${trackerState.currentRound.user.tokens} tokens)`);
        
        // Check for documents
        let docText = '';
        let docChars = 0;
        let docCount = 0;
        
        if (body.attachments && Array.isArray(body.attachments)) {
          body.attachments.forEach((att) => {
            if (att.extracted_content) {
              docText += att.extracted_content + '\n\n';
              docChars += att.extracted_content.length;
              docCount++;
            }
            if (att.content) {
              docText += att.content + '\n\n';
              docChars += att.content.length;
              docCount++;
            }
          });
        }
        
        if (body.files && Array.isArray(body.files)) {
          body.files.forEach((file) => {
            if (file.content) {
              docText += file.content + '\n\n';
              docChars += file.content.length;
              docCount++;
            }
            if (file.extracted_content) {
              docText += file.extracted_content + '\n\n';
              docChars += file.extracted_content.length;
              docCount++;
            }
          });
        }
        
        if (docChars > 0) {
          trackerState.currentRound.documents.text = docText;
          trackerState.currentRound.documents.chars = docChars;
          trackerState.currentRound.documents.tokens = estimateTokens(docChars);
          trackerState.currentRound.documents.count = docCount;
          console.log(`📄 DOCUMENTS: ${docChars.toLocaleString()} chars (~${estimateTokens(docChars).toLocaleString()} tokens), ${docCount} file(s)`);
        }
        
      } catch(e) {
        console.error('❌ Error parsing request body:', e);
      }
    }
  }
  
  // Call original fetch
  const response = await _originalFetch(url, options);
  
  // Process response
  if (typeof url === 'string' && url.includes('/completion')) {
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/event-stream')) {
      const clonedResponse = response.clone();
      processSSEStream(clonedResponse.body);
    }
  }
  
  return response;
};

// === PROCESS SSE STREAM ===
async function processSSEStream(stream) {
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
            
            // Capture thinking
            if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
              trackerState.currentRound.thinking.text += data.delta.thinking || '';
            }
            
            // Capture assistant text
            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              trackerState.currentRound.assistant.text += data.delta.text || '';
            }
            
            // End of message
            if (data.type === 'message_delta' && data.delta?.stop_reason) {
              console.log('🏁 Response completed, processing...');
              setTimeout(() => {
                saveRound();
              }, 500);
            }
            
          } catch(e) {}
        }
      }
    }
  } catch(e) {
    console.error('❌ Error reading stream:', e);
  }
}

// === MESSAGE LISTENER ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleTracking') {
    trackerState.isActive = message.isActive;
    console.log(`📊 Tracking ${trackerState.isActive ? 'ENABLED' : 'DISABLED'}`);
  }
  
  if (message.action === 'showStats') {
    console.log('📊 === DETAILED STATISTICS ===');
    console.table(trackerState.rounds);
    console.log('🌍 GLOBAL:', trackerState.global);
  }
  
  if (message.action === 'exactTokensUpdate') {
    // Update exact tokens from background script
    const { roundNumber, exactTokens } = message.data;
    const round = trackerState.rounds.find(r => r.roundNumber === roundNumber);
    if (round) {
      round.total.tokensExact = exactTokens;
      console.log(`✅ Exact tokens for round #${roundNumber}: ${exactTokens}`);
      saveState();
    }
  }
});

console.log('✅ Claude Token Tracker initialized and ready!');