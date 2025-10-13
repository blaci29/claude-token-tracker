/**
 * CLAUDE TOKEN TRACKER - TOKEN ESTIMATOR
 * Token estimation with central + type-specific ratios
 */

const TokenEstimator = {
  
  /**
   * Get token estimation rate for a specific content type
   * @param {string} type - Content type (userMessage, userDocuments, thinking, assistant, toolContent)
   * @param {object} settings - Settings object with tokenEstimation config
   * @returns {number} - Chars per token ratio
   */
  getRate(type, settings) {
    if (!settings || !settings.tokenEstimation) {
      return CONSTANTS.DEFAULTS.tokenEstimation.central;
    }
    
    const override = settings.tokenEstimation.overrides[type];
    
    // If override exists and is not null, use it
    if (override !== null && override !== undefined) {
      return override;
    }
    
    // Otherwise use central rate
    return settings.tokenEstimation.central;
  },
  
  /**
   * Estimate tokens from character count
   * @param {number|string} chars - Character count or string
   * @param {string} type - Content type
   * @param {object} settings - Settings object
   * @returns {number} - Estimated token count
   */
  estimate(chars, type = 'userMessage', settings = null) {
    // Get character count
    let charCount = typeof chars === 'string' ? chars.length : chars;
    
    // Get rate for this type
    const rate = this.getRate(type, settings || { tokenEstimation: CONSTANTS.DEFAULTS.tokenEstimation });
    
    // Calculate tokens
    return Math.ceil(charCount / rate);
  },
  
  /**
   * Estimate tokens for a round object
   * @param {object} round - Round data with chars
   * @param {object} settings - Settings object
   * @returns {object} - Round with estimated tokens
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
   * @param {object} round - Round with token estimates
   * @returns {number} - Total tokens
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
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TokenEstimator;
}