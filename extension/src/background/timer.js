/**
 * Timer Manager - Automatic token tracking windows
 */

import { CONSTANTS } from '../shared/constants.module.js';
import { StorageManager } from './storage.js';

export const TimerManager = {
  /**
   * Check and auto-start timer window if expired
   * Returns the current active window
   */
  async _checkAndStartWindow(timerType, now = Date.now()) {
    const timers = await StorageManager.getTimers();
    const timer = timerType === 'fourHour' ? timers.fourHour : timers.weekly;
    
    // If no window exists or window expired, create new one
    if (!timer.startTime || !timer.endTime || now > timer.endTime) {
      const duration = timerType === 'fourHour' 
        ? (4 * 60 * 60 * 1000)  // 4 hours
        : (7 * 24 * 60 * 60 * 1000);  // 7 days
      
      timer.startTime = now;
      timer.endTime = now + duration;
      timer.roundIds = [];  // Reset round tracking for new window
      
      if (timerType === 'fourHour') {
        timers.fourHour = timer;
      } else {
        timers.weekly = timer;
      }
      
      await StorageManager.saveTimers(timers);
      console.log(`✨ New ${timerType} window started: ${new Date(timer.startTime)} → ${new Date(timer.endTime)}`);
    }
    
    return timer;
  },

  /**
   * Calculate total tokens from a list of roundIds
   */
  async _calculateTokensFromRoundIds(roundIds) {
    if (!roundIds || roundIds.length === 0) return 0;
    
    const chats = await StorageManager.getChats();
    let totalTokens = 0;
    
    for (const roundId of roundIds) {
      const [chatId, roundNumber] = roundId.split(':');
      const chat = chats[chatId];
      if (chat && chat.rounds && chat.rounds[roundNumber]) {
        const round = chat.rounds[roundNumber];
        totalTokens += round.tokenCount || 0;
      }
    }
    
    return totalTokens;
  },

  /**
   * Get individual timer status with calculated tokens from roundIds
   */
  async _getTimerStatus(timerType, now) {
    const timer = await this._checkAndStartWindow(timerType, now);
    
    // Calculate tokens from roundIds
    const tokens = await this._calculateTokensFromRoundIds(timer.roundIds || []);
    
    // KIKOMMENTEZVE - Nincs limit tracking, csak mérés
    // const limit = timerType === 'fourHour' ? CONSTANTS.TIMER_LIMITS.FOUR_HOUR : CONSTANTS.TIMER_LIMITS.WEEKLY;
    const timeRemaining = Math.max(0, timer.endTime - now);
    const expired = now > timer.endTime;
    
    return {
      active: true,
      tokens,
      // KIKOMMENTEZVE - Nincs limit tracking
      // limit,
      // percentage: (tokens / limit) * 100,
      timeRemaining,
      expired,
      startTime: timer.startTime,
      endTime: timer.endTime,
      roundIds: timer.roundIds || []
    };
  },

  /**
   * Get timer status (main API method)
   */
  async getStatus() {
    const now = Date.now();
    
    const fourHour = await this._getTimerStatus('fourHour', now);
    const weekly = await this._getTimerStatus('weekly', now);

    return { fourHour, weekly };
  },

  /**
   * Add round to timers (called when round is saved)
   */
  async addRoundToTimers(chatId, roundNumber, tokens) {
    const now = Date.now();
    
    // Ensure windows exist and are current
    await this._checkAndStartWindow('fourHour', now);
    await this._checkAndStartWindow('weekly', now);
    
    // Get updated timers
    const timers = await StorageManager.getTimers();
    
    // Add roundId to both windows
    const roundId = `${chatId}:${roundNumber}`;
    
    if (!timers.fourHour.roundIds) timers.fourHour.roundIds = [];
    if (!timers.weekly.roundIds) timers.weekly.roundIds = [];
    
    if (!timers.fourHour.roundIds.includes(roundId)) {
      timers.fourHour.roundIds.push(roundId);
    }
    
    if (!timers.weekly.roundIds.includes(roundId)) {
      timers.weekly.roundIds.push(roundId);
    }
    
    await StorageManager.saveTimers(timers);
    console.log(`📊 Round ${roundId} added to timers (${tokens} tokens)`);
    
    // KIKOMMENTEZVE - Nincs limit warning/notification
    // Check for limit warnings
    // await this._checkLimits(timers);
  },

  /**
   * KIKOMMENTEZVE - Nincs limit checking, csak mérünk!
   * Check if limits are reached
   */
  /*
  async _checkLimits(timers) {
    // Calculate tokens from roundIds
    const fourHourTokens = await this._calculateTokensFromRoundIds(timers.fourHour.roundIds || []);
    const weeklyTokens = await this._calculateTokensFromRoundIds(timers.weekly.roundIds || []);
    
    const fourHourPercent = (fourHourTokens / CONSTANTS.TIMER_LIMITS.FOUR_HOUR) * 100;
    const weeklyPercent = (weeklyTokens / CONSTANTS.TIMER_LIMITS.WEEKLY) * 100;

    if (fourHourPercent >= 90) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'src/assets/icons/icon48.png',
        title: '4-Hour Limit Warning',
        message: `You've used ${fourHourPercent.toFixed(0)}% of your 4-hour token limit.`
      });
    }

    if (weeklyPercent >= 90) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'src/assets/icons/icon48.png',
        title: 'Weekly Limit Warning',
        message: `You've used ${weeklyPercent.toFixed(0)}% of your weekly token limit.`
      });
    }
  },
  */

  /**
   * Set 4-hour timer end time (vésztartalék)
   * Takes duration in milliseconds from now
   */
  async set4HourTimerEnd(durationMs) {
    const timers = await StorageManager.getTimers();
    const now = Date.now();
    
    // Ensure window exists
    await this._checkAndStartWindow('fourHour', now);
    
    // Update endTime
    timers.fourHour.endTime = now + durationMs;
    await StorageManager.saveTimers(timers);
    
    console.log(`⏰ 4-hour timer end set to: ${new Date(timers.fourHour.endTime)}`);
    return await this.getStatus();
  },

  /**
   * Set weekly timer end time (vésztartalék)
   * Takes absolute timestamp
   */
  async setWeeklyTimerEnd(endTimestamp) {
    const timers = await StorageManager.getTimers();
    const now = Date.now();
    
    // Ensure window exists
    await this._checkAndStartWindow('weekly', now);
    
    // Update endTime
    timers.weekly.endTime = endTimestamp;
    await StorageManager.saveTimers(timers);
    
    console.log(`⏰ Weekly timer end set to: ${new Date(timers.weekly.endTime)}`);
    return await this.getStatus();
  }
};
