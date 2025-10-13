/**
 * Storage Manager - Chrome Storage API wrapper
 */

import { CONSTANTS } from '../shared/constants.module.js';

export const StorageManager = {
  /**
   * Initialize storage with defaults
   */
  async initialize() {
    const settings = await this.getSettings();
    if (!settings.initialized) {
      await chrome.storage.local.set({
        settings: {
          initialized: true,
          trackingEnabled: true,
          overlayEnabled: true,
          ratios: CONSTANTS.DEFAULT_RATIOS
        },
        chats: {},
        timers: {
          fourHour: { startTime: null, endTime: null, tokens: 0 },
          weekly: { startTime: null, endTime: null, tokens: 0 }
        }
      });
      console.log('Storage initialized with defaults');
    }
  },

  /**
   * Get settings
   */
  async getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {
      initialized: false,
      trackingEnabled: true,
      overlayEnabled: true,
      ratios: CONSTANTS.DEFAULT_RATIOS
    };
  },

  /**
   * Save settings
   */
  async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  },

  /**
   * Get single chat
   */
  async getChat(chatId) {
    const result = await chrome.storage.local.get('chats');
    const chats = result.chats || {};
    return chats[chatId] || null;
  },

  /**
   * Get all chats
   */
  async getChats() {
    const result = await chrome.storage.local.get('chats');
    return result.chats || {};
  },

  /**
   * Save chat
   */
  async saveChat(chatId, chatData) {
    const chats = await this.getChats();
    chats[chatId] = chatData;
    await chrome.storage.local.set({ chats });
  },

  /**
   * Delete chat
   */
  async deleteChat(chatId) {
    const chats = await this.getChats();
    delete chats[chatId];
    await chrome.storage.local.set({ chats });
  },

  /**
   * Get timers
   */
  async getTimers() {
    const result = await chrome.storage.local.get('timers');
    return result.timers || {
      fourHour: { startTime: null, endTime: null, tokens: 0 },
      weekly: { startTime: null, endTime: null, tokens: 0 }
    };
  },

  /**
   * Save timers
   */
  async saveTimers(timers) {
    await chrome.storage.local.set({ timers });
  },

  /**
   * Get all data
   */
  async getAllData() {
    const result = await chrome.storage.local.get(null);
    return result;
  },

  /**
   * Import data
   */
  async importData(data) {
    await chrome.storage.local.set(data);
  },

  /**
   * Reset all data
   */
  async resetAll() {
    await chrome.storage.local.clear();
    await this.initialize();
  }
};
