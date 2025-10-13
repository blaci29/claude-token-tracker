/**
 * ES6 Module export for TokenEstimator
 * Used by background service worker
 */

import { CONSTANTS } from './constants.module.js';

export const TokenEstimator = {
  
  /**
   * Get token estimation rate for a specific content type
   */
  getRate(type, settings) {
    if (!settings || !settings.tokenEstimation) {
      return CONSTANTS.DEFAULTS.tokenEstimation.central;
    }
    
    const override = settings.tokenEstimation.overrides[type];
    
    if (override !== null && override !== undefined) {
      return override;
    }
    
    return settings.tokenEstimation.central;
  },
  
  /**
   * Estimate tokens from character count
   */
  estimate(chars, type = 'userMessage', settings = null) {
    let charCount = typeof chars === 'string' ? chars.length : chars;
    
    const defaultSettings = { tokenEstimation: CONSTANTS.DEFAULTS.tokenEstimation };
    const rate = this.getRate(type, settings || defaultSettings);
    
    return Math.ceil(charCount / rate);
  },
  
  /**
   * Estimate tokens for a round object
   */
  estimateRound(round, settings) {
    return {
      ...round,
      user: {
        ...round.user,
        tokens: this.estimate(round.user.chars, 'userMessage', settings)
      },
      documents: {
        ...round.documents,
        tokens: this.estimate(round.documents.chars, 'userDocuments', settings)
      },
      thinking: {
        ...round.thinking,
        tokens: this.estimate(round.thinking.chars, 'thinking', settings)
      },
      assistant: {
        ...round.assistant,
        tokens: this.estimate(round.assistant.chars, 'assistant', settings)
      },
      toolContent: {
        ...round.toolContent,
        tokens: this.estimate(round.toolContent.chars, 'toolContent', settings)
      }
    };
  },
  
  /**
   * Calculate total tokens for a round
   */
  calculateRoundTotal(round) {
    return (
      (round.user?.tokens || 0) +
      (round.documents?.tokens || 0) +
      (round.thinking?.tokens || 0) +
      (round.assistant?.tokens || 0) +
      (round.toolContent?.tokens || 0)
    );
  },
  
  /**
   * Get current settings from storage
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(CONSTANTS.STORAGE_KEYS.SETTINGS);
      return result[CONSTANTS.STORAGE_KEYS.SETTINGS] || CONSTANTS.DEFAULTS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return CONSTANTS.DEFAULTS;
    }
  }
};
