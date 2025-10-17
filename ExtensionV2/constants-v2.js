// ═══════════════════════════════════════════════════════════════════
// Claude Token Tracker v2.0 - Constants
// ═══════════════════════════════════════════════════════════════════

const TRACKER_V2_CONSTANTS = {
  // ===== VERSION INFO =====
  VERSION: '2.0.0',
  STORAGE_KEY_PREFIX: 'claude_tracker_v2_',
  
  // ===== TOKEN ESTIMATION RATIOS =====
  // Based on real API measurements (v1.6 research)
  TOKEN_RATIOS: {
    thinking: 3.2,        // Code-like, technical reasoning
    text: 2.6,            // Natural language
    tool_content: 3.2,    // JSON, code in artifacts
    user_message: 2.6,    // Natural language
    documents: 3.2,       // Files (typically code/technical)
    default: 2.6          // Fallback
  },
  
  // ===== API ENDPOINTS =====
  API_ENDPOINTS: {
    // Chat
    CHAT_CONVERSATIONS: '/api/organizations/{orgId}/chat_conversations',
    CHAT_DETAIL: '/api/organizations/{orgId}/chat_conversations/{chatId}',
    COMPLETION: '/api/organizations/{orgId}/chat_conversations/{chatId}/completion',
    
    // Projects
    PROJECT_DETAIL: '/api/organizations/{orgId}/projects/{projectId}',
    
    // Sync
    SYNC_CHAT: '/api/organizations/{orgId}/sync/chat',
    SYNC_GITHUB_TREE: '/api/organizations/{orgId}/sync/github/repo/{owner}/{repo}/tree/{branch}',
    
    // Account
    ACCOUNT_PROFILE: '/api/account_profile',
    ORGANIZATION_DETAIL: '/api/organizations/{orgId}'
  },
  
  // ===== STORAGE KEYS =====
  STORAGE_KEYS: {
    VERSION: 'version',
    USER: 'user',
    ORGANIZATIONS: 'organizations',
    PROJECTS: 'projects',
    CHATS: 'chats',
    MESSAGES: 'messages',
    INITIALIZED_AT: 'initialized_at'
  },
  
  // ===== GITHUB CACHE =====
  GITHUB_CACHE: {
    TTL_DAYS: 7,
    KEY_FORMAT: '{owner}/{repo}/{branch}'
  },
  
  // ===== VIRTUAL PROJECT =====
  VIRTUAL_PROJECT_ID: '_no_project',
  
  // ===== MESSAGE SETTINGS =====
  MESSAGE: {
    FETCH_DELAY_MS: 2000,  // Delay after SSE completion before fetching final data
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000
  },
  
  // ===== DEBUG SETTINGS =====
  DEBUG: {
    ENABLED: true,
    LOG_FETCH: false,        // Log all fetch calls
    LOG_STORAGE: false,      // Log storage operations
    LOG_TRACKING: true,      // Log tracking events
    LOG_ERRORS: true         // Log errors
  },
  
  // ===== CONSOLE OUTPUT =====
  CONSOLE: {
    PREFIX: '🔍 TrackerV2:',
    COLORS: {
      info: '#3498db',
      success: '#2ecc71',
      warning: '#f39c12',
      error: '#e74c3c',
      debug: '#95a5a6'
    }
  }
};

// ===== HELPER FUNCTIONS =====

/**
 * Get token ratio for content type
 */
function getTokenRatio(contentType) {
  return TRACKER_V2_CONSTANTS.TOKEN_RATIOS[contentType] 
    || TRACKER_V2_CONSTANTS.TOKEN_RATIOS.default;
}

/**
 * Estimate tokens from character count
 */
function estimateTokens(chars, contentType = 'default') {
  if (typeof chars === 'string') {
    chars = chars.length;
  }
  const ratio = getTokenRatio(contentType);
  return Math.ceil(chars / ratio);
}

/**
 * Calculate duration in seconds between timestamps
 */
function calculateDuration(startTimestamp, stopTimestamp) {
  if (!startTimestamp || !stopTimestamp) return 0;
  
  const start = new Date(startTimestamp).getTime();
  const stop = new Date(stopTimestamp).getTime();
  
  return (stop - start) / 1000;
}

/**
 * Build API endpoint URL
 */
function buildEndpoint(endpoint, params = {}) {
  let url = TRACKER_V2_CONSTANTS.API_ENDPOINTS[endpoint];
  
  if (!url) return null;
  
  // Replace placeholders
  Object.keys(params).forEach(key => {
    url = url.replace(`{${key}}`, params[key]);
  });
  
  return url;
}

/**
 * Normalize GitHub path (ensure leading slash)
 */
function normalizeGithubPath(path) {
  return path.startsWith('/') ? path : '/' + path;
}

/**
 * Generate GitHub cache key
 */
function getGithubCacheKey(owner, repo, branch) {
  return `${owner}/${repo}/${branch}`;
}

/**
 * Console logger with styling
 */
const logger = {
  log(message, data = null, type = 'info') {
    if (!TRACKER_V2_CONSTANTS.DEBUG.ENABLED) return;
    
    const color = TRACKER_V2_CONSTANTS.CONSOLE.COLORS[type];
    const prefix = TRACKER_V2_CONSTANTS.CONSOLE.PREFIX;
    
    console.log(`%c${prefix} ${message}`, `color: ${color}; font-weight: bold`, data || '');
  },
  
  info(message, data) {
    this.log(message, data, 'info');
  },
  
  success(message, data) {
    this.log(message, data, 'success');
  },
  
  warning(message, data) {
    this.log(message, data, 'warning');
  },
  
  error(message, data) {
    if (TRACKER_V2_CONSTANTS.DEBUG.LOG_ERRORS) {
      this.log(message, data, 'error');
    }
  },
  
  debug(message, data) {
    this.log(message, data, 'debug');
  }
};

// Export for ES6 modules (service worker)
export {
  TRACKER_V2_CONSTANTS,
  getTokenRatio,
  estimateTokens,
  calculateDuration,
  buildEndpoint,
  normalizeGithubPath,
  getGithubCacheKey,
  logger
};

// Export for content script (global scope)
if (typeof window !== 'undefined') {
  window.TRACKER_V2_CONSTANTS = TRACKER_V2_CONSTANTS;
  window.TrackerV2Utils = {
    getTokenRatio,
    estimateTokens,
    calculateDuration,
    buildEndpoint,
    normalizeGithubPath,
    getGithubCacheKey,
    logger
  };
}