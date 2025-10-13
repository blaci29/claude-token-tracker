/*
 * Service worker entry point for the extension.
 *
 * Responsibilities:
 * - Receive messages from content scripts containing round data.
 * - Delegate heavy computation to a Web Worker for token processing.
 * - Manage limit timers via chrome.alarms and persist aggregated stats.
 * - Respond to requests from the popup and options pages with stored data.
 *
 * This is a stub implementation.
 */


// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'contentScriptLoaded') {
    console.log('Content script reported loaded at', new Date(message.data.timestamp));
    // TODO: initialize state for this tab if necessary
  }
  // Additional message handlers will be added here
  return false; // indicates asynchronous response is not expected
});

// Placeholder alarm listener for limit timers
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm triggered', alarm.name);
  // TODO: update usage counters and notify UI
});