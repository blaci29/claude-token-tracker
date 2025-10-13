/**
 * CLAUDE TOKEN TRACKER - TIMER MANAGER
 * Manages 4-hour and weekly usage timers
 */

const TimerManager = {
  
  /**
   * Start 4-hour timer
   * @param {string} endTime - Optional end time (ISO format)
   * @returns {Promise<object>} - Updated timer
   */
  async start4HourTimer(endTime = null) {
    try {
      const timers = await StorageManager.getTimers();
      const now = new Date().toISOString();
      
      // If no end time provided, set it to 4 hours from now
      const calculatedEndTime = endTime || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      
      timers.fourHour = {
        enabled: true,
        startTime: now,
        endTime: calculatedEndTime,
        tokens: 0,
        rounds: []
      };
      
      await StorageManager.saveTimers(timers);
      
      console.log('4-hour timer started:', timers.fourHour);
      
      return timers.fourHour;
    } catch (error) {
      console.error('Error starting 4-hour timer:', error);
      return null;
    }
  },
  
  /**
   * Reset 4-hour timer
   * @returns {Promise<object>} - Updated timer
   */
  async reset4HourTimer() {
    return await this.start4HourTimer();
  },
  
  /**
   * Set 4-hour timer end time
   * @param {string} endTime - End time (ISO format)
   * @returns {Promise<object>} - Updated timer
   */
  async set4HourTimerEnd(endTime) {
    try {
      const timers = await StorageManager.getTimers();
      
      if (!timers.fourHour.enabled) {
        // If not running, start it with this end time
        return await this.start4HourTimer(endTime);
      }
      
      timers.fourHour.endTime = endTime;
      await StorageManager.saveTimers(timers);
      
      console.log('4-hour timer end time updated:', endTime);
      
      return timers.fourHour;
    } catch (error) {
      console.error('Error setting 4-hour timer end:', error);
      return null;
    }
  },
  
  /**
   * Start weekly timer
   * @returns {Promise<object>} - Updated timer
   */
  async startWeeklyTimer() {
    try {
      const timers = await StorageManager.getTimers();
      const settings = await StorageManager.getSettings();
      
      const weekStart = Utils.getWeekStart(
        settings.weekStartDay || 'Monday',
        settings.weekStartTime || '00:00'
      );
      
      timers.weekly = {
        enabled: true,
        weekStartDay: settings.weekStartDay || 'Monday',
        weekStartTime: settings.weekStartTime || '00:00',
        currentWeekStart: weekStart.toISOString(),
        tokens: 0,
        rounds: []
      };
      
      await StorageManager.saveTimers(timers);
      
      console.log('Weekly timer started:', timers.weekly);
      
      return timers.weekly;
    } catch (error) {
      console.error('Error starting weekly timer:', error);
      return null;
    }
  },
  
  /**
   * Reset weekly timer
   * @returns {Promise<object>} - Updated timer
   */
  async resetWeeklyTimer() {
    return await this.startWeeklyTimer();
  },
  
  /**
   * Add round to timers
   * @param {string} chatId - Chat ID
   * @param {number} roundNumber - Round number
   * @param {number} tokens - Token count
   * @returns {Promise<boolean>} - Success status
   */
  async addRoundToTimers(chatId, roundNumber, tokens) {
    try {
      const timers = await StorageManager.getTimers();
      
      const roundRef = {
        chatId,
        roundNumber,
        tokens,
        timestamp: new Date().toISOString()
      };
      
      // Add to 4-hour timer if enabled
      if (timers.fourHour.enabled) {
        timers.fourHour.rounds.push(roundRef);
        timers.fourHour.tokens += tokens;
        
        // Check if expired
        if (timers.fourHour.endTime && Date.now() > Date.parse(timers.fourHour.endTime)) {
          console.log('4-hour timer expired');
          // Optionally auto-reset or notify
        }
      }
      
      // Add to weekly timer if enabled
      if (timers.weekly.enabled) {
        // Check if we need to reset weekly timer
        const weekStart = Utils.getWeekStart(
          timers.weekly.weekStartDay,
          timers.weekly.weekStartTime
        );
        
        if (weekStart.getTime() > Date.parse(timers.weekly.currentWeekStart)) {
          console.log('Week changed - resetting weekly timer');
          await this.resetWeeklyTimer();
          // Re-get timers after reset
          const updatedTimers = await StorageManager.getTimers();
          updatedTimers.weekly.rounds.push(roundRef);
          updatedTimers.weekly.tokens += tokens;
          await StorageManager.saveTimers(updatedTimers);
        } else {
          timers.weekly.rounds.push(roundRef);
          timers.weekly.tokens += tokens;
          await StorageManager.saveTimers(timers);
        }
      } else {
        await StorageManager.saveTimers(timers);
      }
      
      // Check warning thresholds
      await this.checkWarnings(timers);
      
      return true;
    } catch (error) {
      console.error('Error adding round to timers:', error);
      return false;
    }
  },
  
  /**
   * Check warning thresholds and send notifications
   * @param {object} timers - Timers object
   */
  async checkWarnings(timers) {
    try {
      const settings = await StorageManager.getSettings();
      
      // Check 4-hour timer
      if (timers.fourHour.enabled) {
        const fourHourLimit = settings.estimatedLimits?.fourHour || 50000;
        const fourHourThreshold = settings.warningThresholds?.fourHour || 0.9;
        const fourHourPercentage = timers.fourHour.tokens / fourHourLimit;
        
        if (fourHourPercentage >= fourHourThreshold && fourHourPercentage < 1) {
          this.sendWarningNotification(
            '4-Hour Limit Warning',
            `You've used ${(fourHourPercentage * 100).toFixed(0)}% of your estimated 4-hour token limit.`
          );
        } else if (fourHourPercentage >= 1) {
          this.sendWarningNotification(
            '4-Hour Limit Exceeded',
            'You have exceeded your estimated 4-hour token limit.'
          );
        }
      }
      
      // Check weekly timer
      if (timers.weekly.enabled) {
        const weeklyLimit = settings.estimatedLimits?.weekly || 200000;
        const weeklyThreshold = settings.warningThresholds?.weekly || 0.9;
        const weeklyPercentage = timers.weekly.tokens / weeklyLimit;
        
        if (weeklyPercentage >= weeklyThreshold && weeklyPercentage < 1) {
          this.sendWarningNotification(
            'Weekly Limit Warning',
            `You've used ${(weeklyPercentage * 100).toFixed(0)}% of your estimated weekly token limit.`
          );
        } else if (weeklyPercentage >= 1) {
          this.sendWarningNotification(
            'Weekly Limit Exceeded',
            'You have exceeded your estimated weekly token limit.'
          );
        }
      }
    } catch (error) {
      console.error('Error checking warnings:', error);
    }
  },
  
  /**
   * Send warning notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   */
  sendWarningNotification(title, message) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'src/assets/icons/icon48.png',
        title: title,
        message: message,
        priority: 2
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  },
  
  /**
   * Get timer status
   * @returns {Promise<object>} - Timer status
   */
  async getStatus() {
    try {
      const timers = await StorageManager.getTimers();
      const settings = await StorageManager.getSettings();
      
      return {
        fourHour: {
          ...timers.fourHour,
          limit: settings.estimatedLimits?.fourHour || 50000,
          percentage: timers.fourHour.enabled 
            ? (timers.fourHour.tokens / (settings.estimatedLimits?.fourHour || 50000) * 100).toFixed(1)
            : 0
        },
        weekly: {
          ...timers.weekly,
          limit: settings.estimatedLimits?.weekly || 200000,
          percentage: timers.weekly.enabled 
            ? (timers.weekly.tokens / (settings.estimatedLimits?.weekly || 200000) * 100).toFixed(1)
            : 0
        }
      };
    } catch (error) {
      console.error('Error getting timer status:', error);
      return null;
    }
  }
};

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimerManager;
}