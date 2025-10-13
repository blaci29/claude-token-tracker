# Claude Token Tracker

Real-time token usage tracking for Claude.ai conversations with advanced features and configurable estimation.

## 🎯 Overview

Claude Token Tracker is a Tampermonkey userscript that monitors and tracks token usage in your Claude.ai conversations. It provides detailed statistics, model detection, thinking process tracking, and exports your data for analysis.

**Why use this?** Claude.ai doesn't show token counts in the interface. This tracker estimates token usage based on character counts, helping you:
- Monitor conversation costs
- Track context window usage
- Analyze model performance
- Optimize your prompts

## ✨ Features

- ✅ **Automatic Token Tracking** - Tracks every conversation round
- ✅ **Model Detection** - Identifies which Claude model you're using (Sonnet, Opus, Haiku)
- ✅ **Thinking Detection** - Tracks extended thinking tokens separately
- ✅ **Document Support** - Handles attached files (PDF, TXT, etc.)
- ✅ **Configurable Estimation** - Fine-tune token estimation per content type
- ✅ **Console Spam Filter** - Clean console by filtering Claude.ai's debug messages
- ✅ **Debug Mode** - Detailed logging and export capabilities
- ✅ **Model Statistics** - Per-model analytics and comparisons
- ✅ **Memory Optimized** - Clears text content after processing
- ✅ **Export Data** - JSON export and clipboard copy

## 📊 Token Estimation

The tracker uses character-based token estimation:

- **Default**: 2.6 chars/token (~3-5% accuracy)
- **Configurable** per content type:
  - User messages
  - Documents
  - Thinking
  - Assistant responses
  - Tool content (artifacts, code)

### Fine-Tuning Guide

Different content types have different token densities:

1. **Code** (dense): 2.0-2.4 chars/token
   - Contains symbols, brackets, operators
2. **Natural Text** (normal): 2.6 chars/token
   - Regular conversation, explanations
3. **Documents** (sparse): 2.8-3.0 chars/token
   - PDFs, formatted text files

## 🚀 Installation

### Prerequisites

- [Tampermonkey](https://www.tampermonkey.net/) browser extension
- Supported browsers: Chrome, Firefox, Edge, Safari

### Steps

1. **Install Tampermonkey**
   - Chrome: [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - Edge: [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. **Install the Script**
   - Open Tampermonkey Dashboard
   - Click "Create a new script"
   - Copy and paste the entire script
   - Save (Ctrl+S or Cmd+S)

3. **Navigate to Claude.ai**
   - Go to [claude.ai](https://claude.ai)
   - The tracker will initialize automatically

## 💻 Usage

### Basic Usage

Once installed, the tracker runs automatically. Open the browser console (F12) to see:

- **Round summaries** after each conversation turn
- **Global statistics** across all conversations
- **Model information** and thinking detection

### Console Commands

Access these functions from the browser console:

```javascript
// Display all conversation rounds
window.showAllRounds()

// Show model-specific statistics
window.showModelStats()

// Export data to clipboard as JSON
window.exportJSON()

// Generate blob URL for data
window.getTrackerURL()

// Reset all tracking data
window.resetTracker()

// Enable enhanced debug mode
window.enableDebug()

// Disable debug mode
window.disableDebug()

// Download debug log as file
window.saveDebugLog()

// Show debug summary
window.getDebugSummary()
```

### Example Output

```
═══════════════════════════════════════════════════════
✅ ROUND #1 COMPLETED @ 13:21:23
🤖 MODEL: Sonnet 4.5
🧠 THINKING: ✓ YES
═══════════════════════════════════════════════════════

📥 USER INPUT:
   User message: 125 chars (~48 tokens)
   Documents: 0 chars (~0 tokens)
   ─────────────────────────────
   USER SUBTOTAL: 125 chars (~48 tokens)

🤖 CLAUDE OUTPUT:
   Thinking: 1,234 chars (~475 tokens)
   Assistant: 2,456 chars (~945 tokens)
   Tool Content: 0 chars (~0 tokens)
   ─────────────────────────────
   CLAUDE SUBTOTAL: 3,690 chars (~1,420 tokens)

═══════════════════════════════════════════════════════
📊 ROUND TOTAL: 3,815 chars (~1,468 tokens)
═══════════════════════════════════════════════════════
```

## ⚙️ Configuration

### User Settings

Edit these settings at the top of the script:

```javascript
const SETTINGS = {
  // Debug mode on startup
  DEBUG_MODE_ON_START: false,
  
  // Hide Claude.ai console spam
  HIDE_CLAUDE_CONSOLE_SPAM: true,
  
  // Central token estimation (default for all)
  CHARS_PER_TOKEN: 2.6,
  
  // Fine-tuned estimation per content type
  TOKEN_ESTIMATION: {
    userMessage: null,      // null = use central
    userDocuments: null,
    thinking: null,
    assistant: null,
    toolContent: null,      // e.g., 2.2 for code-heavy content
  },
  
  // Large document warning threshold
  LARGE_DOCUMENT_THRESHOLD: 100000,
  
  // Clear texts after saving (memory optimization)
  CLEAR_TEXTS_AFTER_SAVE: true,
  
  // Delay before saving round
  SAVE_DELAY_MS: 500,
};
```

### Console Spam Filtering

The tracker filters out Claude.ai's debug messages by default. To customize:

```javascript
CONSOLE_SPAM_PATTERNS: [
  'IsolatedSegment',
  'NOTIFICATION API DEBUG',
  'Violation',
  // Add your own patterns here
],
```

## 📈 Data Structure

### Round Object

```javascript
{
  roundNumber: 1,
  timestamp: "13:21:23",
  model: "Sonnet 4.5",
  hasThinking: true,
  user: { chars: 125, tokens: 48 },
  documents: { chars: 0, tokens: 0, count: 0 },
  thinking: { chars: 1234, tokens: 475 },
  assistant: { chars: 2456, tokens: 945 },
  toolContent: { chars: 0, tokens: 0 },
  total: { chars: 3815, tokens: 1468 }
}
```

### Global Statistics

```javascript
{
  roundCount: 5,
  totalChars: 15420,
  totalTokens: 5931,
  totalUserChars: 625,
  totalUserTokens: 240,
  totalThinkingChars: 6170,
  totalThinkingTokens: 2373,
  // ... more statistics
  modelStats: {
    "Sonnet 4.5": { /* model-specific stats */ }
  }
}
```

## 🎓 Advanced Features

### Measuring Your Own Token Ratios

For maximum accuracy, measure your actual token ratios:

1. Send conversations directly to Claude API
2. Compare API token counts with character counts
3. Calculate: `chars / tokens = your ratio`
4. Update `TOKEN_ESTIMATION` values

Example:
```javascript
TOKEN_ESTIMATION: {
  userMessage: 2.6,    // Natural language
  thinking: 2.4,       // Technical/code-heavy
  toolContent: 2.2,    // Pure code artifacts
}
```

### Debug Mode

Enable detailed logging:

```javascript
window.enableDebug()
```

This logs:
- All fetch URLs
- Request/response bodies
- SSE events
- Token calculations

Save debug log to file:
```javascript
window.saveDebugLog()
```

### Chrome Extension (Future)

The current Tampermonkey version is a prototype. A Chrome extension is planned with:
- API-based accurate token counting
- Multi-tab tracking
- Auto-tuned estimation
- Visual dashboard

## 🐛 Troubleshooting

### Model Shows "unknown"

**Issue**: Model name not detected

**Solution**: 
- Refresh the page
- Ensure the model selector is visible
- Check if Claude.ai changed their DOM structure

### Console Still Shows Spam

**Issue**: Some messages not filtered

**Solution**:
- Add patterns to `CONSOLE_SPAM_PATTERNS`
- Use Chrome DevTools filter: `-IsolatedSegment -Violation`
- First page load may have unfiltered messages (unavoidable)

### Token Counts Seem Off

**Issue**: Estimation doesn't match expected values

**Solution**:
- Adjust `CHARS_PER_TOKEN` setting
- Fine-tune `TOKEN_ESTIMATION` per content type
- Measure your actual ratios (see Advanced Features)

### Script Not Running

**Issue**: Tracker doesn't initialize

**Solution**:
- Check Tampermonkey is enabled
- Verify script is enabled in Tampermonkey
- Check browser console for errors
- Ensure you're on claude.ai domain

## 📝 Notes

- **Accuracy**: Character-based estimation is ~3-5% accurate
- **API Tokens**: Claude.ai doesn't expose token counts via UI
- **Chrome Extension**: For exact API token counts, a future Chrome extension is planned
- **Privacy**: All tracking is local, no data sent anywhere
- **Performance**: Minimal impact, memory optimized

## 🤝 Contributing

Feedback and contributions welcome! If you find bugs or have feature requests, please share.

## 📜 License

Free to use and modify for personal use.

## ⚠️ Disclaimer

This is an unofficial tool. Token estimates are approximate. For exact billing, refer to Anthropic's official API usage dashboard.

---

**Version**: 1.3  
**Last Updated**: 2025-10-13  
**Compatibility**: Claude.ai web interface

🎯 Happy tracking!