/**
 * INJECTED SCRIPT - Runs in page context (not content script isolated world)
 * This script intercepts fetch calls at the page level
 */

(function() {
  'use strict';
  
  console.log('🔧 Page interceptor starting...');
  
  const _originalFetch = window.fetch;
  
  window.fetch = async function(url, options = {}) {
    const urlString = typeof url === 'string' ? url : (url ? url.toString() : 'unknown');
    
    console.log('🌐 [PAGE] Fetch:', urlString);
    
    // Notify content script about the fetch
    window.postMessage({
      type: 'CLAUDE_TRACKER_FETCH',
      url: urlString,
      method: options.method || 'GET',
      hasBody: !!options.body
    }, '*');
    
    // Call original fetch
    return _originalFetch.apply(this, arguments);
  };
  
  console.log('✅ Fetch interceptor active in page context');
})();
