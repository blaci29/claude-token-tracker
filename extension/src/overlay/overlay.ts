/*
 * Overlay component injected into Claude.ai pages.
 *
 * Displays a floating widget with real‑time token usage and controls to start
 * or stop limit counters. The overlay can be repositioned by the user and
 * toggled on/off via settings.
 */

// Create overlay element
const overlay = document.createElement('div');
overlay.id = 'ctt-overlay';
overlay.style.position = 'fixed';
overlay.style.bottom = '1rem';
overlay.style.right = '1rem';
overlay.style.zIndex = '10000';
overlay.style.background = '#333';
overlay.style.color = '#fff';
overlay.style.padding = '0.5rem';
overlay.style.borderRadius = '4px';
overlay.style.fontSize = '12px';

overlay.textContent = 'Loading...';
document.body.appendChild(overlay);

// Listen for updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'updateOverlay') {
    overlay.textContent = message.text;
  }
});