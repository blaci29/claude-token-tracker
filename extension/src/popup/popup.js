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
      updateSettingsUI();
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
 * Update settings UI
 */
function updateSettingsUI() {
  if (!currentSettings) return;
  
  // Tracking toggle
  const trackingToggle = document.getElementById('tracking-toggle');
  trackingToggle.checked = currentSettings.trackingEnabled;
  
  // Token ratio
  const tokenRatio = document.getElementById('token-ratio');
  tokenRatio.value = currentSettings.tokenEstimation.central;
  
  // Overlay toggle
  const overlayToggle = document.getElementById('overlay-toggle');
  overlayToggle.checked = currentSettings.overlayEnabled;
}

/**
 * Update timer UI
 */
function updateTimerUI() {
  if (!timerStatus) return;
  
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
  const content = document.getElementById('four-hour-content');
  
  if (!fourHour.active) {
    content.classList.add('disabled');
    // KIKOMMENTEZVE - Nincs limit display
    // document.getElementById('4h-tokens').textContent = '0 / ~50,000';
    document.getElementById('4h-tokens').textContent = '0';
    document.getElementById('4h-remaining').textContent = 'Inactive';
    return;
  }
  
  content.classList.remove('disabled');
  
  // Tokens - KIKOMMENTEZVE limit display
  // const tokensText = `${Utils.formatLargeNumber(fourHour.tokens)} / ~${Utils.formatLargeNumber(fourHour.limit)}`;
  const tokensText = Utils.formatLargeNumber(fourHour.tokens);
  document.getElementById('4h-tokens').textContent = tokensText;
  
  // Progress bar - KIKOMMENTEZVE, nincs limit tracking
  // const percentage = parseFloat(fourHour.percentage);
  // const progressBar = document.getElementById('4h-progress');
  // progressBar.style.width = `${Math.min(percentage, 100)}%`;
  
  // Color based on percentage - KIKOMMENTEZVE
  // progressBar.classList.remove('warning', 'danger');
  // if (percentage >= 100) {
  //   progressBar.classList.add('danger');
  // } else if (percentage >= 90) {
  //   progressBar.classList.add('warning');
  // }
  
  // Remaining time - format: "Resets in 3 hr 34 min"
  if (fourHour.timeRemaining > 0) {
    const hours = Math.floor(fourHour.timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((fourHour.timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    document.getElementById('4h-remaining').textContent = `Resets in ${hours} hr ${minutes} min`;
  } else {
    document.getElementById('4h-remaining').textContent = 'Expired';
  }
}

/**
 * Update weekly timer display
 */
function updateWeeklyTimer() {
  const weekly = timerStatus.weekly;
  const content = document.getElementById('weekly-content');
  
  if (!weekly.active) {
    content.classList.add('disabled');
    // KIKOMMENTEZVE - Nincs limit display
    // document.getElementById('week-tokens').textContent = '0 / ~200,000';
    document.getElementById('week-tokens').textContent = '0';
    document.getElementById('week-reset').textContent = 'Inactive';
    return;
  }
  
  content.classList.remove('disabled');
  
  // Tokens - KIKOMMENTEZVE limit display
  // const tokensText = `${Utils.formatLargeNumber(weekly.tokens)} / ~${Utils.formatLargeNumber(weekly.limit)}`;
  const tokensText = Utils.formatLargeNumber(weekly.tokens);
  document.getElementById('week-tokens').textContent = tokensText;
  
  // Progress bar - KIKOMMENTEZVE, nincs limit tracking
  // const percentage = parseFloat(weekly.percentage);
  // const progressBar = document.getElementById('week-progress');
  // progressBar.style.width = `${Math.min(percentage, 100)}%`;
  
  // Color based on percentage - KIKOMMENTEZVE
  // progressBar.classList.remove('warning', 'danger');
  // if (percentage >= 100) {
  //   progressBar.classList.add('danger');
  // } else if (percentage >= 90) {
  //   progressBar.classList.add('warning');
  // }
  
  // Reset time - format: "Resets Thu 9:59 AM"
  if (weekly.endTime) {
    const endDate = new Date(weekly.endTime);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][endDate.getDay()];
    const timeStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    document.getElementById('week-reset').textContent = `Resets ${dayName} ${timeStr}`;
  } else {
    document.getElementById('week-reset').textContent = 'No end time set';
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
      }
    } catch (error) {
      console.error('Error toggling tracking:', error);
    }
  });
  
  // Token ratio
  document.getElementById('token-ratio').addEventListener('change', async (e) => {
    try {
      const newRatio = parseFloat(e.target.value);
      
      if (newRatio >= 1 && newRatio <= 5) {
        currentSettings.tokenEstimation.central = newRatio;
        
        await chrome.runtime.sendMessage({
          type: CONSTANTS.MSG_TYPES.UPDATE_SETTINGS,
          data: { settings: currentSettings }
        });
      }
    } catch (error) {
      console.error('Error updating token ratio:', error);
    }
  });
  
  // 4-hour timer controls
  document.getElementById('start-4h').addEventListener('click', async () => {
    try {
      if (timerStatus.fourHour.enabled) {
        // Stop timer - just disable it
        timerStatus.fourHour.enabled = false;
        await chrome.runtime.sendMessage({
          type: CONSTANTS.MSG_TYPES.RESET_TIMER,
          data: { timerType: CONSTANTS.TIMER_TYPES.FOUR_HOUR }
        });
      } else {
        // Start timer
        await chrome.runtime.sendMessage({
          type: CONSTANTS.MSG_TYPES.RESET_TIMER,
          data: { timerType: CONSTANTS.TIMER_TYPES.FOUR_HOUR }
        });
      }
      
      await loadTimerStatus();
    } catch (error) {
      console.error('Error toggling 4h timer:', error);
    }
  });
  
  document.getElementById('reset-4h').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.RESET_TIMER,
        data: { timerType: CONSTANTS.TIMER_TYPES.FOUR_HOUR }
      });
      
      await loadTimerStatus();
    } catch (error) {
      console.error('Error resetting 4h timer:', error);
    }
  });
  
  document.getElementById('set-4h-end').addEventListener('click', async () => {
    // Simple prompt for now - could be improved with a better time picker
    const hours = prompt('Set end time (hours from now):', '4');
    
    if (hours) {
      const hoursNum = parseFloat(hours);
      if (hoursNum > 0) {
        const endTime = new Date(Date.now() + hoursNum * 60 * 60 * 1000).toISOString();
        
        try {
          await chrome.runtime.sendMessage({
            type: CONSTANTS.MSG_TYPES.SET_TIMER_END,
            data: { endTime }
          });
          
          await loadTimerStatus();
        } catch (error) {
          console.error('Error setting timer end:', error);
        }
      }
    }
  });
  
  // Weekly timer controls
  document.getElementById('start-weekly').addEventListener('click', async () => {
    try {
      if (timerStatus.weekly.enabled) {
        // Stop timer
        timerStatus.weekly.enabled = false;
        await chrome.runtime.sendMessage({
          type: CONSTANTS.MSG_TYPES.RESET_TIMER,
          data: { timerType: CONSTANTS.TIMER_TYPES.WEEKLY }
        });
      } else {
        // Start timer
        await chrome.runtime.sendMessage({
          type: CONSTANTS.MSG_TYPES.RESET_TIMER,
          data: { timerType: CONSTANTS.TIMER_TYPES.WEEKLY }
        });
      }
      
      await loadTimerStatus();
    } catch (error) {
      console.error('Error toggling weekly timer:', error);
    }
  });
  
  document.getElementById('reset-weekly').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.RESET_TIMER,
        data: { timerType: CONSTANTS.TIMER_TYPES.WEEKLY }
      });
      
      await loadTimerStatus();
    } catch (error) {
      console.error('Error resetting weekly timer:', error);
    }
  });
  
  // Overlay toggle
  document.getElementById('overlay-toggle').addEventListener('change', async (e) => {
    try {
      await chrome.runtime.sendMessage({
        type: CONSTANTS.MSG_TYPES.TOGGLE_OVERLAY,
        data: { enabled: e.target.checked }
      });
      
      if (currentSettings) {
        currentSettings.overlayEnabled = e.target.checked;
      }
      
      // Notify current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url.includes('claude.ai')) {
        chrome.tabs.sendMessage(tab.id, {
          type: CONSTANTS.MSG_TYPES.TOGGLE_OVERLAY,
          data: { enabled: e.target.checked }
        });
      }
    } catch (error) {
      console.error('Error toggling overlay:', error);
    }
  });
  
  // Action buttons
  document.getElementById('open-stats').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/stats/stats.html') });
  });
  
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Support button
  document.getElementById('support-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://ko-fi.com/yourname' }); // Replace with actual donation URL
  });
}

/**
 * Start auto-update interval
 */
function startAutoUpdate() {
  // Update timer UI every second
  updateInterval = setInterval(async () => {
    await loadTimerStatus();
  }, 1000);
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