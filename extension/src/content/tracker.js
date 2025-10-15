/**
 * CLAUDE TOKEN TRACKER - MAIN CONTENT SCRIPT
 * Entry point that initializes all content script components
 */

console.log('');
console.log('🔍 === CLAUDE TOKEN TRACKER INITIALIZED ===');
console.log('');

// Initialize console spam filter
(async function initConsoleFilter() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.GET_SETTINGS
    });
    
    const settings = response.data || CONSTANTS.DEFAULTS;
    
    if (settings.consoleSpamFilter) {
      // Save original console methods
      const _originalConsoleLog = console.log;
      const _originalConsoleWarn = console.warn;
      const _originalConsoleError = console.error;
      const _originalConsoleInfo = console.info;
      const _originalConsoleDebug = console.debug;
      
      // Helper function to check if message should be filtered
      function shouldFilter(args) {
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
        
        return CONSTANTS.SPAM_PATTERNS.some(pattern => 
          message.toLowerCase().includes(pattern.toLowerCase())
        );
      }
      
      // Override console methods
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
      
      console.debug = function(...args) {
        if (!shouldFilter(args)) {
          _originalConsoleDebug.apply(console, args);
        }
      };
      
      console.log('✅ Console spam filter enabled');
    }
  } catch (error) {
    console.error('Error initializing console filter:', error);
  }
})();

// Display info
console.log('✅ Claude Token Tracker is active!');
console.log('');
console.log('📌 Features:');
console.log('   - Automatic token tracking per conversation');
console.log('   - Chat-based organization');
console.log('   - 4-hour and weekly usage limits');
console.log('   - Floating overlay widget');
console.log('   - Model detection & thinking tracking');
console.log('   - Customizable token estimation');
console.log('');
console.log('💬 Click the extension icon to view stats and settings');
console.log('');

// Export for debugging
window.claudeTokenTracker = {
  version: CONSTANTS.VERSION,
  constants: CONSTANTS,
  utils: Utils,
  apiObserver: ApiObserver,
  domObserver: DOMObserver,
  overlay: OverlayManager,
  
  // Helper functions for debugging
  async getSettings() {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.GET_SETTINGS
    });
    return response.data;
  },
  
  async getTimers() {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.GET_TIMER_STATUS
    });
    return response.data;
  },
  
  async getCurrentChat() {
    const chatInfo = Utils.extractChatInfo(window.location.href);
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.GET_CHAT_DATA,
      data: { chatId: chatInfo.id }
    });
    return response.data;
  },
  
  async exportData() {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.EXPORT_DATA
    });
    return response.data;
  },
  
  showOverlay() {
    OverlayManager.show();
  },
  
  hideOverlay() {
    OverlayManager.hide();
  }
};

console.log('🎮 Debug helpers available at window.claudeTokenTracker');
console.log('');