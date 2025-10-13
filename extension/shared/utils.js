/**
 * CLAUDE TOKEN TRACKER - UTILITIES
 * Helper functions used across the extension
 */

const Utils = {
  
  /**
   * Generate a unique hash from a string (simple implementation)
   * @param {string} str - Input string
   * @returns {string} - Hash string
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  },
  
  /**
   * Extract chat ID from URL
   * @param {string} url - Claude.ai URL
   * @returns {object} - {id, type, url}
   */
  extractChatInfo(url) {
    // Project chat: /project/{projectId}/chat/{chatId}
    const projectMatch = url.match(CONSTANTS.URL_PATTERNS.PROJECT);
    if (projectMatch) {
      return {
        id: projectMatch[2], // chatId
        type: CONSTANTS.CHAT_TYPES.PROJECT,
        url: url,
        projectId: projectMatch[1]
      };
    }
    
    // Regular chat: /chat/{chatId}
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
  
  /**
   * Format number with locale
   * @param {number} num - Number to format
   * @returns {string} - Formatted number
   */
  formatNumber(num) {
    return num.toLocaleString('en-US');
  },
  
  /**
   * Format large numbers (k, M notation)
   * @param {number} num - Number to format
   * @returns {string} - Formatted number
   */
  formatLargeNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  },
  
  /**
   * Format timestamp to readable string
   * @param {string|number} timestamp - ISO string or timestamp
   * @returns {string} - Formatted time
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  },
  
  /**
   * Format date to readable string
   * @param {string|number} timestamp - ISO string or timestamp
   * @returns {string} - Formatted date
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  },
  
  /**
   * Format date and time
   * @param {string|number} timestamp - ISO string or timestamp
   * @returns {string} - Formatted datetime
   */
  formatDateTime(timestamp) {
    return `${this.formatDate(timestamp)} ${this.formatTime(timestamp)}`;
  },
  
  /**
   * Calculate time remaining
   * @param {string} endTime - ISO timestamp
   * @returns {object} - {hours, minutes, seconds, total}
   */
  getTimeRemaining(endTime) {
    const total = Date.parse(endTime) - Date.now();
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    
    return {
      total,
      days,
      hours,
      minutes,
      seconds
    };
  },
  
  /**
   * Format time remaining as human readable
   * @param {string} endTime - ISO timestamp
   * @returns {string} - e.g. "2h 15m"
   */
  formatTimeRemaining(endTime) {
    const remaining = this.getTimeRemaining(endTime);
    
    if (remaining.total <= 0) {
      return 'Expired';
    }
    
    if (remaining.days > 0) {
      return `${remaining.days}d ${remaining.hours}h`;
    }
    
    if (remaining.hours > 0) {
      return `${remaining.hours}h ${remaining.minutes}m`;
    }
    
    if (remaining.minutes > 0) {
      return `${remaining.minutes}m ${remaining.seconds}s`;
    }
    
    return `${remaining.seconds}s`;
  },
  
  /**
   * Get start of current week
   * @param {string} dayName - Day name (e.g., 'Monday')
   * @param {string} timeStr - Time string (e.g., '00:00')
   * @returns {Date} - Start of week
   */
  getWeekStart(dayName = 'Monday', timeStr = '00:00') {
    const now = new Date();
    const dayIndex = CONSTANTS.DAYS.indexOf(dayName);
    const currentDay = now.getDay(); // 0 = Sunday
    
    // Convert to Monday = 0 system
    const currentDayMonday = currentDay === 0 ? 6 : currentDay - 1;
    const daysToSubtract = (currentDayMonday - dayIndex + 7) % 7;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToSubtract);
    
    // Set time
    const [hours, minutes] = timeStr.split(':').map(Number);
    weekStart.setHours(hours, minutes, 0, 0);
    
    return weekStart;
  },
  
  /**
   * Deep clone object
   * @param {object} obj - Object to clone
   * @returns {object} - Cloned object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  
  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function} - Debounced function
   */
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
  
  /**
   * Wait for element to appear in DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Element>} - Found element
   */
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
  
  /**
   * Safe JSON parse
   * @param {string} str - JSON string
   * @param {*} fallback - Fallback value
   * @returns {*} - Parsed object or fallback
   */
  safeJSONParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  },
  
  /**
   * Generate UUID v4
   * @returns {string} - UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}