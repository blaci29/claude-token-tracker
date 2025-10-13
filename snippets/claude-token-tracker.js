// ===================================================================
// CLAUDE TOKEN TRACKER - CLEAN VERSION WITH DEBUG
// Real-time token usage tracking for Claude.ai conversations
// Token estimation only (~3-5% accuracy)
// Captures: text, thinking, AND file content!
// ===================================================================

console.clear();
console.log('');
console.log('🔍 === CLAUDE TOKEN TRACKER INITIALIZED ===');
console.log('');

// === DEBUG MODE ===
let debugMode = false;

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
    totalToolChars: 0,
    totalToolTokens: 0,
    roundCount: 0
  },
  rounds: [],
  last: null,
  
  currentRound: {
    user: { chars: 0, tokens: 0 },
    documents: { chars: 0, tokens: 0, count: 0 },
    thinking: { text: '', chars: 0, tokens: 0 },
    assistant: { text: '', chars: 0, tokens: 0 },
    toolContent: { text: '', chars: 0, tokens: 0 },
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

// === DEBUG FUNCTIONS ===
window.enableDebug = function() {
  debugMode = true;
  console.log('');
  console.log('🐛 DEBUG MODE ENABLED');
  console.log('   All SSE events will be logged');
  console.log('   Use window.disableDebug() to turn off');
  console.log('');
};

window.disableDebug = function() {
  debugMode = false;
  console.log('');
  console.log('🔇 DEBUG MODE DISABLED');
  console.log('');
};

// === SAVE ROUND ===
function saveRound() {
  const round = window.claudeTracker.currentRound;
  
  if (!round.active) return;
  
  const thinkingChars = round.thinking.text.length;
  const thinkingTokens = estimateTokens(thinkingChars);
  const assistantChars = round.assistant.text.length;
  const assistantTokens = estimateTokens(assistantChars);
  const toolChars = round.toolContent.text.length;
  const toolTokens = estimateTokens(toolChars);
  
  // Calculate subtotals
  const userSubtotalChars = round.user.chars + round.documents.chars;
  const userSubtotalTokens = round.user.tokens + round.documents.tokens;
  const claudeSubtotalChars = thinkingChars + assistantChars + toolChars;
  const claudeSubtotalTokens = thinkingTokens + assistantTokens + toolTokens;
  
  const totalChars = userSubtotalChars + claudeSubtotalChars;
  const totalTokens = userSubtotalTokens + claudeSubtotalTokens;
  
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
    userSubtotal: {
      chars: userSubtotalChars,
      tokens: userSubtotalTokens
    },
    thinking: {
      chars: thinkingChars,
      tokens: thinkingTokens
    },
    assistant: {
      chars: assistantChars,
      tokens: assistantTokens
    },
    toolContent: {
      chars: toolChars,
      tokens: toolTokens
    },
    claudeSubtotal: {
      chars: claudeSubtotalChars,
      tokens: claudeSubtotalTokens
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
  window.claudeTracker.global.totalToolChars += toolChars;
  window.claudeTracker.global.totalToolTokens += toolTokens;
  window.claudeTracker.global.totalChars += totalChars;
  window.claudeTracker.global.totalTokens += totalTokens;
  
  printRoundSummary(savedRound);
  
  // Clear texts from memory (optimization for large documents)
  window.claudeTracker.currentRound.thinking.text = '';
  window.claudeTracker.currentRound.assistant.text = '';
  window.claudeTracker.currentRound.toolContent.text = '';
  
  // Reset current round
  window.claudeTracker.currentRound = {
    user: { chars: 0, tokens: 0 },
    documents: { chars: 0, tokens: 0, count: 0 },
    thinking: { text: '', chars: 0, tokens: 0 },
    assistant: { text: '', chars: 0, tokens: 0 },
    toolContent: { text: '', chars: 0, tokens: 0 },
    timestamp: null,
    active: false
  };
}

// === PRINT ROUND SUMMARY ===
function printRoundSummary(round) {
  const g = window.claudeTracker.global;
  
  // Calculate global subtotals
  const globalUserSubtotal = g.totalUserChars + g.totalDocChars;
  const globalUserTokens = g.totalUserTokens + g.totalDocTokens;
  const globalClaudeSubtotal = g.totalThinkingChars + g.totalAssistantChars + g.totalToolChars;
  const globalClaudeTokens = g.totalThinkingTokens + g.totalAssistantTokens + g.totalToolTokens;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ ROUND #${round.roundNumber} COMPLETED @ ${round.timestamp}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📥 USER INPUT:');
  console.log(`   User message: ${round.user.chars.toLocaleString()} chars (~${round.user.tokens.toLocaleString()} tokens)`);
  
  if (round.documents.count > 0) {
    console.log(`   Documents (${round.documents.count}): ${round.documents.chars.toLocaleString()} chars (~${round.documents.tokens.toLocaleString()} tokens)`);
  } else {
    console.log(`   Documents: 0 chars (~0 tokens)`);
  }
  
  console.log('   ─────────────────────────────');
  console.log(`   USER SUBTOTAL: ${round.userSubtotal.chars.toLocaleString()} chars (~${round.userSubtotal.tokens.toLocaleString()} tokens)`);
  console.log('');
  console.log('🤖 CLAUDE OUTPUT:');
  console.log(`   Thinking: ${round.thinking.chars.toLocaleString()} chars (~${round.thinking.tokens.toLocaleString()} tokens)`);
  console.log(`   Assistant: ${round.assistant.chars.toLocaleString()} chars (~${round.assistant.tokens.toLocaleString()} tokens)`);
  
  if (round.toolContent.chars > 0) {
    console.log(`   Tool Content: ${round.toolContent.chars.toLocaleString()} chars (~${round.toolContent.tokens.toLocaleString()} tokens)`);
  } else {
    console.log(`   Tool Content: 0 chars (~0 tokens)`);
  }
  
  console.log('   ─────────────────────────────');
  console.log(`   CLAUDE SUBTOTAL: ${round.claudeSubtotal.chars.toLocaleString()} chars (~${round.claudeSubtotal.tokens.toLocaleString()} tokens)`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📊 ROUND TOTAL: ${round.total.chars.toLocaleString()} chars (~${round.total.tokens.toLocaleString()} tokens)`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('🌍 GLOBAL TOTALS:');
  console.log(`   Total rounds: ${g.roundCount}`);
  console.log('');
  console.log('   📥 USER INPUT:');
  console.log(`      User messages: ${g.totalUserChars.toLocaleString()} chars (~${g.totalUserTokens.toLocaleString()} tokens)`);
  console.log(`      Documents: ${g.totalDocChars.toLocaleString()} chars (~${g.totalDocTokens.toLocaleString()} tokens)`);
  console.log('      ─────────────────────────────');
  console.log(`      USER SUBTOTAL: ${globalUserSubtotal.toLocaleString()} chars (~${globalUserTokens.toLocaleString()} tokens)`);
  console.log('');
  console.log('   🤖 CLAUDE OUTPUT:');
  console.log(`      Thinking: ${g.totalThinkingChars.toLocaleString()} chars (~${g.totalThinkingTokens.toLocaleString()} tokens)`);
  console.log(`      Assistant: ${g.totalAssistantChars.toLocaleString()} chars (~${g.totalAssistantTokens.toLocaleString()} tokens)`);
  console.log(`      Tool Content: ${g.totalToolChars.toLocaleString()} chars (~${g.totalToolTokens.toLocaleString()} tokens)`);
  console.log('      ─────────────────────────────');
  console.log(`      CLAUDE SUBTOTAL: ${globalClaudeSubtotal.toLocaleString()} chars (~${globalClaudeTokens.toLocaleString()} tokens)`);
  console.log('');
  console.log('   ═════════════════════════════════════');
  console.log(`   TOTAL: ${g.totalChars.toLocaleString()} chars (~${g.totalTokens.toLocaleString()} tokens)`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

// === EXPORT FUNCTIONS ===

window.showAllRounds = function() {
  console.log('');
  console.log('📋 ALL ROUNDS:');
  console.table(window.claudeTracker.rounds);
  console.log('');
  console.log('🌍 GLOBAL STATISTICS:');
  console.table(window.claudeTracker.global);
};

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
      totalToolChars: 0,
      totalToolTokens: 0,
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
          console.log(`📄 DOCUMENTS: ${docChars.toLocaleString()} chars (~${estimateTokens(docChars).toLocaleString()} tokens), ${docCount} file(s)`);
          
          // Memory warning for large documents
          if (docChars > 100000) {
            console.warn(`⚠️ Large document detected (${(docChars/1000).toFixed(0)}k chars) - will be cleared after processing`);
          }
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
  
  if (debugMode) {
    console.log('');
    console.log('🐛 === SSE STREAM DEBUG MODE ===');
    console.log('');
  }
  
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
            
            // === DEBUG: Log ALL events ===
            if (debugMode) {
              console.log('🐛 SSE Event:', data.type);
              console.log('   Full data:', data);
              
              // Detailed info for content blocks
              if (data.type === 'content_block_start') {
                console.log('   📦 Content block type:', data.content_block?.type);
              }
              
              if (data.type === 'content_block_delta') {
                console.log('   📦 Delta type:', data.delta?.type);
                if (data.delta?.text) {
                  console.log('   📦 Text length:', data.delta.text.length);
                }
                if (data.delta?.thinking) {
                  console.log('   📦 Thinking length:', data.delta.thinking.length);
                }
                if (data.delta?.partial_json) {
                  console.log('   📦 Partial JSON length:', data.delta.partial_json.length);
                }
              }
              console.log('');
            }
            
            // === CAPTURE THINKING ===
            if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
              const text = data.delta.thinking || '';
              window.claudeTracker.currentRound.thinking.text += text;
              
              if (debugMode) {
                console.log(`🐛 ✅ THINKING captured: +${text.length} chars`);
              }
            }
            
            // === CAPTURE TEXT (assistant response) ===
            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              const text = data.delta.text || '';
              window.claudeTracker.currentRound.assistant.text += text;
              
              if (debugMode) {
                console.log(`🐛 ✅ ASSISTANT TEXT captured: +${text.length} chars`);
              }
            }
            
            // === CAPTURE TOOL CONTENT (files/artifacts) ===
            if (data.type === 'content_block_delta' && data.delta?.type === 'input_json_delta') {
              const text = data.delta.partial_json || '';
              window.claudeTracker.currentRound.toolContent.text += text;
              
              if (debugMode) {
                console.log(`🐛 ✅ TOOL CONTENT captured: +${text.length} chars`);
              }
            }
            
            // === DETECT END OF MESSAGE ===
            if (data.type === 'message_delta' && data.delta?.stop_reason) {
              console.log('🏁 Response completed, processing...');
              
              if (debugMode) {
                console.log('🐛 === END OF STREAM ===');
                console.log('');
              }
              
              setTimeout(() => {
                saveRound();
              }, 500);
            }
            
          } catch(e) {
            if (debugMode) {
              console.error('🐛 ❌ Error parsing SSE data:', e);
            }
          }
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
console.log('   - Tool content tracking (files, artifacts)');
console.log('   - Memory optimized (texts cleared after processing)');
console.log('');
console.log('📌 Token estimation: chars / 2.6 (~3-5% accuracy)');
console.log('');
console.log('🎮 Available commands:');
console.log('   window.showAllRounds()  - Display all rounds in a table');
console.log('   window.exportJSON()     - Export data as JSON to clipboard');
console.log('   window.getTrackerURL()  - Generate blob URL for data');
console.log('   window.resetTracker()   - Reset all tracking data');
console.log('   window.enableDebug()    - Enable debug mode (SSE events)');
console.log('   window.disableDebug()   - Disable debug mode');
console.log('');
console.log('💬 Start chatting with Claude to track token usage!');
console.log('');