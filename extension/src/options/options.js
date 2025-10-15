/**
 * CLAUDE TOKEN TRACKER - OPTIONS PAGE SCRIPT
 * Handles settings UI and persistence
 */

let currentSettings = null;
let hasUnsavedChanges = false;

/**
 * Initialize options page
 */
async function init() {
  console.log('Options page initializing...');
  
  // Load current settings
  await loadSettings();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load storage info
  await updateStorageInfo();
  
  console.log('Options page ready');
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
      populateForm();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showNotification('Error loading settings', 'error');
  }
}

/**
 * Populate form with current settings
 */
function populateForm() {
  if (!currentSettings) return;
  
  // Token estimation - central
  document.getElementById('central-ratio').value = currentSettings.tokenEstimation.central;
  
  // Token estimation - overrides
  const overrides = currentSettings.tokenEstimation.overrides;
  document.getElementById('ratio-user').value = overrides.userMessage || '';
  document.getElementById('ratio-docs').value = overrides.userDocuments || '';
  document.getElementById('ratio-thinking').value = overrides.thinking || '';
  document.getElementById('ratio-assistant').value = overrides.assistant || '';
  document.getElementById('ratio-tool').value = overrides.toolContent || '';
  
  // Overlay settings
  document.getElementById('overlay-default').checked = currentSettings.overlayEnabled;
  document.getElementById('overlay-remember-position').checked = true; // Always enabled in v1.0
  
  // Advanced settings
  document.getElementById('console-filter').checked = currentSettings.consoleSpamFilter;
  document.getElementById('debug-mode').checked = currentSettings.debugMode;
  
  hasUnsavedChanges = false;
}

/**
 * Collect settings from form
 */
function collectSettings() {
  const settings = {
    ...currentSettings,
    
    // Token estimation
    tokenEstimation: {
      central: parseFloat(document.getElementById('central-ratio').value) || 2.6,
      overrides: {
        userMessage: parseFloat(document.getElementById('ratio-user').value) || null,
        userDocuments: parseFloat(document.getElementById('ratio-docs').value) || null,
        thinking: parseFloat(document.getElementById('ratio-thinking').value) || null,
        assistant: parseFloat(document.getElementById('ratio-assistant').value) || null,
        toolContent: parseFloat(document.getElementById('ratio-tool').value) || null
      }
    },
    
    // Overlay
    overlayEnabled: document.getElementById('overlay-default').checked,
    
    // Advanced
    consoleSpamFilter: document.getElementById('console-filter').checked,
    debugMode: document.getElementById('debug-mode').checked
  };
  
  return settings;
}

/**
 * Save settings
 */
async function saveSettings() {
  try {
    const settings = collectSettings();
    
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.UPDATE_SETTINGS,
      data: { settings }
    });
    
    if (response.success) {
      currentSettings = settings;
      hasUnsavedChanges = false;
      showNotification('Settings saved successfully!');
    } else {
      showNotification('Error saving settings', 'error');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Error saving settings', 'error');
  }
}

/**
 * Reset to defaults
 */
async function resetToDefaults() {
  if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.UPDATE_SETTINGS,
      data: { settings: CONSTANTS.DEFAULTS }
    });
    
    if (response.success) {
      currentSettings = CONSTANTS.DEFAULTS;
      populateForm();
      showNotification('Settings reset to defaults');
    }
  } catch (error) {
    console.error('Error resetting settings:', error);
    showNotification('Error resetting settings', 'error');
  }
}

/**
 * Export data
 */
async function exportData() {
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
      showNotification('Data exported successfully!');
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    showNotification('Error exporting data', 'error');
  }
}

/**
 * Import data
 */
function importData() {
  document.getElementById('import-file').click();
}

/**
 * Handle import file selection
 */
async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validate data structure
    if (!data.chats || !data.settings || !data.timers) {
      showNotification('Invalid data format - missing required fields', 'error');
      throw new Error('Invalid data format');
    }
    
    // Show confirmation with details
    const chatCount = Object.keys(data.chats || {}).length;
    const confirmMessage = 
      `⚠️ IMPORT WARNING ⚠️\n\n` +
      `This will REPLACE ALL current data with:\n` +
      `• ${chatCount} chat(s) from the import file\n` +
      `• All settings from the import file\n` +
      `• All timer data from the import file\n\n` +
      `Your current data will be PERMANENTLY DELETED.\n\n` +
      `Type "IMPORT" to confirm:`;
    
    const confirmation = prompt(confirmMessage);
    
    if (confirmation !== 'IMPORT') {
      showNotification('Import cancelled', 'error');
      event.target.value = ''; // Reset file input
      return;
    }
    
    // Send to worker to import
    const response = await chrome.runtime.sendMessage({
      type: 'IMPORT_DATA',
      data: { importData: data }
    });
    
    if (response.success) {
      await loadSettings();
      await updateStorageInfo();
      showNotification(`Successfully imported ${chatCount} chat(s)!`);
    } else {
      showNotification('Import failed: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Error importing data:', error);
    showNotification('Error importing data: ' + error.message, 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

/**
 * Reset all data
 */
async function resetAllData() {
  const confirmation = prompt(
    '⚠️ DANGER: PERMANENT DATA DELETION ⚠️\n\n' +
    'This will DELETE ALL:\n' +
    '• Chat history and conversations\n' +
    '• Token usage statistics\n' +
    '• Timer data (4-hour and weekly)\n' +
    '• All tracked rounds\n\n' +
    'Settings will be reset to defaults.\n\n' +
    'THIS CANNOT BE UNDONE!\n\n' +
    'Type "DELETE ALL" to confirm:'
  );
  
  if (confirmation !== 'DELETE ALL') {
    if (confirmation !== null) { // User didn't cancel
      showNotification('Reset cancelled - incorrect confirmation', 'error');
    }
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: CONSTANTS.MSG_TYPES.RESET_ALL_DATA
    });
    
    if (response.success) {
      await loadSettings();
      await updateStorageInfo();
      showNotification('All data has been permanently deleted');
    } else {
      showNotification('Reset failed: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Error resetting data:', error);
    showNotification('Error resetting data: ' + error.message, 'error');
  }
}

/**
 * Update storage info display
 */
async function updateStorageInfo() {
  try {
    const bytesInUse = await chrome.storage.local.getBytesInUse(null);
    const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
    
    const usedMB = (bytesInUse / 1024 / 1024).toFixed(2);
    const quotaMB = (quota / 1024 / 1024).toFixed(0);
    const percentage = ((bytesInUse / quota) * 100).toFixed(1);
    
    document.getElementById('storage-used').textContent = `${usedMB} MB (${percentage}%)`;
    document.getElementById('storage-quota').textContent = `${quotaMB} MB`;
    
    console.log('Storage info updated:', { usedMB, quotaMB, percentage });
  } catch (error) {
    console.error('Error getting storage info:', error);
    document.getElementById('storage-used').textContent = 'Error';
    document.getElementById('storage-quota').textContent = 'Error';
  }
}

/**
 * Show notification
 */
function showNotification(message, type = 'success') {
  const notification = document.getElementById('save-notification');
  const icon = notification.querySelector('.notification-icon');
  const text = notification.querySelector('.notification-text');
  
  // Set content
  text.textContent = message;
  
  // Set icon and color based on type
  if (type === 'error') {
    icon.textContent = '❌';
    notification.style.background = '#f44336'; // Red for errors
  } else {
    icon.textContent = '✅';
    notification.style.background = '#00d26a'; // Green for success
  }
  
  // Show
  notification.classList.remove('hidden');
  
  // Hide after 3 seconds
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Save button
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // Reset to defaults
  document.getElementById('reset-defaults').addEventListener('click', resetToDefaults);
  
  // Export data
  document.getElementById('export-data').addEventListener('click', exportData);
  
  // Import data
  document.getElementById('import-data').addEventListener('click', importData);
  document.getElementById('import-file').addEventListener('change', handleImportFile);
  
  // Reset data
  document.getElementById('reset-data').addEventListener('click', resetAllData);
  
  // Open stats
  document.getElementById('open-stats').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('src/stats/stats.html') });
  });
  
  // Track changes
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      hasUnsavedChanges = true;
    });
  });
  
  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveSettings();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}