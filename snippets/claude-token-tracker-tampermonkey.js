// ==UserScript==
// @name         Claude Token Tracker
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Real-time token usage tracking for Claude.ai with console spam filtering
// @author       You
// @match        https://claude.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

// ═══════════════════════════════════════════════════════════════════
// ⚙️ USER SETTINGS - CHANGE THESE AS NEEDED
// ═══════════════════════════════════════════════════════════════════

const SETTINGS = {
  // === DEBUG MODE ===
  // Enable debug mode on startup?
  DEBUG_MODE_ON_START: false,
  
  // === CONSOLE FILTERING ===
  // Hide Claude.ai's own console spam?
  HIDE_CLAUDE_CONSOLE_SPAM: true,
  
  // Spam patterns to filter out (case-insensitive)
CONSOLE_SPAM_PATTERNS: [
  'IsolatedSegment',
  'NOTIFICATION API DEBUG',
  'Violation',
  'Preferences fetched',
  'Intercom',
  'handler took',
  'Forced reflow',
  'honeycombio',
  'opentelemetry',
  'statsig',
  'Analytics loaded',
  'Message received',
  'sendMessage called',
  'Launcher is disabled',
  'iframe_ready',
  'segment_initialized',
  'Processing message',
  'Identify completed',
  'requestAnimationFrame',
  'setTimeout',
  'deterministic sampler'
],
  
  // === CENTRAL TOKEN ESTIMATION ===
  // Default chars per token ratio for ALL content types
  // Claude average: 2.6 chars/token (~3-5% accuracy)
  CHARS_PER_TOKEN: 2.6,
  
  // === DETAILED TOKEN ESTIMATION (OPTIONAL OVERRIDES) ===
  // Fine-tune estimation for different content types
  // If null, uses CHARS_PER_TOKEN (central setting)
  // 
  // 💡 FINE-TUNING GUIDE:
  // Different content types have different token densities:
  // 
  // 1. CODE (dense): 2.0-2.4 chars/token
  //    - Contains many symbols, brackets, operators
  //    - Recommended: thinking: 2.4, toolContent: 2.2
  // 
  // 2. NATURAL TEXT (normal): 2.6 chars/token
  //    - Regular conversation, explanations
  //    - Recommended: userMessage: 2.6, assistant: 2.6
  // 
  // 3. DOCUMENTS (sparse): 2.8-3.0 chars/token
  //    - PDFs, text files with formatting
  //    - Recommended: userDocuments: 2.8
  // 
  // 📊 HOW TO MEASURE YOUR OWN RATIOS:
  // 1. Send conversations to Claude API directly
  // 2. Compare actual token counts from API with character counts
  // 3. Calculate: chars / tokens = your ratio
  // 4. Set the values below for better accuracy!
  // 
  // 🔮 FUTURE: Chrome extension will auto-tune these values
  //    based on your actual API usage!
  
  TOKEN_ESTIMATION: {
    userMessage: null,      // User's text input (null = use central 2.6)
    userDocuments: null,    // Attached files/documents (null = use central 2.6)
    thinking: null,         // Claude's thinking process (null = use central 2.6)
    assistant: null,        // Claude's visible response (null = use central 2.6)
    toolContent: null,      // Artifacts, code files (null = use central 2.6)
  },
  
  // === OTHER SETTINGS ===
  
  // Large document warning threshold (in characters)
  LARGE_DOCUMENT_THRESHOLD: 100000,
  
  // Memory optimization: clear text content after saving round?
  CLEAR_TEXTS_AFTER_SAVE: true,
  
  // Delay before saving round (milliseconds)
  SAVE_DELAY_MS: 500,
  
  // Important endpoints for detailed debug logging
  IMPORTANT_ENDPOINTS: [
    '/completion',
    '/chat',
    '/model',
    '/chat_preferences'
  ]
};

// ═══════════════════════════════════════════════════════════════════
// END OF USER SETTINGS
// ═══════════════════════════════════════════════════════════════════

// === CONSOLE SPAM FILTER ===
// === CONSOLE SPAM FILTER (AGGRESSIVE MODE) ===
if (SETTINGS.HIDE_CLAUDE_CONSOLE_SPAM) {
  // Save original console methods
  const _originalConsoleLog = console.log;
  const _originalConsoleWarn = console.warn;
  const _originalConsoleError = console.error;
  const _originalConsoleInfo = console.info;
  
  // Helper function to check if message should be filtered
  function shouldFilter(args) {
    // Convert all arguments to strings
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch(e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    // Check against all spam patterns
    return SETTINGS.CONSOLE_SPAM_PATTERNS.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }
  
  // Override console methods with aggressive filtering
  console.log = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleLog.apply(console, args);
    }
  };
  
  console.warn = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleWarn.apply(console, args);
    }
  };
  
  console.error = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleError.apply(console, args);
    }
  };
  
  console.info = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleInfo.apply(console, args);
    }
  };
  
  // Also override console.debug
  const _originalConsoleDebug = console.debug;
  console.debug = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleDebug.apply(console, args);
    }
  };
}

console.clear();
console.log('');
console.log('🔍 === CLAUDE TOKEN TRACKER INITIALIZED (TAMPERMONKEY) ===');
console.log('');

// === DEBUG MODE ===
let debugMode = SETTINGS.DEBUG_MODE_ON_START;
let debugLog = []; // Store all debug entries

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

// === GET TOKEN ESTIMATION RATE FOR CONTENT TYPE ===
function getTokenEstimationRate(type) {
  // Check if there's a specific override for this type
  if (SETTINGS.TOKEN_ESTIMATION[type] !== null && SETTINGS.TOKEN_ESTIMATION[type] !== undefined) {
    return SETTINGS.TOKEN_ESTIMATION[type];
  }
  // Fall back to central setting
  return SETTINGS.CHARS_PER_TOKEN;
}

// === TOKEN ESTIMATION ===
function estimateTokens(chars, type = 'userMessage') {
  if (typeof chars === 'string') {
    chars = chars.length;
  }
  const rate = getTokenEstimationRate(type);
  return Math.ceil(chars / rate);
}

// === CHECK IF ENDPOINT IS IMPORTANT ===
function isImportantEndpoint(url) {
  return SETTINGS.IMPORTANT_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

// === ADD DEBUG LOG ENTRY ===
function addDebugLog(type, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    type: type,
    data: data
  };
  debugLog.push(entry);
}

// === DOM-BASED MODEL DETECTION ===
function detectModelFromDOM() {
  // PRIORITY 1: Model selector dropdown (most reliable)
  try {
    const modelButton = document.querySelector('[data-testid="model-selector-dropdown"] .whitespace-nowrap');
    if (modelButton) {
      const text = modelButton.textContent?.trim();
      if (text) {
        console.log(`🎯 Model detected from selector: "${text}"`);
        return text;
      }
    }
  } catch(e) {
    // Ignore
  }
  
  // FALLBACK: Try other selectors
  const fallbackSelectors = [
    '[class*="model-name"]',
    '.font-claude-response .whitespace-nowrap'
  ];
  
  for (const selector of fallbackSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const elem of elements) {
        const text = elem.textContent?.trim();
        // Check if it looks like a model name
        if (text && (
          text.includes('Sonnet') || 
          text.includes('Opus') || 
          text.includes('Haiku')
        )) {
          console.log(`🎯 Model detected from fallback: "${text}"`);
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
  console.log('   📦 Important endpoint responses will be inspected');
  console.log('   🔍 Automatic search for: token, usage, model, size, count');
  console.log('   📝 SSE events will be logged');
  console.log('');
  console.log('   Use window.disableDebug() to turn off');
  console.log('   Use window.saveDebugLog() to download debug log');
  console.log('   Use window.getDebugSummary() to see summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
};

window.disableDebug = function() {
  debugMode = false;
  console.log('');
  console.log('🔇 DEBUG MODE DISABLED');
  console.log('');
};

// === SAVE DEBUG LOG TO FILE ===
window.saveDebugLog = function() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `claude-tracker-debug-${timestamp}.txt`;
  
  let logText = '═══════════════════════════════════════════════════════\n';
  logText += 'CLAUDE TOKEN TRACKER - DEBUG LOG\n';
  logText += `Generated: ${new Date().toLocaleString()}\n`;
  logText += `Total entries: ${debugLog.length}\n`;
  logText += '═══════════════════════════════════════════════════════\n\n';
  
  debugLog.forEach((entry, index) => {
    logText += `\n[${index + 1}] ${entry.timestamp} - ${entry.type}\n`;
    logText += '─────────────────────────────────────────────────────\n';
    logText += JSON.stringify(entry.data, null, 2) + '\n';
  });
  
  const blob = new Blob([logText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('');
  console.log('✅ DEBUG LOG SAVED!');
  console.log(`📁 Filename: ${filename}`);
  console.log(`📊 Total entries: ${debugLog.length}`);
  console.log('');
};

// === GET DEBUG SUMMARY ===
window.getDebugSummary = function() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 DEBUG SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // Count by type
  const typeCounts = {};
  debugLog.forEach(entry => {
    typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
  });
  
  console.log('📈 Entries by type:');
  console.table(typeCounts);
  console.log('');
  
  // Find all interesting fields
  const allInterestingFields = {};
  debugLog.forEach(entry => {
    if (entry.data.interestingFields) {
      entry.data.interestingFields.forEach(field => {
        const key = `${field.path}`;
        if (!allInterestingFields[key]) {
          allInterestingFields[key] = {
            path: field.path,
            key: field.key,
            type: field.type,
            exampleValue: field.value,
            count: 0
          };
        }
        allInterestingFields[key].count++;
      });
    }
  });
  
  if (Object.keys(allInterestingFields).length > 0) {
    console.log('🔍 All interesting fields found:');
    console.table(Object.values(allInterestingFields));
  } else {
    console.log('ℹ️ No interesting fields found yet');
  }
  
  console.log('');
  console.log(`Total debug entries: ${debugLog.length}`);
  console.log('');
  console.log('💡 TIP: Use window.saveDebugLog() to download full log');
  console.log('═══════════════════════════════════════════════════════');
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
  const thinkingTokens = estimateTokens(thinkingChars, 'thinking');
  const assistantChars = round.assistant.text.length;
  const assistantTokens = estimateTokens(assistantChars, 'assistant');
  const toolChars = round.toolContent.text.length;
  const toolTokens = estimateTokens(toolChars, 'toolContent');
  
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
  if (SETTINGS.CLEAR_TEXTS_AFTER_SAVE) {
    window.claudeTracker.currentRound.thinking.text = '';
    window.claudeTracker.currentRound.assistant.text = '';
    window.claudeTracker.currentRound.toolContent.text = '';
  }
  
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
  
  const isImportant = isImportantEndpoint(url);
  
  // === LOG FETCH URL (always in debug mode) ===
  if (debugMode) {
    if (isImportant) {
      console.log('');
      console.log('🐛 ═══════════════════════════════════════════════════');
      console.log(`🐛 📡 IMPORTANT ENDPOINT: ${url}`);
      if (options.method) {
        console.log(`🐛 📤 METHOD: ${options.method}`);
      }
    } else {
      console.log(`🐛 📡 ${url}`);
    }
    
    addDebugLog('FETCH_REQUEST', {
      url: url,
      method: options.method || 'GET',
      important: isImportant
    });
  }
  
  // === INTERCEPT COMPLETION REQUESTS ===
  if (typeof url === 'string' && url.includes('/completion')) {
    
    if (options && options.body) {
      try {
        const body = JSON.parse(options.body);
        
        const promptText = body.prompt || '';
        
        // Model detection: Only from DOM (API doesn't provide it)
        let modelName = detectModelFromDOM();
        
        if (!modelName) {
          modelName = 'unknown';
        }
        
        // Start new round
        window.claudeTracker.currentRound.active = true;
        window.claudeTracker.currentRound.timestamp = new Date().toLocaleTimeString();
        window.claudeTracker.currentRound.model = modelName;
        window.claudeTracker.currentRound.user.chars = promptText.length;
        window.claudeTracker.currentRound.user.tokens = estimateTokens(promptText.length, 'userMessage');
        
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
          
          addDebugLog('COMPLETION_REQUEST', {
            model: modelName,
            promptLength: promptText.length,
            bodyKeys: Object.keys(body),
            interestingFields: interestingFields
          });
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
          window.claudeTracker.currentRound.documents.tokens = estimateTokens(docChars, 'userDocuments');
          window.claudeTracker.currentRound.documents.count = docCount;
          console.log(`📄 DOCUMENTS: ${docChars.toLocaleString()} chars (~${estimateTokens(docChars, 'userDocuments').toLocaleString()} tokens), ${docCount} file(s)`);
          
          if (docChars > SETTINGS.LARGE_DOCUMENT_THRESHOLD) {
            console.warn(`⚠️ Large document detected (${(docChars/1000).toFixed(0)}k chars) - will be cleared after processing`);
          }
        }
        
      } catch(e) {
        console.error('❌ Error parsing request body:', e);
        if (debugMode) {
          console.error('🐛 Full error:', e);
          addDebugLog('ERROR', {
            context: 'parsing request body',
            error: e.message
          });
        }
      }
    }
  }
  
  // === CALL ORIGINAL FETCH ===
  const response = await _originalFetch(url, options);
  
  // === ENHANCED DEBUG: Response inspection (only for important endpoints) ===
  if (debugMode && isImportant) {
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
          
          addDebugLog('RESPONSE_INTERESTING', {
            url: url,
            status: response.status,
            interestingFields: interestingFields
          });
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
                
                addDebugLog('SSE_EVENT_INTERESTING', {
                  eventType: data.type,
                  interestingFields: interestingFields
                });
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
              }, SETTINGS.SAVE_DELAY_MS);
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
console.log('   - Configurable token estimation per content type');
console.log('   - Console spam filtering (clean console!)');
console.log('   - Enhanced debug mode with endpoint filtering');
console.log('   - Debug log export to file');
console.log('   - Document support (txt, pdf, etc.)');
console.log('   - Memory optimized (texts cleared after processing)');
console.log('');
console.log('⚙️ CURRENT SETTINGS:');
console.log(`   Debug mode: ${SETTINGS.DEBUG_MODE_ON_START ? 'ON' : 'OFF'}`);
console.log(`   Console spam filtering: ${SETTINGS.HIDE_CLAUDE_CONSOLE_SPAM ? 'ON' : 'OFF'}`);
console.log(`   Central chars/token: ${SETTINGS.CHARS_PER_TOKEN}`);
console.log(`   Custom estimation:`);
console.log(`      User message: ${SETTINGS.TOKEN_ESTIMATION.userMessage || 'central'}`);
console.log(`      User documents: ${SETTINGS.TOKEN_ESTIMATION.userDocuments || 'central'}`);
console.log(`      Thinking: ${SETTINGS.TOKEN_ESTIMATION.thinking || 'central'}`);
console.log(`      Assistant: ${SETTINGS.TOKEN_ESTIMATION.assistant || 'central'}`);
console.log(`      Tool content: ${SETTINGS.TOKEN_ESTIMATION.toolContent || 'central'}`);
console.log('');
console.log('📌 Token estimation: chars / rate (default 2.6, ~3-5% accuracy)');
console.log('');
console.log('🎮 Available commands:');
console.log('   window.showAllRounds()   - Display all rounds in a table');
console.log('   window.showModelStats()  - Display model-specific statistics');
console.log('   window.exportJSON()      - Export data as JSON to clipboard');
console.log('   window.getTrackerURL()   - Generate blob URL for data');
console.log('   window.resetTracker()    - Reset all tracking data');
console.log('   window.enableDebug()     - Enable ENHANCED debug mode');
console.log('   window.disableDebug()    - Disable debug mode');
console.log('   window.saveDebugLog()    - Download debug log as file');
console.log('   window.getDebugSummary() - Show debug summary in console');
console.log('');
console.log('💬 Start chatting with Claude to track token usage!');
console.log('');

})();