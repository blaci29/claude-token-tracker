/**
 * CLAUDE TOKEN TRACKER - STATS PAGE SCRIPT
 * Handles statistics display and navigation
 */

let allChats = {};
let timerStatus = null;
let currentFilter = 'all';
let currentSort = 'recent';
let searchQuery = '';
let currentView = 'main'; // 'main' or 'detail'
let currentChatId = null;

// Pagination
const CHATS_PER_PAGE = 20;
const ROUNDS_PER_PAGE = 20;
let currentChatPage = 1;
let currentRoundPage = 1;

/**
 * Initialize stats page
 */
async function init() {
  console.log('Stats page initializing...');
  
  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const chatId = urlParams.get('chatId');
  
  // Load data
  await loadData();
  
  // Setup event listeners
  setupEventListeners();
  
  // Show appropriate view
  if (chatId && allChats[chatId]) {
    showDetailView(chatId);
  } else {
    showMainView();
  }
  
  console.log('Stats page ready');
}

/**
 * Load all data
 */
async function loadData() {
  try {
    // Show loading
    showLoading();
    
    // Get chats
    const chatsResponse = await chrome.runtime.sendMessage({
      type: 'GET_ALL_CHATS'
    });
    
    if (chatsResponse && chatsResponse.success) {
      allChats = chatsResponse.data || {};
    }
    
    // Get timer status
    const timerResponse = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.GET_TIMER_STATUS
    });
    
    if (timerResponse && timerResponse.success) {
      timerStatus = timerResponse.data;
    }
    
    // Hide loading
    hideLoading();
    
    // Check if empty
    if (Object.keys(allChats).length === 0) {
      showEmptyState();
    }
    
  } catch (error) {
    console.error('Error loading data:', error);
    hideLoading();
  }
}

/**
 * Show main view
 */
function showMainView() {
  currentView = 'main';
  currentChatId = null;
  
  // Update URL
  window.history.pushState({}, '', window.location.pathname);
  
  // Show/hide views
  document.getElementById('main-view').classList.remove('hidden');
  document.getElementById('detail-view').classList.add('hidden');
  document.getElementById('back-btn').classList.add('hidden');
  
  // Update subtitle
  document.getElementById('stats-subtitle').textContent = 'Comprehensive token usage tracking';
  
  // Render main view
  renderSummaryCards();
  renderModelBreakdown();
  renderChatList();
}

/**
 * Show detail view
 */
function showDetailView(chatId) {
  currentView = 'detail';
  currentChatId = chatId;
  
  // Update URL
  window.history.pushState({}, '', `?chatId=${chatId}`);
  
  // Show/hide views
  document.getElementById('main-view').classList.add('hidden');
  document.getElementById('detail-view').classList.remove('hidden');
  document.getElementById('back-btn').classList.remove('hidden');
  
  // Update subtitle
  const chat = allChats[chatId];
  document.getElementById('stats-subtitle').textContent = chat ? chat.title : 'Chat Details';
  
  // Render detail view
  renderChatDetail(chatId);
}

/**
 * Render summary cards
 */
function renderSummaryCards() {
  // Get filtered chats for each time range
  const fourHourChats = getFilteredChats('4h');
  const weekChats = getFilteredChats('week');
  const allTimeChats = Object.values(allChats);
  
  // Calculate stats
  const fourHourStats = calculateStats(fourHourChats);
  const weekStats = calculateStats(weekChats);
  const allTimeStats = calculateStats(allTimeChats);
  
  // Update 4-hour card
  document.getElementById('summary-4h').textContent = 
    `${Utils.formatNumber(fourHourStats.tokens)} tokens`;
  document.getElementById('summary-4h-sub').textContent = 
    `${fourHourStats.rounds} rounds • ${fourHourStats.chats} chats`;
  
  // Update week card
  document.getElementById('summary-week').textContent = 
    `${Utils.formatNumber(weekStats.tokens)} tokens`;
  document.getElementById('summary-week-sub').textContent = 
    `${weekStats.rounds} rounds • ${weekStats.chats} chats`;
  
  // Update all time card
  document.getElementById('summary-total').textContent = 
    `${Utils.formatNumber(allTimeStats.tokens)} tokens`;
  document.getElementById('summary-total-sub').textContent = 
    `${allTimeStats.rounds} rounds • ${allTimeStats.chats} chats`;
}

/**
 * Calculate stats from chat array
 */
function calculateStats(chats) {
  let tokens = 0;
  let rounds = 0;
  
  chats.forEach(chat => {
    if (chat.stats) {
      tokens += chat.stats.totalTokens || 0;
      rounds += chat.stats.totalRounds || 0;
    }
  });
  
  return {
    tokens,
    rounds,
    chats: chats.length
  };
}

/**
 * Render model breakdown
 */
function renderModelBreakdown() {
  const container = document.getElementById('model-breakdown');
  const chats = getFilteredChats(currentFilter);
  
  // Aggregate model stats
  const modelStats = {};
  let totalTokens = 0;
  
  chats.forEach(chat => {
    if (chat.stats && chat.stats.modelBreakdown) {
      Object.entries(chat.stats.modelBreakdown).forEach(([model, data]) => {
        if (!modelStats[model]) {
          modelStats[model] = { rounds: 0, tokens: 0 };
        }
        modelStats[model].rounds += data.rounds || 0;
        modelStats[model].tokens += data.tokens || 0;
        totalTokens += data.tokens || 0;
      });
    }
  });
  
  // Sort by tokens
  const sorted = Object.entries(modelStats).sort((a, b) => b[1].tokens - a[1].tokens);
  
  if (sorted.length === 0) {
    container.innerHTML = '<p class="empty-text">No model data available</p>';
    return;
  }
  
  container.innerHTML = sorted.map(([model, data]) => {
    const percentage = totalTokens > 0 ? (data.tokens / totalTokens * 100).toFixed(0) : 0;
    return `
      <div class="model-item">
        <div class="model-info">
          <div class="model-name">${model}</div>
          <div class="model-stats">
            ${Utils.formatNumber(data.tokens)} tokens • ${data.rounds} rounds
          </div>
        </div>
        <div class="model-percentage">${percentage}%</div>
      </div>
    `;
  }).join('');
}

/**
 * Render chat list
 */
function renderChatList() {
  const container = document.getElementById('chat-list');
  let chats = getFilteredChats(currentFilter);
  
  // Apply search filter
  if (searchQuery) {
    chats = chats.filter(chat => 
      chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  // Apply sorting
  chats = sortChats(chats, currentSort);
  
  // Pagination
  const totalPages = Math.ceil(chats.length / CHATS_PER_PAGE);
  const startIdx = (currentChatPage - 1) * CHATS_PER_PAGE;
  const endIdx = startIdx + CHATS_PER_PAGE;
  const pageChats = chats.slice(startIdx, endIdx);
  
  if (pageChats.length === 0) {
    container.innerHTML = '<p class="empty-text">No chats found</p>';
    document.getElementById('chat-pagination').classList.add('hidden');
    return;
  }
  
  container.innerHTML = pageChats.map(chat => {
    const typeIcon = chat.type === 'project' ? '📁' : '💬';
    return `
      <div class="chat-item" data-chat-id="${chat.id}">
        <div class="chat-type-icon">${typeIcon}</div>
        <div class="chat-item-content">
          <div class="chat-item-title">${chat.title}</div>
          <div class="chat-item-meta">
            Last active: ${Utils.formatDateTime(chat.lastActive)}
          </div>
        </div>
        <div class="chat-item-stats">
          <div class="stat">
            <span class="stat-label">Rounds</span>
            <span class="stat-value">${chat.stats?.totalRounds || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Tokens</span>
            <span class="stat-value">${Utils.formatLargeNumber(chat.stats?.totalTokens || 0)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click listeners
  container.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const chatId = item.dataset.chatId;
      showDetailView(chatId);
    });
  });
  
  // Update pagination
  if (totalPages > 1) {
    document.getElementById('chat-pagination').classList.remove('hidden');
    document.getElementById('page-info').textContent = `Page ${currentChatPage} of ${totalPages}`;
    document.getElementById('prev-page').disabled = currentChatPage === 1;
    document.getElementById('next-page').disabled = currentChatPage === totalPages;
  } else {
    document.getElementById('chat-pagination').classList.add('hidden');
  }
}

/**
 * Render chat detail
 */
function renderChatDetail(chatId) {
  const chat = allChats[chatId];
  if (!chat) return;
  
  // Header
  document.getElementById('detail-title').textContent = chat.title;
  document.getElementById('detail-url').textContent = `🔗 ${chat.url}`;
  document.getElementById('detail-created').textContent = `📅 Created: ${Utils.formatDateTime(chat.created)}`;
  document.getElementById('detail-active').textContent = `🕐 Last active: ${Utils.formatDateTime(chat.lastActive)}`;
  
  // Summary
  const summaryContainer = document.getElementById('detail-summary');
  const byType = chat.stats?.byType || {};
  summaryContainer.innerHTML = `
    <div class="summary-stat">
      <div class="summary-stat-label">Total Rounds</div>
      <div class="summary-stat-value">${chat.stats?.totalRounds || 0}</div>
    </div>
    <div class="summary-stat">
      <div class="summary-stat-label">Total Tokens</div>
      <div class="summary-stat-value">${Utils.formatNumber(chat.stats?.totalTokens || 0)}</div>
    </div>
    <div class="summary-stat">
      <div class="summary-stat-label">👤 User</div>
      <div class="summary-stat-value">${Utils.formatLargeNumber(byType.user?.tokens || 0)}</div>
    </div>
    <div class="summary-stat">
      <div class="summary-stat-label">📄 Docs</div>
      <div class="summary-stat-value">${Utils.formatLargeNumber(byType.documents?.tokens || 0)}</div>
    </div>
    <div class="summary-stat">
      <div class="summary-stat-label">🧠 Thinking</div>
      <div class="summary-stat-value">${Utils.formatLargeNumber(byType.thinking?.tokens || 0)}</div>
    </div>
    <div class="summary-stat">
      <div class="summary-stat-label">🤖 Assistant</div>
      <div class="summary-stat-value">${Utils.formatLargeNumber(byType.assistant?.tokens || 0)}</div>
    </div>
    <div class="summary-stat">
      <div class="summary-stat-label">🔧 Tools</div>
      <div class="summary-stat-value">${Utils.formatLargeNumber(byType.toolContent?.tokens || 0)}</div>
    </div>
  `;
  
  // Rounds
  renderRoundsList(chat);
}

/**
 * Render rounds list
 */
function renderRoundsList(chat) {
  const container = document.getElementById('rounds-list');
  const rounds = chat.rounds || [];
  
  // Update title
  document.getElementById('rounds-title').textContent = `🔄 Rounds (${rounds.length})`;
  
  if (rounds.length === 0) {
    container.innerHTML = '<p class="empty-text">No rounds recorded</p>';
    document.getElementById('rounds-pagination').classList.add('hidden');
    return;
  }
  
  // Pagination
  const totalPages = Math.ceil(rounds.length / ROUNDS_PER_PAGE);
  const startIdx = (currentRoundPage - 1) * ROUNDS_PER_PAGE;
  const endIdx = startIdx + ROUNDS_PER_PAGE;
  const pageRounds = rounds.slice(startIdx, endIdx);
  
  container.innerHTML = pageRounds.map(round => {
    const thinkingIcon = round.hasThinking ? ' 🧠' : '';
    return `
      <div class="round-item" data-round="${round.roundNumber}">
        <div class="round-header">
          <div class="round-header-left">
            <span class="round-number">#${round.roundNumber}</span>
            <span class="round-time">⏱️ ${Utils.formatTime(round.timestamp)}</span>
            <span class="round-model">🤖 ${round.model}${thinkingIcon}</span>
          </div>
          <div class="round-header-right">
            <span class="round-tokens">${Utils.formatLargeNumber(round.total?.tokens || 0)}</span>
            <span class="round-toggle">▼</span>
          </div>
        </div>
        <div class="round-details">
          <div class="round-stats">
            <div class="round-stat">
              <span class="round-stat-label">👤 User</span>
              <span class="round-stat-value">${Utils.formatLargeNumber(round.user?.tokens || 0)}</span>
            </div>
            ${round.documents?.chars > 0 ? `
              <div class="round-stat">
                <span class="round-stat-label">📄 Docs</span>
                <span class="round-stat-value">${Utils.formatLargeNumber(round.documents?.tokens || 0)}</span>
              </div>
            ` : ''}
            ${round.thinking?.chars > 0 ? `
              <div class="round-stat">
                <span class="round-stat-label">🧠 Think</span>
                <span class="round-stat-value">${Utils.formatLargeNumber(round.thinking?.tokens || 0)}</span>
              </div>
            ` : ''}
            <div class="round-stat">
              <span class="round-stat-label">🤖 Reply</span>
              <span class="round-stat-value">${Utils.formatLargeNumber(round.assistant?.tokens || 0)}</span>
            </div>
            ${round.toolContent?.chars > 0 ? `
              <div class="round-stat">
                <span class="round-stat-label">🔧 Tools</span>
                <span class="round-stat-value">${Utils.formatLargeNumber(round.toolContent?.tokens || 0)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add toggle listeners
  container.querySelectorAll('.round-header').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.round-item').classList.toggle('expanded');
    });
  });
  
  // Update pagination
  if (totalPages > 1) {
    document.getElementById('rounds-pagination').classList.remove('hidden');
    document.getElementById('rounds-page-info').textContent = `Page ${currentRoundPage} of ${totalPages}`;
    document.getElementById('rounds-prev-page').disabled = currentRoundPage === 1;
    document.getElementById('rounds-next-page').disabled = currentRoundPage === totalPages;
  } else {
    document.getElementById('rounds-pagination').classList.add('hidden');
  }
}

/**
 * Get filtered chats
 */
function getFilteredChats(filter) {
  const now = Date.now();
  const chatArray = Object.values(allChats);
  
  switch (filter) {
    case '4h':
      const fourHoursAgo = now - (4 * 60 * 60 * 1000);
      return chatArray.filter(chat => Date.parse(chat.lastActive) >= fourHoursAgo);
    
    case 'today':
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return chatArray.filter(chat => Date.parse(chat.lastActive) >= todayStart.getTime());
    
    case 'week':
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
      return chatArray.filter(chat => Date.parse(chat.lastActive) >= weekAgo);
    
    case 'all':
    default:
      return chatArray;
  }
}

/**
 * Sort chats
 */
function sortChats(chats, sortBy) {
  switch (sortBy) {
    case 'recent':
      return chats.sort((a, b) => Date.parse(b.lastActive) - Date.parse(a.lastActive));
    
    case 'tokens':
      return chats.sort((a, b) => (b.stats?.totalTokens || 0) - (a.stats?.totalTokens || 0));
    
    case 'rounds':
      return chats.sort((a, b) => (b.stats?.totalRounds || 0) - (a.stats?.totalRounds || 0));
    
    default:
      return chats;
  }
}

/**
 * Export current chat
 */
async function exportCurrentChat() {
  if (!currentChatId) return;
  
  const chat = allChats[currentChatId];
  if (!chat) return;
  
  const json = JSON.stringify(chat, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${currentChatId}-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Delete current chat
 */
async function deleteCurrentChat() {
  if (!currentChatId) return;
  
  const chat = allChats[currentChatId];
  if (!chat) return;
  
  if (!confirm(`Delete chat "${chat.title}"? This cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.DELETE_CHAT,
      data: { chatId: currentChatId }
    });
    
    if (response.success) {
      delete allChats[currentChatId];
      showMainView();
    }
  } catch (error) {
    console.error('Error deleting chat:', error);
    alert('Error deleting chat');
  }
}

/**
 * Export all data
 */
async function exportAllData() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.EXPORT_DATA
    });
    
    if (response.success) {
      const data = response.data;
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `claude-token-tracker-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Error exporting data');
  }
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('main-view').classList.add('hidden');
  document.getElementById('detail-view').classList.add('hidden');
  document.getElementById('empty-state').classList.add('hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
  document.getElementById('loading-state').classList.add('hidden');
}

/**
 * Show empty state
 */
function showEmptyState() {
  document.getElementById('empty-state').classList.remove('hidden');
  document.getElementById('main-view').classList.add('hidden');
  document.getElementById('detail-view').classList.add('hidden');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Back button
  document.getElementById('back-btn').addEventListener('click', showMainView);
  
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      currentChatPage = 1;
      renderSummaryCards();
      renderModelBreakdown();
      renderChatList();
    });
  });
  
  // Search
  document.getElementById('search-chats').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    currentChatPage = 1;
    renderChatList();
  });
  
  // Sort
  document.getElementById('sort-chats').addEventListener('change', (e) => {
    currentSort = e.target.value;
    currentChatPage = 1;
    renderChatList();
  });
  
  // Chat pagination
  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentChatPage > 1) {
      currentChatPage--;
      renderChatList();
    }
  });
  
  document.getElementById('next-page').addEventListener('click', () => {
    currentChatPage++;
    renderChatList();
  });
  
  // Round pagination
  document.getElementById('rounds-prev-page').addEventListener('click', () => {
    if (currentRoundPage > 1) {
      currentRoundPage--;
      renderRoundsList(allChats[currentChatId]);
    }
  });
  
  document.getElementById('rounds-next-page').addEventListener('click', () => {
    currentRoundPage++;
    renderRoundsList(allChats[currentChatId]);
  });
  
  // Export
  document.getElementById('export-btn').addEventListener('click', () => {
    if (currentView === 'detail') {
      exportCurrentChat();
    } else {
      exportAllData();
    }
  });
  
  // Export chat button
  document.getElementById('export-chat-btn').addEventListener('click', exportCurrentChat);
  
  // Delete chat button
  document.getElementById('delete-chat-btn').addEventListener('click', deleteCurrentChat);
  
  // Settings button
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Enable tracking button (empty state)
  document.getElementById('enable-tracking-btn').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.TOGGLE_TRACKING,
        data: { enabled: true }
      });
      location.reload();
    } catch (error) {
      console.error('Error enabling tracking:', error);
    }
  });
  
  // Browser back/forward
  window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('chatId');
    
    if (chatId && allChats[chatId]) {
      showDetailView(chatId);
    } else {
      showMainView();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}