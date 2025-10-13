/**
 * INLINE VERSION FOR CONTENT SCRIPTS
 */

const Utils = {
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  },
  
  extractChatInfo(url) {
    const projectMatch = url.match(CONSTANTS.URL_PATTERNS.PROJECT);
    if (projectMatch) {
      return {
        id: projectMatch[2],
        type: CONSTANTS.CHAT_TYPES.PROJECT,
        url: url,
        projectId: projectMatch[1]
      };
    }
    
    const chatMatch = url.match(CONSTANTS.URL_PATTERNS.CHAT);
    if (chatMatch) {
      return {
        id: chatMatch[1],
        type: CONSTANTS.CHAT_TYPES.CHAT,
        url: url,
        projectId: null
      };
    }
    
    return {
      id: this.hashString(url),
      type: CONSTANTS.CHAT_TYPES.UNKNOWN,
      url: url,
      projectId: null
    };
  },
  
  formatNumber(num) {
    return num.toLocaleString('en-US');
  },
  
  formatLargeNumber(num) {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    num = Number(num);
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },
  
  formatTime(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // Format as date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  },
  
  safeJSONParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }
};