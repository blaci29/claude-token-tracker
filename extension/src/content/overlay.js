/**
 * CLAUDE TOKEN TRACKER - OVERLAY MANAGER
 * Manages the floating widget overlay
 */

const OverlayManager = {
  
  overlay: null,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  currentChatId: null,
  isMinimized: false,
  isLoading: false,  // Guard against multiple simultaneous loads
  
  /**
   * Initialize overlay
   */
  async init() {
    // Check if overlay should be shown
    const settings = await this.getSettings();
    
    if (settings.overlayEnabled) {
      this.show();
    }
    
    // Listen for overlay toggle messages
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === CONSTANTS.MSG_TYPES.TOGGLE_OVERLAY) {
        if (message.data.enabled) {
          this.show();
        } else {
          this.hide();
        }
      }
      
      if (message.type === CONSTANTS.MSG_TYPES.UPDATE_OVERLAY) {
        this.updateData(message.data);
      }
    });
  },
  
  /**
   * Create overlay element
   */
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'ctt-overlay';
    overlay.innerHTML = `
      <div class="ctt-overlay-header">
        <div class="ctt-overlay-title">
          <span>💬</span>
          <span>Chat Tracker</span>
        </div>
        <div class="ctt-overlay-controls">
          <button class="ctt-overlay-btn" id="ctt-minimize" title="Minimize">
            <span>−</span>
          </button>
          <button class="ctt-overlay-btn" id="ctt-close" title="Close">
            <span>×</span>
          </button>
        </div>
      </div>
      <div class="ctt-overlay-body">
        <div class="ctt-overlay-loading">Loading...</div>
      </div>
      <div class="ctt-overlay-footer">
        <button class="ctt-footer-btn" id="ctt-view-stats">
          📊 All Rounds
        </button>
        <button class="ctt-footer-btn" id="ctt-settings">
          ⚙️ Settings
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Set position
    this.setPosition(overlay);
    
    // Add event listeners
    this.attachEventListeners(overlay);
    
    return overlay;
  },
  
  /**
   * Set overlay position
   */
  async setPosition(overlay) {
    const settings = await this.getSettings();
    const position = settings.overlayPosition || { x: 20, y: 100 };
    
    overlay.style.left = position.x + 'px';
    overlay.style.top = position.y + 'px';
  },
  
  /**
   * Attach event listeners
   */
  attachEventListeners(overlay) {
    const header = overlay.querySelector('.ctt-overlay-header');
    const minimizeBtn = overlay.querySelector('#ctt-minimize');
    const closeBtn = overlay.querySelector('#ctt-close');
    const statsBtn = overlay.querySelector('#ctt-view-stats');
    const settingsBtn = overlay.querySelector('#ctt-settings');
    
    // Drag functionality
    let dragStarted = false;
    let startX, startY;
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ctt-overlay-controls')) return;
      
      dragStarted = false;
      startX = e.clientX;
      startY = e.clientY;
      
      this.isDragging = true;
      this.dragOffset.x = e.clientX - overlay.offsetLeft;
      this.dragOffset.y = e.clientY - overlay.offsetTop;
      
      overlay.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      // Check if mouse moved enough to consider it a drag
      const moveX = Math.abs(e.clientX - startX);
      const moveY = Math.abs(e.clientY - startY);
      
      if (moveX > 5 || moveY > 5) {
        dragStarted = true;
      }
      
      if (dragStarted) {
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        
        overlay.style.left = x + 'px';
        overlay.style.top = y + 'px';
      }
    });
    
    document.addEventListener('mouseup', async (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        overlay.style.cursor = 'move';
        
        // If didn't drag, treat as click
        if (!dragStarted && this.isMinimized) {
          this.toggleMinimize();
        }
        
        // Save position if dragged
        if (dragStarted) {
          await this.savePosition({
            x: parseInt(overlay.style.left),
            y: parseInt(overlay.style.top)
          });
        }
        
        dragStarted = false;
      }
    });
    
    // Minimize
    minimizeBtn.addEventListener('click', () => {
      this.toggleMinimize();
    });
    
    // Close
    closeBtn.addEventListener('click', () => {
      this.hide();
    });
    
    // View stats
    statsBtn.addEventListener('click', () => {
      this.openStats();
    });
    
    // Settings
    settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });
  },
  
  /**
   * Show overlay
   */
  async show() {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
    } else {
      this.overlay = this.createOverlay();
    }
    
    // Load data for current chat
    const chatInfo = Utils.extractChatInfo(window.location.href);
    this.currentChatId = chatInfo.id;
    await this.loadChatData(chatInfo.id);
  },
  
  /**
   * Hide overlay
   */
  hide() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    
    // Update settings
    this.updateSettings({ overlayEnabled: false });
  },
  
  /**
   * Toggle minimize
   */
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    
    const minimizeBtn = this.overlay.querySelector('#ctt-minimize span');
    
    if (this.isMinimized) {
      this.overlay.classList.add('minimized');
      minimizeBtn.textContent = '□'; // Maximize icon
    } else {
      this.overlay.classList.remove('minimized');
      minimizeBtn.textContent = '−'; // Minimize icon
    }
  },
  
  /**
   * Load chat data
   */
  async loadChatData(chatId) {
    // Prevent multiple simultaneous loads
    if (this.isLoading) {
      console.log('Already loading, skipping...');
      return;
    }
    
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      return; // Extension was reloaded, skip
    }
    
    try {
      if (!chatId) {
        return;
      }
      
      this.isLoading = true;
      
      const response = await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.GET_CHAT_DATA,
        data: { chatId }
      });
      
      if (response && response.success && response.data) {
        this.renderData(response.data);
      } else if (response && response.success && response.data === null) {
        // No chat data yet - this is normal for new chats
        this.renderEmpty();
      } else {
        this.renderEmpty();
      }
    } catch (error) {
      // Silently fail - overlay errors shouldn't spam console
      this.renderError();
    } finally {
      this.isLoading = false;
    }
  },
  
  /**
   * Render data
   */
  renderData(data) {
    const { chat, lastRound } = data;
    
    if (!chat || !chat.stats) {
      this.renderEmpty();
      return;
    }
    
    // Mark which chat we're displaying
    this.overlay.dataset.chatId = chat.id;
    
    const stats = chat.stats;
    const byType = stats.byType || {};
    
    const body = this.overlay.querySelector('.ctt-overlay-body');
    
    body.innerHTML = `
      <div class="ctt-chat-info">
        <div class="ctt-chat-title" title="${chat.title}">
          📁 ${chat.title}
        </div>
        <div class="ctt-chat-id">🔗 /${chat.id.substring(0, 12)}...</div>
      </div>
      
      <div class="ctt-section">
        <div class="ctt-section-title">📊 Chat Summary (${stats.totalRounds || 0} rounds)</div>
        <div class="ctt-stats-grid">
          <div class="ctt-stat-row">
            <div class="ctt-stat-label">👤 User</div>
            <div class="ctt-stat-value">${Utils.formatLargeNumber(byType.user?.chars)} (~${Utils.formatLargeNumber(byType.user?.tokens)})</div>
          </div>
          <div class="ctt-stat-row">
            <div class="ctt-stat-label">📄 Docs</div>
            <div class="ctt-stat-value">${Utils.formatLargeNumber(byType.documents?.chars)} (~${Utils.formatLargeNumber(byType.documents?.tokens)})</div>
          </div>
          <div class="ctt-stat-row">
            <div class="ctt-stat-label">🧠 Thinking</div>
            <div class="ctt-stat-value">${Utils.formatLargeNumber(byType.thinking?.chars)} (~${Utils.formatLargeNumber(byType.thinking?.tokens)})</div>
          </div>
          <div class="ctt-stat-row">
            <div class="ctt-stat-label">🤖 Reply</div>
            <div class="ctt-stat-value">${Utils.formatLargeNumber(byType.assistant?.chars)} (~${Utils.formatLargeNumber(byType.assistant?.tokens)})</div>
          </div>
          <div class="ctt-stat-row">
            <div class="ctt-stat-label">🔧 Tools</div>
            <div class="ctt-stat-value">${Utils.formatLargeNumber(byType.toolContent?.chars)} (~${Utils.formatLargeNumber(byType.toolContent?.tokens)})</div>
          </div>
          <div class="ctt-stat-row ctt-stat-total">
            <div class="ctt-stat-label">✨ TOTAL</div>
            <div class="ctt-stat-value">${Utils.formatLargeNumber(stats.totalChars)} (~${Utils.formatLargeNumber(stats.totalTokens)})</div>
          </div>
        </div>
      </div>
      
      ${lastRound ? `
        <div class="ctt-section">
          <div class="ctt-section-title">🔄 Last Round (#${lastRound.roundNumber})</div>
          <div class="ctt-round-info">
            <div class="ctt-round-header">
              <div class="ctt-round-number">⏱️ ${Utils.formatTime(lastRound.timestamp)}</div>
              <div class="ctt-round-model">
                🤖 ${lastRound.model}${lastRound.hasThinking ? ' + 🧠' : ''}
              </div>
            </div>
            <div class="ctt-stats-grid">
              <div class="ctt-stat-row">
                <div class="ctt-stat-label">👤 User</div>
                <div class="ctt-stat-value">${Utils.formatLargeNumber(lastRound.user.chars)} (~${Utils.formatLargeNumber(lastRound.user.tokens)})</div>
              </div>
              ${lastRound.documents && lastRound.documents.chars > 0 ? `
                <div class="ctt-stat-row">
                  <div class="ctt-stat-label">📄 Docs</div>
                  <div class="ctt-stat-value">${Utils.formatLargeNumber(lastRound.documents.chars)} (~${Utils.formatLargeNumber(lastRound.documents.tokens)})</div>
                </div>
              ` : ''}
              ${lastRound.thinking.chars > 0 ? `
                <div class="ctt-stat-row">
                  <div class="ctt-stat-label">🧠 Think</div>
                  <div class="ctt-stat-value">${Utils.formatLargeNumber(lastRound.thinking.chars)} (~${Utils.formatLargeNumber(lastRound.thinking.tokens)})</div>
                </div>
              ` : ''}
              <div class="ctt-stat-row">
                <div class="ctt-stat-label">🤖 Reply</div>
                <div class="ctt-stat-value">${Utils.formatLargeNumber(lastRound.assistant.chars)} (~${Utils.formatLargeNumber(lastRound.assistant.tokens)})</div>
              </div>
              ${lastRound.toolContent.chars > 0 ? `
                <div class="ctt-stat-row">
                  <div class="ctt-stat-label">🔧 Tools</div>
                  <div class="ctt-stat-value">${Utils.formatLargeNumber(lastRound.toolContent.chars)} (~${Utils.formatLargeNumber(lastRound.toolContent.tokens)})</div>
                </div>
              ` : ''}
              <div class="ctt-stat-row ctt-stat-total">
                <div class="ctt-stat-label">✨ Total</div>
                <div class="ctt-stat-value">${Utils.formatLargeNumber(lastRound.total.chars)} (~${Utils.formatLargeNumber(lastRound.total.tokens)})</div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  },
  
  /**
   * Render empty state
   */
  renderEmpty() {
    const body = this.overlay.querySelector('.ctt-overlay-body');
    body.innerHTML = `
      <div class="ctt-overlay-empty">
        No data yet for this chat.<br>
        Start a conversation!
      </div>
    `;
  },
  
  /**
   * Render error state
   */
  renderError() {
    const body = this.overlay.querySelector('.ctt-overlay-body');
    body.innerHTML = `
      <div class="ctt-overlay-empty">
        Error loading data.<br>
        Please refresh the page.
      </div>
    `;
  },
  
  /**
   * Update data (called from worker)
   */
  updateData(data) {
    if (this.overlay && this.overlay.style.display !== 'none') {
      this.renderData(data);
    }
  },
  
  /**
   * On chat change
   */
  async onChatChange(chatId) {
    this.currentChatId = chatId;
    if (this.overlay && this.overlay.style.display !== 'none') {
      await this.loadChatData(chatId);
    }
  },
  
  /**
   * Update chat title
   */
  async updateChatTitle() {
    // Don't update if overlay doesn't exist, is hidden, loading, or no chatId
    if (!this.overlay || this.overlay.style.display === 'none' || this.isLoading || !this.currentChatId) {
      return;
    }
    
    // Don't reload if we're already showing this chat's data
    const currentChatIdInOverlay = this.overlay.dataset.chatId;
    if (currentChatIdInOverlay === this.currentChatId) {
      return;
    }
    
    await this.loadChatData(this.currentChatId);
  },
  
  /**
   * Open stats page
   */
  openStats() {
    chrome.runtime.sendMessage({
      type: 'OPEN_STATS_PAGE',
      data: { chatId: this.currentChatId }
    });
  },
  
  /**
   * Open settings
   */
  openSettings() {
    // Content scripts cannot directly open options page, send message to background
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  },
  
  /**
   * Check if overlay is visible
   */
  isVisible() {
    return this.overlay && this.overlay.style.display !== 'none';
  },
  
  /**
   * Get settings
   */
  async getSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.GET_SETTINGS
      });
      return response.data || CONSTANTS.DEFAULTS;
    } catch (error) {
      return CONSTANTS.DEFAULTS;
    }
  },
  
  /**
   * Update settings
   */
  async updateSettings(updates) {
    try {
      const settings = await this.getSettings();
      const newSettings = { ...settings, ...updates };
      
      await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.UPDATE_SETTINGS,
        data: { settings: newSettings }
      });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  },
  
  /**
   * Save position
   */
  async savePosition(position) {
    const settings = await this.getSettings();
    settings.overlayPosition = position;
    
    await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.UPDATE_SETTINGS,
      data: { settings }
    });
  }
};

// Make available globally
window.OverlayManager = OverlayManager;

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    OverlayManager.init();
  });
} else {
  OverlayManager.init();
}