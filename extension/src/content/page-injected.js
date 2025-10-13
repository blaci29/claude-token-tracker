/**
 * INJECTED SCRIPT - Runs in page context (not content script isolated world)
 * This script intercepts fetch calls at the page level
 */

(function() {
  'use strict';
  
  console.log('🔧 Page interceptor starting...');
  
  const _originalFetch = window.fetch;
  
  window.fetch = async function(url, options = {}) {
    const urlString = typeof url === 'string' ? url : (url ? url.toString() : 'unknown');
    
    console.log('🌐 [PAGE] Fetch:', urlString);
    
    // Check if this is a completion request
    const isCompletion = urlString.includes('/completion');
    
    if (isCompletion) {
      console.log('🟢 COMPLETION REQUEST DETECTED!', urlString);
      
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
        console.log('🟢 COMPLETION RESPONSE IS SSE STREAM');
        
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
  
  console.log('✅ Fetch interceptor active in page context');
})();
