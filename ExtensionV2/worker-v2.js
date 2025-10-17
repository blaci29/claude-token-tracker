/**
 * CLAUDE TOKEN TRACKER V2 - SERVICE WORKER
 * 
 * Handles storage operations from content script
 */

import { StorageManagerV2 } from './storage-v2.js';

console.log('⚙️ Claude Token Tracker V2 - Service Worker Starting...');

const storage = new StorageManagerV2();

// ═══════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRACKER_V2_STORAGE') {
    handleStorageAction(message.action, message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep channel open for async response
  }
});

// ═══════════════════════════════════════════════════════════════════
// STORAGE ACTION HANDLER
// ═══════════════════════════════════════════════════════════════════

async function handleStorageAction(action, data) {
  console.log('📦 [Worker] Storage action:', action);

  switch (action) {
    // ===== GET CHAT =====
    case 'GET_CHAT':
      return await storage.getChat(data.chatId);

    // ===== SAVE CHAT =====
    case 'SAVE_CHAT':
      const { userId, orgId, projectId, chat } = data;

      // Ensure user exists
      if (userId) {
        await storage.ensureUser(userId);
      }

      // Ensure org exists
      if (orgId) {
        await storage.ensureOrganization(orgId);
      }

      // Ensure project exists
      await storage.ensureProject(projectId);

      // Save chat (messages are embedded in chat object)
      await storage.setChat(chat.uuid, chat);

      // Add chat to project
      await storage.addChatToProject(projectId, chat.uuid);

      // Update stats
      await storage.updateChatStats(chat.uuid);
      await storage.updateProjectStats(projectId);

      return { success: true };

    // ===== GET MESSAGE =====
    case 'GET_MESSAGE':
      return await storage.getMessage(data.chatId, data.index);

    // ===== GET PROJECT =====
    case 'GET_PROJECT':
      return await storage.getProject(data.projectId);

    // ===== DELETE CHAT =====
    case 'DELETE_CHAT':
      await storage.deleteChat(data.chatId);
      return { success: true };

    // ===== DELETE PROJECT =====
    case 'DELETE_PROJECT':
      await storage.deleteProject(data.projectId);
      return { success: true };

    // ===== BLACKLIST =====
    case 'GET_BLACKLIST':
      return await storage.getBlacklist();

    case 'ADD_TO_BLACKLIST':
      await storage.addToBlacklist(data.type, data.id);
      return { success: true };

    case 'REMOVE_FROM_BLACKLIST':
      await storage.removeFromBlacklist(data.type, data.id);
      return { success: true };

    // ===== EXPORT ALL =====
    case 'EXPORT_ALL':
      return await storage.exportAll();

    // ===== RESET ALL =====
    case 'RESET_ALL':
      await chrome.storage.local.clear();
      console.log('🗑️ [Worker] Storage cleared');
      return { success: true };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(async () => {
  console.log('📦 [Worker] Extension installed/updated');
  
  // Initialize storage version
  const data = await chrome.storage.local.get('version');
  if (!data.version) {
    await chrome.storage.local.set({
      version: '2.0.0',
      initialized_at: new Date().toISOString()
    });
    console.log('✅ [Worker] Storage initialized');
  }
});

console.log('✅ Claude Token Tracker V2 - Service Worker Ready!');