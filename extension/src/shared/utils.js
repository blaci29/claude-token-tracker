/**
 * CLAUDE TOKEN TRACKER - UTILITIES
 * Helper functions used across the extension
 */

const Utils = {
  
  /**
   * Generate a unique hash from a string
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  },
  
  /**
   * Extract chat ID from URL
   */
  extractChatInfo(url) {
    // Access CONSTANTS from global scope
    const CONST = (typeof CONSTANTS !== 'undefined') ? CONSTANTS : (typeof window !== 'undefined' ? window.CONSTANTS : self.CONSTANTS);
    
    const projectMatch = url.match(CONST.URL_PATTERNS.PROJECT);
    if (projectMatch) {
      return {
        id: projectMatch[2],
        type: CONST.CHAT_TYPES.PROJECT,
        url: url,
        projectId: projectMatch[1]
      };
    }
    
    const chatMatch = url.match(CONST.URL_PATTERNS.CHAT);
    if (chatMatch) {
      return {
        id: chatMatch[1],
        type: CONST.CHAT_TYPES.CHAT,
        url: url,
        projectId: null
      };
    }
    
    return {
      id: this.hashString(url),
      type: CONST.CHAT_TYPES.UNKNOWN,
      url: url,
      projectId: null
    };
  },
  
  /**
   * Format number with locale
   */
  formatNumber(num) {
    return num.toLocaleString('en-US');
  },
  
  /**
   * Format large numbers (k, M notation)
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
   */
  formatDateTime(timestamp) {
    return `${this.formatDate(timestamp)} ${this.formatTime(timestamp)}`;
  },
  
  /**
   * Calculate time remaining
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
   */
  getWeekStart(dayName = 'Monday', timeStr = '00:00') {
    const CONST = (typeof CONSTANTS !== 'undefined') ? CONSTANTS : (typeof window !== 'undefined' ? window.CONSTANTS : self.CONSTANTS);
    
    const now = new Date();
    const dayIndex = CONST.DAYS.indexOf(dayName);
    const currentDay = now.getDay();
    
    const currentDayMonday = currentDay === 0 ? 6 : currentDay - 1;
    const daysToSubtract = (currentDayMonday - dayIndex + 7) % 7;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToSubtract);
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    weekStart.setHours(hours, minutes, 0, 0);
    
    return weekStart;
  },
  
  /**
   * Deep clone object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  
  /**
   * Debounce function
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
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Utils = Utils;
}

if (typeof self !== 'undefined' && self !== window) {
  self.Utils = Utils;
}

if (typeof exports !== 'undefined') {
  exports.Utils = Utils;
}