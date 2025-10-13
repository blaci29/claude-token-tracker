/**
 * INLINE VERSION FOR CONTENT SCRIPTS
 * This is a non-module version that creates global variables
 */

const CONSTANTS = {
  VERSION: '1.0.0',
  NAME: 'Claude Token Tracker',
  
  DEFAULTS: {
    trackingEnabled: true,
    tokenEstimation: {
      central: 2.6,
      overrides: {
        userMessage: null,
        userDocuments: 2.8,
        thinking: 2.4,
        assistant: null,
        toolContent: 2.2
      }
    },
    consoleSpamFilter: true,
    debugMode: false,
    overlayEnabled: false,
    overlayPosition: { x: 20, y: 100 },
    warningThresholds: { fourHour: 0.9, weekly: 0.9 },
    estimatedLimits: { fourHour: 50000, weekly: 200000 },
    weekStartDay: 'Monday',
    weekStartTime: '00:00'
  },
  
  SPAM_PATTERNS: [
    'IsolatedSegment', 'NOTIFICATION API DEBUG', 'Violation', 'Preferences fetched',
    'Intercom', 'handler took', 'Forced reflow', 'honeycombio', 'opentelemetry',
    'statsig', 'Analytics loaded', 'Message received', 'sendMessage called',
    'Launcher is disabled', 'iframe_ready', 'segment_initialized',
    'Processing message', 'Identify completed', 'requestAnimationFrame',
    'setTimeout', 'deterministic sampler'
  ],
  
  ENDPOINTS: {
    COMPLETION: '/completion',
    CHAT: '/chat',
    MODEL: '/model',
    PREFERENCES: '/chat_preferences'
  },
  
  IMPORTANT_ENDPOINTS: ['/completion', '/chat', '/model', '/chat_preferences'],
  
  URL_PATTERNS: {
    CHAT: /\/chat\/([a-zA-Z0-9-]+)/,
    PROJECT: /\/project\/([a-zA-Z0-9-]+)\/chat\/([a-zA-Z0-9-]+)/
  },
  
  SELECTORS: {
    MODEL_BUTTON: '[data-testid="model-selector-dropdown"] .whitespace-nowrap',
    CHAT_TITLE: '[data-testid="chat-title"]',
    MESSAGE_CONTAINER: '[data-testid="message-container"]'
  },
  
  MSG_TYPES: {
    ROUND_COMPLETED: 'ROUND_COMPLETED',
    GET_CHAT_DATA: 'GET_CHAT_DATA',
    GET_GLOBAL_STATS: 'GET_GLOBAL_STATS',
    GET_TIMER_STATUS: 'GET_TIMER_STATUS',
    RESET_TIMER: 'RESET_TIMER',
    SET_TIMER_END: 'SET_TIMER_END',
    TOGGLE_TRACKING: 'TOGGLE_TRACKING',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    EXPORT_DATA: 'EXPORT_DATA',
    DELETE_CHAT: 'DELETE_CHAT',
    RESET_ALL_DATA: 'RESET_ALL_DATA',
    GET_SETTINGS: 'GET_SETTINGS',
    TOGGLE_OVERLAY: 'TOGGLE_OVERLAY',
    UPDATE_OVERLAY: 'UPDATE_OVERLAY'
  },
  
  STORAGE_KEYS: { CHATS: 'chats', TIMERS: 'timers', SETTINGS: 'settings', VERSION: 'version' },
  TIMER_TYPES: { FOUR_HOUR: 'fourHour', WEEKLY: 'weekly' },
  CHAT_TYPES: { PROJECT: 'project', CHAT: 'chat', UNKNOWN: 'unknown' },
  LARGE_DOCUMENT_THRESHOLD: 100000,
  SAVE_DELAY_MS: 500,
  DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
};