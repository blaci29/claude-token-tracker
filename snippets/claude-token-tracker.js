// ===================================================================
// CLAUDE TOKEN TRACKER - ENHANCED DEBUG + DOM MODEL DETECTION
// Real-time token usage tracking for Claude.ai conversations
// Token estimation only (~3-5% accuracy)
// Captures: text, thinking, AND file content!
// NEW: Enhanced debug mode + DOM-based model detection
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
    roundCount: 0,
    modelStats: {}
  },
  rounds: [],
  last: null,
  
  currentRound: {
    model: null,
    hasThinking: false,
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

// === DOM-BASED MODEL DETECTION ===
function detectModelFromDOM() {
  const selectors = [
    '.font-claude-response .whitespace-nowrap',
    '[class*="model-name"]',
    '[class*="model"] .whitespace-nowrap',
    '.font-claude-response div',
  ];
  
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const elem of elements) {
        const text = elem.textContent?.trim();
        // Check if it looks like a model name
        if (text && (
          text.includes('Sonnet') || 
          text.includes('Opus') || 
          text.includes('Haiku') ||
          text.match(/claude/i)
        )) {
          console.log(`🎯 Model detected from DOM: "${text}"`);
          return text;
        }
      }
    } catch(e) {
      // Ignore selector errors
    }
  }
  
  return null;
}

// === DEEP SEARCH FOR INTERESTING FIELDS ===
function deepSearchObject(obj, searchKeys = ['token', 'usage', 'model', 'size', 'count', 'chars'], path = '', results = []) {
  if (!obj || typeof obj !== 'object') return results;
  
  for (const key in obj) {
    const newPath = path ? `${path}.${key}` : key;
    const value = obj[key];
    
    // Check if key matches any search term
    const keyLower = key.toLowerCase();
    const isInteresting = searchKeys.some(searchKey => keyLower.includes(searchKey));
    
    if (isInteresting && value !== null && value !== undefined) {
      results.push({
        path: newPath,
        key: key,
        value: value,
        type: typeof value
      });
    }
    
    // Recurse into nested objects/arrays
    if (typeof value === 'object' && value !== null) {
      deepSearchObject(value, searchKeys, newPath, results);
    }
  }
  
  return results;
}

// === DEBUG FUNCTIONS ===
window.enableDebug = function() {
  debugMode = true;
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🐛 ENHANCED DEBUG MODE ENABLED');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   📡 All fetch URLs will be logged');
  console.log('   📦 Response bodies will be inspected');
  console.log('   🔍 Automatic search for: token, usage, model, size, count');
  console.log('   📝 SSE events will be logged');
  console.log('');
  console.log('   Use window.disableDebug() to turn off');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
};

window.disableDebug = function() {
  debugMode = false;
  console.log('');
  console.log('🔇 DEBUG MODE DISABLED');
  console.log('');
};

// === INITIALIZE MODEL STATS ===
function initModelStats(modelName) {
  if (!window.claudeTracker.global.modelStats[modelName]) {
    window.claudeTracker.global.modelStats[modelName] = {
      rounds: 0,
      roundsWithThinking: 0,
      roundsWithoutThinking: 0,
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
      totalToolTokens: 0
    };
  }
}

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
  
  const hasThinking = thinkingChars > 0;
  
  const userSubtotalChars = round.user.chars + round.documents.chars;
  const userSubtotalTokens = round.user.tokens + round.documents.tokens;
  const claudeSubtotalChars = thinkingChars + assistantChars + toolChars;
  const claudeSubtotalTokens = thinkingTokens + assistantTokens + toolTokens;
  
  const totalChars = userSubtotalChars + claudeSubtotalChars;
  const totalTokens = userSubtotalTokens + claudeSubtotalTokens;
  
  const savedRound = {
    roundNumber: window.claudeTracker.global.roundCount + 1,
    timestamp: round.timestamp || new Date().toLocaleTimeString(),
    model: round.model || 'unknown',
    hasThinking: hasThinking,
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
  
  // Update model-specific stats
  const modelName = round.model || 'unknown';
  initModelStats(modelName);
  const modelStats = window.claudeTracker.global.modelStats[modelName];
  
  modelStats.rounds++;
  if (hasThinking) {
    modelStats.roundsWithThinking++;
  } else {
    modelStats.roundsWithoutThinking++;
  }
  modelStats.totalChars += totalChars;
  modelStats.totalTokens += totalTokens;
  modelStats.totalUserChars += round.user.chars;
  modelStats.totalUserTokens += round.user.tokens;
  modelStats.totalDocChars += round.documents.chars;
  modelStats.totalDocTokens += round.documents.tokens;
  modelStats.totalThinkingChars += thinkingChars;
  modelStats.totalThinkingTokens += thinkingTokens;
  modelStats.totalAssistantChars += assistantChars;
  modelStats.totalAssistantTokens += assistantTokens;
  modelStats.totalToolChars += toolChars;
  modelStats.totalToolTokens += toolTokens;
  
  printRoundSummary(savedRound);
  
  // Clear texts from memory
  window.claudeTracker.currentRound.thinking.text = '';
  window.claudeTracker.currentRound.assistant.text = '';
  window.claudeTracker.currentRound.toolContent.text = '';
  
  // Reset current round
  window.claudeTracker.currentRound = {
    model: null,
    hasThinking: false,
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
  
  const globalUserSubtotal = g.totalUserChars + g.totalDocChars;
  const globalUserTokens = g.totalUserTokens + g.totalDocTokens;
  const globalClaudeSubtotal = g.totalThinkingChars + g.totalAssistantChars + g.totalToolChars;
  const globalClaudeTokens = g.totalThinkingTokens + g.totalAssistantTokens + g.totalToolTokens;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ ROUND #${round.roundNumber} COMPLETED @ ${round.timestamp}`);
  console.log(`🤖 MODEL: ${round.model}`);
  console.log(`🧠 THINKING: ${round.hasThinking ? '✓ YES' : '✗ NO'}`);
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

window.showModelStats = function() {
  const modelStats = window.claudeTracker.global.modelStats;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🤖 MODEL STATISTICS');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  const models = Object.keys(modelStats);
  
  if (models.length === 0) {
    console.log('No model data available yet.');
    console.log('');
    return;
  }
  
  models.forEach(modelName => {
    const stats = modelStats[modelName];
    const userSubtotal = stats.totalUserChars + stats.totalDocChars;
    const userTokens = stats.totalUserTokens + stats.totalDocTokens;
    const claudeSubtotal = stats.totalThinkingChars + stats.totalAssistantChars + stats.totalToolChars;
    const claudeTokens = stats.totalThinkingTokens + stats.totalAssistantTokens + stats.totalToolTokens;
    
    console.log(`📊 ${modelName}`);
    console.log('─────────────────────────────────────────────────────');
    console.log(`   Total rounds: ${stats.rounds}`);
    console.log(`   Rounds with thinking: ${stats.roundsWithThinking}`);
    console.log(`   Rounds without thinking: ${stats.roundsWithoutThinking}`);
    console.log('');
    console.log('   📥 USER INPUT:');
    console.log(`      User messages: ${stats.totalUserChars.toLocaleString()} chars (~${stats.totalUserTokens.toLocaleString()} tokens)`);
    console.log(`      Documents: ${stats.totalDocChars.toLocaleString()} chars (~${stats.totalDocTokens.toLocaleString()} tokens)`);
    console.log('      ─────────────────────────────');
    console.log(`      USER SUBTOTAL: ${userSubtotal.toLocaleString()} chars (~${userTokens.toLocaleString()} tokens)`);
    console.log('');
    console.log('   🤖 CLAUDE OUTPUT:');
    console.log(`      Thinking: ${stats.totalThinkingChars.toLocaleString()} chars (~${stats.totalThinkingTokens.toLocaleString()} tokens)`);
    console.log(`      Assistant: ${stats.totalAssistantChars.toLocaleString()} chars (~${stats.totalAssistantTokens.toLocaleString()} tokens)`);
    console.log(`      Tool Content: ${stats.totalToolChars.toLocaleString()} chars (~${stats.totalToolTokens.toLocaleString()} tokens)`);
    console.log('      ─────────────────────────────');
    console.log(`      CLAUDE SUBTOTAL: ${claudeSubtotal.toLocaleString()} chars (~${claudeTokens.toLocaleString()} tokens)`);
    console.log('');
    console.log('   ═════════════════════════════════════');
    console.log(`   TOTAL: ${stats.totalChars.toLocaleString()} chars (~${stats.totalTokens.toLocaleString()} tokens)`);
    console.log('');
  });
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  const tableData = models.map(modelName => {
    const stats = modelStats[modelName];
    return {
      model: modelName,
      rounds: stats.rounds,
      withThinking: stats.roundsWithThinking,
      withoutThinking: stats.roundsWithoutThinking,
      totalTokens: stats.totalTokens,
      thinkingTokens: stats.totalThinkingTokens,
      assistantTokens: stats.totalAssistantTokens
    };
  });
  
  console.table(tableData);
  console.log('');
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
      roundCount: 0,
      modelStats: {}
    };
    window.claudeTracker.rounds = [];
    window.claudeTracker.last = null;
    console.log('🔄 Tracker reset successfully!');
  }
};

// === FETCH INTERCEPTOR ===
const _originalFetch = window.fetch;

window.fetch = async function(url, options = {}) {
  
  // === ENHANCED DEBUG: Log ALL fetch URLs ===
  if (debugMode) {
    console.log('');
    console.log('🐛 ═══════════════════════════════════════════════════');
    console.log(`🐛 📡 FETCH URL: ${url}`);
    if (options.method) {
      console.log(`🐛 📤 METHOD: ${options.method}`);
    }
  }
  
  // === INTERCEPT COMPLETION REQUESTS ===
  if (typeof url === 'string' && url.includes('/completion')) {
    
    if (options && options.body) {
      try {
        const body = JSON.parse(options.body);
        
        const promptText = body.prompt || '';
        let modelName = body.model || null;
        
        // Try to detect model from DOM if not in request
        if (!modelName) {
          modelName = detectModelFromDOM();
        }
        
        if (!modelName) {
          modelName = 'unknown';
        }
        
        // Start new round
        window.claudeTracker.currentRound.active = true;
        window.claudeTracker.currentRound.timestamp = new Date().toLocaleTimeString();
        window.claudeTracker.currentRound.model = modelName;
        window.claudeTracker.currentRound.user.chars = promptText.length;
        window.claudeTracker.currentRound.user.tokens = estimateTokens(promptText.length);
        
        console.log('');
        console.log('🟢 NEW ROUND STARTED...');
        console.log(`🤖 MODEL: ${modelName}`);
        console.log(`📤 USER message: ${promptText.length} chars (~${window.claudeTracker.currentRound.user.tokens} tokens)`);
        
        // === ENHANCED DEBUG: Request body inspection ===
        if (debugMode) {
          console.log('🐛 📦 REQUEST BODY KEYS:', Object.keys(body));
          const interestingFields = deepSearchObject(body);
          if (interestingFields.length > 0) {
            console.log('🐛 🔍 INTERESTING FIELDS IN REQUEST:');
            console.table(interestingFields);
          }
        }
        
        // === CHECK FOR DOCUMENTS ===
        let docChars = 0;
        let docCount = 0;
        
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
          
          if (docChars > 100000) {
            console.warn(`⚠️ Large document detected (${(docChars/1000).toFixed(0)}k chars) - will be cleared after processing`);
          }
        }
        
      } catch(e) {
        console.error('❌ Error parsing request body:', e);
        if (debugMode) {
          console.error('🐛 Full error:', e);
        }
      }
    }
  }
  
  // === CALL ORIGINAL FETCH ===
  const response = await _originalFetch(url, options);
  
  // === ENHANCED DEBUG: Response inspection ===
  if (debugMode) {
    console.log(`🐛 📥 RESPONSE STATUS: ${response.status} ${response.statusText}`);
    console.log(`🐛 📥 RESPONSE TYPE: ${response.type}`);
    
    const contentType = response.headers.get('content-type') || '';
    console.log(`🐛 📥 CONTENT-TYPE: ${contentType}`);
    
    // Try to read and inspect response body (but preserve it for actual use)
    if (contentType.includes('application/json')) {
      try {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();
        
        console.log('🐛 📦 RESPONSE BODY KEYS:', Object.keys(data));
        
        const interestingFields = deepSearchObject(data);
        if (interestingFields.length > 0) {
          console.log('🐛 🔍 INTERESTING FIELDS IN RESPONSE:');
          console.table(interestingFields);
        } else {
          console.log('🐛 ℹ️ No interesting fields found in response');
        }
      } catch(e) {
        console.log('🐛 ⚠️ Could not parse JSON response:', e.message);
      }
    }
    
    console.log('🐛 ═══════════════════════════════════════════════════');
    console.log('');
  }
  
  // === PROCESS COMPLETION RESPONSE ===
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
              
              // Search for interesting fields in SSE data
              const interestingFields = deepSearchObject(data);
              if (interestingFields.length > 0) {
                console.log('   🔍 Interesting fields in event:');
                console.table(interestingFields);
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
console.log('   - Model tracking & thinking detection');
console.log('   - DOM-based model detection');
console.log('   - Enhanced debug mode (all fetch URLs + response inspection)');
console.log('   - Document support (txt, pdf, etc.)');
console.log('   - Thinking + Assistant text counting');
console.log('   - Tool content tracking (files, artifacts)');
console.log('   - Memory optimized (texts cleared after processing)');
console.log('');
console.log('📌 Token estimation: chars / 2.6 (~3-5% accuracy)');
console.log('');
console.log('🎮 Available commands:');
console.log('   window.showAllRounds()   - Display all rounds in a table');
console.log('   window.showModelStats()  - Display model-specific statistics');
console.log('   window.exportJSON()      - Export data as JSON to clipboard');
console.log('   window.getTrackerURL()   - Generate blob URL for data');
console.log('   window.resetTracker()    - Reset all tracking data');
console.log('   window.enableDebug()     - Enable ENHANCED debug mode');
console.log('   window.disableDebug()    - Disable debug mode');
console.log('');
console.log('💬 Start chatting with Claude to track token usage!');
console.log('');