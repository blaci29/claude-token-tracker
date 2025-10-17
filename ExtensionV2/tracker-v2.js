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
      // Check if chrome.runtime is available
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.error('❌ Storage communication error: chrome.runtime not available');
        console.log('   This usually means the service worker is not running or extension context is invalid');
        return null;
      }

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
  // AUTO-FIX: MISSING GITHUB FILES
  // ═══════════════════════════════════════════════════════════════════

  async function autoFixMissingGithubFiles(repoKey) {
    console.log('🔧 [V2] Auto-fix: Searching for messages with missing GitHub files for', repoKey);

    // Get all chats with incomplete messages from storage
    let allChats;
    try {
      allChats = await sendToStorage({
        action: 'GET_ALL_CHATS',
        data: {}
      });
    } catch (error) {
      console.error('❌ [V2] Auto-fix: Failed to get chats from storage:', error);
      return;
    }

    if (!allChats || allChats.length === 0) {
      console.log('ℹ️ [V2] Auto-fix: No chats found');
      return;
    }

    console.log(`🔍 [V2] Auto-fix: Checking ${allChats.length} chats...`);

    let totalChatsFixed = 0;
    let totalMessagesFixed = 0;

    for (const chat of allChats) {
      // Skip chats with no data_status or all complete
      if (!chat.data_status || chat.data_status.complete) {
        console.log(`⏭️ [V2] Auto-fix: Skipping chat "${chat.name}" (complete or no data_status)`);
        continue;
      }

      console.log(`🔎 [V2] Auto-fix: Checking chat "${chat.name}" (incomplete_message_count: ${chat.data_status.incomplete_message_count})...`);

      let chatNeedsUpdate = false;
      const updatedMessages = [];

      for (const message of chat.messages || []) {
        let messageNeedsUpdate = false;
        let messageFixed = { ...message };

        // Check if message has issues related to this repo
        if (message.data_status && !message.data_status.complete && message.data_status.issues) {
          console.log(`   📝 [V2] Message ${message.index}: has ${message.data_status.issues.length} issues`);

          const hasRepoIssue = message.data_status.issues.some(
            issue => {
              const matches = issue.type === 'missing_github_files' &&
                              issue.required_data &&
                              issue.required_data.includes(repoKey);

              if (issue.type === 'missing_github_files') {
                console.log(`      Issue: ${issue.type}, required_data:`, issue.required_data, `matches repo "${repoKey}":`, matches);
              }

              return matches;
            }
          );

          if (hasRepoIssue) {
            console.log(`   ✅ [V2] Message ${message.index}: Found matching repo issue, attempting fix...`);
            // Re-expand sync sources with new cache
            const expandedFiles = [];
            const updatedSyncSources = [];

            for (const syncSource of message.sync_sources || []) {
              const files = await expandSyncSourceFiles(syncSource);

              if (files.length > 0) {
                expandedFiles.push(...files);
                updatedSyncSources.push({
                  ...syncSource,
                  expanded_files: files,
                  issue: undefined  // Remove issue
                });
                messageNeedsUpdate = true;
              } else {
                // Still no files (keep issue)
                updatedSyncSources.push(syncSource);
              }
            }

            if (messageNeedsUpdate) {
              // Recalculate stats with expanded files
              const newStats = calculateMessageStats(message, expandedFiles);

              // Update data_status (remove fixed issues)
              const remainingIssues = message.data_status.issues.filter(
                issue => !(issue.type === 'missing_github_files' &&
                          issue.required_data &&
                          issue.required_data.includes(repoKey))
              );

              const isComplete = remainingIssues.length === 0;

              messageFixed = {
                ...message,
                sync_sources: updatedSyncSources,
                stats: newStats,
                data_status: {
                  complete: isComplete,
                  validated: isComplete,
                  locked: false,
                  issues: remainingIssues,
                  last_sync: new Date().toISOString()
                }
              };

              totalMessagesFixed++;
              chatNeedsUpdate = true;
            }
          }
        }

        updatedMessages.push(messageFixed);
      }

      if (chatNeedsUpdate) {
        // Recalculate chat-level data_status
        const incompleteMessageCount = updatedMessages.filter(m => !m.data_status.complete).length;
        const allMessagesComplete = incompleteMessageCount === 0;

        const updatedChat = {
          ...chat,
          messages: updatedMessages,
          data_status: {
            complete: allMessagesComplete,
            all_messages_complete: allMessagesComplete,
            incomplete_message_count: incompleteMessageCount,
            last_sync: new Date().toISOString()
          }
        };

        // Save updated chat to storage
        await sendToStorage({
          action: 'UPDATE_CHAT_MESSAGES',
          data: {
            chatId: chat.uuid,
            chat: updatedChat
          }
        });

        totalChatsFixed++;
        console.log(`✅ [V2] Auto-fix: Fixed chat "${chat.name}" (${updatedMessages.filter((m, i) => m !== chat.messages[i]).length} messages updated)`);
      }
    }

    if (totalMessagesFixed > 0) {
      console.log(`🎉 [V2] Auto-fix complete: ${totalMessagesFixed} messages fixed in ${totalChatsFixed} chats for repo ${repoKey}`);
    } else {
      console.log(`ℹ️ [V2] Auto-fix: No messages needed fixing for repo ${repoKey}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GITHUB TREE CACHE
  // ═══════════════════════════════════════════════════════════════════

  async function cacheGithubTree(owner, repo, branch, tree) {
    const key = `${owner}/${repo}/${branch}`;
    const cacheData = {
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

    // Save to memory cache (for current session)
    githubTreeCache[key] = cacheData;

    // Save to persistent storage (for auto-fix and future sessions)
    await sendToStorage({
      action: 'CACHE_GITHUB_TREE',
      data: {
        key: key,
        cache: cacheData
      }
    });

    console.log('🌳 [V2] GitHub tree cached:', key, `(${cacheData.files.length} files)`);

    // AUTO-FIX: Find and fix messages with missing GitHub files for this repo
    await autoFixMissingGithubFiles(key);
  }

  async function getGithubTree(owner, repo, branch) {
    const key = `${owner}/${repo}/${branch}`;

    // Try memory cache first
    let cached = githubTreeCache[key];

    // If not in memory, try persistent storage
    if (!cached) {
      const storageCache = await sendToStorage({
        action: 'GET_GITHUB_TREE',
        data: { key: key }
      });

      if (storageCache) {
        // Load into memory cache
        githubTreeCache[key] = storageCache;
        cached = storageCache;
      }
    }

    if (cached) {
      const now = new Date();
      const expires = new Date(cached.expires_at);
      if (now < expires) {
        return cached.files;
      } else {
        console.log('⚠️ [V2] GitHub cache expired:', key);
        delete githubTreeCache[key];

        // Also delete from persistent storage
        await sendToStorage({
          action: 'DELETE_GITHUB_TREE',
          data: { key: key }
        });
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPAND SYNC SOURCE FILES (from GitHub cache)
  // ═══════════════════════════════════════════════════════════════════

  async function expandSyncSourceFiles(syncSource) {
    if (syncSource.type !== 'github') return [];

    const { owner, repo, branch, filters } = syncSource.config;
    if (!owner || !repo || !branch || !filters) return [];

    const tree = await getGithubTree(owner, repo, branch);
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

    // Extract and process messages
    const rawMessages = chatData.chat_messages || [];
    const processedMessages = rawMessages.map((msg, index) => {
      // Expand sync_sources to file list (GitHub, etc.)
      const expandedFiles = [];
      const syncSources = msg.sync_sources || [];
      const syncSourcesWithIssues = [];

      for (const syncSource of syncSources) {
        const files = expandSyncSourceFiles(syncSource);

        if (files.length > 0) {
          expandedFiles.push(...files);
          syncSourcesWithIssues.push({
            ...syncSource,
            expanded_files: files
          });
        } else {
          // No files found - mark as issue
          syncSourcesWithIssues.push({
            ...syncSource,
            expanded_files: [],
            issue: 'missing_github_files'
          });
        }
      }

      // Calculate message stats (including expanded files)
      const stats = calculateMessageStats(msg, expandedFiles);

      // Detect issues
      const issues = [];
      let isComplete = true;

      // Check for missing GitHub files
      for (const syncSource of syncSourcesWithIssues) {
        if (syncSource.issue === 'missing_github_files') {
          const repoKey = `${syncSource.config.owner}/${syncSource.config.repo}/${syncSource.config.branch}`;
          issues.push({
            id: `missing_github_${syncSource.uuid}`,
            type: 'missing_github_files',
            severity: 'warning',
            description: `GitHub file list not available for ${repoKey}`,
            can_auto_fix: true,
            required_data: [repoKey],
            created_at: new Date().toISOString()
          });
          isComplete = false;
        }
      }

      // Check for missing attachments
      if (msg.attachments && msg.attachments.length > 0) {
        for (const attachment of msg.attachments) {
          if (!attachment.extracted_content && !attachment.file_name) {
            issues.push({
              id: `missing_attachment_${attachment.id || index}`,
              type: 'missing_attachment_content',
              severity: 'warning',
              description: 'Attachment content not extracted',
              can_auto_fix: false,
              created_at: new Date().toISOString()
            });
            isComplete = false;
          }
        }
      }

      // Data status
      const data_status = {
        complete: isComplete,
        validated: isComplete && issues.length === 0,
        locked: false,
        issues: issues,
        last_sync: new Date().toISOString()
      };

      return {
        uuid: msg.uuid,
        index: index,
        sender: msg.sender,
        parent_message_uuid: msg.parent_message_uuid || null,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        stop_reason: msg.completion?.stop_reason || null,
        model: msg.model || null,  // For Opus detection (assistant messages only)
        content: msg.content || [],
        attachments: msg.attachments || [],
        files: msg.files || [],
        sync_sources: syncSourcesWithIssues,
        stats: stats,
        data_status: data_status
      };
    });

    // Calculate chat-level data_status
    const incompleteMessageCount = processedMessages.filter(m => !m.data_status.complete).length;
    const allMessagesComplete = incompleteMessageCount === 0;

    const chatDataStatus = {
      complete: allMessagesComplete,
      all_messages_complete: allMessagesComplete,
      incomplete_message_count: incompleteMessageCount,
      last_sync: new Date().toISOString()
    };

    // Prepare chat object with embedded messages
    const chatObj = {
      uuid: chatData.uuid,
      name: chatData.name || 'Untitled Chat',
      summary: chatData.summary || '',
      project_uuid: chatData.project_uuid || null,
      created_at: chatData.created_at,
      updated_at: chatData.updated_at,
      is_starred: chatData.is_starred || false,
      settings: chatData.settings || {},
      messages: processedMessages,  // ← Embedded directly!
      data_status: chatDataStatus
    };

    // Save chat to storage
    // Use project_uuid from chat data if available, otherwise fall back to context
    const projectId = chatObj.project_uuid || context.projectId || '_no_project';

    await sendToStorage({
      action: 'SAVE_CHAT',
      data: {
        userId: context.userId,
        orgId: context.orgId,
        projectId: projectId,
        chat: chatObj
      }
    });

    console.log('✅ [V2] Chat saved:', chatObj.name);
    console.log(`   Project: ${projectId}`);
    console.log(`   Messages: ${processedMessages.length}`);

    // ===== SESSION TRACKING: Add message pairs =====
    await trackMessagePairs(chatObj.uuid, processedMessages);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SESSION TRACKING: MESSAGE PAIR TRACKING
  // ═══════════════════════════════════════════════════════════════════

  async function trackMessagePairs(chatId, messages) {
    if (!messages || messages.length === 0) return;

    console.log('📊 [V2] Tracking message pairs for sessions...');

    // Find complete pairs (human + assistant)
    let pairsAdded = 0;
    let incompleteFound = false;

    for (let i = 0; i < messages.length - 1; i += 2) {
      const humanMsg = messages[i];
      const assistantMsg = messages[i + 1];

      // Check if this is a valid pair
      if (!humanMsg || !assistantMsg) {
        incompleteFound = true;
        break;
      }

      if (humanMsg.sender !== 'human' || assistantMsg.sender !== 'assistant') {
        console.warn('⚠️ [V2] Invalid message pair sequence at index', i);
        continue;
      }

      // Add pair to sessions
      try {
        await sendToStorage({
          action: 'ADD_MESSAGE_PAIR',
          data: {
            chatId: chatId,
            humanIndex: i,
            assistantIndex: i + 1,
            humanMessage: humanMsg,
            assistantMessage: assistantMsg
          }
        });

        pairsAdded++;
      } catch (error) {
        console.error('❌ [V2] Failed to add message pair:', error);
      }
    }

    console.log(`✅ [V2] Session tracking: ${pairsAdded} pairs added`);

    if (incompleteFound) {
      console.log('ℹ️ [V2] Incomplete pair detected at end (no assistant response yet)');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // MESSAGE STATS CALCULATION
  // ═══════════════════════════════════════════════════════════════════

  function calculateMessageStats(message, expandedFiles = []) {
    const stats = {
      total_chars: 0,
      total_tokens_estimated: 0,
      total_tokens_actual: null,
      by_type: {}
    };

    // Get token ratios and estimation function from constants
    const { estimateTokens } = window.TrackerV2Utils || {};
    if (!estimateTokens) {
      console.warn('⚠️ TrackerV2Utils not available, using default estimation');
    }

    // Process content blocks
    if (message.content && Array.isArray(message.content)) {
      for (const block of message.content) {
        const contentType = block.type || 'text';
        const text = block.text || block.thinking || '';
        const chars = text.length;

        stats.total_chars += chars;

        // Estimate tokens
        const tokens = estimateTokens
          ? estimateTokens(chars, contentType)
          : Math.ceil(chars / 2.6); // Fallback

        stats.total_tokens_estimated += tokens;

        // Track by type
        if (!stats.by_type[contentType]) {
          stats.by_type[contentType] = { chars: 0, tokens_estimated: 0 };
        }
        stats.by_type[contentType].chars += chars;
        stats.by_type[contentType].tokens_estimated += tokens;
      }
    }

    // Process expanded files from sync_sources (GitHub, etc.)
    if (expandedFiles && expandedFiles.length > 0) {
      const fileType = 'github_files';

      if (!stats.by_type[fileType]) {
        stats.by_type[fileType] = { chars: 0, tokens_estimated: 0, file_count: 0 };
      }

      for (const file of expandedFiles) {
        stats.total_chars += file.chars || 0;
        stats.total_tokens_estimated += file.tokens_estimated || 0;

        stats.by_type[fileType].chars += file.chars || 0;
        stats.by_type[fileType].tokens_estimated += file.tokens_estimated || 0;
        stats.by_type[fileType].file_count++;
      }

      console.log(`📂 [V2] Added ${expandedFiles.length} GitHub files to stats:`, {
        chars: stats.by_type[fileType].chars,
        tokens: stats.by_type[fileType].tokens_estimated
      });
    }

    // Add actual tokens if available (from API)
    if (message.completion?.usage) {
      const usage = message.completion.usage;
      stats.total_tokens_actual = {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: usage.cache_read_input_tokens || 0
      };
    }

    return stats;
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
      await cacheGithubTree(owner, repo, branch, tree);
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

    // ===== COMMAND FROM PAGE CONSOLE =====
    else if (message.type === 'CLAUDE_TRACKER_V2_COMMAND') {
      const { command, data, messageId } = message;
      let result = null;

      try {
        switch (command) {
          case 'GET_CONTEXT':
            result = { ...context };
            break;

          case 'GET_CURRENT_ROUND':
            result = { ...currentRound };
            break;

          case 'GET_CHAT_SUMMARY':
            result = await sendToStorage({
              action: 'GET_CHAT',
              data: { chatId: data.chatId || context.chatId }
            });
            break;

          case 'LIST_ROUNDS':
            const chatId = data.chatId || context.chatId;
            if (!chatId) {
              result = { error: 'No chat ID' };
              break;
            }

            const chat = await sendToStorage({
              action: 'GET_CHAT',
              data: { chatId }
            });

            if (!chat || !chat.messages) {
              result = [];
              break;
            }

            const pairs = [];
            for (let i = 0; i < chat.messages.length; i += 2) {
              const human = chat.messages[i];
              const assistant = chat.messages[i + 1];

              if (!assistant) break;

              const humanPreview = human.content
                ?.map(c => c.text || '')
                .join(' ')
                .substring(0, 100) || '';

              const assistantPreview = assistant.content
                ?.map(c => c.text || '')
                .join(' ')
                .substring(0, 100) || '';

              pairs.push({
                pair_number: Math.floor(i / 2) + 1,
                human_uuid: human.uuid,
                human_index: human.index,
                human_chars: human.stats.total_chars,
                human_tokens: human.stats.total_tokens_estimated,
                human_preview: humanPreview,
                assistant_uuid: assistant.uuid,
                assistant_index: assistant.index,
                assistant_chars: assistant.stats.total_chars,
                assistant_tokens: assistant.stats.total_tokens_estimated,
                assistant_preview: assistantPreview,
                total_chars: human.stats.total_chars + assistant.stats.total_chars,
                total_tokens_estimated: human.stats.total_tokens_estimated + assistant.stats.total_tokens_estimated
              });
            }

            result = pairs;
            break;

          case 'GET_MESSAGE':
            const msgChatId = data.chatId || context.chatId;
            if (!msgChatId) {
              result = { error: 'No chat ID' };
              break;
            }

            result = await sendToStorage({
              action: 'GET_MESSAGE',
              data: { chatId: msgChatId, index: data.index }
            });
            break;

          case 'GET_PROJECT_INFO':
            const projectId = data.projectId || context.projectId || '_no_project';
            result = await sendToStorage({
              action: 'GET_PROJECT',
              data: { projectId }
            });
            break;

          case 'GET_GITHUB_CACHE':
            result = { ...githubTreeCache };
            break;

          case 'DELETE_CHAT':
            await sendToStorage({
              action: 'DELETE_CHAT',
              data: { chatId: data.chatId }
            });
            result = { success: true };
            break;

          case 'DELETE_PROJECT':
            await sendToStorage({
              action: 'DELETE_PROJECT',
              data: { projectId: data.projectId }
            });
            result = { success: true };
            break;

          case 'GET_BLACKLIST':
            result = await sendToStorage({
              action: 'GET_BLACKLIST',
              data: {}
            });
            break;

          case 'BLACKLIST_CHAT':
            await sendToStorage({
              action: 'ADD_TO_BLACKLIST',
              data: { type: 'chat', id: data.chatId }
            });
            result = { success: true };
            break;

          case 'BLACKLIST_PROJECT':
            await sendToStorage({
              action: 'ADD_TO_BLACKLIST',
              data: { type: 'project', id: data.projectId }
            });
            result = { success: true };
            break;

          case 'UNBLACKLIST_CHAT':
            await sendToStorage({
              action: 'REMOVE_FROM_BLACKLIST',
              data: { type: 'chat', id: data.chatId }
            });
            result = { success: true };
            break;

          case 'UNBLACKLIST_PROJECT':
            await sendToStorage({
              action: 'REMOVE_FROM_BLACKLIST',
              data: { type: 'project', id: data.projectId }
            });
            result = { success: true };
            break;

          case 'EXPORT_DATA':
            result = await sendToStorage({
              action: 'EXPORT_ALL',
              data: {}
            });
            break;

          case 'RESET_STORAGE':
            await sendToStorage({
              action: 'RESET_ALL',
              data: {}
            });
            result = { success: true };
            break;

          // ===== SESSION TRACKING =====
          case 'INITIALIZE_SESSIONS':
            result = await sendToStorage({
              action: 'INITIALIZE_SESSIONS',
              data: {}
            });
            break;

          case 'GET_SESSIONS':
            result = await sendToStorage({
              action: 'GET_SESSIONS',
              data: {}
            });
            break;

          case 'GET_SESSION_STATS':
            result = await sendToStorage({
              action: 'GET_SESSION_STATS',
              data: {}
            });
            break;

          case 'GET_CHANGELOG':
            result = await sendToStorage({
              action: 'GET_CHANGELOG',
              data: { limit: data.limit || 10 }
            });
            break;

          case 'RECALCULATE_SESSION_STATS':
            result = await sendToStorage({
              action: 'RECALCULATE_SESSION_STATS',
              data: { sessionType: data.sessionType }
            });
            break;

          default:
            result = { error: 'Unknown command' };
        }
      } catch (error) {
        result = { error: error.message };
      }

      // Send response back to page
      window.postMessage({
        type: 'CLAUDE_TRACKER_V2_COMMAND_RESPONSE',
        messageId,
        result
      }, '*');
    }
  });

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
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  console.log('🎯 Claude Token Tracker V2 - Content Script Ready!');

  // Initial context detection
  setTimeout(() => {
    updateContext();
  }, 1000);

})();
