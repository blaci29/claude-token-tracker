/**
 * CLAUDE TOKEN TRACKER V2 - PAGE INJECTED SCRIPT
 * 
 * Runs in PAGE CONTEXT (not content script context)
 * 
 * Responsibilities:
 * - Intercept fetch() calls (POST /completion, GET /chat_conversations, etc.)
 * - Filter console spam
 * - Post messages to content script via window.postMessage
 * 
 * Note: This file has NO access to chrome.* APIs!
 * Must communicate via window.postMessage → content script → chrome.runtime
 */

(function() {
  'use strict';

  console.log('🔧 Claude Token Tracker V2 - Page Injected Script Starting...');

  // ═══════════════════════════════════════════════════════════════════
  // CONSOLE SPAM FILTER
  // ═══════════════════════════════════════════════════════════════════

  const CONSOLE_SPAM_PATTERNS = [
    'IsolatedSegment',
    'NOTIFICATION API DEBUG',
    'Violation',
    'Preferences fetched',
    'Intercom',
    'handler took',
    'Forced reflow',
    'honeycombio',
    'opentelemetry',
    'statsig',
    'Analytics loaded',
    'Message received',
    'sendMessage called',
    'Launcher is disabled',
    'iframe_ready',
    'segment_initialized',
    'Processing message',
    'Identify completed',
    'requestAnimationFrame',
    'setTimeout',
    'deterministic sampler'
  ];

  // Save original console methods
  const _originalLog = console.log;
  const _originalWarn = console.warn;
  const _originalError = console.error;
  const _originalInfo = console.info;
  const _originalDebug = console.debug;

  function shouldFilter(args) {
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch(e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    return CONSOLE_SPAM_PATTERNS.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  // Override console methods
  console.log = function(...args) {
    if (!shouldFilter(args)) {
      _originalLog.apply(console, args);
    }
  };

  console.warn = function(...args) {
    if (!shouldFilter(args)) {
      _originalWarn.apply(console, args);
    }
  };

  console.error = function(...args) {
    if (!shouldFilter(args)) {
      _originalError.apply(console, args);
    }
  };

  console.info = function(...args) {
    if (!shouldFilter(args)) {
      _originalInfo.apply(console, args);
    }
  };

  console.debug = function(...args) {
    if (!shouldFilter(args)) {
      _originalDebug.apply(console, args);
    }
  };

  console.log('✅ Console spam filter initialized');

  // ═══════════════════════════════════════════════════════════════════
  // FETCH INTERCEPTOR
  // ═══════════════════════════════════════════════════════════════════

  const _originalFetch = window.fetch;

  window.fetch = async function(url, options = {}) {
    const method = options.method || 'GET';
    const urlString = typeof url === 'string' ? url : url.toString();

    // ===== INTERCEPT: POST /completion =====
    if (urlString.includes('/completion') && method === 'POST') {
      console.log('📤 [V2] POST /completion intercepted');

      // Parse request body
      try {
        if (options.body) {
          const body = JSON.parse(options.body);
          
          // Send to content script
          window.postMessage({
            type: 'CLAUDE_TRACKER_V2_COMPLETION_REQUEST',
            data: {
              url: urlString,
              prompt: body.prompt || '',
              attachments: body.attachments || [],
              files: body.files || [],
              sync_sources: body.sync_sources || [],
              timestamp: new Date().toISOString()
            }
          }, '*');
        }
      } catch (e) {
        console.error('❌ Error parsing completion request:', e);
      }
    }

    // Call original fetch
    const response = await _originalFetch(url, options);

    // ===== INTERCEPT: GET /chat_conversations/{chatId} =====
    if (urlString.includes('/chat_conversations/') && method === 'GET') {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          
          console.log('📥 [V2] GET /chat_conversations response');
          
          // Send to content script
          window.postMessage({
            type: 'CLAUDE_TRACKER_V2_CHAT_DATA',
            data: {
              url: urlString,
              chat: data,
              timestamp: new Date().toISOString()
            }
          }, '*');
        } catch (e) {
          console.error('❌ Error parsing chat_conversations response:', e);
        }
      }
    }

    // ===== INTERCEPT: GET /sync/github/repo/{owner}/{repo}/tree/{branch} =====
    if (urlString.includes('/sync/github/repo/') && urlString.includes('/tree/') && method === 'GET') {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          
          // Parse owner/repo/branch from URL
          const match = urlString.match(/\/sync\/github\/repo\/([^\/]+)\/([^\/]+)\/tree\/(.+?)(?:\?|$)/);
          
          if (match && data.tree) {
            const [_, owner, repo, branch] = match;
            
            console.log('🌳 [V2] GitHub tree intercepted:', `${owner}/${repo}/${branch}`);
            
            // Send to content script
            window.postMessage({
              type: 'CLAUDE_TRACKER_V2_GITHUB_TREE',
              data: {
                owner,
                repo,
                branch,
                tree: data.tree,
                timestamp: new Date().toISOString()
              }
            }, '*');
          }
        } catch (e) {
          console.error('❌ Error parsing GitHub tree response:', e);
        }
      }
    }

    // ===== INTERCEPT: POST /sync/chat (Add files button) =====
    if (urlString.includes('/sync/chat') && method === 'POST' && !urlString.includes('/chat_conversations/')) {
      console.log('📎 [V2] POST /sync/chat intercepted (file picker)');
      
      // We don't need to do anything here, the GET /sync/chat/{uuid} will have the data
    }

    // ===== INTERCEPT: GET /sync/chat/{uuid} (Ready sync state) =====
    if (urlString.includes('/sync/chat/') && method === 'GET' && !urlString.includes('/chat_conversations/')) {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          
          if (data.type && data.status && data.status.state === 'ready') {
            console.log('🔗 [V2] Sync source ready:', data.type);
            
            // Send to content script
            window.postMessage({
              type: 'CLAUDE_TRACKER_V2_SYNC_READY',
              data: {
                sync_source: data,
                timestamp: new Date().toISOString()
              }
            }, '*');
          }
        } catch (e) {
          console.error('❌ Error parsing sync/chat response:', e);
        }
      }
    }

    return response;
  };

  console.log('✅ Fetch interceptor initialized');

  // ═══════════════════════════════════════════════════════════════════
  // DEBUG API (accessible from page console)
  // ═══════════════════════════════════════════════════════════════════

  window.claudeTrackerV2 = {
    // Send command to content script and wait for response
    async _sendCommand(command, data = {}) {
      return new Promise((resolve) => {
        const messageId = `cmd_${Date.now()}_${Math.random()}`;

        // Listen for response
        const listener = (event) => {
          if (event.data?.type === 'CLAUDE_TRACKER_V2_COMMAND_RESPONSE' &&
              event.data?.messageId === messageId) {
            window.removeEventListener('message', listener);
            resolve(event.data.result);
          }
        };

        window.addEventListener('message', listener);

        // Send command
        window.postMessage({
          type: 'CLAUDE_TRACKER_V2_COMMAND',
          command,
          data,
          messageId
        }, '*');

        // Timeout after 5 seconds
        setTimeout(() => {
          window.removeEventListener('message', listener);
          resolve({ error: 'Command timeout' });
        }, 5000);
      });
    },

    // Get current context
    async getContext() {
      const result = await this._sendCommand('GET_CONTEXT');
      console.table(result);
      return result;
    },

    // Get current round
    async getCurrentRound() {
      const result = await this._sendCommand('GET_CURRENT_ROUND');
      console.log('Current Round:', result);
      return result;
    },

    // Get chat summary
    async getChatSummary(chatId = null) {
      const result = await this._sendCommand('GET_CHAT_SUMMARY', { chatId });
      if (result && !result.error) {
        console.log(`\n📊 Chat: ${result.name}`);
        console.log(`   UUID: ${result.uuid}`);
        console.log(`   Messages: ${result.stats?.total_messages || result.messages?.length || 0} (${result.stats?.total_pairs || 0} pairs)`);
        console.log(`   Total chars: ${result.stats?.total_chars?.toLocaleString() || 0}`);
        console.log(`   Est. tokens: ${result.stats?.total_tokens_estimated?.toLocaleString() || 0}`);
        if (result.stats?.total_tokens_actual_input || result.stats?.total_tokens_actual_output) {
          console.log(`   Actual tokens: ${(result.stats.total_tokens_actual_input + result.stats.total_tokens_actual_output).toLocaleString()}`);
          console.log(`      Input: ${result.stats.total_tokens_actual_input.toLocaleString()}, Output: ${result.stats.total_tokens_actual_output.toLocaleString()}`);
        }
      }
      return result;
    },

    // List all message pairs (rounds)
    async listRounds(chatId = null) {
      const result = await this._sendCommand('LIST_ROUNDS', { chatId });
      if (result && Array.isArray(result)) {
        console.log(`\n📝 Message Pairs (${result.length}):\n`);
        result.forEach((pair, i) => {
          console.log(`${i + 1}. Pair ${pair.pair_number} (indexes: ${pair.human_index}/${pair.assistant_index})`);
          console.log(`   Human [${pair.human_uuid.substring(0, 8)}...]: ${pair.human_preview}`);
          console.log(`      ${pair.human_chars} chars, ~${pair.human_tokens} tokens`);
          console.log(`   Assistant [${pair.assistant_uuid.substring(0, 8)}...]: ${pair.assistant_preview}`);
          console.log(`      ${pair.assistant_chars} chars, ~${pair.assistant_tokens} tokens`);
          console.log(`   Total: ${pair.total_chars} chars, ~${pair.total_tokens_estimated} tokens\n`);
        });
      }
      return result;
    },

    // Get specific message
    async getMessage(arg1, arg2) {
      const data = typeof arg1 === 'number'
        ? { index: arg1 }
        : { chatId: arg1, index: arg2 };

      const result = await this._sendCommand('GET_MESSAGE', data);
      if (result && !result.error) {
        console.log('\n📬 Message:', result);
      }
      return result;
    },

    // Get project info
    async getProjectInfo(projectId = null) {
      const result = await this._sendCommand('GET_PROJECT_INFO', { projectId });
      if (result && !result.error) {
        console.log('\n📁 Project:', result);
      }
      return result;
    },

    // Get GitHub cache
    async getGithubCache() {
      const result = await this._sendCommand('GET_GITHUB_CACHE');
      if (result && !result.error) {
        console.log('\n🌳 GitHub Cache:', result);
      }
      return result;
    },

    // Export all data
    async exportData() {
      const result = await this._sendCommand('EXPORT_DATA');
      if (result && !result.error) {
        try {
          await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
          console.log('✅ Data exported to clipboard!');
        } catch (e) {
          console.log('📦 Export data:', result);
        }
      }
      return result;
    },

    // Download export as JSON file
    async downloadJSON() {
      const result = await this._sendCommand('EXPORT_DATA');
      if (result && !result.error) {
        const json = JSON.stringify(result, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `claude-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('✅ Data downloaded as JSON file!');
      }
      return result;
    },

    // Delete specific chat
    async deleteChat(chatId) {
      if (!chatId) {
        console.error('❌ Please provide a chatId (string)');
        console.log('💡 Tip: Use deleteCurrentChat() to delete the current chat');
        return { error: 'No chatId provided' };
      }

      if (!confirm(`⚠️ Delete chat ${chatId}?`)) {
        return { cancelled: true };
      }

      const result = await this._sendCommand('DELETE_CHAT', { chatId });
      console.log('✅ Chat deleted:', chatId);
      return result;
    },

    // Delete current chat
    async deleteCurrentChat() {
      const context = await this._sendCommand('GET_CONTEXT');
      if (!context.chatId) {
        console.error('❌ No current chat');
        return { error: 'No current chat' };
      }

      return await this.deleteChat(context.chatId);
    },

    // Delete specific project (and all its chats)
    async deleteProject(projectId) {
      if (!projectId) {
        console.error('❌ Please provide a projectId (string)');
        console.log('💡 Tip: Use deleteCurrentProject() to delete the current project');
        return { error: 'No projectId provided' };
      }

      if (projectId === '_no_project') {
        console.error('❌ Cannot delete virtual project');
        return { error: 'Cannot delete virtual project' };
      }

      if (!confirm(`⚠️ Delete project ${projectId} and ALL its chats?`)) {
        return { cancelled: true };
      }

      const result = await this._sendCommand('DELETE_PROJECT', { projectId });
      console.log('✅ Project deleted:', projectId);
      return result;
    },

    // Delete current project
    async deleteCurrentProject() {
      const context = await this._sendCommand('GET_CONTEXT');
      if (!context.projectId || context.projectId === '_no_project') {
        console.error('❌ No current project or is virtual project');
        return { error: 'No current project' };
      }

      return await this.deleteProject(context.projectId);
    },

    // Get blacklist
    async getBlacklist() {
      const result = await this._sendCommand('GET_BLACKLIST');
      if (result) {
        console.log('\n🚫 Blacklist:');
        console.log(`   Projects (${result.projects?.length || 0}):`, result.projects);
        console.log(`   Chats (${result.chats?.length || 0}):`, result.chats);
      }
      return result;
    },

    // Blacklist chat (prevents tracking)
    async blacklistChat(chatId) {
      if (!chatId) {
        console.error('❌ Please provide a chatId (string)');
        console.log('💡 Tip: Use blacklistCurrentChat() to blacklist the current chat');
        return { error: 'No chatId provided' };
      }

      const result = await this._sendCommand('BLACKLIST_CHAT', { chatId });
      console.log('🚫 Chat blacklisted (tracking disabled):', chatId);
      return result;
    },

    // Blacklist current chat
    async blacklistCurrentChat() {
      const context = await this._sendCommand('GET_CONTEXT');
      if (!context.chatId) {
        console.error('❌ No current chat');
        return { error: 'No current chat' };
      }

      return await this.blacklistChat(context.chatId);
    },

    // Blacklist project (prevents tracking all chats in project)
    async blacklistProject(projectId) {
      if (!projectId) {
        console.error('❌ Please provide a projectId (string)');
        console.log('💡 Tip: Use blacklistCurrentProject() to blacklist the current project');
        return { error: 'No projectId provided' };
      }

      if (projectId === '_no_project') {
        console.error('❌ Cannot blacklist virtual project');
        return { error: 'Cannot blacklist virtual project' };
      }

      const result = await this._sendCommand('BLACKLIST_PROJECT', { projectId });
      console.log('🚫 Project blacklisted (tracking disabled for all chats):', projectId);
      return result;
    },

    // Blacklist current project
    async blacklistCurrentProject() {
      const context = await this._sendCommand('GET_CONTEXT');
      if (!context.projectId || context.projectId === '_no_project') {
        console.error('❌ No current project or is virtual project');
        return { error: 'No current project' };
      }

      return await this.blacklistProject(context.projectId);
    },

    // Remove chat from blacklist
    async unblacklistChat(chatId) {
      if (!chatId) {
        console.error('❌ Please provide a chatId');
        return { error: 'No chatId provided' };
      }

      const result = await this._sendCommand('UNBLACKLIST_CHAT', { chatId });
      console.log('✅ Chat removed from blacklist (tracking enabled):', chatId);
      return result;
    },

    // Remove project from blacklist
    async unblacklistProject(projectId) {
      if (!projectId) {
        console.error('❌ Please provide a projectId');
        return { error: 'No projectId provided' };
      }

      const result = await this._sendCommand('UNBLACKLIST_PROJECT', { projectId });
      console.log('✅ Project removed from blacklist (tracking enabled):', projectId);
      return result;
    },

    // Reset storage (dangerous!)
    async resetStorage() {
      if (!confirm('⚠️ This will DELETE ALL V2 tracking data! Are you sure?')) {
        return;
      }

      const result = await this._sendCommand('RESET_STORAGE');
      console.log('✅ Storage reset complete');
      location.reload();
      return result;
    },

    // ===== SESSION TRACKING =====

    // Initialize sessions (first time setup)
    async initializeSessions() {
      const result = await this._sendCommand('INITIALIZE_SESSIONS');
      console.log('✅ Sessions initialized');
      return result;
    },

    // Get all sessions (raw data)
    async getSessions() {
      const result = await this._sendCommand('GET_SESSIONS');
      console.log('\n📊 Sessions:', result);
      return result;
    },

    // Get session stats (formatted)
    async getSessionStats() {
      const result = await this._sendCommand('GET_SESSION_STATS');
      if (result) {
        console.log('\n📊 Session Stats:\n');

        // Current Session (5hr)
        if (result.current) {
          console.log('🕐 Current Session (5 hours):');
          console.log(`   Pairs: ${result.current.total_pairs}`);
          console.log(`   Chars: ${result.current.total_chars.toLocaleString()}`);
          console.log(`   Tokens (est): ${result.current.total_tokens_estimated.toLocaleString()}\n`);
        } else {
          console.log('🕐 Current Session: No active session\n');
        }

        // Weekly Session (7 days)
        if (result.weekly) {
          console.log('📅 Weekly Session (7 days):');
          console.log(`   Pairs: ${result.weekly.total_pairs}`);
          console.log(`   Chars: ${result.weekly.total_chars.toLocaleString()}`);
          console.log(`   Tokens (est): ${result.weekly.total_tokens_estimated.toLocaleString()}`);

          if (result.weekly.opus_subset && result.weekly.opus_subset.total_pairs > 0) {
            console.log(`   ⭐ Opus subset: ${result.weekly.opus_subset.total_pairs} pairs (${result.weekly.opus_subset.total_tokens_estimated.toLocaleString()} tokens)`);
          }
          console.log('');
        } else {
          console.log('📅 Weekly Session: No active session\n');
        }

        // Monthly Session (30 days)
        if (result.monthly) {
          console.log('📆 Monthly Session (30 days):');
          console.log(`   Pairs: ${result.monthly.total_pairs}`);
          console.log(`   Chars: ${result.monthly.total_chars.toLocaleString()}`);
          console.log(`   Tokens (est): ${result.monthly.total_tokens_estimated.toLocaleString()}\n`);
        } else {
          console.log('📆 Monthly Session: No active session\n');
        }

        // Monthly Archive
        if (result.monthly_archive && result.monthly_archive.length > 0) {
          console.log(`📦 Monthly Archive (${result.monthly_archive.length} months):\n`);
          result.monthly_archive.forEach((archive, i) => {
            console.log(`   ${i + 1}. Archived: ${new Date(archive.archived_at).toLocaleDateString()}`);
            console.log(`      Reset: ${new Date(archive.reset_at).toLocaleDateString()}`);
            console.log(`      Pairs: ${archive.stats.total_pairs}, Tokens: ${archive.stats.total_tokens_estimated.toLocaleString()}`);
          });
          console.log('');
        }
      }
      return result;
    },

    // Get stats changelog (last N entries)
    async getChangelog(limit = 10) {
      const result = await this._sendCommand('GET_CHANGELOG', { limit });
      if (result && Array.isArray(result)) {
        console.log(`\n📝 Stats Changelog (last ${result.length} entries):\n`);
        result.forEach((entry, i) => {
          const timestamp = new Date(entry.timestamp).toLocaleString();
          console.log(`${i + 1}. [${timestamp}] ${entry.type}`);

          if (entry.type === 'message_pair_added') {
            console.log(`   Chat: ${entry.chat_id}`);
            console.log(`   Pair: ${entry.pair.human} → ${entry.pair.assistant}`);
            if (entry.is_opus) {
              console.log(`   ⭐ Opus model`);
            }
            console.log(`   Delta: +${entry.delta.chars} chars, +${entry.delta.tokens_estimated} tokens`);
          }
          console.log('');
        });
      }
      return result;
    },

    // Recalculate session stats (for debugging)
    async recalculateSessionStats(sessionType = 'current') {
      if (!['current', 'weekly', 'monthly'].includes(sessionType)) {
        console.error('❌ Invalid session type. Use: current, weekly, or monthly');
        return { error: 'Invalid session type' };
      }

      const result = await this._sendCommand('RECALCULATE_SESSION_STATS', { sessionType });
      console.log(`✅ ${sessionType} session stats recalculated`);
      return result;
    }
  };

  console.log('🎯 Claude Token Tracker V2 - Page Injected Script Ready!');
  console.log('');
  console.log('📌 Debug Commands:');
  console.log('   window.claudeTrackerV2.getContext()            // Current context');
  console.log('   window.claudeTrackerV2.getCurrentRound()       // Active round');
  console.log('   window.claudeTrackerV2.getChatSummary()        // Chat stats');
  console.log('   window.claudeTrackerV2.listRounds()            // All message pairs');
  console.log('   window.claudeTrackerV2.getMessage(index)       // Get message');
  console.log('   window.claudeTrackerV2.getProjectInfo()        // Project info');
  console.log('   window.claudeTrackerV2.getGithubCache()        // GitHub cache');
  console.log('');
  console.log('📊 Session Tracking (NEW!):');
  console.log('   window.claudeTrackerV2.initializeSessions()           // First time setup');
  console.log('   window.claudeTrackerV2.getSessionStats()              // Current/Weekly/Monthly stats');
  console.log('   window.claudeTrackerV2.getSessions()                  // Raw session data');
  console.log('   window.claudeTrackerV2.getChangelog(limit)            // Stats changelog (default: 10)');
  console.log('   window.claudeTrackerV2.recalculateSessionStats(type)  // Recalc (current/weekly/monthly)');
  console.log('');
  console.log('📤 Export:');
  console.log('   window.claudeTrackerV2.exportData()            // Copy to clipboard');
  console.log('   window.claudeTrackerV2.downloadJSON()          // Download JSON file');
  console.log('');
  console.log('🗑️  Delete (removes data, allows re-tracking):');
  console.log('   window.claudeTrackerV2.deleteCurrentChat()     // Delete THIS chat');
  console.log('   window.claudeTrackerV2.deleteCurrentProject()  // Delete THIS project');
  console.log('   window.claudeTrackerV2.deleteChat(chatId)      // Delete specific chat');
  console.log('   window.claudeTrackerV2.deleteProject(projId)   // Delete specific project');
  console.log('   window.claudeTrackerV2.resetStorage()          // ⚠️ DELETE ALL');
  console.log('');
  console.log('🚫 Blacklist (prevents tracking permanently):');
  console.log('   window.claudeTrackerV2.getBlacklist()           // Show blacklist');
  console.log('   window.claudeTrackerV2.blacklistCurrentChat()   // Blacklist THIS chat');
  console.log('   window.claudeTrackerV2.blacklistCurrentProject()// Blacklist THIS project');
  console.log('   window.claudeTrackerV2.blacklistChat(chatId)    // Blacklist specific chat');
  console.log('   window.claudeTrackerV2.blacklistProject(prjId)  // Blacklist specific project');
  console.log('   window.claudeTrackerV2.unblacklistChat(chatId)  // Remove from blacklist');
  console.log('   window.claudeTrackerV2.unblacklistProject(id)   // Remove from blacklist');
  console.log('');

})();