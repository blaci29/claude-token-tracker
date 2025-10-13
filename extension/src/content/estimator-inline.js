/**
 * INLINE VERSION FOR CONTENT SCRIPTS
 */

const TokenEstimator = {
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
  
  estimate(chars, type = 'userMessage', settings = null) {
    let charCount = typeof chars === 'string' ? chars.length : chars;
    const rate = this.getRate(type, settings || { tokenEstimation: CONSTANTS.DEFAULTS.tokenEstimation });
    return Math.ceil(charCount / rate);
  }
};