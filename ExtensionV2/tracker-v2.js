/**
 * CLAUDE TOKEN TRACKER V2 - MAIN CONTENT SCRIPT
 * 
 * Runs in CONTENT SCRIPT CONTEXT
 * 
 * Responsibilities:
 * - Context detection (User, Org, Project, Chat)
 * - URL change monitoring
 * - Listen to page-injected messages
 * - Round tracking coordination
 * - Storage coordination via chrome.runtime.sendMessage
 * - Debug commands on window.claudeTrackerV2
 */

(function() {
  'use strict';

  console.log('🚀 Claude Token Tracker V2 - Content Script Starting...');

  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT STATE
  // ═══════════════════════════════════════════════════════════════════

  const context = {
    userId: null,
    orgId: null,
    projectId: null,
    chatId: null,
    chatName: null,
    isProjectChat: false,
    initialized: false
  };

  // ═══════════════════════════════════════════════════════════════════
  // ROUND TRACKING STATE
  // ═══════════════════════════════════════════════════════════════════

  let currentRound = {
    active: false,
    chatId: null,
    pairNumber: null,
    humanMessage: null,
    assistantMessage: null,
    startedAt: null
  };

  // Cache for sync sources (GitHub, etc.)
  let pendingSyncSources = [];

  // Cache for GitHub trees
  const githubTreeCache = {};

  // ═══════════════════════════════════════════════════════════════════
  // USER ID DETECTION (from cookie)
  // ═══════════════════════════════════════════════════════════════════

  function getUserIdFromCookie() {
    try {
      const cookies = document.cookie.split(';');
      const userIdCookie = cookies.find(c => c.includes('ajs_user_id'));
      if (userIdCookie) {
        const userId = userIdCookie.split('=')[1]?.trim();
        if (userId && userId !== 'undefined' && userId !== 'null') {
          return userId;
        }
      }
    } catch (e) {
      console.error('❌ Error reading user ID from cookie:', e);
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // URL PARSING
  // ═══════════════════════════════════════════════════════════════════

  function parseUrl(url = window.location.href) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Extract org ID from URL: /api/organizations/{orgId}/...
    const orgMatch = pathname.match(/\/organizations\/([a-f0-9-]+)/);
    const orgId = orgMatch ? orgMatch[1] : null;

    // Check if project chat: /project/{projectId}/chat/{chatId}
    const projectChatMatch = pathname.match(/\/project\/([a-f0-9-]+)\/chat\/([a-f0-9-]+)/);
    if (projectChatMatch) {
      return {
        type: 'project_chat',
        projectId: projectChatMatch[1],
        chatId: projectChatMatch[2],
        orgId: orgId || context.orgId
      };
    }

    // Check if regular chat: /chat/{chatId}
    const chatMatch = pathname.match(/\/chat\/([a-f0-9-]+)/);
    if (chatMatch) {
      return {
        type: 'chat',
        projectId: null,
        chatId: chatMatch[1],
        orgId: orgId || context.orgId
      };
    }

    return {
      type: 'other',
      projectId: null,
      chatId: null,
      orgId: orgId
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHAT TITLE DETECTION
  // ═══════════════════════════════════════════════════════════════════

  function getChatTitle() {
    // Try DOM selector first
    try {
      const titleElement = document.querySelector('.min-w-0.flex-1 .truncate.font-base-bold');
      if (titleElement && titleElement.textContent) {
        return titleElement.textContent.trim();
      }
    } catch (e) {
      // Ignore
    }

    // Fallback to document.title
    try {
      const docTitle = document.title;
      if (docTitle && docTitle !== 'Claude') {
        const parts = docTitle.split('|');
        if (parts.length > 0) {
          return parts[0].trim();
        }
      }
    } catch (e) {
      // Ignore
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT DETECTION & UPDATE
  // ═══════════════════════════════════════════════════════════════════

  async function updateContext() {
    const urlInfo = parseUrl();
    
    // Update user ID (once)
    if (!context.userId) {
      context.userId = getUserIdFromCookie();
      if (context.userId) {
        console.log('👤 [V2] User ID detected:', context.userId);
      }
    }

    // Update org ID
    if (urlInfo.orgId && urlInfo.orgId !== context.orgId) {
      context.orgId = urlInfo.orgId;
      console.log('🏢 [V2] Organization ID:', context.orgId);
    }

    // Update project & chat
    const chatChanged = urlInfo.chatId !== context.chatId;
    const projectChanged = urlInfo.projectId !== context.projectId;

    if (chatChanged || projectChanged) {
      context.projectId = urlInfo.projectId;
      context.chatId = urlInfo.chatId;
      context.isProjectChat = urlInfo.type === 'project_chat';

      if (context.chatId) {
        console.log('💬 [V2] Chat context:', {
          chatId: context.chatId,
          projectId: context.projectId || '_no_project',
          isProject: context.isProjectChat
        });

        // Get chat title
        setTimeout(() => {
          const title = getChatTitle();
          if (title) {
            context.chatName = title;
            console.log('📝 [V2] Chat title:', title);
          }
        }, 500);

        // Initialize chat in storage (will load existing data if available)
        await initializeChat();
      }
    }

    if (!context.initialized) {
      context.initialized = true;
      console.log('✅ [V2] Context initialized');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STORAGE COMMUNICATION
  // ═══════════════════════════════════════════════════════════════════

  async function sendToStorage(message) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRACKER_V2_STORAGE',
        action: message.action,
        data: message.data
      });

      if (response && response.success) {
        return response.data;
      } else {
        console.error('❌ Storage action failed:', response?.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Storage communication error:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHAT INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  async function initializeChat() {
    if (!context.chatId) return;

    console.log('🔄 [V2] Initializing chat...');

    // Check if chat exists in storage
    const existingChat = await sendToStorage({
      action: 'GET_CHAT',
      data: { chatId: context.chatId }
    });

    if (existingChat) {
      console.log('📦 [V2] Chat loaded from storage:', existingChat.name);
      context.chatName = existingChat.name;
      return;
    }

    // Chat doesn't exist, we'll create it when we get chat data from API
    console.log('🆕 [V2] New chat detected, waiting for API data...');
  }

  // ═══════════════════════════════════════════════════════════════════
  // GITHUB TREE CACHE
  // ═══════════════════════════════════════════════════════════════════

  function cacheGithubTree(owner, repo, branch, tree) {
    const key = `${owner}/${repo}/${branch}`;
    githubTreeCache[key] = {
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      files: tree
        .filter(item => item.type === 'blob')
        .map(item => ({
          path: item.path,
          size: item.size || 0,
          type: item.type,
          sha: item.sha
        }))
    };

    console.log('🌳 [V2] GitHub tree cached:', key, `(${githubTreeCache[key].files.length} files)`);
  }

  function getGithubTree(owner, repo, branch) {
    const key = `${owner}/${repo}/${branch}`;
    const cached = githubTreeCache[key];

    if (cached) {
      const now = new Date();
      const expires = new Date(cached.expires_at);
      if (now < expires) {
        return cached.files;
      } else {
        console.log('⚠️ [V2] GitHub cache expired:', key);
        delete githubTreeCache[key];
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPAND SYNC SOURCE FILES (from GitHub cache)
  // ═══════════════════════════════════════════════════════════════════

  function expandSyncSourceFiles(syncSource) {
    if (syncSource.type !== 'github') return [];

    const { owner, repo, branch, filters } = syncSource.config;
    if (!owner || !repo || !branch || !filters) return [];

    const tree = getGithubTree(owner, repo, branch);
    if (!tree) {
      console.warn('⚠️ [V2] No GitHub cache for:', `${owner}/${repo}/${branch}`);
      return [];
    }

    const selectedPaths = Object.keys(filters.filters || {});
    const matchedFiles = [];

    for (const file of tree) {
      const normalizedFilePath = file.path.startsWith('/') ? file.path : '/' + file.path;

      for (const selectedPath of selectedPaths) {
        const normalizedSelectedPath = selectedPath.startsWith('/') ? selectedPath : '/' + selectedPath;

        // Directory match
        if (normalizedSelectedPath.endsWith('/')) {
          if (normalizedFilePath.startsWith(normalizedSelectedPath)) {
            matchedFiles.push(file);
            break;
          }
        }
        // Exact file match
        else if (normalizedFilePath === normalizedSelectedPath) {
          matchedFiles.push(file);
          break;
        }
      }
    }

    console.log('📂 [V2] Expanded files:', matchedFiles.length);
    return matchedFiles.map(file => ({
      path: file.path,
      size: file.size,
      chars: file.size, // Assuming text files
      tokens_estimated: Math.ceil(file.size / 3.2), // Document chars/token ratio
      chars_per_token: 3.2
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  // PROCESS CHAT DATA (from GET /chat_conversations)
  // ═══════════════════════════════════════════════════════════════════

  async function processChatData(chatData) {
    if (!chatData || !chatData.uuid) return;

    console.log('📊 [V2] Processing chat data...');

    // Extract messages
    const messages = chatData.chat_messages || [];
    
    // Save chat to storage
    await sendToStorage({
      action: 'SAVE_CHAT',
      data: {
        userId: context.userId,
        orgId: context.orgId,
        projectId: context.projectId || '_no_project',
        chat: chatData,
        messages: messages
      }
    });

    console.log('✅ [V2] Chat saved:', chatData.name || chatData.uuid);
    console.log(`   Messages: ${messages.length}`);
    console.log(`   Pairs: ${Math.floor(messages.length / 2)}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MESSAGE LISTENER (from page-injected)
  // ═══════════════════════════════════════════════════════════════════

  window.addEventListener('message', async (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;

    const message = event.data;
    if (!message || !message.type) return;

    // ===== COMPLETION REQUEST =====
    if (message.type === 'CLAUDE_TRACKER_V2_COMPLETION_REQUEST') {
      console.log('📤 [V2] Completion request received');
      
      // Start new round
      currentRound = {
        active: true,
        chatId: context.chatId,
        pairNumber: null, // Will be determined after API response
        humanMessage: null,
        assistantMessage: null,
        startedAt: new Date().toISOString()
      };

      // Cache sync sources for this round
      pendingSyncSources = message.data.sync_sources || [];

      console.log('🟢 [V2] Round started');
    }

    // ===== CHAT DATA =====
    else if (message.type === 'CLAUDE_TRACKER_V2_CHAT_DATA') {
      console.log('📥 [V2] Chat data received');
      await processChatData(message.data.chat);

      // If round is active, this is the final data
      if (currentRound.active) {
        console.log('✅ [V2] Round completed');
        currentRound.active = false;
        currentRound = {
          active: false,
          chatId: null,
          pairNumber: null,
          humanMessage: null,
          assistantMessage: null,
          startedAt: null
        };
      }
    }

    // ===== GITHUB TREE =====
    else if (message.type === 'CLAUDE_TRACKER_V2_GITHUB_TREE') {
      const { owner, repo, branch, tree } = message.data;
      cacheGithubTree(owner, repo, branch, tree);
    }

    // ===== SYNC READY =====
    else if (message.type === 'CLAUDE_TRACKER_V2_SYNC_READY') {
      console.log('🔗 [V2] Sync source ready');
      // Add to pending sync sources if not already there
      const syncSource = message.data.sync_source;
      if (!pendingSyncSources.find(s => s.uuid === syncSource.uuid)) {
        pendingSyncSources.push(syncSource);
      }
    }

  // ═══════════════════════════════════════════════════════════════════
  // URL CHANGE MONITORING
  // ═══════════════════════════════════════════════════════════════════

  let lastUrl = window.location.href;

  function checkUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('🔄 [V2] URL changed');
      lastUrl = currentUrl;
      updateContext();
    }
  }

  // Check every 500ms
  setInterval(checkUrlChange, 500);

  // Also listen to popstate
  window.addEventListener('popstate', () => {
    console.log('🔄 [V2] Navigation detected (popstate)');
    setTimeout(updateContext, 100);
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEBUG COMMANDS
  // ═══════════════════════════════════════════════════════════════════

  window.claudeTrackerV2 = {
    // Get current context
    getContext() {
      return { ...context };
    },

    // Get current round
    getCurrentRound() {
      return { ...currentRound };
    },

    // Get chat summary
    async getChatSummary(chatId = context.chatId) {
      if (!chatId) {
        console.error('❌ No chat ID provided');
        return null;
      }

      return await sendToStorage({
        action: 'GET_CHAT',
        data: { chatId }
      });
    },

    // List rounds (message pairs)
    async listRounds(chatId = context.chatId) {
      if (!chatId) {
        console.error('❌ No chat ID provided');
        return null;
      }

      const chat = await sendToStorage({
        action: 'GET_CHAT',
        data: { chatId }
      });

      if (!chat || !chat.message_indexes) return [];

      const pairs = [];
      for (let i = 0; i < chat.message_indexes.length; i += 2) {
        const humanIdx = chat.message_indexes[i];
        const assistantIdx = chat.message_indexes[i + 1];

        const human = await sendToStorage({
          action: 'GET_MESSAGE',
          data: { chatId, index: humanIdx }
        });

        const assistant = await sendToStorage({
          action: 'GET_MESSAGE',
          data: { chatId, index: assistantIdx }
        });

        if (human && assistant) {
          pairs.push({
            pair: Math.floor(i / 2) + 1,
            human: {
              index: human.index,
              chars: human.stats.total_chars,
              tokens: human.stats.total_tokens_estimated
            },
            assistant: {
              index: assistant.index,
              chars: assistant.stats.total_chars,
              tokens: assistant.stats.total_tokens_estimated
            },
            total_tokens: human.stats.total_tokens_estimated + assistant.stats.total_tokens_estimated
          });
        }
      }

      return pairs;
    },

    // Get message details
    async getMessage(indexOrChatId, index = null) {
      let chatId, messageIndex;

      if (index === null) {
        // Called with just index, use current chat
        chatId = context.chatId;
        messageIndex = indexOrChatId;
      } else {
        // Called with chatId and index
        chatId = indexOrChatId;
        messageIndex = index;
      }

      if (!chatId) {
        console.error('❌ No chat ID');
        return null;
      }

      return await sendToStorage({
        action: 'GET_MESSAGE',
        data: { chatId, index: messageIndex }
      });
    },

    // Get project info
    async getProjectInfo(projectId = context.projectId) {
      const pid = projectId || context.projectId || '_no_project';

      return await sendToStorage({
        action: 'GET_PROJECT',
        data: { projectId: pid }
      });
    },

    // Get GitHub cache
    getGithubCache() {
      return { ...githubTreeCache };
    },

    // Export all data
    async exportData() {
      const data = await sendToStorage({
        action: 'EXPORT_ALL',
        data: {}
      });

      if (data) {
        const json = JSON.stringify(data, null, 2);
        
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(json);
          console.log('✅ Data exported to clipboard!');
        } catch (e) {
          console.log('📋 Data exported (see below):');
          console.log(json);
        }

        return data;
      }

      return null;
    },

    // Reset storage
    async resetStorage() {
      if (!confirm('⚠️ This will DELETE ALL V2 tracking data! Are you sure?')) {
        return;
      }

      await sendToStorage({
        action: 'RESET_ALL',
        data: {}
      });

      console.log('✅ Storage reset complete');
      location.reload();
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  console.log('🎯 Claude Token Tracker V2 - Content Script Ready!');
  console.log('');
  console.log('📌 Debug Commands:');
  console.log('   window.claudeTrackerV2.getContext()');
  console.log('   window.claudeTrackerV2.getCurrentRound()');
  console.log('   window.claudeTrackerV2.getChatSummary()');
  console.log('   window.claudeTrackerV2.listRounds()');
  console.log('   window.claudeTrackerV2.getMessage(index)');
  console.log('   window.claudeTrackerV2.getProjectInfo()');
  console.log('   window.claudeTrackerV2.getGithubCache()');
  console.log('   window.claudeTrackerV2.exportData()');
  console.log('   window.claudeTrackerV2.resetStorage()');
  console.log('');

  // Initial context detection
  setTimeout(() => {
    updateContext();
  }, 1000);

})();
