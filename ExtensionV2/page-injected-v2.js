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
        console.log(`   Messages: ${result.message_count} (${result.message_pair_count} pairs)`);
        console.log(`   Total chars: ${result.stats?.total_chars?.toLocaleString() || 0}`);
        console.log(`   Est. tokens: ${result.stats?.total_tokens_estimated?.toLocaleString() || 0}`);
      }
      return result;
    },

    // List all message pairs (rounds)
    async listRounds(chatId = null) {
      const result = await this._sendCommand('LIST_ROUNDS', { chatId });
      if (result && Array.isArray(result)) {
        console.log(`\n📝 Message Pairs (${result.length}):\n`);
        result.forEach((pair, i) => {
          console.log(`${i + 1}. Pair ${pair.pair_number}`);
          console.log(`   Human: ${pair.human_preview}`);
          console.log(`   Assistant: ${pair.assistant_preview}`);
          console.log(`   Tokens: ~${pair.total_tokens_estimated}`);
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

    // Reset storage (dangerous!)
    async resetStorage() {
      if (!confirm('⚠️ This will DELETE ALL V2 tracking data! Are you sure?')) {
        return;
      }

      const result = await this._sendCommand('RESET_STORAGE');
      console.log('✅ Storage reset complete');
      location.reload();
      return result;
    }
  };

  console.log('🎯 Claude Token Tracker V2 - Page Injected Script Ready!');
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

})();