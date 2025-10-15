/**
 * CLAUDE TOKEN TRACKER - STATS PAGE (REDESIGNED)
 * Timer-focused statistics display
 */

let allChats = {};
let timerStatus = null;

/**
 * Initialize stats page
 */
async function init() {
  console.log('📊 Stats page initializing...');
  
  await loadData();
  setupEventListeners();
  renderAll();
  
  // Hide loading state
  const loadingState = document.getElementById('loading-state');
  if (loadingState) {
    loadingState.style.display = 'none';
  }
  
  console.log('✅ Stats page ready');
}

/**
 * Load all data
 */
async function loadData() {
  try {
    // Get chats
    const chatsResponse = await chrome.runtime.sendMessage({
      type: 'GET_ALL_CHATS'
    });
    
    console.log('📦 Raw chats response:', chatsResponse);
    
    if (chatsResponse?.success) {
      allChats = chatsResponse.data || {};
      console.log('   ✅ Loaded chats:', Object.keys(allChats).length);
      console.log('   📝 Chat IDs:', Object.keys(allChats));
      console.log('   💾 Full chat data:', allChats);
    } else {
      console.error('❌ Failed to load chats:', chatsResponse);
    }
    
    // Get timer status
    const timerResponse = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.GET_TIMER_STATUS
    });
    
    if (timerResponse?.success) {
      timerStatus = timerResponse.data;
      console.log('⏱️ Timer status:', timerStatus);
    }
    
  } catch (error) {
    console.error('❌ Error loading data:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // 4-hour timer set button
  document.getElementById('set-4h-btn').addEventListener('click', async () => {
    const hours = parseInt(document.getElementById('set-4h-hours').value) || 0;
    const minutes = parseInt(document.getElementById('set-4h-minutes').value) || 0;
    const durationMs = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
    
    await chrome.runtime.sendMessage({
      type: 'SET_4H_TIMER_END',
      data: { durationMs }
    });
    
    await loadData();
    renderTimerSections();
  });
  
  // Weekly timer set button
  document.getElementById('set-weekly-btn').addEventListener('click', async () => {
    const day = parseInt(document.getElementById('set-weekly-day').value);
    const time = document.getElementById('set-weekly-time').value;
    
    // Calculate next occurrence of this day+time
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    
    // Set to selected day
    const currentDay = target.getDay();
    const daysUntil = (day - currentDay + 7) % 7;
    target.setDate(target.getDate() + (daysUntil === 0 ? 7 : daysUntil));
    
    // Set time
    target.setHours(hours, minutes, 0, 0);
    
    await chrome.runtime.sendMessage({
      type: 'SET_WEEKLY_TIMER_END',
      data: { endTimestamp: target.getTime() }
    });
    
    await loadData();
    renderTimerSections();
  });
  
  // Settings button
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Export button
  document.getElementById('export-btn').addEventListener('click', exportData);
  
  // Search chats
  const searchInput = document.getElementById('search-chats');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderConversations();
    });
  }
  
  // Sort chats
  const sortSelect = document.getElementById('sort-chats');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      renderConversations();
    });
  }
  
  // Delete old chats button
  const deleteOldBtn = document.getElementById('delete-old-chats');
  if (deleteOldBtn) {
    deleteOldBtn.addEventListener('click', deleteOldChats);
  }
}

/**
 * Render all sections
 */
function renderAll() {
  renderTimerSections();
  renderConversations();
}

/**
 * Render timer sections (4-hour, weekly, all-time)
 */
function renderTimerSections() {
  if (!timerStatus) return;
  
  // 4-Hour Section
  const fourHour = timerStatus.fourHour;
  document.getElementById('timer-4h-status').textContent = formatTimerStatus(fourHour);
  document.getElementById('timer-4h-stats').innerHTML = renderTokenBreakdown(fourHour.roundIds, 'fourHour');
  
  // Weekly Section
  const weekly = timerStatus.weekly;
  document.getElementById('timer-weekly-status').textContent = formatTimerStatus(weekly);
  document.getElementById('timer-weekly-stats').innerHTML = renderTokenBreakdown(weekly.roundIds, 'weekly');
  
  // All Time Section
  const allTimeRoundIds = getAllRoundIds();
  document.getElementById('timer-alltime-stats').innerHTML = renderTokenBreakdown(allTimeRoundIds, 'allTime');
}

/**
 * Format timer status display
 */
function formatTimerStatus(timer) {
  if (!timer.active) return 'Inactive';
  
  const remaining = timer.timeRemaining;
  if (remaining <= 0) return 'Expired';
  
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  
  // For 4-hour: "Resets in 3 hr 34 min"
  // For weekly: "Resets Thu 9:59 AM"
  if (timer.endTime) {
    const endDate = new Date(timer.endTime);
    const isWeekly = remaining > (24 * 60 * 60 * 1000); // More than 1 day = weekly
    
    if (isWeekly) {
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][endDate.getDay()];
      const timeStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `Resets ${dayName} ${timeStr}`;
    } else {
      return `Resets in ${hours} hr ${minutes} min`;
    }
  }
  
  return `${hours} hr ${minutes} min remaining`;
}

/**
 * Render token breakdown by type
 */
function renderTokenBreakdown(roundIds, section) {
  const stats = calculateStatsFromRoundIds(roundIds);
  
  // Calculate total Opus tokens (all Opus versions combined)
  let opusTokens = 0;
  for (const modelName in stats.byModel) {
    if (modelName.toLowerCase().includes('opus')) {
      opusTokens += stats.byModel[modelName];
    }
  }
  
  const opusSection = section === 'weekly' ? `
    <div class="stat-row" style="margin-top: var(--dt-space-sm); padding-top: var(--dt-space-sm); border-top: 1px solid var(--dt-divider);">
      <span class="stat-label">Opus (separate)</span>
      <span class="stat-value">${Utils.formatLargeNumber(opusTokens)} tk</span>
    </div>
  ` : '';
  
  return `
    <div class="stat-group-title">Input</div>
    <div class="stat-group">
      <div class="stat-row">
        <span class="stat-label">User</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.user.chars)} ch · ${Utils.formatLargeNumber(stats.byType.user.tokens)} tk</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Docs</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.documents.chars)} ch · ${Utils.formatLargeNumber(stats.byType.documents.tokens)} tk</span>
      </div>
    </div>
    
    <div class="stat-group-title">Output</div>
    <div class="stat-group">
      <div class="stat-row">
        <span class="stat-label">Thinking</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.thinking.chars)} ch · ${Utils.formatLargeNumber(stats.byType.thinking.tokens)} tk</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Reply</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.assistant.chars)} ch · ${Utils.formatLargeNumber(stats.byType.assistant.tokens)} tk</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Tools</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.toolContent.chars)} ch · ${Utils.formatLargeNumber(stats.byType.toolContent.tokens)} tk</span>
      </div>
    </div>
    
    <div class="stat-row stat-total">
      <span class="stat-label">TOTAL</span>
      <span class="stat-value">${Utils.formatLargeNumber(stats.total.chars)} ch · ${Utils.formatLargeNumber(stats.total.tokens)} tk</span>
    </div>
    
    ${opusSection}
    
    <div class="stat-row" style="margin-top: var(--dt-space-xs); padding-top: var(--dt-space-xs); border-top: 1px solid var(--dt-divider);">
      <span class="stat-label">Rounds</span>
      <span class="stat-value">${stats.successfulRounds}</span>
    </div>
  `;
}

/**
 * Calculate stats from roundIds
 */
function calculateStatsFromRoundIds(roundIds) {
  const stats = {
    total: { chars: 0, tokens: 0 },
    successfulRounds: 0,  // ← Count successful rounds
    byType: {
      user: { chars: 0, tokens: 0 },
      documents: { chars: 0, tokens: 0 },
      thinking: { chars: 0, tokens: 0 },
      assistant: { chars: 0, tokens: 0 },
      toolContent: { chars: 0, tokens: 0 }
    },
    byModel: {}
  };
  
  if (!roundIds || roundIds.length === 0) {
    console.log('⚠️ No roundIds to calculate');
    return stats;
  }
  
  console.log(`📊 Calculating stats from ${roundIds.length} rounds:`, roundIds);
  
  for (const roundId of roundIds) {
    const [chatId, roundNumber] = roundId.split(':');
    const chat = allChats[chatId];
    
    if (!chat) {
      console.warn(`❌ Chat not found: ${chatId}`);
      continue;
    }
    
    if (!chat.rounds || !Array.isArray(chat.rounds)) {
      console.warn(`❌ Chat ${chatId} has no rounds array`);
      continue;
    }
    
    const round = chat.rounds[parseInt(roundNumber) - 1];
    
    if (!round) {
      console.warn(`❌ Round ${roundNumber} not found in chat ${chatId} (has ${chat.rounds.length} rounds)`);
      continue;
    }
    
    // ⚠️ SKIP ERROR ROUNDS
    if (round.error) {
      console.log(`⚠️ Skipping error round ${roundNumber} in chat ${chatId}: ${round.error}`);
      continue;
    }
    
    console.log(`✅ Found round ${roundNumber} in chat ${chatId}:`, round.total?.tokens, 'tokens', round.total?.chars, 'chars');
    
    // Count this as successful round
    stats.successfulRounds++;
    
    // Accumulate totals - both chars and tokens
    stats.total.chars += round.total?.chars || 0;
    stats.total.tokens += round.total?.tokens || 0;
    
    stats.byType.user.chars += round.user?.chars || 0;
    stats.byType.user.tokens += round.user?.tokens || 0;
    
    stats.byType.documents.chars += round.documents?.chars || 0;
    stats.byType.documents.tokens += round.documents?.tokens || 0;
    
    stats.byType.thinking.chars += round.thinking?.chars || 0;
    stats.byType.thinking.tokens += round.thinking?.tokens || 0;
    
    stats.byType.assistant.chars += round.assistant?.chars || 0;
    stats.byType.assistant.tokens += round.assistant?.tokens || 0;
    
    stats.byType.toolContent.chars += round.toolContent?.chars || 0;
    stats.byType.toolContent.tokens += round.toolContent?.tokens || 0;
    
    // Track by model
    const model = round.model || 'unknown';
    if (!stats.byModel[model]) stats.byModel[model] = 0;
    stats.byModel[model] += round.total?.tokens || 0;
  }
  
  console.log('📈 Final stats:', stats);
  return stats;
}

/**
 * Get all round IDs from all chats
 */
function getAllRoundIds() {
  const roundIds = [];
  
  for (const chatId in allChats) {
    const chat = allChats[chatId];
    if (chat.rounds) {
      for (let i = 0; i < chat.rounds.length; i++) {
        roundIds.push(`${chatId}:${i + 1}`);
      }
    }
  }
  
  return roundIds;
}

/**
 * Render conversations list
 */
function renderConversations() {
  const chatList = document.getElementById('chat-list');
  const searchQuery = document.getElementById('search-chats')?.value.toLowerCase() || '';
  const sortBy = document.getElementById('sort-chats')?.value || 'recent';
  
  let chatsArray = Object.values(allChats);
  
  // Filter by search query
  if (searchQuery) {
    chatsArray = chatsArray.filter(chat => 
      chat.title.toLowerCase().includes(searchQuery) ||
      chat.url.toLowerCase().includes(searchQuery)
    );
  }
  
  // Sort
  chatsArray.sort((a, b) => {
    switch (sortBy) {
      case 'tokens':
        return (b.stats?.totalTokens || 0) - (a.stats?.totalTokens || 0);
      case 'rounds':
        return (b.rounds?.length || 0) - (a.rounds?.length || 0);
      case 'recent':
      default:
        return new Date(b.lastActive) - new Date(a.lastActive);
    }
  });
  
  if (chatsArray.length === 0) {
    chatList.innerHTML = '<div class="empty-message">No conversations found</div>';
    return;
  }
  
  chatList.innerHTML = chatsArray.map(chat => {
    const totalTokens = chat.stats?.totalTokens || 0;
    const totalChars = chat.stats?.totalChars || 0;
    const roundCount = chat.rounds?.length || 0;
    
    return `
      <div class="chat-item" data-chat-id="${chat.id}">
        <div class="chat-item-header">
          <h3 class="chat-item-title">${escapeHtml(chat.title)}</h3>
          <span class="chat-item-date">${formatDate(chat.lastActive)}</span>
        </div>
        <div class="chat-item-stats">
          <span class="stat-badge">🔄 ${roundCount} rounds</span>
          <span class="stat-badge">🎯 ${Utils.formatLargeNumber(totalChars)} (~${Utils.formatLargeNumber(totalTokens)})</span>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click event listeners (CSP safe - no inline onclick)
  document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const chatId = item.getAttribute('data-chat-id');
      showChatDetail(chatId);
    });
  });
}

/**
 * Export data
 */
function exportData() {
  const dataStr = JSON.stringify({ chats: allChats, timers: timerStatus }, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `claude-tracker-export-${new Date().toISOString()}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Delete chats older than 30 days
 */
async function deleteOldChats() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const chatsToDelete = [];
  
  // Find old chats
  for (const [chatId, chat] of Object.entries(allChats)) {
    const lastActive = new Date(chat.lastActive).getTime();
    if (lastActive < thirtyDaysAgo) {
      chatsToDelete.push({ id: chatId, title: chat.title });
    }
  }
  
  if (chatsToDelete.length === 0) {
    alert('No chats older than 30 days found! ✅');
    return;
  }
  
  // Confirm deletion
  const message = `Delete ${chatsToDelete.length} chat(s) older than 30 days?\n\n` +
    chatsToDelete.slice(0, 5).map(c => `• ${c.title}`).join('\n') +
    (chatsToDelete.length > 5 ? `\n... and ${chatsToDelete.length - 5} more` : '');
  
  if (!confirm(message)) {
    return;
  }
  
  // Delete chats one by one
  for (const chat of chatsToDelete) {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_CHAT',
        data: { chatId: chat.id }
      });
      console.log(`🗑️ Deleted chat: ${chat.title}`);
    } catch (error) {
      console.error(`❌ Error deleting chat ${chat.id}:`, error);
    }
  }
  
  // Reload data and refresh UI
  await loadData();
  renderAll();
  
  alert(`✅ Deleted ${chatsToDelete.length} old chat(s)!`);
}

/**
 * Utility functions
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show chat detail view
 */
function showChatDetail(chatId) {
  const chat = allChats[chatId];
  if (!chat) return;
  
  // Hide conversations list
  document.getElementById('conversations-section').style.display = 'none';
  
  // Show detail view
  const detailView = document.getElementById('chat-detail-view') || createChatDetailView();
  detailView.style.display = 'block';
  
  // Render chat details
  renderChatDetail(chat);
}

/**
 * Create chat detail view container
 */
function createChatDetailView() {
  const detailView = document.createElement('section');
  detailView.id = 'chat-detail-view';
  detailView.className = 'stats-section';
  detailView.innerHTML = `
    <div class="section-header">
      <button id="back-to-list" class="back-button">← Back to List</button>
      <h2 id="detail-chat-title" class="section-title"></h2>
    </div>
    <div id="detail-chat-content"></div>
  `;
  
  // Insert after conversations section
  const conversationsSection = document.getElementById('conversations-section');
  conversationsSection.parentNode.insertBefore(detailView, conversationsSection.nextSibling);
  
  // Add back button listener
  document.getElementById('back-to-list').addEventListener('click', hideChatDetail);
  
  return detailView;
}

/**
 * Render chat detail content
 */
function renderChatDetail(chat) {
  document.getElementById('detail-chat-title').textContent = chat.title;
  
  const content = document.getElementById('detail-chat-content');
  
  // Chat metadata
  const metadata = `
    <div class="chat-metadata">
      <div class="metadata-item">
        <span class="metadata-label">Chat ID:</span>
        <span class="metadata-value">${chat.id.substring(0, 12)}...</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Last Active:</span>
        <span class="metadata-value">${new Date(chat.lastActive).toLocaleString()}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Total Rounds:</span>
        <span class="metadata-value">${chat.rounds?.length || 0}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Total Tokens:</span>
        <span class="metadata-value">${Utils.formatLargeNumber(chat.stats?.totalTokens || 0)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Total Characters:</span>
        <span class="metadata-value">${Utils.formatLargeNumber(chat.stats?.totalChars || 0)}</span>
      </div>
    </div>
  `;
  
  // Rounds list
  const rounds = chat.rounds || [];
  const roundsList = rounds.map((round, index) => `
    <div class="round-detail">
      <div class="round-header">
        <h3 class="round-title">Round #${index + 1}</h3>
        <span class="round-model">${round.model || 'Unknown'}</span>
        <span class="round-time">${Utils.formatRelativeTime(round.timestamp)}</span>
      </div>
      <div class="round-stats">
        <div class="stat-row">
          <span class="stat-label">User</span>
          <span class="stat-value">${Utils.formatLargeNumber(round.user?.chars || 0)} ch · ${Utils.formatLargeNumber(round.user?.tokens || 0)} tk</span>
        </div>
        ${round.documents && round.documents.chars > 0 ? `
          <div class="stat-row">
            <span class="stat-label">Docs</span>
            <span class="stat-value">${Utils.formatLargeNumber(round.documents.chars)} ch · ${Utils.formatLargeNumber(round.documents.tokens)} tk</span>
          </div>
        ` : ''}
        ${round.thinking && round.thinking.chars > 0 ? `
          <div class="stat-row">
            <span class="stat-label">Thinking</span>
            <span class="stat-value">${Utils.formatLargeNumber(round.thinking.chars)} ch · ${Utils.formatLargeNumber(round.thinking.tokens)} tk</span>
          </div>
        ` : ''}
        <div class="stat-row">
          <span class="stat-label">Reply</span>
          <span class="stat-value">${Utils.formatLargeNumber(round.assistant?.chars || 0)} ch · ${Utils.formatLargeNumber(round.assistant?.tokens || 0)} tk</span>
        </div>
        ${round.toolContent && round.toolContent.chars > 0 ? `
          <div class="stat-row">
            <span class="stat-label">Tools</span>
            <span class="stat-value">${Utils.formatLargeNumber(round.toolContent.chars)} ch · ${Utils.formatLargeNumber(round.toolContent.tokens)} tk</span>
          </div>
        ` : ''}
        <div class="stat-row total-row">
          <span class="stat-label">Total</span>
          <span class="stat-value">${Utils.formatLargeNumber(round.total?.chars || 0)} ch · ${Utils.formatLargeNumber(round.total?.tokens || 0)} tk</span>
        </div>
      </div>
    </div>
  `).join('');
  
  content.innerHTML = metadata + '<div class="rounds-list">' + roundsList + '</div>';
}

/**
 * Hide chat detail view and show conversations list
 */
function hideChatDetail() {
  const detailView = document.getElementById('chat-detail-view');
  if (detailView) {
    detailView.style.display = 'none';
  }
  
  document.getElementById('conversations-section').style.display = 'block';
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
