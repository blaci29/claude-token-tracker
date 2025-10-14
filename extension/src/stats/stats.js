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
    
    if (chatsResponse?.success) {
      allChats = chatsResponse.data || {};
      console.log('📦 Loaded chats:', Object.keys(allChats).length, allChats);
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
  
  const percentage = section === 'allTime' ? 100 : 
    (stats.total / (section === 'fourHour' ? 50000 : 200000)) * 100;
  
  const opusSection = section === 'weekly' ? `
    <div class="stat-row opus-row">
      <span class="stat-label">Opus (separate)</span>
      <span class="stat-value">${Utils.formatLargeNumber(stats.byModel?.opus || 0)}</span>
    </div>
  ` : '';
  
  return `
    <div class="token-breakdown">
      <div class="stat-row total-row">
        <span class="stat-label">Total Tokens</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.total)}</span>
      </div>
      ${section !== 'allTime' ? `
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
        </div>
        <div class="stat-label-small">${percentage.toFixed(1)}% of limit</div>
      ` : ''}
      
      <div class="stat-divider"></div>
      
      <div class="stat-row">
        <span class="stat-label">👤 User Messages</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.user)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">📄 Documents</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.documents)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">🧠 Thinking</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.thinking)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">🤖 Assistant</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.assistant)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">🔧 Tools</span>
        <span class="stat-value">${Utils.formatLargeNumber(stats.byType.toolContent)}</span>
      </div>
      
      ${opusSection}
      
      <div class="stat-divider"></div>
      
      <div class="stat-row">
        <span class="stat-label">Rounds</span>
        <span class="stat-value">${roundIds.length}</span>
      </div>
    </div>
  `;
}

/**
 * Calculate stats from roundIds
 */
function calculateStatsFromRoundIds(roundIds) {
  const stats = {
    total: 0,
    byType: {
      user: 0,
      documents: 0,
      thinking: 0,
      assistant: 0,
      toolContent: 0
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
    
    console.log(`✅ Found round ${roundNumber} in chat ${chatId}:`, round.total?.tokens, 'tokens');
    
    stats.total += round.total?.tokens || 0;
    stats.byType.user += round.user?.tokens || 0;
    stats.byType.documents += round.documents?.tokens || 0;
    stats.byType.thinking += round.thinking?.tokens || 0;
    stats.byType.assistant += round.assistant?.tokens || 0;
    stats.byType.toolContent += round.toolContent?.tokens || 0;
    
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
  
  const chatsArray = Object.values(allChats).sort((a, b) => {
    return new Date(b.lastActive) - new Date(a.lastActive);
  });
  
  if (chatsArray.length === 0) {
    chatList.innerHTML = '<div class="empty-message">No conversations yet</div>';
    return;
  }
  
  chatList.innerHTML = chatsArray.map(chat => {
    const totalTokens = chat.stats?.totalTokens || 0;
    const roundCount = chat.rounds?.length || 0;
    
    return `
      <div class="chat-item" data-chat-id="${chat.id}">
        <div class="chat-item-header">
          <h3 class="chat-item-title">${escapeHtml(chat.title)}</h3>
          <span class="chat-item-date">${formatDate(chat.lastActive)}</span>
        </div>
        <div class="chat-item-stats">
          <span class="stat-badge">🔄 ${roundCount} rounds</span>
          <span class="stat-badge">🎯 ${Utils.formatLargeNumber(totalTokens)} tokens</span>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click listeners
  document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const chatId = item.dataset.chatId;
      const chat = allChats[chatId];
      if (chat?.url) {
        window.open(chat.url, '_blank');
      }
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

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
