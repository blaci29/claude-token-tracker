// ═══════════════════════════════════════════════════════════════════
// Claude Token Tracker v2.0 - Storage Helper
// Service Worker Module
// ═══════════════════════════════════════════════════════════════════

// Import constants (ES6 module version for service worker)
import { TRACKER_V2_CONSTANTS, logger } from './constants-module.js';

// ═══════════════════════════════════════════════════════════════════
// STORAGE MANAGER
// ═══════════════════════════════════════════════════════════════════

class StorageManagerV2 {
  constructor() {
    this.initialized = false;
  }
  
  // ===== INITIALIZATION =====
  
  async initialize() {
    try {
      const data = await this.getAll();
      
      if (!data.version || data.version !== TRACKER_V2_CONSTANTS.VERSION) {
        logger.info('Initializing v2 storage structure...');
        await this.initializeStructure();
      }
      
      this.initialized = true;
      logger.success('Storage initialized', { version: TRACKER_V2_CONSTANTS.VERSION });
      
      return true;
    } catch (error) {
      logger.error('Storage initialization failed', error);
      return false;
    }
  }
  
  async initializeStructure() {
    const initialData = {
      version: TRACKER_V2_CONSTANTS.VERSION,
      initialized_at: new Date().toISOString(),
      
      user: null,
      organizations: {},
      projects: {
        [TRACKER_V2_CONSTANTS.VIRTUAL_PROJECT_ID]: {
          uuid: null,
          name: 'No Project',
          virtual: true,
          stats: this.createEmptyStats(),
          chat_ids: []
        }
      },
      chats: {},
      messages: {}
    };
    
    await chrome.storage.local.set(initialData);
    logger.success('Storage structure initialized');
  }
  
  // ===== BASIC OPERATIONS =====
  
  async get(key) {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } catch (error) {
      logger.error(`Get failed for key: ${key}`, error);
      return null;
    }
  }
  
  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      logger.error(`Set failed for key: ${key}`, error);
      return false;
    }
  }
  
  async getAll() {
    try {
      return await chrome.storage.local.get(null);
    } catch (error) {
      logger.error('GetAll failed', error);
      return {};
    }
  }
  
  async clear() {
    try {
      await chrome.storage.local.clear();
      logger.warning('Storage cleared');
      return true;
    } catch (error) {
      logger.error('Clear failed', error);
      return false;
    }
  }
  
  // ===== USER =====

  async getUser() {
    return await this.get('user');
  }

  async setUser(userData) {
    const user = {
      uuid: userData.uuid,
      full_name: userData.full_name || null,
      email: userData.email || null,
      tracked_since: userData.tracked_since || new Date().toISOString(),
      stats: userData.stats || this.createEmptyStats()
    };

    await this.set('user', user);
    logger.success('User saved', { uuid: user.uuid });
    return user;
  }

  async ensureUser(userId) {
    const existing = await this.getUser();
    if (!existing || existing.uuid !== userId) {
      await this.setUser({ uuid: userId });
    }
    return true;
  }
  
  // ===== ORGANIZATIONS =====
  
  async getOrganization(orgId) {
    const orgs = await this.get('organizations') || {};
    return orgs[orgId] || null;
  }
  
  async setOrganization(orgId, orgData) {
    const orgs = await this.get('organizations') || {};

    orgs[orgId] = {
      uuid: orgId,
      name: orgData.name,
      rate_limit_tier: orgData.rate_limit_tier,
      capabilities: orgData.capabilities || [],
      created_at: orgData.created_at,
      stats: orgData.stats || this.createEmptyStats(),
      github_trees: orgData.github_trees || {}
    };

    await this.set('organizations', orgs);
    logger.success('Organization saved', { orgId });
    return orgs[orgId];
  }

  async ensureOrganization(orgId) {
    const existing = await this.getOrganization(orgId);
    if (!existing) {
      await this.setOrganization(orgId, {
        name: 'Unknown Organization',
        rate_limit_tier: 'unknown',
        created_at: new Date().toISOString()
      });
    }
    return true;
  }
  
  // ===== PROJECTS =====
  
  async getProject(projectId) {
    const projects = await this.get('projects') || {};
    return projects[projectId] || null;
  }
  
  async setProject(projectId, projectData) {
    const projects = await this.get('projects') || {};
    
    const isVirtual = projectId === TRACKER_V2_CONSTANTS.VIRTUAL_PROJECT_ID;
    
    projects[projectId] = {
      uuid: isVirtual ? null : projectId,
      name: projectData.name,
      description: projectData.description || '',
      virtual: isVirtual,
      creator: projectData.creator || null,
      created_at: projectData.created_at || new Date().toISOString(),
      updated_at: projectData.updated_at || new Date().toISOString(),
      stats: projectData.stats || this.createEmptyStats(),
      chat_ids: projectData.chat_ids || []
    };
    
    await this.set('projects', projects);
    logger.success('Project saved', { projectId, name: projectData.name });
    return projects[projectId];
  }
  
  async ensureProject(projectId) {
    const existing = await this.getProject(projectId);
    if (!existing) {
      await this.setProject(projectId, {
        name: projectId === TRACKER_V2_CONSTANTS.VIRTUAL_PROJECT_ID ? 'No Project' : 'Unknown Project',
        description: '',
        created_at: new Date().toISOString()
      });
    }
    return true;
  }

  async addChatToProject(projectId, chatId) {
    const project = await this.getProject(projectId);
    if (!project) return false;

    if (!project.chat_ids.includes(chatId)) {
      project.chat_ids.push(chatId);
      await this.setProject(projectId, project);
    }

    return true;
  }
  
  // ===== CHATS =====
  
  async getChat(chatId) {
    const chats = await this.get('chats') || {};
    return chats[chatId] || null;
  }
  
  async setChat(chatId, chatData) {
    const chats = await this.get('chats') || {};
    
    chats[chatId] = {
      uuid: chatId,
      name: chatData.name || 'Untitled Chat',
      summary: chatData.summary || '',
      project_uuid: chatData.project_uuid || null,
      created_at: chatData.created_at,
      updated_at: chatData.updated_at || new Date().toISOString(),
      is_starred: chatData.is_starred || false,
      settings: chatData.settings || {},
      message_count: chatData.message_count || 0,
      message_pair_count: chatData.message_pair_count || 0,
      stats: chatData.stats || this.createEmptyStats(),
      message_indexes: chatData.message_indexes || []
    };
    
    await this.set('chats', chats);
    logger.success('Chat saved', { chatId, name: chatData.name });
    return chats[chatId];
  }
  
  // ===== MESSAGES =====
  
  async getMessage(chatId, messageIndex) {
    const messageId = `${chatId}:${messageIndex}`;
    const messages = await this.get('messages') || {};
    return messages[messageId] || null;
  }
  
  async setMessage(chatId, messageIndex, messageData) {
    const messageId = `${chatId}:${messageIndex}`;
    const messages = await this.get('messages') || {};
    
    messages[messageId] = {
      uuid: messageData.uuid,
      chat_id: chatId,
      index: messageIndex,
      sender: messageData.sender,
      parent_message_uuid: messageData.parent_message_uuid,
      created_at: messageData.created_at,
      stop_reason: messageData.stop_reason || null,
      content: messageData.content || [],
      attachments: messageData.attachments || [],
      files: messageData.files || [],
      sync_sources: messageData.sync_sources || [],
      stats: messageData.stats || this.createEmptyMessageStats()
    };
    
    await this.set('messages', messages);
    logger.debug('Message saved', { messageId, sender: messageData.sender });
    return messages[messageId];
  }
  
  async getMessagesForChat(chatId) {
    const messages = await this.get('messages') || {};
    const chatMessages = [];
    
    Object.keys(messages).forEach(messageId => {
      if (messageId.startsWith(`${chatId}:`)) {
        chatMessages.push(messages[messageId]);
      }
    });
    
    // Sort by index
    chatMessages.sort((a, b) => a.index - b.index);
    
    return chatMessages;
  }
  
  // ===== GITHUB CACHE =====
  
  async getGithubTree(owner, repo, branch) {
    const orgs = await this.get('organizations') || {};
    
    // Search in all organizations (for now, assume first org)
    // TODO: Better org detection
    const orgId = Object.keys(orgs)[0];
    if (!orgId) return null;
    
    const key = `${owner}/${repo}/${branch}`;
    return orgs[orgId]?.github_trees?.[key] || null;
  }
  
  async setGithubTree(orgId, owner, repo, branch, files) {
    const orgs = await this.get('organizations') || {};
    
    if (!orgs[orgId]) return false;
    
    if (!orgs[orgId].github_trees) {
      orgs[orgId].github_trees = {};
    }
    
    const key = `${owner}/${repo}/${branch}`;
    const now = Date.now();
    const ttl = TRACKER_V2_CONSTANTS.GITHUB_CACHE.TTL_DAYS * 24 * 60 * 60 * 1000;
    
    orgs[orgId].github_trees[key] = {
      cached_at: new Date().toISOString(),
      expires_at: new Date(now + ttl).toISOString(),
      files: files
    };
    
    await this.set('organizations', orgs);
    logger.success('GitHub tree cached', { key, file_count: files.length });
    return true;
  }
  
  // ===== STATS HELPERS =====
  
  createEmptyStats() {
    return {
      total_chats: 0,
      total_messages: 0,
      total_chars: 0,
      total_tokens_estimated: 0,
      total_tokens_actual: 0
    };
  }
  
  createEmptyMessageStats() {
    return {
      total_chars: 0,
      total_tokens_estimated: 0,
      total_tokens_actual: null,
      by_type: {}
    };
  }
  
  // ===== STATS AGGREGATION =====
  
  async updateChatStats(chatId) {
    const messages = await this.getMessagesForChat(chatId);
    const chat = await this.getChat(chatId);
    
    if (!chat) return false;
    
    // Aggregate message stats
    const stats = {
      total_chars: 0,
      total_tokens_estimated: 0,
      total_tokens_actual: 0,
      by_sender: {
        human: { total_chars: 0, total_tokens_estimated: 0, message_count: 0 },
        assistant: { total_chars: 0, total_tokens_estimated: 0, message_count: 0 }
      },
      by_type: {}
    };
    
    messages.forEach(msg => {
      stats.total_chars += msg.stats.total_chars;
      stats.total_tokens_estimated += msg.stats.total_tokens_estimated;
      
      if (msg.stats.total_tokens_actual) {
        stats.total_tokens_actual += msg.stats.total_tokens_actual;
      }
      
      // By sender
      const sender = msg.sender;
      if (stats.by_sender[sender]) {
        stats.by_sender[sender].total_chars += msg.stats.total_chars;
        stats.by_sender[sender].total_tokens_estimated += msg.stats.total_tokens_estimated;
        stats.by_sender[sender].message_count++;
      }
      
      // By type
      Object.keys(msg.stats.by_type || {}).forEach(type => {
        if (!stats.by_type[type]) {
          stats.by_type[type] = { chars: 0, tokens_estimated: 0 };
        }
        stats.by_type[type].chars += msg.stats.by_type[type].chars;
        stats.by_type[type].tokens_estimated += msg.stats.by_type[type].tokens_estimated;
      });
    });
    
    chat.stats = stats;
    chat.message_count = messages.length;
    chat.message_pair_count = Math.floor(messages.length / 2);
    
    await this.setChat(chatId, chat);
    logger.debug('Chat stats updated', { chatId, message_count: messages.length });
    
    return stats;
  }
  
  async updateProjectStats(projectId) {
    const project = await this.getProject(projectId);
    if (!project) return false;
    
    const stats = this.createEmptyStats();
    stats.total_chats = project.chat_ids.length;
    
    for (const chatId of project.chat_ids) {
      const chat = await this.getChat(chatId);
      if (chat) {
        stats.total_messages += chat.message_count;
        stats.total_chars += chat.stats.total_chars;
        stats.total_tokens_estimated += chat.stats.total_tokens_estimated;
        if (chat.stats.total_tokens_actual) {
          stats.total_tokens_actual += chat.stats.total_tokens_actual;
        }
      }
    }
    
    project.stats = stats;
    await this.setProject(projectId, project);
    logger.debug('Project stats updated', { projectId });
    
    return stats;
  }
  
  // ===== EXPORT DATA =====
  
  async exportAll() {
    const data = await this.getAll();
    return JSON.stringify(data, null, 2);
  }
}

// Export class and singleton instance
export { StorageManagerV2 };
export const storageV2 = new StorageManagerV2();