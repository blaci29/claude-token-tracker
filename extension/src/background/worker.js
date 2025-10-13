/**
 * CLAUDE TOKEN TRACKER - SERVICE WORKER
 * Central message handler and coordination
 * NO ES6 imports - uses global objects from manifest-loaded scripts
 */

console.log('Claude Token Tracker Service Worker starting...');

// Check if shared objects are available
if (typeof CONSTANTS === 'undefined') {
  console.error('CONSTANTS not loaded! Check manifest.json script order.');
}
if (typeof Utils === 'undefined') {
  console.error('Utils not loaded! Check manifest.json script order.');
}
if (typeof TokenEstimator === 'undefined') {
  console.error('TokenEstimator not loaded! Check manifest.json script order.');
}

// ========================================
// STORAGE MANAGER
// ========================================

const StorageManager = {
  
  async initialize() {
    try {
      const result = await chrome.storage.local.get(null);
      
      if (!result[CONSTANTS.STORAGE_KEYS.VERSION]) {
        console.log('First run - initializing storage with defaults');
        
        await chrome.storage.local.set({
          [CONSTANTS.STORAGE_KEYS.VERSION]: CONSTANTS.VERSION,
          [CONSTANTS.STORAGE_KEYS.CHATS]: {},
          [CONSTANTS.STORAGE_KEYS.TIMERS]: {
            fourHour: {
              enabled: false,
              startTime: null,
              endTime: null,
              tokens: 0,
              rounds: []
            },
            weekly: {
              enabled: false,
              weekStartDay: CONSTANTS.DEFAULTS.weekStartDay,
              weekStartTime: CONSTANTS.DEFAULTS.weekStartTime,
              currentWeekStart: null,
              tokens: 0,
              rounds: []
            }
          },
          [CONSTANTS.STORAGE_KEYS.SETTINGS]: CONSTANTS.DEFAULTS
        });
        
        console.log('Storage initialized successfully');
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing storage:', error);
      return false;
    }
  },
  
  async getChats() {
    try {
      const result = await chrome.storage.local.get(CONSTANTS.STORAGE_KEYS.CHATS);
      return result[CONSTANTS.STORAGE_KEYS.CHATS] || {};
    } catch (error) {
      console.error('Error getting chats:', error);
      return {};
    }
  },
  
  async getChat(chatId) {
    try {
      const chats = await this.getChats();
      return chats[chatId] || null;
    } catch (error) {
      console.error('Error getting chat:', error);
      return null;
    }
  },
  
  async saveChat(chatId, chatData) {
    try {
      const chats = await this.getChats();
      chats[chatId] = chatData;
      
      await chrome.storage.local.set({
        [CONSTANTS.STORAGE_KEYS.CHATS]: chats
      });
      
      return true;
    } catch (error) {
      console.error('Error saving chat:', error);
      return false;
    }
  },
  
  async deleteChat(chatId) {
    try {
      const chats = await this.getChats();
      delete chats[chatId];
      
      await chrome.storage.local.set({
        [CONSTANTS.STORAGE_KEYS.CHATS]: chats
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  },
  
  async getTimers() {
    try {
      const result = await chrome.storage.local.get(CONSTANTS.STORAGE_KEYS.TIMERS);
      return result[CONSTANTS.STORAGE_KEYS.TIMERS] || {
        fourHour: { enabled: false, tokens: 0, rounds: [] },
        weekly: { enabled: false, tokens: 0, rounds: [] }
      };
    } catch (error) {
      console.error('Error getting timers:', error);
      return {
        fourHour: { enabled: false, tokens: 0, rounds: [] },
        weekly: { enabled: false, tokens: 0, rounds: [] }
      };
    }
  },
  
  async saveTimers(timers) {
    try {
      await chrome.storage.local.set({
        [CONSTANTS.STORAGE_KEYS.TIMERS]: timers
      });
      return true;
    } catch (error) {
      console.error('Error saving timers:', error);
      return false;
    }
  },
  
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(CONSTANTS.STORAGE_KEYS.SETTINGS);
      return result[CONSTANTS.STORAGE_KEYS.SETTINGS] || CONSTANTS.DEFAULTS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return CONSTANTS.DEFAULTS;
    }
  },
  
  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({
        [CONSTANTS.STORAGE_KEYS.SETTINGS]: settings
      });
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  },
  
  async getAllData() {
    try {
      const result = await chrome.storage.local.get(null);
      return result;
    } catch (error) {
      console.error('Error getting all data:', error);
      return {};
    }
  },
  
  async importData(data) {
    try {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  },
  
  async resetAll() {
    try {
      await chrome.storage.local.clear();
      await this.initialize();
      return true;
    } catch (error) {
      console.error('Error resetting data:', error);
      return false;
    }
  }
};

// ========================================
// AGGREGATOR
// ========================================

const Aggregator = {
  
  calculateChatStats(rounds) {
    const stats = {
      totalRounds: rounds.length,
      totalChars: 0,
      totalTokens: 0,
      
      userChars: 0,
      userTokens: 0,
      
      docChars: 0,
      docTokens: 0,
      
      thinkingChars: 0,
      thinkingTokens: 0,
      
      assistantChars: 0,
      assistantTokens: 0,
      
      toolChars: 0,
      toolTokens: 0,
      
      modelBreakdown: {}
    };
    
    rounds.forEach(round => {
      stats.userChars += round.user?.chars || 0;
      stats.userTokens += round.user?.tokens || 0;
      
      stats.docChars += round.documents?.chars || 0;
      stats.docTokens += round.documents?.tokens || 0;
      
      stats.thinkingChars += round.thinking?.chars || 0;
      stats.thinkingTokens += round.thinking?.tokens || 0;
      
      stats.assistantChars += round.assistant?.chars || 0;
      stats.assistantTokens += round.assistant?.tokens || 0;
      
      stats.toolChars += round.toolContent?.chars || 0;
      stats.toolTokens += round.toolContent?.tokens || 0;
      
      stats.totalChars += round.total?.chars || 0;
      stats.totalTokens += round.total?.tokens || 0;
      
      const model = round.model || 'unknown';
      if (!stats.modelBreakdown[model]) {
        stats.modelBreakdown[model] = {
          rounds: 0,
          tokens: 0,
          roundsWithThinking: 0
        };
      }
      stats.modelBreakdown[model].rounds++;
      stats.modelBreakdown[model].tokens += round.total?.tokens || 0;
      if (round.hasThinking) {
        stats.modelBreakdown[model].roundsWithThinking++;
      }
    });
    
    return stats;
  },
  
  calculateGlobalStats(chats) {
    const stats = {
      totalChats: Object.keys(chats).length,
      totalRounds: 0,
      totalTokens: 0,
      totalChars: 0,
      
      userTokens: 0,
      docTokens: 0,
      thinkingTokens: 0,
      assistantTokens: 0,
      toolTokens: 0,
      
      modelBreakdown: {},
      
      chatsByType: {
        project: 0,
        chat: 0,
        unknown: 0
      }
    };
    
    Object.values(chats).forEach(chat => {
      stats.chatsByType[chat.type] = (stats.chatsByType[chat.type] || 0) + 1;
      
      if (chat.stats) {
        stats.totalRounds += chat.stats.totalRounds || 0;
        stats.totalTokens += chat.stats.totalTokens || 0;
        stats.totalChars += chat.stats.totalChars || 0;
        
        stats.userTokens += (chat.stats.userTokens || 0) + (chat.stats.docTokens || 0);
        stats.thinkingTokens += chat.stats.thinkingTokens || 0;
        stats.assistantTokens += chat.stats.assistantTokens || 0;
        stats.toolTokens += chat.stats.toolTokens || 0;
        
        if (chat.stats.modelBreakdown) {
          Object.entries(chat.stats.modelBreakdown).forEach(([model, data]) => {
            if (!stats.modelBreakdown[model]) {
              stats.modelBreakdown[model] = {
                rounds: 0,
                tokens: 0,
                roundsWithThinking: 0
              };
            }
            stats.modelBreakdown[model].rounds += data.rounds || 0;
            stats.modelBreakdown[model].tokens += data.tokens || 0;
            stats.modelBreakdown[model].roundsWithThinking += data.roundsWithThinking || 0;
          });
        }
      }
    });
    
    return stats;
  }
};

// ========================================
// TIMER MANAGER
// ========================================

const TimerManager = {
  
  async start4HourTimer(endTime = null) {
    try {
      const timers = await StorageManager.getTimers();
      const now = new Date().toISOString();
      
      const calculatedEndTime = endTime || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      
      timers.fourHour = {
        enabled: true,
        startTime: now,
        endTime: calculatedEndTime,
        tokens: 0,
        rounds: []
      };
      
      await StorageManager.saveTimers(timers);
      
      console.log('4-hour timer started:', timers.fourHour);
      
      return timers.fourHour;
    } catch (error) {
      console.error('Error starting 4-hour timer:', error);
      return null;
    }
  },
  
  async reset4HourTimer() {
    return await this.start4HourTimer();
  },
  
  async set4HourTimerEnd(endTime) {
    try {
      const timers = await StorageManager.getTimers();
      
      if (!timers.fourHour.enabled) {
        return await this.start4HourTimer(endTime);
      }
      
      timers.fourHour.endTime = endTime;
      await StorageManager.saveTimers(timers);
      
      console.log('4-hour timer end time updated:', endTime);
      
      return timers.fourHour;
    } catch (error) {
      console.error('Error setting 4-hour timer end:', error);
      return null;
    }
  },
  
  async startWeeklyTimer() {
    try {
      const timers = await StorageManager.getTimers();
      const settings = await StorageManager.getSettings();
      
      const weekStart = Utils.getWeekStart(
        settings.weekStartDay || 'Monday',
        settings.weekStartTime || '00:00'
      );
      
      timers.weekly = {
        enabled: true,
        weekStartDay: settings.weekStartDay || 'Monday',
        weekStartTime: settings.weekStartTime || '00:00',
        currentWeekStart: weekStart.toISOString(),
        tokens: 0,
        rounds: []
      };
      
      await StorageManager.saveTimers(timers);
      
      console.log('Weekly timer started:', timers.weekly);
      
      return timers.weekly;
    } catch (error) {
      console.error('Error starting weekly timer:', error);
      return null;
    }
  },
  
  async resetWeeklyTimer() {
    return await this.startWeeklyTimer();
  },
  
  async addRoundToTimers(chatId, roundNumber, tokens) {
    try {
      const timers = await StorageManager.getTimers();
      
      const roundRef = {
        chatId,
        roundNumber,
        tokens,
        timestamp: new Date().toISOString()
      };
      
      if (timers.fourHour.enabled) {
        timers.fourHour.rounds.push(roundRef);
        timers.fourHour.tokens += tokens;
        
        if (timers.fourHour.endTime && Date.now() > Date.parse(timers.fourHour.endTime)) {
          console.log('4-hour timer expired');
        }
      }
      
      if (timers.weekly.enabled) {
        const weekStart = Utils.getWeekStart(
          timers.weekly.weekStartDay,
          timers.weekly.weekStartTime
        );
        
        if (weekStart.getTime() > Date.parse(timers.weekly.currentWeekStart)) {
          console.log('Week changed - resetting weekly timer');
          await this.resetWeeklyTimer();
          const updatedTimers = await StorageManager.getTimers();
          updatedTimers.weekly.rounds.push(roundRef);
          updatedTimers.weekly.tokens += tokens;
          await StorageManager.saveTimers(updatedTimers);
        } else {
          timers.weekly.rounds.push(roundRef);
          timers.weekly.tokens += tokens;
          await StorageManager.saveTimers(timers);
        }
      } else {
        await StorageManager.saveTimers(timers);
      }
      
      await this.checkWarnings(timers);
      
      return true;
    } catch (error) {
      console.error('Error adding round to timers:', error);
      return false;
    }
  },
  
  async checkWarnings(timers) {
    try {
      const settings = await StorageManager.getSettings();
      
      if (timers.fourHour.enabled) {
        const fourHourLimit = settings.estimatedLimits?.fourHour || 50000;
        const fourHourThreshold = settings.warningThresholds?.fourHour || 0.9;
        const fourHourPercentage = timers.fourHour.tokens / fourHourLimit;
        
        if (fourHourPercentage >= fourHourThreshold && fourHourPercentage < 1) {
          this.sendWarningNotification(
            '4-Hour Limit Warning',
            `You've used ${(fourHourPercentage * 100).toFixed(0)}% of your estimated 4-hour token limit.`
          );
        } else if (fourHourPercentage >= 1) {
          this.sendWarningNotification(
            '4-Hour Limit Exceeded',
            'You have exceeded your estimated 4-hour token limit.'
          );
        }
      }
      
      if (timers.weekly.enabled) {
        const weeklyLimit = settings.estimatedLimits?.weekly || 200000;
        const weeklyThreshold = settings.warningThresholds?.weekly || 0.9;
        const weeklyPercentage = timers.weekly.tokens / weeklyLimit;
        
        if (weeklyPercentage >= weeklyThreshold && weeklyPercentage < 1) {
          this.sendWarningNotification(
            'Weekly Limit Warning',
            `You've used ${(weeklyPercentage * 100).toFixed(0)}% of your estimated weekly token limit.`
          );
        } else if (weeklyPercentage >= 1) {
          this.sendWarningNotification(
            'Weekly Limit Exceeded',
            'You have exceeded your estimated weekly token limit.'
          );
        }
      }
    } catch (error) {
      console.error('Error checking warnings:', error);
    }
  },
  
  sendWarningNotification(title, message) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'src/assets/icons/icon48.png',
        title: title,
        message: message,
        priority: 2
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  },
  
  async getStatus() {
    try {
      const timers = await StorageManager.getTimers();
      const settings = await StorageManager.getSettings();
      
      return {
        fourHour: {
          ...timers.fourHour,
          limit: settings.estimatedLimits?.fourHour || 50000,
          percentage: timers.fourHour.enabled 
            ? (timers.fourHour.tokens / (settings.estimatedLimits?.fourHour || 50000) * 100).toFixed(1)
            : 0
        },
        weekly: {
          ...timers.weekly,
          limit: settings.estimatedLimits?.weekly || 200000,
          percentage: timers.weekly.enabled 
            ? (timers.weekly.tokens / (settings.estimatedLimits?.weekly || 200000) * 100).toFixed(1)
            : 0
        }
      };
    } catch (error) {
      console.error('Error getting timer status:', error);
      return null;
    }
  }
};

// ========================================
// INSTALLATION & STARTUP
// ========================================

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

// ========================================
// MESSAGE HANDLER
// ========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message.type);
  
  handleMessage(message, sender)
    .then(response => {
      sendResponse({ success: true, data: response });
    })
    .catch(error => {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });
  
  return true; // Keep channel open for async response
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
  
  console.log(`Round #${estimatedRound.roundNumber} saved to chat ${chatId}`);
  
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
      // Ignore
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
  
  // Filter chats by time range
  const now = Date.now();
  const chatArray = Object.values(chats);
  let filteredChats = [];
  
  switch (range) {
    case '4h':
      const fourHoursAgo = now - (4 * 60 * 60 * 1000);
      filteredChats = chatArray.filter(chat => Date.parse(chat.lastActive) >= fourHoursAgo);
      break;
    case 'today':
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      filteredChats = chatArray.filter(chat => Date.parse(chat.lastActive) >= todayStart.getTime());
      break;
    case 'week':
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
      filteredChats = chatArray.filter(chat => Date.parse(chat.lastActive) >= weekAgo);
      break;
    case 'all':
    default:
      filteredChats = chatArray;
  }
  
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