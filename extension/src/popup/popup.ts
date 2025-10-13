/*
 * Popup script for the extension's browser action.
 *
 * Fetches aggregated usage statistics from the background and renders them
 * in the popup UI. Provides navigation to the options page.
 */

document.addEventListener('DOMContentLoaded', () => {
  const statsContainer = document.getElementById('stats-container');
  const openOptions = document.getElementById('openOptions');

  // Request stats from background
  chrome.runtime.sendMessage({ type: 'getStats' }, (response) => {
    if (response?.stats) {
      statsContainer!.textContent = JSON.stringify(response.stats, null, 2);
    } else {
      statsContainer!.textContent = 'No data yet.';
    }
  });

  openOptions?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});