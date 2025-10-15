/**
 * CLAUDE TOKEN TRACKER - PAGE CONTEXT SCRIPT
 * This script observes fetch calls at the page level AND filters console spam
 */

(function() {
  'use strict';
  
  // === CONSOLE SPAM FILTER ===
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
    'deterministic sampler',
    'Loading chat data for',
    'Got response:',
    'Error loading chat data',
    'Error details:',
    '[COMPLETION] Request failed',
    '[COMPLETION] Not retryable error',
    'prompt is too long',
    'formatLargeNumber'
  ];
  
  // Save original console methods
  const _originalConsoleLog = console.log;
  const _originalConsoleWarn = console.warn;
  const _originalConsoleError = console.error;
  const _originalConsoleInfo = console.info;
  const _originalConsoleDebug = console.debug;
  
  // Helper function to check if message should be filtered
  function shouldFilter(args) {
    // Convert all arguments to strings
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
    
    // Check against all spam patterns
    return CONSOLE_SPAM_PATTERNS.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }
  
  // Override console methods with filtering
  console.log = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleLog.apply(console, args);
    }
  };
  
  console.warn = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleWarn.apply(console, args);
    }
  };
  
  console.error = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleError.apply(console, args);
    }
  };
  
  console.info = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleInfo.apply(console, args);
    }
  };
  
  console.debug = function(...args) {
    if (!shouldFilter(args)) {
      _originalConsoleDebug.apply(console, args);
    }
  };
  
  
  // === FETCH OBSERVER ===
  const _originalFetch = window.fetch;
  
  window.fetch = async function(url, options = {}) {
    const urlString = typeof url === 'string' ? url : (url ? url.toString() : 'unknown');
    
    // Check if this is a completion request
    const isCompletion = urlString.includes('/completion');
    
    if (isCompletion) {
      
      // Try to extract prompt from request body
      let promptText = '';
      let documents = { chars: 0, count: 0 };
      
      if (options.body) {
        try {
          const body = JSON.parse(options.body);
          promptText = body.prompt || '';
          
          // Check for documents
          let docChars = 0;
          let docCount = 0;
          
          if (body.attachments && Array.isArray(body.attachments)) {
            body.attachments.forEach((att) => {
              if (att.extracted_content) {
                docChars += att.extracted_content.length;
                docCount++;
              }
              if (att.content) {
                docChars += att.content.length;
                docCount++;
              }
            });
          }
          
          if (body.files && Array.isArray(body.files)) {
            body.files.forEach((file) => {
              if (file.content) {
                docChars += file.content.length;
                docCount++;
              }
              if (file.extracted_content) {
                docChars += file.extracted_content.length;
                docCount++;
              }
            });
          }
          
          documents = { chars: docChars, count: docCount };
          
        } catch(e) {
          console.error('Error parsing request body:', e);
        }
      }
      
      // Notify content script about completion request
      window.postMessage({
        type: 'CLAUDE_TRACKER_COMPLETION_REQUEST',
        url: urlString,
        promptText: promptText,
        documents: documents
      }, '*');
    }
    
    // Call original fetch
    const response = await _originalFetch.apply(this, arguments);
    
    // If completion response with SSE stream, process it
    if (isCompletion) {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('text/event-stream')) {
        // Clone response to read stream without consuming it
        const clonedResponse = response.clone();
        processSSEStream(clonedResponse.body);
      }
    }
    
    return response;
  };
  
  /**
   * Process SSE stream and send events to content script
   */
  async function processSSEStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // Send SSE events to content script
              window.postMessage({
                type: 'CLAUDE_TRACKER_SSE_EVENT',
                event: data
              }, '*');
              
            } catch(e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch(e) {
      console.error('Error reading SSE stream:', e);
    }
  }
  
  // === ERROR DETECTION ===
  // Catch unhandled promise rejections (e.g., "prompt is too long")
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason) {
      const errorMessage = event.reason.message || String(event.reason);
      
      // Check for known error patterns
      if (errorMessage.includes('prompt is too long')) {
        // Use console.log instead of warn to avoid red errors in Extensions tab
        console.log('🚨 Claude Token Tracker: prompt too long detected');
        
        // Notify observer about the error
        window.postMessage({
          type: 'CLAUDE_TRACKER_ERROR',
          error: 'prompt_too_long',
          message: errorMessage
        }, '*');
        
        // Prevent the unhandled rejection from showing as error
        event.preventDefault();
      }
    }
  });
  
  console.log('✅ Claude Token Tracker active');
})();
