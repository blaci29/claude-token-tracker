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
  console.log('🎯 Claude Token Tracker V2 - Page Injected Script Ready!');
  console.log('');

})();