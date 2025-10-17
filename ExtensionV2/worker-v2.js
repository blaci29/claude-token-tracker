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
    // AUTOMATIC SESSION CLEANUP CHECK (every request)
    storage.checkAndCleanupExpiredSessions()
      .then(() => handleStorageAction(message.action, message.data))
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

    // ===== GET ALL CHATS =====
    case 'GET_ALL_CHATS':
      return await storage.getAllChats();

    // ===== UPDATE CHAT MESSAGES =====
    case 'UPDATE_CHAT_MESSAGES':
      return await storage.updateChatMessages(data.chatId, data.chat);

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

    // ===== SESSION TRACKING =====
    case 'INITIALIZE_SESSIONS':
      return await storage.initializeSessions();

    case 'GET_SESSIONS':
      return await storage.getSessions();

    case 'GET_SESSION_STATS':
      const sessions = await storage.getSessions();
      if (!sessions) return null;

      return {
        current: sessions.current?.stats || null,
        weekly: sessions.weekly?.stats || null,
        monthly: sessions.monthly?.stats || null,
        monthly_archive: sessions.monthly_archive?.map(s => ({
          reset_at: s.reset_at,
          archived_at: s.archived_at,
          stats: s.stats
        })) || []
      };

    case 'ADD_MESSAGE_PAIR':
      return await storage.addMessagePairToSessions(
        data.chatId,
        data.humanIndex,
        data.assistantIndex,
        data.humanMessage,
        data.assistantMessage
      );

    case 'GET_CHANGELOG':
      return await storage.getChangelog(data.limit || 10);

    case 'RECALCULATE_SESSION_STATS':
      return await storage.recalculateSessionStats(data.sessionType);

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