/**
 * CLAUDE TOKEN TRACKER - DOM OBSERVER
 * Monitors URL changes and chat title updates
 */

const DOMObserver = {
  
  currentUrl: null,
  currentChatId: null,
  
  /**
   * Initialize observer
   */
  init() {
    console.log('DOM Observer initializing...');
    
    // Track initial URL
    this.currentUrl = window.location.href;
    this.currentChatId = Utils.extractChatInfo(this.currentUrl).id;
    
    // Watch for URL changes (SPA navigation)
    this.watchURLChanges();
    
    // Watch for chat title changes
    this.watchTitleChanges();
    
    console.log('DOM Observer ready');
  },
  
  /**
   * Watch for URL changes
   */
  watchURLChanges() {
    // Override pushState and replaceState
    const _originalPushState = history.pushState;
    const _originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      _originalPushState.apply(history, arguments);
      DOMObserver.onURLChange();
    };
    
    history.replaceState = function() {
      _originalReplaceState.apply(history, arguments);
      DOMObserver.onURLChange();
    };
    
    // Listen for popstate
    window.addEventListener('popstate', () => {
      DOMObserver.onURLChange();
    });
    
    // Polling fallback (for cases where above doesn't work)
    setInterval(() => {
      if (window.location.href !== DOMObserver.currentUrl) {
        DOMObserver.onURLChange();
      }
    }, 1000);
  },
  
  /**
   * Handle URL change
   */
  onURLChange() {
    const newUrl = window.location.href;
    
    if (newUrl !== this.currentUrl) {
      console.log('URL changed:', newUrl);
      
      const oldChatId = this.currentChatId;
      const chatInfo = Utils.extractChatInfo(newUrl);
      const newChatId = chatInfo.id;
      
      this.currentUrl = newUrl;
      this.currentChatId = newChatId;
      
      // If chat changed, update overlay
      if (oldChatId !== newChatId) {
        console.log('Chat changed:', oldChatId, '→', newChatId);
        this.onChatChange(newChatId);
      }
    }
  },
  
  /**
   * Handle chat change
   */
  async onChatChange(chatId) {
    // Notify overlay to update
    if (window.OverlayManager) {
      window.OverlayManager.onChatChange(chatId);
    }
  },
  
  /**
   * Watch for chat title changes
   */
  watchTitleChanges() {
    // Observe document title changes
    const titleObserver = new MutationObserver(() => {
      this.onTitleChange();
    });
    
    titleObserver.observe(document.querySelector('title'), {
      childList: true
    });
    
    // Observe body for h1 changes (chat title)
    const bodyObserver = new MutationObserver(() => {
      this.onTitleChange();
    });
    
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  },
  
  /**
   * Handle title change
   */
  onTitleChange: Utils.debounce(function() {
    // Get current title
    const title = DOMObserver.detectChatTitle();
    
    // Update overlay if active
    if (window.OverlayManager && window.OverlayManager.isVisible()) {
      window.OverlayManager.updateChatTitle();
    }
    
    // Notify background to update stored title
    if (title && title !== 'Untitled Chat' && DOMObserver.currentChatId) {
      chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.UPDATE_CHAT_TITLE,
        data: {
          chatId: DOMObserver.currentChatId,
          title: title
        }
      }).catch(() => {
        // Silently fail
      });
    }
  }, 500),
  
  /**
   * Detect chat title from DOM
   */
  detectChatTitle() {
    try {
      const selectors = [
        'h1.font-tiempos',
        '[data-testid="chat-title"]',
        'h1',
        '.chat-title'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const title = element.textContent?.trim();
          if (title && title.length > 0 && title.length < 200) {
            return title;
          }
        }
      }
    } catch(e) {
      // Ignore
    }
    return 'Untitled Chat';
  }
};

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    DOMObserver.init();
  });
} else {
  DOMObserver.init();
}