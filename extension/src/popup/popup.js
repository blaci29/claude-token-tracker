/**
 * CLAUDE TOKEN TRACKER - POPUP SCRIPT
 * Handles popup UI interactions and displays timer status
 */

let currentSettings = null;
let timerStatus = null;
let updateInterval = null;

/**
 * Initialize popup
 */
async function init() {
  console.log('Popup initializing...');
  
  // Load settings and timer status
  await loadSettings();
  await loadTimerStatus();
  
  // Set up event listeners
  setupEventListeners();
  
  // Start auto-update
  startAutoUpdate();
  
  console.log('Popup ready');
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.GET_SETTINGS
    });
    
    if (response.success) {
      currentSettings = response.data;
      updateTrackingToggle();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Load timer status
 */
async function loadTimerStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.GET_TIMER_STATUS
    });
    
    if (response.success) {
      timerStatus = response.data;
      updateTimerUI();
    }
  } catch (error) {
    console.error('Error loading timer status:', error);
  }
}

/**
 * Update tracking toggle
 */
function updateTrackingToggle() {
  if (!currentSettings) return;
  
  const trackingToggle = document.getElementById('tracking-toggle');
  const trackingStatus = document.getElementById('tracking-status');
  
  trackingToggle.checked = currentSettings.trackingEnabled;
  trackingStatus.textContent = currentSettings.trackingEnabled ? 'ON' : 'OFF';
  
  if (currentSettings.trackingEnabled) {
    trackingStatus.classList.add('active');
  } else {
    trackingStatus.classList.remove('active');
  }
}

/**
 * Update timer UI
 */
function updateTimerUI() {
  if (!timerStatus) return;
  
  console.log('🔄 Updating timer UI with:', timerStatus);
  
  // 4-hour timer
  update4HourTimer();
  
  // Weekly timer
  updateWeeklyTimer();
}

/**
 * Update 4-hour timer display
 */
function update4HourTimer() {
  const fourHour = timerStatus.fourHour;
  
  console.log('⏱️ 4-hour timer data:', fourHour);
  
  // End time
  const endEl = document.getElementById('4h-end');
  if (fourHour.active && fourHour.endTime) {
    const endDate = new Date(fourHour.endTime);
    const timeStr = endDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    endEl.textContent = timeStr;
  } else {
    endEl.textContent = 'Not started';
  }
  
  // Chars and tokens
  document.getElementById('4h-chars').textContent = `${Utils.formatLargeNumber(fourHour.chars || 0)} chars`;
  document.getElementById('4h-tokens').textContent = `${Utils.formatLargeNumber(fourHour.tokens || 0)} tokens`;
  
  // Progress bar - time-based (how much time has elapsed)
  const totalDuration = fourHour.endTime - fourHour.startTime;
  const elapsed = Date.now() - fourHour.startTime;
  const percentage = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
  
  const progressBar = document.getElementById('4h-progress');
  progressBar.style.width = `${percentage}%`;
  
  // Color based on percentage
  progressBar.classList.remove('warning', 'danger');
  if (percentage >= 90) {
    progressBar.classList.add('danger');
  } else if (percentage >= 75) {
    progressBar.classList.add('warning');
  }
  
  // Update button states
  const startBtn = document.getElementById('start-4h');
  if (fourHour.active) {
    startBtn.textContent = 'Running...';
    startBtn.disabled = true;
    startBtn.classList.remove('btn-primary');
    startBtn.classList.add('btn-ghost');
    startBtn.style.cursor = 'not-allowed';
  } else {
    startBtn.textContent = 'Start';
    startBtn.disabled = false;
    startBtn.classList.add('btn-primary');
    startBtn.classList.remove('btn-ghost');
    startBtn.style.cursor = 'pointer';
  }
}

/**
 * Update weekly timer display
 */
function updateWeeklyTimer() {
  const weekly = timerStatus.weekly;
  
  // Reset time
  const resetEl = document.getElementById('week-reset');
  if (weekly.active && weekly.endTime) {
    const endDate = new Date(weekly.endTime);
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][endDate.getDay()];
    const timeStr = endDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    resetEl.textContent = `${dayName} ${timeStr}`;
  } else {
    resetEl.textContent = 'Not started';
  }
  
  // Chars and tokens
  document.getElementById('week-chars').textContent = `${Utils.formatLargeNumber(weekly.chars || 0)} chars`;
  document.getElementById('week-tokens').textContent = `${Utils.formatLargeNumber(weekly.tokens || 0)} tokens`;
  
  // Opus count (estimate: 1 message ≈ ~400 tokens)
  const opusMessages = Math.round((weekly.tokens || 0) / 400);
  document.getElementById('opus-count').textContent = `~${opusMessages} / 500 messages`;
  
  // Progress bar - time-based (how much time has elapsed)
  const totalDuration = weekly.endTime - weekly.startTime;
  const elapsed = Date.now() - weekly.startTime;
  const percentage = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
  
  const progressBar = document.getElementById('week-progress');
  progressBar.style.width = `${percentage}%`;
  
  // Color based on percentage
  progressBar.classList.remove('warning', 'danger');
  if (percentage >= 90) {
    progressBar.classList.add('danger');
  } else if (percentage >= 75) {
    progressBar.classList.add('warning');
  }
  
  // Update button states
  const startBtn = document.getElementById('start-weekly');
  if (weekly.active) {
    startBtn.textContent = 'Running...';
    startBtn.disabled = true;
    startBtn.classList.remove('btn-primary');
    startBtn.classList.add('btn-ghost');
    startBtn.style.cursor = 'not-allowed';
  } else {
    startBtn.textContent = 'Start';
    startBtn.disabled = false;
    startBtn.classList.add('btn-primary');
    startBtn.classList.remove('btn-ghost');
    startBtn.style.cursor = 'pointer';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Tracking toggle
  document.getElementById('tracking-toggle').addEventListener('change', async (e) => {
    try {
      await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.TOGGLE_TRACKING,
        data: { enabled: e.target.checked }
      });
      
      if (currentSettings) {
        currentSettings.trackingEnabled = e.target.checked;
        updateTrackingToggle();
      }
    } catch (error) {
      console.error('Error toggling tracking:', error);
    }
  });
  
  // 4-hour timer start
  document.getElementById('start-4h').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.RESET_TIMER,
        data: { timerType: CONSTANTS.TIMER_TYPES.FOUR_HOUR }
      });
      
      await loadTimerStatus();
    } catch (error) {
      console.error('Error starting 4h timer:', error);
    }
  });
  
  // Weekly timer start
  document.getElementById('start-weekly').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.RESET_TIMER,
        data: { timerType: CONSTANTS.TIMER_TYPES.WEEKLY }
      });
      
      await loadTimerStatus();
    } catch (error) {
      console.error('Error starting weekly timer:', error);
    }
  });
  
  // Navigation buttons
  document.getElementById('open-stats').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/stats/stats.html') });
  });
  
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

/**
 * Start auto-update interval
 */
function startAutoUpdate() {
  // Update every 5 seconds
  updateInterval = setInterval(async () => {
    await loadTimerStatus();
  }, 5000);
}

/**
 * Stop auto-update interval
 */
function stopAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Clean up on unload
window.addEventListener('unload', stopAutoUpdate);
