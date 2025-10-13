/**
 * CLAUDE TOKEN TRACKER - STORAGE MANAGER
 * Handles all chrome.storage.local operations
 */

const StorageManager = {
  
  /**
   * Initialize storage with defaults
   */
  async initialize() {
    try {
      const result = await chrome.storage.local.get(null);
      
      // Check if this is first run
      if (!result[CONSTANTS.STORAGE_KEYS.VERSION]) {
        console.log('First run - initializing storage with defaults');
        
        await chrome.storage.local.set({
          [CONSTANTS.STORAGE_KEYS.VERSION]: CONSTANTS.VERSION,
          [CONSTANTS.STORAGE_KEYS.CHATS]: {},
          [CONSTANTS.STORAGE_KEYS.TIMERS]: {
            fourHour: {
              enabled: false,
              startTime: null,
              endTime: null,
              tokens: 0,
              rounds: []
            },
            weekly: {
              enabled: false,
              weekStartDay: CONSTANTS.DEFAULTS.weekStartDay,
              weekStartTime: CONSTANTS.DEFAULTS.weekStartTime,
              currentWeekStart: null,
              tokens: 0,
              rounds: []
            }
          },
          [CONSTANTS.STORAGE_KEYS.SETTINGS]: CONSTANTS.DEFAULTS
        });
        
        console.log('Storage initialized successfully');
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing storage:', error);
      return false;
    }
  },
  
  /**
   * Get all chats
   * @returns {Promise<object>} - Chats object
   */
  async getChats() {
    try {
      const result = await chrome.storage.local.get(CONSTANTS.STORAGE_KEYS.CHATS);
      return result[CONSTANTS.STORAGE_KEYS.CHATS] || {};
    } catch (error) {
      console.error('Error getting chats:', error);
      return {};
    }
  },
  
  /**
   * Get a specific chat by ID
   * @param {string} chatId - Chat ID
   * @returns {Promise<object|null>} - Chat object or null
   */
  async getChat(chatId) {
    try {
      const chats = await this.getChats();
      return chats[chatId] || null;
    } catch (error) {
      console.error('Error getting chat:', error);
      return null;
    }
  },
  
  /**
   * Save or update a chat
   * @param {string} chatId - Chat ID
   * @param {object} chatData - Chat data
   * @returns {Promise<boolean>} - Success status
   */
  async saveChat(chatId, chatData) {
    try {
      const chats = await this.getChats();
      chats[chatId] = chatData;
      
      await chrome.storage.local.set({
        [CONSTANTS.STORAGE_KEYS.CHATS]: chats
      });
      
      return true;
    } catch (error) {
      console.error('Error saving chat:', error);
      return false;
    }
  },
  
  /**
   * Delete a chat
   * @param {string} chatId - Chat ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteChat(chatId) {
    try {
      const chats = await this.getChats();
      delete chats[chatId];
      
      await chrome.storage.local.set({
        [CONSTANTS.STORAGE_KEYS.CHATS]: chats
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  },
  
  /**
   * Get timers
   * @returns {Promise<object>} - Timers object
   */
  async getTimers() {
    try {
      const result = await chrome.storage.local.get(CONSTANTS.STORAGE_KEYS.TIMERS);
      return result[CONSTANTS.STORAGE_KEYS.TIMERS] || {
        fourHour: { enabled: false, tokens: 0, rounds: [] },
        weekly: { enabled: false, tokens: 0, rounds: [] }
      };
    } catch (error) {
      console.error('Error getting timers:', error);
      return {
        fourHour: { enabled: false, tokens: 0, rounds: [] },
        weekly: { enabled: false, tokens: 0, rounds: [] }
      };
    }
  },
  
  /**
   * Save timers
   * @param {object} timers - Timers object
   * @returns {Promise<boolean>} - Success status
   */
  async saveTimers(timers) {
    try {
      await chrome.storage.local.set({
        [CONSTANTS.STORAGE_KEYS.TIMERS]: timers
      });
      return true;
    } catch (error) {
      console.error('Error saving timers:', error);
      return false;
    }
  },
  
  /**
   * Get settings
   * @returns {Promise<object>} - Settings object
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(CONSTANTS.STORAGE_KEYS.SETTINGS);
      return result[CONSTANTS.STORAGE_KEYS.SETTINGS] || CONSTANTS.DEFAULTS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return CONSTANTS.DEFAULTS;
    }
  },
  
  /**
   * Save settings
   * @param {object} settings - Settings object
   * @returns {Promise<boolean>} - Success status
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({
        [CONSTANTS.STORAGE_KEYS.SETTINGS]: settings
      });
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  },
  
  /**
   * Get all data (for export)
   * @returns {Promise<object>} - All data
   */
  async getAllData() {
    try {
      const result = await chrome.storage.local.get(null);
      return result;
    } catch (error) {
      console.error('Error getting all data:', error);
      return {};
    }
  },
  
  /**
   * Import data (overwrite all)
   * @param {object} data - Data to import
   * @returns {Promise<boolean>} - Success status
   */
  async importData(data) {
    try {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  },
  
  /**
   * Reset all data
   * @returns {Promise<boolean>} - Success status
   */
  async resetAll() {
    try {
      await chrome.storage.local.clear();
      await this.initialize();
      return true;
    } catch (error) {
      console.error('Error resetting data:', error);
      return false;
    }
  },
  
  /**
   * Get storage usage
   * @returns {Promise<object>} - {bytesInUse, quota}
   */
  async getUsage() {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse(null);
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      return {
        bytesInUse,
        quota,
        percentage: (bytesInUse / quota * 100).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { bytesInUse: 0, quota: 0, percentage: 0 };
    }
  }
};

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}