/**
 * CLAUDE TOKEN TRACKER - TOKEN ESTIMATOR
 * Token estimation with central + type-specific ratios
 */

const TokenEstimator = {
  
  /**
   * Get token estimation rate for a specific content type
   */
  getRate(type, settings) {
    const CONST = (typeof CONSTANTS !== 'undefined') ? CONSTANTS : (typeof window !== 'undefined' ? window.CONSTANTS : self.CONSTANTS);
    
    if (!settings || !settings.tokenEstimation) {
      return CONST.DEFAULTS.tokenEstimation.central;
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
    const CONST = (typeof CONSTANTS !== 'undefined') ? CONSTANTS : (typeof window !== 'undefined' ? window.CONSTANTS : self.CONSTANTS);
    
    let charCount = typeof chars === 'string' ? chars.length : chars;
    
    const rate = this.getRate(type, settings || { tokenEstimation: CONST.DEFAULTS.tokenEstimation });
    
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
    const CONST = (typeof CONSTANTS !== 'undefined') ? CONSTANTS : (typeof window !== 'undefined' ? window.CONSTANTS : self.CONSTANTS);
    
    try {
      const result = await chrome.storage.local.get(CONST.STORAGE_KEYS.SETTINGS);
      return result[CONST.STORAGE_KEYS.SETTINGS] || CONST.DEFAULTS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return CONST.DEFAULTS;
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.TokenEstimator = TokenEstimator;
}

if (typeof self !== 'undefined' && self !== window) {
  self.TokenEstimator = TokenEstimator;
}

if (typeof exports !== 'undefined') {
  exports.TokenEstimator = TokenEstimator;
}