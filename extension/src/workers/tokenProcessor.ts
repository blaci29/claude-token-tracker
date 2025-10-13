/*
 * Web Worker responsible for processing raw round data and estimating token usage.
 *
 * Receives messages from the service worker (background) containing the text
 * content of a round. Performs character counting and applies configured
 * characters‑per‑token ratios to estimate token usage. In future versions this
 * worker will call the Claude API to obtain exact token counts.
 *
 * Note: Web Workers run in a separate scope and cannot access the DOM or
 * certain Chrome APIs directly.
 */

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;
  if (type === 'processRound') {
    const { userChars, assistantChars, thinkingChars, toolChars, ratios } = payload;
    // Simple estimation: tokens = chars / ratio
    const estimate = {
      userTokens: userChars / ratios.user,
      assistantTokens: assistantChars / ratios.assistant,
      thinkingTokens: thinkingChars / ratios.thinking,
      toolTokens: toolChars / ratios.tool
    };
    // Respond back to the sender (service worker)
    (self as any).postMessage({ type: 'roundProcessed', estimate });
  }
};