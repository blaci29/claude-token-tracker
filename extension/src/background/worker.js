/**
 * CLAUDE TOKEN TRACKER - SERVICE WORKER
 * Central message handler and coordination
 */

// ES6 Imports
import { CONSTANTS } from '../shared/constants.module.js';
import { TokenEstimator } from '../shared/estimator.module.js';
import { StorageManager } from './storage.js';
import { TimerManager } from './timer.js';
import { Aggregator } from './aggregator.js';

console.log('Claude Token Tracker Service Worker starting...');

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    await StorageManager.initialize();
    console.log('Storage initialized for first install');
  }
  
  if (details.reason === 'update') {
    console.log('Extension updated from', details.previousVersion, 'to', CONSTANTS.VERSION);
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨', message.type);
  
  handleMessage(message, sender)
    .then(response => {
      sendResponse({ success: true, data: response });
    })
    .catch(error => {
      console.error('❌ Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });
  
  return true; // Keep the message channel open for async response
});

/**
 * Main message handler
 */
async function handleMessage(message, sender) {
  const { type, data } = message;
  
  switch (type) {
    case CONSTANTS.MSG_TYPES.ROUND_COMPLETED:
      return await handleRoundCompleted(data);
    
    case CONSTANTS.MSG_TYPES.GET_CHAT_DATA:
      return await handleGetChatData(data);
    
    case CONSTANTS.MSG_TYPES.GET_GLOBAL_STATS:
      return await handleGetGlobalStats(data);
    
    case CONSTANTS.MSG_TYPES.GET_TIMER_STATUS:
      return await handleGetTimerStatus();
    
    case CONSTANTS.MSG_TYPES.RESET_TIMER:
      return await handleResetTimer(data);
    
    case CONSTANTS.MSG_TYPES.SET_TIMER_END:
      return await handleSetTimerEnd(data);
    
    case CONSTANTS.MSG_TYPES.TOGGLE_TRACKING:
      return await handleToggleTracking(data);
    
    case CONSTANTS.MSG_TYPES.UPDATE_SETTINGS:
      return await handleUpdateSettings(data);
    
    case CONSTANTS.MSG_TYPES.EXPORT_DATA:
      return await handleExportData();
    
    case CONSTANTS.MSG_TYPES.DELETE_CHAT:
      return await handleDeleteChat(data);
    
    case CONSTANTS.MSG_TYPES.RESET_ALL_DATA:
      return await handleResetAllData();
    
    case CONSTANTS.MSG_TYPES.GET_SETTINGS:
      return await handleGetSettings();
    
    case CONSTANTS.MSG_TYPES.TOGGLE_OVERLAY:
      return await handleToggleOverlay(data);

    case 'GET_ALL_CHATS':
      return await handleGetAllChats();
    
    case 'IMPORT_DATA':
      return await handleImportData(data);
    
    case 'OPEN_OPTIONS_PAGE':
      chrome.runtime.openOptionsPage();
      return { success: true };
    
    case 'OPEN_STATS_PAGE':
      const statsUrl = chrome.runtime.getURL('src/stats/stats.html');
      await chrome.tabs.create({ url: statsUrl });
      return { success: true };
    
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Handle round completed
 */
async function handleRoundCompleted(data) {
  const { chatId, chatUrl, chatTitle, chatType, round } = data;
  
  const settings = await StorageManager.getSettings();
  
  if (!settings.trackingEnabled) {
    console.log('Tracking disabled - round not saved');
    return { saved: false, reason: 'tracking_disabled' };
  }
  
  let chat = await StorageManager.getChat(chatId);
  
  if (!chat) {
    chat = {
      id: chatId,
      url: chatUrl,
      title: chatTitle || 'Untitled Chat',
      type: chatType || CONSTANTS.CHAT_TYPES.UNKNOWN,
      rounds: [],
      stats: {},
      created: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
  }
  
  const estimatedRound = {
    roundNumber: chat.rounds.length + 1,
    timestamp: round.timestamp || new Date().toISOString(),
    model: round.model || 'unknown',
    hasThinking: round.hasThinking || false,
    
    user: {
      chars: round.user?.chars || 0,
      tokens: TokenEstimator.estimate(round.user?.chars || 0, 'userMessage', settings)
    },
    documents: {
      chars: round.documents?.chars || 0,
      tokens: TokenEstimator.estimate(round.documents?.chars || 0, 'userDocuments', settings),
      count: round.documents?.count || 0
    },
    thinking: {
      chars: round.thinking?.chars || 0,
      tokens: TokenEstimator.estimate(round.thinking?.chars || 0, 'thinking', settings)
    },
    assistant: {
      chars: round.assistant?.chars || 0,
      tokens: TokenEstimator.estimate(round.assistant?.chars || 0, 'assistant', settings)
    },
    toolContent: {
      chars: round.toolContent?.chars || 0,
      tokens: TokenEstimator.estimate(round.toolContent?.chars || 0, 'toolContent', settings)
    }
  };
  
  const totalChars = 
    estimatedRound.user.chars +
    estimatedRound.documents.chars +
    estimatedRound.thinking.chars +
    estimatedRound.assistant.chars +
    estimatedRound.toolContent.chars;
  
  const totalTokens = 
    estimatedRound.user.tokens +
    estimatedRound.documents.tokens +
    estimatedRound.thinking.tokens +
    estimatedRound.assistant.tokens +
    estimatedRound.toolContent.tokens;
  
  estimatedRound.total = {
    chars: totalChars,
    tokens: totalTokens
  };
  
  chat.rounds.push(estimatedRound);
  chat.lastActive = new Date().toISOString();
  
  if (chatTitle && chatTitle !== 'Untitled Chat') {
    chat.title = chatTitle;
  }
  
  chat.stats = Aggregator.calculateChatStats(chat.rounds);
  
  await StorageManager.saveChat(chatId, chat);
  
  await TimerManager.addRoundToTimers(chatId, estimatedRound.roundNumber, totalTokens);
  
  console.log(`✅ Round #${estimatedRound.roundNumber} saved (${totalTokens} tokens)`);
  
  if (settings.overlayEnabled) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: CONSTANTS.MSG_TYPES.UPDATE_OVERLAY,
            data: { chat, lastRound: estimatedRound }
          });
        }
      });
    } catch (error) {
      // Ignore overlay errors
    }
  }
  
  return {
    saved: true,
    chat: chat,
    round: estimatedRound
  };
}

/**
 * Handle get chat data
 */
async function handleGetChatData(data) {
  const { chatId } = data;
  const chat = await StorageManager.getChat(chatId);
  
  if (!chat) {
    return null;
  }
  
  return {
    chat: chat,
    lastRound: chat.rounds[chat.rounds.length - 1] || null
  };
}

/**
 * Handle get global stats
 */
async function handleGetGlobalStats(data) {
  const { range } = data || { range: 'all' };
  
  const chats = await StorageManager.getChats();
  const timers = await StorageManager.getTimers();
  
  const filteredChats = Aggregator.getFilteredChats(chats, range);
  
  const filteredChatsObject = {};
  filteredChats.forEach(chat => {
    filteredChatsObject[chat.id] = chat;
  });
  
  const stats = Aggregator.calculateGlobalStats(filteredChatsObject);
  
  return {
    stats,
    timers,
    chatCount: filteredChats.length
  };
}

/**
 * Handle get timer status
 */
async function handleGetTimerStatus() {
  return await TimerManager.getStatus();
}

/**
 * Handle reset timer
 */
async function handleResetTimer(data) {
  const { timerType } = data;
  
  if (timerType === CONSTANTS.TIMER_TYPES.FOUR_HOUR) {
    return await TimerManager.reset4HourTimer();
  } else if (timerType === CONSTANTS.TIMER_TYPES.WEEKLY) {
    return await TimerManager.resetWeeklyTimer();
  }
  
  throw new Error(`Unknown timer type: ${timerType}`);
}

/**
 * Handle set timer end
 */
async function handleSetTimerEnd(data) {
  const { endTime } = data;
  return await TimerManager.set4HourTimerEnd(endTime);
}

/**
 * Handle toggle tracking
 */
async function handleToggleTracking(data) {
  const { enabled } = data;
  const settings = await StorageManager.getSettings();
  settings.trackingEnabled = enabled;
  await StorageManager.saveSettings(settings);
  
  console.log(`Tracking ${enabled ? 'enabled' : 'disabled'}`);
  
  return { trackingEnabled: enabled };
}

/**
 * Handle update settings
 */
async function handleUpdateSettings(data) {
  const { settings } = data;
  await StorageManager.saveSettings(settings);
  
  console.log('Settings updated');
  
  return { success: true };
}

/**
 * Handle export data
 */
async function handleExportData() {
  const data = await StorageManager.getAllData();
  return data;
}

/**
 * Handle delete chat
 */
async function handleDeleteChat(data) {
  const { chatId } = data;
  await StorageManager.deleteChat(chatId);
  
  console.log(`Chat ${chatId} deleted`);
  
  return { success: true };
}

/**
 * Handle reset all data
 */
async function handleResetAllData() {
  await StorageManager.resetAll();
  
  console.log('All data reset');
  
  return { success: true };
}

/**
 * Handle get settings
 */
async function handleGetSettings() {
  return await StorageManager.getSettings();
}

/**
 * Handle toggle overlay
 */
async function handleToggleOverlay(data) {
  const { enabled } = data;
  const settings = await StorageManager.getSettings();
  settings.overlayEnabled = enabled;
  await StorageManager.saveSettings(settings);
  
  console.log(`Overlay ${enabled ? 'enabled' : 'disabled'}`);
  
  return { overlayEnabled: enabled };
}

/**
 * Handle get all chats
 */
async function handleGetAllChats() {
  const chats = await StorageManager.getChats();
  return chats;
}

/**
 * Handle import data
 */
async function handleImportData(data) {
  const { importData } = data;
  
  if (!importData || typeof importData !== 'object') {
    throw new Error('Invalid import data');
  }
  
  await StorageManager.importData(importData);
  
  console.log('Data imported successfully');
  
  return { success: true };
}

console.log('Claude Token Tracker Service Worker ready');