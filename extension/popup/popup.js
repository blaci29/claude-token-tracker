// Popup logic for Claude Token Tracker extension

document.addEventListener('DOMContentLoaded', async () => {
  // Load current state
  await loadState();
  
  // Setup event listeners
  setupEventListeners();
  
  // Update stats every second
  setInterval(loadState, 1000);
});

// Load current tracking state
async function loadState() {
  try {
    const result = await chrome.storage.local.get(['isActive', 'trackerData', 'apiKey']);
    
    const isActive = result.isActive !== false; // Default true
    const trackerData = result.trackerData || { global: { totalTokens: 0, totalChars: 0, roundCount: 0 } };
    const hasApiKey = !!result.apiKey;
    
    // Update UI
    updateStatusUI(isActive);
    updateStatsUI(trackerData);
    updateApiUI(hasApiKey);
    
  } catch (error) {
    console.error('Error loading state:', error);
  }
}

// Update status indicator
function updateStatusUI(isActive) {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const toggleBtn = document.getElementById('toggle-btn');
  
  if (isActive) {
    statusDot.className = 'dot active';
    statusText.textContent = 'Active';
    toggleBtn.textContent = 'Turn Off';
    toggleBtn.className = 'toggle-btn';
  } else {
    statusDot.className = 'dot inactive';
    statusText.textContent = 'Inactive';
    toggleBtn.textContent = 'Turn On';
    toggleBtn.className = 'toggle-btn off';
  }
}

// Update stats display
function updateStatsUI(data) {
  const totalTokens = data.global?.totalTokens || 0;
  const totalChars = data.global?.totalChars || 0;
  const roundCount = data.global?.roundCount || 0;
  
  document.getElementById('total-tokens').textContent = totalTokens.toLocaleString();
  document.getElementById('total-chars').textContent = totalChars.toLocaleString();
  document.getElementById('total-rounds').textContent = roundCount;
}

// Update API status
function updateApiUI(hasApiKey) {
  const apiStatus = document.getElementById('api-status');
  const configBtn = document.getElementById('config-api-btn');
  
  if (hasApiKey) {
    apiStatus.textContent = 'API Key: Configured ✓';
    apiStatus.className = 'api-status configured';
    configBtn.textContent = 'Update API Key';
  } else {
    apiStatus.textContent = 'API Key: Not configured';
    apiStatus.className = 'api-status';
    configBtn.textContent = 'Configure API Key';
  }
}

// Setup event listeners
function setupEventListeners() {
  // Toggle tracking on/off
  document.getElementById('toggle-btn').addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['isActive']);
    const newState = !(result.isActive !== false);
    
    await chrome.storage.local.set({ isActive: newState });
    updateStatusUI(newState);
    
    // Send message to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('claude.ai')) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'toggleTracking', 
        isActive: newState 
      });
    }
  });
  
  // Configure API key
  document.getElementById('config-api-btn').addEventListener('click', async () => {
    const apiKey = prompt('Enter your Anthropic API key:\n(Stored locally in browser storage)');
    
    if (apiKey && apiKey.trim() !== '') {
      await chrome.storage.local.set({ apiKey: apiKey.trim() });
      updateApiUI(true);
      alert('API key saved! Exact token counting will be enabled.');
    }
  });
  
  // View detailed stats
  document.getElementById('view-stats-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url?.includes('claude.ai')) {
      chrome.tabs.sendMessage(tab.id, { action: 'showStats' });
      window.close();
    } else {
      alert('Please open a Claude.ai tab to view detailed statistics.');
    }
  });
  
  // Clear all data
  document.getElementById('clear-data-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all tracking data? This cannot be undone.')) {
      await chrome.storage.local.remove('trackerData');
      await loadState();
      alert('All tracking data has been cleared.');
    }
  });
}