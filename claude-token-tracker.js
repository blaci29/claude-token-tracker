// ===================================================================
// CLAUDE TOKEN TRACKER
// Track token usage in Claude.ai conversations in real-time
// ===================================================================

console.clear();
console.log('');
console.log('🔍 === CLAUDE TOKEN TRACKER INITIALIZED ===');
console.log('');

// === TRACKER STATE ===
window.claudeTracker = {
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
    user: { chars: 0, tokens: 0 },
    documents: { chars: 0, tokens: 0, count: 0 },
    thinking: { text: '', chars: 0, tokens: 0 },
    assistant: { text: '', chars: 0, tokens: 0 },
    timestamp: null,
    active: false
  }
};

// === TOKEN ESTIMATION (2.6 chars/token average) ===
function estimateTokens(chars) {
  if (typeof chars === 'string') {
    chars = chars.length;
  }
  return Math.ceil(chars / 2.6);
}

// === SAVE ROUND ===
function saveRound() {
  const round = window.claudeTracker.currentRound;
  
  if (!round.active) return;
  
  const thinkingChars = round.thinking.text.length;
  const thinkingTokens = estimateTokens(thinkingChars);
  const assistantChars = round.assistant.text.length;
  const assistantTokens = estimateTokens(assistantChars);
  
  const totalChars = round.user.chars + round.documents.chars + thinkingChars + assistantChars;
  const totalTokens = round.user.tokens + round.documents.tokens + thinkingTokens + assistantTokens;
  
  const savedRound = {
    roundNumber: window.claudeTracker.global.roundCount + 1,
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
  
  window.claudeTracker.rounds.push(savedRound);
  window.claudeTracker.last = savedRound;
  
  // Update global stats
  window.claudeTracker.global.roundCount++;
  window.claudeTracker.global.totalUserChars += round.user.chars;
  window.claudeTracker.global.totalUserTokens += round.user.tokens;
  window.claudeTracker.global.totalDocChars += round.documents.chars;
  window.claudeTracker.global.totalDocTokens += round.documents.tokens;
  window.claudeTracker.global.totalThinkingChars += thinkingChars;
  window.claudeTracker.global.totalThinkingTokens += thinkingTokens;
  window.claudeTracker.global.totalAssistantChars += assistantChars;
  window.claudeTracker.global.totalAssistantTokens += assistantTokens;
  window.claudeTracker.global.totalChars += totalChars;
  window.claudeTracker.global.totalTokens += totalTokens;
  
  printRoundSummary(savedRound);
  
  // Reset current round (memory optimization - no text storage)
  window.claudeTracker.currentRound = {
    user: { chars: 0, tokens: 0 },
    documents: { chars: 0, tokens: 0, count: 0 },
    thinking: { text: '', chars: 0, tokens: 0 },
    assistant: { text: '', chars: 0, tokens: 0 },
    timestamp: null,
    active: false
  };
}

// === PRINT ROUND SUMMARY ===
function printRoundSummary(round) {
  const g = window.claudeTracker.global;
  
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

// === EXPORT FUNCTIONS ===

// Show all rounds in a table
window.showAllRounds = function() {
  console.log('');
  console.log('📋 ALL ROUNDS:');
  console.table(window.claudeTracker.rounds);
  console.log('');
  console.log('🌍 GLOBAL STATISTICS:');
  console.table(window.claudeTracker.global);
};

// Export tracker data as JSON (copies to clipboard)
window.exportJSON = function() {
  const json = JSON.stringify(window.claudeTracker, null, 2);
  console.log('');
  console.log('📦 TRACKER DATA (JSON):');
  console.log(json);
  
  navigator.clipboard.writeText(json).then(() => {
    console.log('✅ JSON copied to clipboard!');
  }).catch(() => {
    console.log('❌ Failed to copy to clipboard');
  });
  
  return json;
};

// Generate a blob URL for the tracker data
window.getTrackerURL = function() {
  const json = JSON.stringify(window.claudeTracker, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  console.log('');
  console.log('🔗 TRACKER DATA URL:');
  console.log(url);
  console.log('Open in a new tab to view the full JSON data!');
  
  return url;
};

// Reset all tracker data
window.resetTracker = function() {
  if (confirm('Are you sure you want to reset all tracking data?')) {
    window.claudeTracker.global = {
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
    };
    window.claudeTracker.rounds = [];
    window.claudeTracker.last = null;
    console.log('🔄 Tracker reset successfully!');
  }
};

// === FETCH INTERCEPTOR ===
const _originalFetch = window.fetch;

window.fetch = async function(url, options = {}) {
  
  // === INTERCEPT COMPLETION REQUESTS ===
  if (typeof url === 'string' && url.includes('/completion')) {
    
    if (options && options.body) {
      try {
        const body = JSON.parse(options.body);
        
        const promptText = body.prompt || '';
        
        // Start new round
        window.claudeTracker.currentRound.active = true;
        window.claudeTracker.currentRound.timestamp = new Date().toLocaleTimeString();
        window.claudeTracker.currentRound.user.chars = promptText.length;
        window.claudeTracker.currentRound.user.tokens = estimateTokens(promptText.length);
        
        console.log('');
        console.log('🟢 NEW ROUND STARTED...');
        console.log(`📤 USER message: ${promptText.length} chars (~${window.claudeTracker.currentRound.user.tokens} tokens)`);
        
        // === CHECK FOR DOCUMENTS ===
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
          window.claudeTracker.currentRound.documents.chars = docChars;
          window.claudeTracker.currentRound.documents.tokens = estimateTokens(docChars);
          window.claudeTracker.currentRound.documents.count = docCount;
          console.log(`📄 DOCUMENTS: ${docChars} chars (~${estimateTokens(docChars)} tokens), ${docCount} file(s)`);
        }
        
      } catch(e) {
        console.error('❌ Error parsing request body:', e);
      }
    }
  }
  
  // === CALL ORIGINAL FETCH ===
  const response = await _originalFetch(url, options);
  
  // === PROCESS RESPONSE ===
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
            
            // Capture thinking deltas
            if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
              window.claudeTracker.currentRound.thinking.text += data.delta.thinking || '';
            }
            
            // Capture text deltas (assistant response)
            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              window.claudeTracker.currentRound.assistant.text += data.delta.text || '';
            }
            
            // Detect end of message
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

// === INITIALIZATION ===
console.log('✅ CLAUDE TOKEN TRACKER ACTIVE!');
console.log('');
console.log('📌 Features:');
console.log('   - Automatic token tracking for every conversation round');
console.log('   - Document support (txt, pdf, etc.)');
console.log('   - Thinking + Assistant text counting');
console.log('   - Memory optimized (stores only statistics, not full text)');
console.log('');
console.log('📌 Token estimation: chars / 2.6 (~3-5% accuracy)');
console.log('');
console.log('🎮 Available commands:');
console.log('   window.showAllRounds()  - Display all rounds in a table');
console.log('   window.exportJSON()     - Export data as JSON to clipboard');
console.log('   window.getTrackerURL()  - Generate blob URL for data');
console.log('   window.resetTracker()   - Reset all tracking data');
console.log('');
console.log('💬 Start chatting with Claude to track token usage!');
console.log('');
