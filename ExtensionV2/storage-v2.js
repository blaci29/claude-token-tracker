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

      // Blacklist - prevents tracking
      blacklist: {
        projects: [],  // Array of project UUIDs
        chats: []      // Array of chat UUIDs
      }
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

  async deleteProject(projectId) {
    // Cannot delete virtual project
    if (projectId === TRACKER_V2_CONSTANTS.VIRTUAL_PROJECT_ID) {
      logger.warning('Cannot delete virtual project');
      return false;
    }

    const projects = await this.get('projects') || {};
    const project = projects[projectId];

    if (!project) {
      logger.warning('Project not found', { projectId });
      return false;
    }

    // Delete all chats in project
    if (project.chat_ids && project.chat_ids.length > 0) {
      const chats = await this.get('chats') || {};
      for (const chatId of project.chat_ids) {
        delete chats[chatId];
      }
      await this.set('chats', chats);
      logger.info('Deleted chats from project', { count: project.chat_ids.length });
    }

    // Remove project
    delete projects[projectId];
    await this.set('projects', projects);

    logger.success('Project deleted', { projectId, name: project.name });
    return true;
  }
  
  // ===== CHATS =====

  async getChat(chatId) {
    const chats = await this.get('chats') || {};
    return chats[chatId] || null;
  }

  async setChat(chatId, chatData) {
    // Check blacklist - chat level
    if (await this.isChatBlacklisted(chatId)) {
      logger.warning('Chat is blacklisted, skipping save', { chatId });
      return null;
    }

    // Check blacklist - project level
    if (chatData.project_uuid && await this.isProjectBlacklisted(chatData.project_uuid)) {
      logger.warning('Project is blacklisted, skipping chat save', { chatId, projectId: chatData.project_uuid });
      return null;
    }

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

      // Messages embedded directly in chat
      messages: chatData.messages || [],

      // Stats calculated from messages
      stats: chatData.stats || this.createEmptyStats()
    };

    await this.set('chats', chats);
    logger.success('Chat saved', { chatId, name: chatData.name, message_count: chats[chatId].messages.length });
    return chats[chatId];
  }

  async deleteChat(chatId) {
    const chats = await this.get('chats') || {};
    const chat = chats[chatId];

    if (!chat) {
      logger.warning('Chat not found', { chatId });
      return false;
    }

    // Remove from chats
    delete chats[chatId];
    await this.set('chats', chats);

    // Remove from project's chat_ids
    if (chat.project_uuid) {
      const project = await this.getProject(chat.project_uuid);
      if (project && project.chat_ids) {
        project.chat_ids = project.chat_ids.filter(id => id !== chatId);
        await this.setProject(chat.project_uuid, project);
        await this.updateProjectStats(chat.project_uuid);
      }
    }

    logger.success('Chat deleted', { chatId, name: chat.name });
    return true;
  }
  
  // ===== MESSAGES (now embedded in chat) =====

  async getMessage(chatId, messageIndex) {
    const chat = await this.getChat(chatId);
    if (!chat || !chat.messages) return null;

    return chat.messages.find(m => m.index === messageIndex) || null;
  }

  async getMessagesForChat(chatId) {
    const chat = await this.getChat(chatId);
    return chat?.messages || [];
  }
  
  // ===== GITHUB CACHE (user level) =====

  async getGithubTree(owner, repo, branch) {
    const user = await this.getUser();
    if (!user || !user.github_repos) return null;

    const key = `${owner}/${repo}/${branch}`;
    return user.github_repos[key] || null;
  }

  async setGithubTree(owner, repo, branch, files) {
    const user = await this.getUser();
    if (!user) {
      logger.error('Cannot cache GitHub tree: no user');
      return false;
    }

    if (!user.github_repos) {
      user.github_repos = {};
    }

    const key = `${owner}/${repo}/${branch}`;
    const now = Date.now();
    const ttl = TRACKER_V2_CONSTANTS.GITHUB_CACHE.TTL_DAYS * 24 * 60 * 60 * 1000;

    user.github_repos[key] = {
      owner,
      repo,
      branch,
      cached_at: new Date().toISOString(),
      expires_at: new Date(now + ttl).toISOString(),
      file_count: files.length,
      files: files
    };

    await this.setUser(user);
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
    const chat = await this.getChat(chatId);
    if (!chat || !chat.messages) return false;

    // Aggregate message stats
    const stats = {
      total_messages: chat.messages.length,
      total_pairs: Math.floor(chat.messages.length / 2),
      total_chars: 0,
      total_tokens_estimated: 0,
      total_tokens_actual_input: 0,
      total_tokens_actual_output: 0,
      by_sender: {
        human: { total_chars: 0, total_tokens_estimated: 0, message_count: 0 },
        assistant: { total_chars: 0, total_tokens_estimated: 0, message_count: 0 }
      },
      by_type: {}
    };

    chat.messages.forEach(msg => {
      stats.total_chars += msg.stats.total_chars;
      stats.total_tokens_estimated += msg.stats.total_tokens_estimated;

      // Actual tokens
      if (msg.stats.total_tokens_actual) {
        stats.total_tokens_actual_input += msg.stats.total_tokens_actual.input_tokens || 0;
        stats.total_tokens_actual_output += msg.stats.total_tokens_actual.output_tokens || 0;
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

    await this.setChat(chatId, chat);
    logger.debug('Chat stats updated', { chatId, message_count: stats.total_messages });

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
  
  // ===== BLACKLIST =====

  async getBlacklist() {
    const blacklist = await this.get('blacklist');
    return blacklist || { projects: [], chats: [] };
  }

  async isProjectBlacklisted(projectId) {
    const blacklist = await this.getBlacklist();
    return blacklist.projects.includes(projectId);
  }

  async isChatBlacklisted(chatId) {
    const blacklist = await this.getBlacklist();
    return blacklist.chats.includes(chatId);
  }

  async addToBlacklist(type, id) {
    const blacklist = await this.getBlacklist();

    if (type === 'project') {
      if (!blacklist.projects.includes(id)) {
        blacklist.projects.push(id);
        logger.success('Project blacklisted', { projectId: id });
      }
    } else if (type === 'chat') {
      if (!blacklist.chats.includes(id)) {
        blacklist.chats.push(id);
        logger.success('Chat blacklisted', { chatId: id });
      }
    }

    await this.set('blacklist', blacklist);
    return true;
  }

  async removeFromBlacklist(type, id) {
    const blacklist = await this.getBlacklist();

    if (type === 'project') {
      blacklist.projects = blacklist.projects.filter(pid => pid !== id);
      logger.success('Project removed from blacklist', { projectId: id });
    } else if (type === 'chat') {
      blacklist.chats = blacklist.chats.filter(cid => cid !== id);
      logger.success('Chat removed from blacklist', { chatId: id });
    }

    await this.set('blacklist', blacklist);
    return true;
  }

  // ===== EXPORT DATA =====

  async exportAll() {
    const data = await this.getAll();
    return data;  // Return raw object, not stringified
  }
}

// Export class and singleton instance
export { StorageManagerV2 };
export const storageV2 = new StorageManagerV2();