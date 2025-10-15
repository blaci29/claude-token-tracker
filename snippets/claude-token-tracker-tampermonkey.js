// ==UserScript==
// @name         Claude Token Tracker
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Real-time token usage tracking for Claude.ai with image tracking, GitHub/Drive sync support & API-measured ratios
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
  // MEASURED WITH REAL API DATA:
  // - Code files (JavaScript, etc.): 3.19 chars/token
  // - Markdown documents: 3.19 chars/token
  // - Natural conversation: ~2.6 chars/token (default)
  CHARS_PER_TOKEN: 2.6,
  
  // === DETAILED TOKEN ESTIMATION (OPTIONAL OVERRIDES) ===
  // Fine-tune estimation for different content types
  // If null, uses CHARS_PER_TOKEN (central setting)
  // 
  // 💡 FINE-TUNING GUIDE:
  // Different content types have different token densities:
  // 
  // MEASURED WITH REAL API DATA (2025-10-15):
  // ==========================================
  // - JavaScript code: 56,586 chars → 17,717 tokens = 3.19 chars/token
  // - Markdown docs: 15,297 chars → 4,801 tokens = 3.19 chars/token
  // - Natural conversation: ~2.6 chars/token (Claude default)
  // 
  // KEY INSIGHT: Code and technical documents are LESS DENSE than natural text!
  // More characters needed per token because of:
  // - Variable names (camelCase, snake_case)
  // - Punctuation/symbols ({}, [], (), ;, etc.)
  // - Indentation/whitespace
  // - Code keywords (function, const, if, etc.)
  // 
  // RECOMMENDED SETTINGS:
  // 1. NATURAL TEXT: 2.6 chars/token
  //    - User messages, Claude responses
  // 
  // 2. CODE & DOCUMENTS: 3.2 chars/token
  //    - Attached files, GitHub/Drive files
  //    - Thinking (often code-heavy)
  //    - Tool content (artifacts, code blocks)
  // 
  // 📊 HOW TO MEASURE YOUR OWN RATIOS:
  // 1. Send content to Claude API directly
  // 2. Compare actual token counts from API with character counts
  // 3. Calculate: chars / tokens = your ratio
  // 4. Update values below for maximum accuracy!
  // 
  // 🔮 FUTURE: Chrome extension will auto-tune these values
  //    based on your actual API usage!
  
  TOKEN_ESTIMATION: {
    userMessage: null,      // User's text input (null = use central 2.6)
    userDocuments: 3.2,     // Attached files/documents (MEASURED: 3.19)
    thinking: 3.2,          // Claude's thinking (often code-heavy, MEASURED: 3.19)
    assistant: null,        // Claude's visible response (null = use central 2.6)
    toolContent: 3.2,       // Artifacts, code files (MEASURED: 3.19)
  },
  
  // === IMAGE TOKEN ESTIMATION ===
  IMAGE_TOKEN_ESTIMATION: {
    enabled: true,                    // Enable image token tracking?
    fallbackTokensPerImage: 1500,    // Fallback if size unknown (average: ~1400-1600)
    useAnthropicFormula: true,       // Use (width × height) / 750 when size available
    warnOnLargeImages: true,         // Warn if image > 1600 tokens
    largeImageThreshold: 1600,       // Threshold for "large image" warning
    fetchRetries: 3,                 // Number of retries for dimension fetch
    fetchRetryDelay: 500,            // Delay between retries (ms)
    fetchTimeout: 1000               // Initial delay before first fetch attempt (ms)
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

// === SYNC SOURCES STATE (GitHub, Google Drive, etc.) ===
// Stores the last known sync state from /sync/chat/ endpoints
let lastSyncSources = null;
let lastSyncTimestamp = null;

// === TRACKER STATE ===
window.claudeTracker = {
  global: {
    totalChars: 0,
    totalTokens: 0,
    totalUserChars: 0,
    totalUserTokens: 0,
    totalDocChars: 0,
    totalDocTokens: 0,
    totalImageTokens: 0,  // NEW!
    totalImageCount: 0,   // NEW!
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
    images: { count: 0, tokens: 0, estimated: true, details: [] }, // NEW!
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

// === IMAGE TOKEN ESTIMATION ===
function estimateImageTokens(width, height) {
  if (!SETTINGS.IMAGE_TOKEN_ESTIMATION.enabled) {
    return 0;
  }
  
  // If no dimensions, use fallback
  if (!width || !height) {
    return SETTINGS.IMAGE_TOKEN_ESTIMATION.fallbackTokensPerImage;
  }
  
  // Anthropic formula: (width × height) / 750
  // Images are resized if longest side > 1568px
  let finalWidth = width;
  let finalHeight = height;
  
  const maxDimension = Math.max(width, height);
  if (maxDimension > 1568) {
    const scale = 1568 / maxDimension;
    finalWidth = Math.round(width * scale);
    finalHeight = Math.round(height * scale);
  }
  
  const tokens = Math.round((finalWidth * finalHeight) / 750);
  
  // Warn if large image
  if (SETTINGS.IMAGE_TOKEN_ESTIMATION.warnOnLargeImages && tokens > SETTINGS.IMAGE_TOKEN_ESTIMATION.largeImageThreshold) {
    console.warn(`⚠️ Large image detected: ${width}×${height} → ${tokens} tokens (>${SETTINGS.IMAGE_TOKEN_ESTIMATION.largeImageThreshold})`);
  }
  
  return tokens;
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
function deepSearchObject(obj, searchKeys = ['token', 'usage', 'model', 'size', 'count', 'chars', 'image', 'media', 'width', 'height', 'base64', 'data', 'type', 'source'], path = '', results = []) {
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
      totalToolTokens: 0,
      totalImageTokens: 0,
      totalImageCount: 0
    };
  }
}

// === GET CONVERSATION ID FROM URL ===
function getConversationId() {
  const match = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

// === FETCH CONVERSATION DATA WITH RETRY ===
async function fetchConversationData(retries = SETTINGS.IMAGE_TOKEN_ESTIMATION.fetchRetries) {
  const conversationId = getConversationId();
  if (!conversationId) {
    throw new Error('Not in a chat conversation');
  }
  
  const orgId = '8a16f469-4329-4988-96da-c65439b48f0d';
  const url = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (debugMode) {
        console.log(`🐛 📡 Fetching conversation data (attempt ${attempt}/${retries})...`);
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.chat_messages || !Array.isArray(data.chat_messages)) {
        throw new Error('No chat_messages in response');
      }
      
      if (debugMode) {
        console.log(`🐛 ✅ Fetched ${data.chat_messages.length} messages`);
      }
      
      return data.chat_messages;
      
    } catch (error) {
      if (attempt < retries) {
        if (debugMode) {
          console.log(`🐛 ⚠️ Fetch failed (${error.message}), retrying in ${SETTINGS.IMAGE_TOKEN_ESTIMATION.fetchRetryDelay}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, SETTINGS.IMAGE_TOKEN_ESTIMATION.fetchRetryDelay));
      } else {
        if (debugMode) {
          console.log(`🐛 ❌ Fetch failed after ${retries} attempts: ${error.message}`);
        }
        throw error;
      }
    }
  }
}

// === UPDATE IMAGE DIMENSIONS FROM CHAT MESSAGES ===
function updateImageDimensionsFromMessages(chatMessages, round) {
  if (!round.images || round.images.count === 0) {
    return false;
  }
  
  // Get UUIDs from request (stored in details during Phase 1)
  const requestUuids = round.images.details.map(img => img.uuid);
  
  if (requestUuids.length === 0) {
    if (debugMode) {
      console.log('🐛 ⚠️ No UUIDs stored from request');
    }
    return false;
  }
  
  // Find matching images in chat_messages (search backwards for most recent)
  let updatedCount = 0;
  
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const message = chatMessages[i];
    
    if (!message.files || !Array.isArray(message.files)) continue;
    
    message.files.forEach((file, fileIndex) => {
      const fileUuid = file.uuid || file.file_uuid;
      
      // Find matching detail by UUID
      const detailIndex = round.images.details.findIndex(
        img => img.uuid === fileUuid
      );
      
      if (detailIndex !== -1 && file.preview_asset) {
        const detail = round.images.details[detailIndex];
        const width = file.preview_asset.image_width;
        const height = file.preview_asset.image_height;
        
        if (width && height) {
          // Update with actual dimensions
          detail.width = width;
          detail.height = height;
          detail.tokens = estimateImageTokens(width, height);
          detail.estimated = false;
          detail.messageUuid = message.uuid;
          detail.messageIndex = message.index;
          detail.fileIndex = fileIndex;
          detail.conversationId = getConversationId();
          
          updatedCount++;
          
          if (debugMode) {
            console.log(`🐛 ✅ UUID ${fileUuid}: ${width}×${height} = ${detail.tokens} tokens`);
          }
        }
      }
    });
    
    // If all images updated, break early
    if (updatedCount === requestUuids.length) break;
  }
  
  if (updatedCount > 0) {
    // Recalculate total tokens
    round.images.tokens = round.images.details.reduce((sum, img) => sum + img.tokens, 0);
    round.images.estimated = round.images.details.some(img => img.estimated);
    
    if (debugMode) {
      console.log(`🐛 📷 Updated ${updatedCount}/${requestUuids.length} images`);
    }
  }
  
  return updatedCount > 0;
}

// === SAVE ROUND (WITH ASYNC IMAGE DIMENSION FETCH) ===
async function saveRound() {
  const round = window.claudeTracker.currentRound;
  
  if (!round.active) return;
  
  // === PHASE 1: Try to fetch image dimensions if images present ===
  let imageFetchSuccess = false;
  if (round.images.count > 0 && round.images.estimated) {
    console.log('');
    console.log('🔄 Fetching image dimensions...');
    
    try {
      // Wait a bit for backend to process
      await new Promise(resolve => setTimeout(resolve, SETTINGS.IMAGE_TOKEN_ESTIMATION.fetchTimeout));
      
      const chatMessages = await fetchConversationData();
      imageFetchSuccess = updateImageDimensionsFromMessages(chatMessages, round);
      
      if (imageFetchSuccess) {
        console.log('✅ Image dimensions updated successfully!');
      } else {
        console.log('⚠️ Could not find image dimensions, using estimation');
      }
    } catch (error) {
      console.log(`⚠️ Image dimension fetch failed: ${error.message}`);
      console.log('   Using fallback estimation...');
      
      if (debugMode) {
        console.log('🐛 ❌ Full error:', error);
      }
    }
    console.log('');
  }
  
  // === PHASE 2: Calculate final tokens ===
  const thinkingChars = round.thinking.text.length;
  const thinkingTokens = estimateTokens(thinkingChars, 'thinking');
  const assistantChars = round.assistant.text.length;
  const assistantTokens = estimateTokens(assistantChars, 'assistant');
  const toolChars = round.toolContent.text.length;
  const toolTokens = estimateTokens(toolChars, 'toolContent');
  
  const hasThinking = thinkingChars > 0;
  
  const userSubtotalChars = round.user.chars + round.documents.chars;
  const userSubtotalTokens = round.user.tokens + round.documents.tokens + round.images.tokens;
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
    images: {
      count: round.images.count,
      tokens: round.images.tokens,
      estimated: round.images.estimated,
      details: round.images.details
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
  window.claudeTracker.global.totalImageTokens += round.images.tokens;
  window.claudeTracker.global.totalImageCount += round.images.count;
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
  modelStats.totalImageTokens += round.images.tokens;
  modelStats.totalImageCount += round.images.count;
  
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
    images: { count: 0, tokens: 0, estimated: true, details: [] },
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
  const globalUserTokens = g.totalUserTokens + g.totalDocTokens + g.totalImageTokens;
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
  
  if (round.images.count > 0) {
    const estimatedMarker = round.images.estimated ? '~' : '';
    const estimatedNote = round.images.estimated ? ' (estimated)' : '';
    console.log(`   Images (${round.images.count}): ${estimatedMarker}${round.images.tokens.toLocaleString()} tokens${estimatedNote}`);
    
    // Show per-image breakdown if details available
    if (round.images.details && round.images.details.length > 0 && !round.images.estimated) {
      round.images.details.forEach((img, idx) => {
        console.log(`      [${idx + 1}] ${img.width}×${img.height} = ${img.tokens.toLocaleString()} tokens`);
      });
    }
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
  if (g.totalImageCount > 0) {
    console.log(`      Images (${g.totalImageCount}): ~${g.totalImageTokens.toLocaleString()} tokens`);
  }
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
    if (stats.totalImageCount > 0) {
      console.log(`      Images (${stats.totalImageCount}): ~${stats.totalImageTokens.toLocaleString()} tokens`);
    }
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
      imageCount: stats.totalImageCount || 0,
      imageTokens: stats.totalImageTokens || 0,
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
      totalImageTokens: 0,
      totalImageCount: 0,
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

// === MANUAL IMAGE DIMENSION UPDATE ===
window.updateImageDimensions = async function() {
  const lastRound = window.claudeTracker.last;
  
  if (!lastRound) {
    console.error('❌ No rounds saved yet!');
    return;
  }
  
  if (!lastRound.images || lastRound.images.count === 0) {
    console.error('❌ Last round has no images!');
    return;
  }
  
  if (!lastRound.images.estimated) {
    console.log('ℹ️ Last round images already have precise dimensions');
    return;
  }
  
  console.log('🔄 Manually fetching image dimensions...');
  
  try {
    const chatMessages = await fetchConversationData();
    const updated = updateImageDimensionsFromMessages(chatMessages, lastRound);
    
    if (updated) {
      console.log('');
      console.log('✅ IMAGE DIMENSIONS UPDATED!');
      console.log(`   Round #${lastRound.roundNumber}`);
      console.log(`   Estimated: ~${lastRound.images.details[0].estimatedTokens * lastRound.images.count} tokens`);
      console.log(`   Actual: ${lastRound.images.tokens} tokens`);
      
      if (lastRound.images.details.length > 1) {
        console.log('   Per-image breakdown:');
        lastRound.images.details.forEach((img, idx) => {
          if (!img.estimated) {
            console.log(`   [${idx + 1}] ${img.width}×${img.height} = ${img.tokens.toLocaleString()} tokens`);
          }
        });
      }
      console.log('');
    } else {
      console.error('❌ Could not find matching images in conversation data');
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
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
          
          // === DEBUG: Detailed attachments/files inspection ===
          if (body.attachments && body.attachments.length > 0) {
            console.log('🐛 📎 ATTACHMENTS FOUND:', body.attachments.length);
            body.attachments.forEach((att, index) => {
              console.log(`🐛 📎 Attachment [${index}]:`, {
                keys: Object.keys(att),
                type: att.type,
                file_name: att.file_name,
                media_type: att.media_type,
                extracted_content_length: att.extracted_content?.length,
                content_length: att.content?.length
              });
            });
          }
          
          // === DEBUG: Check if sync_sources in body (shouldn't be, but log if found) ===
          if (body.sync_sources && body.sync_sources.length > 0) {
            console.log('🐛 🔗 SYNC SOURCES IN REQUEST BODY:', body.sync_sources.length);
            body.sync_sources.forEach((source, index) => {
              console.log(`🐛 🔗 Sync Source [${index}]:`, {
                type: source.type,
                current_size_bytes: source.status?.current_size_bytes,
                current_file_count: source.status?.current_file_count,
                filters: source.config?.filters
              });
            });
          }
          
          if (body.files && body.files.length > 0) {
            console.log('🐛 📄 FILES FOUND:', body.files.length);
            body.files.forEach((file, index) => {
              if (typeof file === 'string') {
                console.log(`🐛 📄 File [${index}]: UUID string = "${file}"`);
              } else {
                console.log(`🐛 📄 File [${index}]:`, {
                  keys: Object.keys(file),
                  type: file.type,
                  file_name: file.file_name,
                  media_type: file.media_type,
                  uuid: file.uuid || file.file_uuid || file.id,
                  extracted_content_length: file.extracted_content?.length,
                  content_length: file.content?.length
                });
                
                // ALWAYS log the ENTIRE file object for inspection
                console.log(`🐛 📄 File [${index}] FULL OBJECT:`, file);
              }
            });
          }
          
          addDebugLog('COMPLETION_REQUEST', {
            model: modelName,
            promptLength: promptText.length,
            bodyKeys: Object.keys(body),
            interestingFields: interestingFields
          });
        }
        
        // === CHECK FOR IMAGES ===
        let imageCount = 0;
        let imageTokens = 0;
        
        if (body.files && Array.isArray(body.files)) {
          imageCount = body.files.length;
          // Use fallback token estimation (we don't have dimensions yet)
          imageTokens = imageCount * SETTINGS.IMAGE_TOKEN_ESTIMATION.fallbackTokensPerImage;
          
          window.claudeTracker.currentRound.images.count = imageCount;
          window.claudeTracker.currentRound.images.tokens = imageTokens;
          window.claudeTracker.currentRound.images.estimated = true;
          
          // Store UUIDs and metadata for later matching
          // IMPORTANT: body.files can be either:
          //   - Array of strings (the UUIDs directly)
          //   - Array of objects with uuid/file_uuid/id properties
          window.claudeTracker.currentRound.images.details = body.files.map((file, index) => {
            let uuid;
            if (typeof file === 'string') {
              // File is already the UUID string
              uuid = file;
            } else {
              // File is an object, extract UUID
              uuid = file.uuid || file.file_uuid || file.id;
            }
            
            return {
              uuid: uuid,
              fileIndex: index,
              tokens: SETTINGS.IMAGE_TOKEN_ESTIMATION.fallbackTokensPerImage,
              estimatedTokens: SETTINGS.IMAGE_TOKEN_ESTIMATION.fallbackTokensPerImage,
              estimated: true,
              timestamp: new Date().toISOString(),
              conversationId: getConversationId(),
              // These will be filled later if fetch succeeds
              width: null,
              height: null,
              messageUuid: null,
              messageIndex: null,
              apiTokens: null,
              verifiedByApi: false,
              lastVerified: null,
              formula: 'fallback',
              resized: false,
              originalDimensions: { width: null, height: null }
            };
          });
          
          console.log(`📷 IMAGES: ${imageCount} × ~${SETTINGS.IMAGE_TOKEN_ESTIMATION.fallbackTokensPerImage} tk = ~${imageTokens.toLocaleString()} tokens (estimated)`);
          
          if (debugMode) {
            console.log('🐛 💡 Image dimensions will be fetched before round summary');
            console.log('🐛 📋 Stored UUIDs:', window.claudeTracker.currentRound.images.details.map(d => d.uuid));
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
        
        // === CHECK FOR SYNC SOURCES (GitHub, Google Drive) ===
        // Use cached sync state from last /sync/chat/ GET response
        if (lastSyncSources && lastSyncSources.length > 0) {
          console.log(`🔗 Using cached sync sources (${(Date.now() - lastSyncTimestamp) / 1000}s old)`);
          
          lastSyncSources.forEach((source) => {
            if (source.status && source.status.current_size_bytes) {
              const sourceBytes = source.status.current_size_bytes;
              const fileCount = source.status.current_file_count || 1;
              
              // Add to documents counter (bytes ≈ chars for text files)
              docChars += sourceBytes;
              docCount += fileCount;
              
              console.log(`🔗 SYNC SOURCE (${source.type}): ${sourceBytes.toLocaleString()} bytes, ${fileCount} file(s)`);
              
              if (debugMode) {
                console.log(`🐛 � Sync source details:`, {
                  type: source.type,
                  bytes: sourceBytes,
                  files: fileCount,
                  cacheAge: `${((Date.now() - lastSyncTimestamp) / 1000).toFixed(1)}s`
                });
              }
            }
          });
          
          // Clear sync cache after use (one-time use per round)
          lastSyncSources = null;
          lastSyncTimestamp = null;
        } else if (debugMode) {
          console.log('🐛 ℹ️ No cached sync sources available');
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
  
  // === INTERCEPT SYNC ENDPOINT RESPONSES (GitHub, Google Drive) ===
  if (typeof url === 'string' && url.includes('/sync/chat/') && options.method !== 'PUT') {
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();
        
        // Check if response has sync_sources data
        if (data.type && (data.type === 'github' || data.type === 'google_drive')) {
          // Store as array for consistency (even if single source)
          lastSyncSources = [data];
          lastSyncTimestamp = Date.now();
          
          console.log('');
          console.log('🔗 ═══════════════════════════════════════════════════');
          console.log(`🔗 SYNC STATE UPDATED: ${data.type}`);
          
          if (data.status && data.status.current_size_bytes) {
            const bytes = data.status.current_size_bytes;
            const files = data.status.current_file_count || 1;
            const tokens = estimateTokens(bytes, 'userDocuments');
            
            console.log(`   📊 Size: ${bytes.toLocaleString()} bytes (~${tokens.toLocaleString()} tokens with 3.2 ratio)`);
            console.log(`   📁 Files: ${files}`);
            console.log(`   ⏰ Cached for next completion request`);
            
            if (debugMode) {
              console.log('🐛 🔗 Full sync source data:', data);
            }
          }
          
          console.log('🔗 ═══════════════════════════════════════════════════');
          console.log('');
          
          if (debugMode) {
            addDebugLog('SYNC_STATE_CACHED', {
              type: data.type,
              bytes: data.status?.current_size_bytes,
              files: data.status?.current_file_count,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        if (debugMode) {
          console.log(`🐛 ⚠️ Could not parse sync response: ${e.message}`);
        }
      }
    }
  }
  
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
              
              // Call saveRound (which now handles image dimension fetch)
              setTimeout(() => {
                saveRound(); // Now async, handles everything
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
console.log('   - API-MEASURED token ratios (3.2 for code/docs, 2.6 for text)');
console.log('   - Image token tracking with Anthropic formula');
console.log('   - GitHub/Google Drive sync support (real-time tracking)');
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
console.log(`   Custom estimation (API-MEASURED):`);
console.log(`      User message: ${SETTINGS.TOKEN_ESTIMATION.userMessage || 'central (2.6)'}`);
console.log(`      User documents: ${SETTINGS.TOKEN_ESTIMATION.userDocuments || 'central (2.6)'} ✓ MEASURED`);
console.log(`      Thinking: ${SETTINGS.TOKEN_ESTIMATION.thinking || 'central (2.6)'} ✓ MEASURED`);
console.log(`      Assistant: ${SETTINGS.TOKEN_ESTIMATION.assistant || 'central (2.6)'}`);
console.log(`      Tool content: ${SETTINGS.TOKEN_ESTIMATION.toolContent || 'central (2.6)'} ✓ MEASURED`);
console.log(`   Image tracking: ${SETTINGS.IMAGE_TOKEN_ESTIMATION.enabled ? 'ON' : 'OFF'}`);
if (SETTINGS.IMAGE_TOKEN_ESTIMATION.enabled) {
  console.log(`      Formula: ${SETTINGS.IMAGE_TOKEN_ESTIMATION.useAnthropicFormula ? 'Anthropic (w×h)/750' : 'Fallback only'}`);
  console.log(`      Fallback: ${SETTINGS.IMAGE_TOKEN_ESTIMATION.fallbackTokensPerImage} tokens/image`);
  console.log(`      Auto-fetch: YES (${SETTINGS.IMAGE_TOKEN_ESTIMATION.fetchTimeout}ms delay, ${SETTINGS.IMAGE_TOKEN_ESTIMATION.fetchRetries}× retry)`);
}
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
console.log('   window.updateImageDimensions() - Manually fetch image dimensions for current chat');
console.log('');
console.log('💬 Start chatting with Claude to track token usage!');
console.log('');

})();