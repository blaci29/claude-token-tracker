/*
 * Options page script for Claude Token Tracker.
 *
 * Provides a UI for users to configure estimation settings, limits and other
 * preferences. Saves to chrome.storage and retrieves stored values on load.
 */
document.addEventListener('DOMContentLoaded', () => {
    const charsPerTokenInput = document.getElementById('charsPerToken');
    const fourHourLimitInput = document.getElementById('fourHourLimit');
    const weeklyLimitInput = document.getElementById('weeklyLimit');
    const saveButton = document.getElementById('save');
    // Load existing settings
    chrome.storage.local.get(['charsPerToken', 'fourHourLimit', 'weeklyLimit'], (result) => {
        if (result.charsPerToken)
            charsPerTokenInput.value = result.charsPerToken;
        if (result.fourHourLimit)
            fourHourLimitInput.value = result.fourHourLimit;
        if (result.weeklyLimit)
            weeklyLimitInput.value = result.weeklyLimit;
    });
    saveButton?.addEventListener('click', () => {
        const charsPerToken = parseFloat(charsPerTokenInput.value);
        const fourHourLimit = parseInt(fourHourLimitInput.value, 10);
        const weeklyLimit = parseInt(weeklyLimitInput.value, 10);
        chrome.storage.local.set({ charsPerToken, fourHourLimit, weeklyLimit }, () => {
            alert('Settings saved');
        });
    });
});
