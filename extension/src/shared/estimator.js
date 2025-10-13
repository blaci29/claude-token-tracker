/**
 * CLAUDE TOKEN TRACKER - TOKEN ESTIMATOR
 * Token estimation with central + type-specific ratios
 */

// Import CONSTANTS - works in both module and non-module contexts
const CONSTANTS_REF = typeof CONSTANTS !== 'undefined' ? CONSTANTS : null;

const TokenEstimator = {
  
  /**
   * Get token estimation rate for a specific content type
   */
  getRate(type, settings) {
    const CONST = CONSTANTS_REF || (typeof CONSTANTS !== 'undefined' ? CONSTANTS : {});
    if (!settings || !settings.tokenEstimation) {
      return CONST.DEFAULTS?.tokenEstimation?.central || 2.6;
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
    const CONST = CONSTANTS_REF || (typeof CONSTANTS !== 'undefined' ? CONSTANTS : {});
    let charCount = typeof chars === 'string' ? chars.length : chars;
    
    const defaultSettings = { tokenEstimation: CONST.DEFAULTS?.tokenEstimation || { central: 2.6, overrides: {} } };
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
    const CONST = CONSTANTS_REF || (typeof CONSTANTS !== 'undefined' ? CONSTANTS : {});
    try {
      const storageKey = CONST.STORAGE_KEYS?.SETTINGS || 'settings';
      const result = await chrome.storage.local.get(storageKey);
      return result[storageKey] || CONST.DEFAULTS || {};
    } catch (error) {
      console.error('Error getting settings:', error);
      return CONST.DEFAULTS || {};
    }
  }
};

// For background worker ES6 modules - re-export
export { TokenEstimator };