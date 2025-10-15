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
   * ⚠️ SKIPS rounds with errors
   */
  async _calculateTokensFromRoundIds(roundIds) {
    if (!roundIds || roundIds.length === 0) {
      return { tokens: 0, chars: 0 };
    }
    
    const chats = await StorageManager.getChats();
    let totalTokens = 0;
    let totalChars = 0;
    
    console.log('📊 Calculating from roundIds:', roundIds);
    
    for (const roundId of roundIds) {
      const [chatId, roundNumber] = roundId.split(':');
      const chat = chats[chatId];
      
      if (!chat) {
        console.warn(`❌ Chat not found: ${chatId}`);
        continue;
      }
      
      if (!chat.rounds || !Array.isArray(chat.rounds)) {
        console.warn(`❌ Chat ${chatId} has no rounds array`);
        continue;
      }
      
      // ⚠️ CRITICAL: roundNumber is 1-indexed, array is 0-indexed!
      const round = chat.rounds[parseInt(roundNumber) - 1];
      
      if (!round) {
        console.warn(`❌ Round ${roundNumber} not found in chat ${chatId} (has ${chat.rounds.length} rounds)`);
        continue;
      }
      
      // Skip error rounds
      if (round.error) {
        console.log(`⚠️ Skipping error round ${roundNumber} in chat ${chatId}`);
        continue;
      }
      
      console.log(`✅ Round ${roundNumber} in ${chatId}: ${round.tokenCount} tokens, ${round.total?.chars} chars`);
      
      totalTokens += round.tokenCount || 0;
      totalChars += round.total?.chars || 0;
    }
    
    console.log(`📈 Total: ${totalTokens} tokens, ${totalChars} chars`);
    
    return { tokens: totalTokens, chars: totalChars };
  },

  /**
   * Get individual timer status with calculated tokens from roundIds
   */
  async _getTimerStatus(timerType, now) {
    const timer = await this._checkAndStartWindow(timerType, now);
    
    // Calculate tokens and chars from roundIds
    const stats = await this._calculateTokensFromRoundIds(timer.roundIds || []);
    
    console.log(`⏱️ ${timerType} timer stats:`, stats, 'from', timer.roundIds?.length || 0, 'rounds');
    
    // KIKOMMENTEZVE - Nincs limit tracking, csak mérés
    // const limit = timerType === 'fourHour' ? CONSTANTS.TIMER_LIMITS.FOUR_HOUR : CONSTANTS.TIMER_LIMITS.WEEKLY;
    const timeRemaining = Math.max(0, timer.endTime - now);
    const expired = now > timer.endTime;
    
    return {
      active: true,
      tokens: stats.tokens,
      chars: stats.chars,
      // KIKOMMENTEZVE - Nincs limit tracking
      // limit,
      // percentage: (tokens / limit) * 100,
      percentage: 0, // Placeholder for progress bar
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
  },

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
