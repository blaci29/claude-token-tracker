# 🎯 Claude Token Tracker

**Track your Claude.ai token usage in real-time. Know exactly how much you're using.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.3-green.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

> 💡 **Why?** Claude.ai doesn't show token counts. This tracker estimates your usage based on characters, helping you monitor costs and optimize prompts.

---

## 🚀 Quick Start (60 seconds)

1. **Install [Tampermonkey](https://www.tampermonkey.net/)** (browser extension)
2. **[Click here to install the script](https://github.com/blaci29/claude-token-tracker/raw/main/snippets/claude-token-tracker-tampermonkey.js)** *(or copy-paste manually)*
3. **Go to [Claude.ai](https://claude.ai)** and start chatting!
4. **Open browser console** (press `F12`) to see your token usage

That's it! Every message now shows detailed token statistics. 📊

---

## ✨ What You Get

### Real-Time Tracking
- 📤 **User Input**: Your messages + attached documents
- 🤖 **Claude Output**: Responses + thinking + code/artifacts
- 📊 **Per-Round Summary**: After every message
- 🌍 **Global Statistics**: Total usage across conversation

### Smart Features
- 🎭 **Model Detection**: Knows if you're using Sonnet, Opus, or Haiku
- 🧠 **Thinking Tracking**: Separate stats for extended thinking
- 📎 **Document Support**: Tracks uploaded PDFs, text files, etc.
- 🔧 **Configurable**: Fine-tune estimation for your use case
- 🧹 **Clean Console**: Filters out Claude.ai's debug spam

### Example Output (in console)

```
✅ ROUND #1 COMPLETED @ 13:21:23
🤖 MODEL: Sonnet 4.5
🧠 THINKING: ✓ YES

📥 USER INPUT: 125 chars (~48 tokens)
🤖 CLAUDE OUTPUT: 3,690 chars (~1,420 tokens)
📊 ROUND TOTAL: ~1,468 tokens

🌍 GLOBAL TOTAL: ~1,468 tokens (1 round)
```

---

## 💙 Support This Project

**Claude Token Tracker is 100% free and always will be.** No ads, no paywalls, no data collection.

If this saves you time or helps track your costs, consider buying me a coffee! ☕

Your support means:
- ⚡ Faster bug fixes
- 🎨 New features (Chrome extension, visual dashboard, API integration)
- 📚 Better documentation
- 💪 More motivation to maintain this

### Support Options

**One-time:**
- 💶 [€2](https://ko-fi.com/blaci29?amount=2) - Buy me a coffee
- 💶 [€5](https://ko-fi.com/blaci29?amount=5) - Buy me lunch
- 💶 [€10](https://ko-fi.com/blaci29?amount=10) - Super supporter
- 💶 [Custom amount](https://ko-fi.com/blaci29)

**Monthly:**
- 💶 [€2/month](https://github.com/sponsors/blaci29) - Coffee supporter
- 💶 [€5/month](https://github.com/sponsors/blaci29) - Silver supporter (your name in README)
- 💶 [€9/month](https://github.com/sponsors/blaci29) - Gold supporter (name + vote on roadmap)

**Other Ways:**
- ⭐ [Star this repo on GitHub](https://github.com/blaci29/claude-token-tracker)
- 🐛 [Report bugs or request features](https://github.com/blaci29/claude-token-tracker/issues)
- 🔄 [Share with colleagues who use Claude](https://twitter.com/intent/tweet?text=Check%20out%20Claude%20Token%20Tracker!)

### Hall of Thanks 🙏

*Supporters will be listed here (opt-in)*

---

## 🔒 Privacy & Security

**Your data never leaves your browser.**

- ✅ 100% local tracking
- ✅ No external servers
- ✅ No data collection
- ✅ No analytics or telemetry
- ✅ Open source - verify yourself

The script only:
1. Monitors network requests to Claude.ai (stays in your browser)
2. Counts characters in messages
3. Displays statistics in your console

**No data is sent anywhere. Period.**

---

## � How to Use

### Basic Usage (Zero Configuration)

Just chat normally with Claude. The tracker works automatically:

1. Send a message to Claude
2. Open console (`F12` or `Cmd+Option+J` on Mac)
3. See detailed token breakdown after each response

### Console Commands

Want more details? Use these commands in the console:

```javascript
// Show all conversation rounds in a table
window.showAllRounds()

// Compare statistics by model (Sonnet vs Opus vs Haiku)
window.showModelStats()

// Export all data as JSON
window.exportJSON()

// Reset and start fresh
window.resetTracker()
```

### Advanced: Debug Mode

For troubleshooting or development:

```javascript
// Enable detailed logging
window.enableDebug()

// Save debug log to file
window.saveDebugLog()

// Show debug summary
window.getDebugSummary()

// Turn debug off
window.disableDebug()
```

---

## ⚙️ Customization (Optional)

**The tracker works great out-of-the-box, but you can fine-tune it.**

### Change Token Estimation

By default, the tracker uses **2.6 characters per token** (~3-5% accurate).

Want better accuracy? Edit these settings at the top of the script:

```javascript
const SETTINGS = {
  // Central setting (default for all content types)
  CHARS_PER_TOKEN: 2.6,
  
  // Fine-tune by content type (null = use central)
  TOKEN_ESTIMATION: {
    userMessage: null,      // Your messages (2.6 is fine)
    userDocuments: null,    // PDFs, text files (try 2.8 for documents)
    thinking: null,         // Claude's thinking (try 2.4 for code-heavy)
    assistant: null,        // Claude's responses (2.6 is fine)
    toolContent: null,      // Code artifacts (try 2.2 for pure code)
  },
};
```

**Pro tip:** Different content has different "density":
- **Code** is denser (more tokens per character) → use ~2.2
- **Natural text** is average → use ~2.6
- **Documents** are sparser → use ~2.8

### Hide Console Spam

Claude.ai logs a LOT of debug messages. The tracker filters them by default.

To customize which messages to hide:

```javascript
CONSOLE_SPAM_PATTERNS: [
  'IsolatedSegment',
  'NOTIFICATION API DEBUG',
  'Violation',
  'Preferences fetched',
  // Add your own patterns here
],
```

### Other Settings

```javascript
const SETTINGS = {
  // Start with debug mode enabled?
  DEBUG_MODE_ON_START: false,
  
  // Filter Claude.ai console spam?
  HIDE_CLAUDE_CONSOLE_SPAM: true,
  
  // Clear text from memory after each round? (saves RAM)
  CLEAR_TEXTS_AFTER_SAVE: true,
  
  // Large document warning (characters)
  LARGE_DOCUMENT_THRESHOLD: 100000,
};
```

---

## 🎓 Understanding Token Estimation

### Why Not Exact?

Claude.ai **doesn't expose token counts** in the web interface. Only the API does.

So we estimate based on characters: `tokens ≈ characters / 2.6`

This is **~3-5% accurate** for most content.

### How to Get Exact Counts?

1. **Use Claude API directly** (not the web UI)
2. **Wait for the Chrome extension** (coming soon) - will integrate with API

### Improve Accuracy

Measure your own ratio:
1. Send messages via API
2. Compare API token count with character count
3. Calculate: `ratio = characters / tokens`
4. Update `CHARS_PER_TOKEN` in settings

Example:
- 260 characters, 100 tokens → ratio = 2.6 ✓
- 220 characters, 100 tokens → ratio = 2.2 (code-heavy)
- 280 characters, 100 tokens → ratio = 2.8 (document-heavy)

---

## 🔧 Troubleshooting

### "Model shows as 'unknown'"

**Problem:** Tracker can't detect which model you're using

**Fix:**
1. Refresh the page
2. Make sure the model selector (top-left in Claude UI) is visible
3. If still broken, Claude may have changed their UI → [report it](https://github.com/blaci29/claude-token-tracker/issues)

### "Console is still spammy"

**Problem:** Some Claude.ai debug messages still show

**Fix:**
1. Add more patterns to `CONSOLE_SPAM_PATTERNS` in settings
2. Use Chrome DevTools filter: type `-IsolatedSegment -Violation` in console filter
3. First page load may show some messages (unavoidable)

### "Token counts seem wrong"

**Problem:** Estimation doesn't match what you expect

**Fix:**
1. Check if you're looking at different content types (code vs text)
2. Adjust `CHARS_PER_TOKEN` (higher = fewer estimated tokens)
3. Measure your actual ratio using API (see "Understanding Token Estimation")

### "Script doesn't work at all"

**Problem:** Tracker not running

**Fix:**
1. Check Tampermonkey icon → script should be enabled
2. Refresh Claude.ai page
3. Open console (`F12`) → look for "CLAUDE TOKEN TRACKER INITIALIZED"
4. If not there, script isn't running → reinstall or check Tampermonkey settings

### Still stuck?

[Open an issue](https://github.com/blaci29/claude-token-tracker/issues) with:
- Browser version
- Tampermonkey version
- What you tried
- Console errors (if any)

---

## 🎯 Coming Soon: Chrome Extension

**The Tampermonkey script is just the beginning!**

### Planned Chrome Extension Features

🚀 **Currently in development:**

- 📊 **Visual Dashboard** - No more console, pretty UI with charts
- 🎯 **Exact Token Counts** - Integration with Claude API for 100% accuracy
- 📈 **Auto-Tuning** - Automatically calibrates estimation based on your usage
- 🔔 **Cost Alerts** - Get notified when approaching limits
- 💾 **Persistent Storage** - Track usage across sessions and days
- 📤 **Export Options** - CSV, Excel, JSON with historical data
- ⚡ **Multi-Tab Tracking** - Track all Claude tabs at once
- 🌙 **Dark/Light Themes** - Matches your Claude.ai theme

### Why Not Now?

Chrome extensions require:
- Manifest V3 compliance
- Chrome Web Store approval
- More extensive testing
- Visual design work

The Tampermonkey version is **fully functional NOW** and will receive updates until the extension is ready.

### Stay Updated

- ⭐ [Star the repo](https://github.com/blaci29/claude-token-tracker) to get notified
- 📧 [Follow development](https://github.com/blaci29/claude-token-tracker/issues)
- 💙 [Support development](https://ko-fi.com/blaci29) to speed it up

---

## 🤝 Contributing

**Contributions are welcome!** This is a community project.

### How to Contribute

- 🐛 **Found a bug?** [Report it](https://github.com/blaci29/claude-token-tracker/issues/new?template=bug_report.md)
- 💡 **Have an idea?** [Request a feature](https://github.com/blaci29/claude-token-tracker/issues/new?template=feature_request.md)
- 🔧 **Want to code?** Fork, edit, and submit a PR
- 📚 **Improve docs?** Fix typos, add examples, translate

### Development

For developers:

1. See [developer-doc.md](developer-doc.md) for internals
2. Enable debug mode: `window.enableDebug()`
3. Make changes to the script
4. Test on Claude.ai
5. Submit PR with clear description

### Guidelines

- Keep it simple for users
- Test before submitting
- Follow existing code style
- Update docs if needed

---

## 📜 License

**MIT License** - Free to use, modify, and distribute.

See [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

**This is an unofficial, community-made tool.**

- ✅ Free to use
- ✅ Open source
- ✅ No affiliation with Anthropic
- ⚠️ Token estimates are approximate (~3-5% accurate)
- ⚠️ For exact billing, check [Anthropic's official API dashboard](https://console.anthropic.com/)

**Use at your own discretion.**

---

## 📞 Support & Contact

### Need Help?

1. Check [Troubleshooting](#-troubleshooting) section
2. Search [existing issues](https://github.com/blaci29/claude-token-tracker/issues)
3. [Open a new issue](https://github.com/blaci29/claude-token-tracker/issues/new)

### Community

- 💬 [GitHub Discussions](https://github.com/blaci29/claude-token-tracker/discussions)
- ⭐ [Star the repo](https://github.com/blaci29/claude-token-tracker)
- 🐦 [Share on Twitter](https://twitter.com/intent/tweet?text=Check%20out%20Claude%20Token%20Tracker!)

---

## 📊 Project Stats

**Version:** 1.3  
**Last Updated:** October 13, 2025  
**Compatibility:** Claude.ai web interface  
**Browsers:** Chrome, Firefox, Edge, Safari (via Tampermonkey)  
**Status:** ✅ Active development

---

## 🙏 Thank You

Thank you for using Claude Token Tracker!

If this tool helps you:
- ⭐ Star the repo
- 💙 [Support development](https://ko-fi.com/blaci29)
- 🔄 Share with others
- 🐛 Report bugs
- 💡 Suggest features

**Together we can make Claude.ai more transparent!** 🚀

---

*Made with ❤️ by developers, for developers (and anyone who uses Claude)*

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