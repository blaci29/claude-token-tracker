/**
 * Timer Manager - Token usage timers
 */

import { CONSTANTS } from '../shared/constants.module.js';
import { StorageManager } from './storage.js';

export const TimerManager = {
  /**
   * Get timer status
   */
  async getStatus() {
    const timers = await StorageManager.getTimers();
    const now = Date.now();

    const fourHour = this._getTimerStatus(timers.fourHour, now, CONSTANTS.TIMER_LIMITS.FOUR_HOUR);
    const weekly = this._getTimerStatus(timers.weekly, now, CONSTANTS.TIMER_LIMITS.WEEKLY);

    return { fourHour, weekly };
  },

  /**
   * Helper to get individual timer status
   */
  _getTimerStatus(timer, now, limit) {
    if (!timer.startTime) {
      return {
        active: false,
        tokens: 0,
        limit: limit,
        percentage: 0,
        timeRemaining: null,
        expired: false
      };
    }

    const expired = timer.endTime && now > timer.endTime;

    return {
      active: true,
      tokens: timer.tokens || 0,
      limit: limit,
      percentage: ((timer.tokens || 0) / limit) * 100,
      timeRemaining: timer.endTime ? Math.max(0, timer.endTime - now) : null,
      expired: expired,
      startTime: timer.startTime,
      endTime: timer.endTime
    };
  },

  /**
   * Add tokens to timers
   */
  async addRoundToTimers(chatId, roundNumber, tokens) {
    const timers = await StorageManager.getTimers();
    const now = Date.now();

    // 4-hour timer auto-start
    if (!timers.fourHour.startTime) {
      timers.fourHour.startTime = now;
      timers.fourHour.endTime = now + (4 * 60 * 60 * 1000);
      timers.fourHour.tokens = 0;
    }

    // Weekly timer auto-start
    if (!timers.weekly.startTime) {
      timers.weekly.startTime = now;
      timers.weekly.endTime = now + (7 * 24 * 60 * 60 * 1000);
      timers.weekly.tokens = 0;
    }

    // Check if expired and reset
    if (timers.fourHour.endTime && now > timers.fourHour.endTime) {
      timers.fourHour = { startTime: now, endTime: now + (4 * 60 * 60 * 1000), tokens: 0 };
    }

    if (timers.weekly.endTime && now > timers.weekly.endTime) {
      timers.weekly = { startTime: now, endTime: now + (7 * 24 * 60 * 60 * 1000), tokens: 0 };
    }

    // Add tokens
    timers.fourHour.tokens += tokens;
    timers.weekly.tokens += tokens;

    await StorageManager.saveTimers(timers);

    // Check for limit notifications
    this._checkLimits(timers);
  },

  /**
   * Check if limits are reached
   */
  _checkLimits(timers) {
    const fourHourPercent = (timers.fourHour.tokens / CONSTANTS.TIMER_LIMITS.FOUR_HOUR) * 100;
    const weeklyPercent = (timers.weekly.tokens / CONSTANTS.TIMER_LIMITS.WEEKLY) * 100;

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

  /**
   * Reset 4-hour timer
   */
  async reset4HourTimer() {
    const timers = await StorageManager.getTimers();
    const now = Date.now();
    timers.fourHour = {
      startTime: now,
      endTime: now + (4 * 60 * 60 * 1000),
      tokens: 0
    };
    await StorageManager.saveTimers(timers);
    return timers.fourHour;
  },

  /**
   * Reset weekly timer
   */
  async resetWeeklyTimer() {
    const timers = await StorageManager.getTimers();
    const now = Date.now();
    timers.weekly = {
      startTime: now,
      endTime: now + (7 * 24 * 60 * 60 * 1000),
      tokens: 0
    };
    await StorageManager.saveTimers(timers);
    return timers.weekly;
  },

  /**
   * Set 4-hour timer end time
   */
  async set4HourTimerEnd(endTime) {
    const timers = await StorageManager.getTimers();
    if (timers.fourHour.startTime) {
      timers.fourHour.endTime = endTime;
      await StorageManager.saveTimers(timers);
    }
    return timers.fourHour;
  }
};
