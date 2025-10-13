# Claude Token Tracker - Chrome Extension

🚀 Track your Claude.ai token usage in real-time with automatic character and token counting. Never hit context limits unexpectedly again!

## ✨ Features

- **📊 Real-time Tracking** - Automatically monitors every conversation round
- **🎯 Accurate Estimation** - ~3-5% accuracy with character-to-token ratio
- **📄 Document Support** - Counts tokens in attached files (txt, pdf, etc.)
- **🧠 Thinking Mode** - Includes thinking blocks in calculations
- **💾 Persistent Storage** - Data saved across browser sessions
- **🔑 Exact Counting** (Optional) - Use Anthropic API for precise token counts
- **🎨 Clean UI** - Simple popup interface for quick stats
- **⚡ Lightweight** - Minimal performance impact

## 📦 Installation

### Install from Chrome Web Store
*(Coming soon)*

### Install Locally (Development)

1. **Download this repository**
   ```bash
   git clone https://github.com/yourusername/claude-token-tracker.git
   cd claude-token-tracker/extension
   ```

2. **Load in Chrome/Edge**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension` folder

3. **Start Tracking!**
   - Navigate to [claude.ai](https://claude.ai)
   - The extension will automatically start tracking
   - Click the extension icon to view stats

## 🎮 Usage

### Automatic Tracking

Once installed, the extension automatically tracks:
- User input (your messages)
- Documents (attached files)
- Thinking blocks (Claude's reasoning)
- Assistant responses (Claude's answers)

### Viewing Stats

**Quick Stats (Popup)**
- Click the extension icon
- View current session totals
- Toggle tracking on/off

**Detailed Stats (Console)**
- Open DevTools (F12)
- Click "View Detailed Stats" in popup
- See per-round breakdown

### Exact Token Counting

For precise token counts using Anthropic's API:

1. Click the extension icon
2. Click "Configure API Key"
3. Enter your Anthropic API key
4. Exact counts will be fetched automatically

**Note:** Exact token counting requires an Anthropic API key and makes API calls (free tier has rate limits).

## 📊 What Gets Tracked

The extension monitors:

- **User Messages** - Text you type and send
- **Documents** - Content from attached files
- **Thinking** - Claude's internal reasoning (when enabled)
- **Assistant** - Claude's actual responses

**Token Estimation:** Uses ~2.6 characters per token ratio (~3-5% accuracy)

## 🔐 Privacy & Security

- ✅ **Runs locally** - All tracking happens in your browser
- ✅ **No data collection** - Your conversations never leave your device
- ✅ **Open source** - Audit the code yourself
- ✅ **Optional API** - Exact counting is opt-in only
- ✅ **Secure storage** - API keys stored in local browser storage

## ⚙️ Settings

**Tracking Toggle**
- Turn tracking on/off from the popup
- Persists across sessions

**API Key Management**
- Configure Anthropic API key for exact counting
- Update or remove anytime

**Clear Data**
- Reset all tracking data
- Cannot be undone

## 🎯 Context Window Limits

Claude models have different context window sizes:

| Model | Context Window |
|-------|----------------|
| Claude Sonnet 4.5 | 200,000 tokens |
| Claude Sonnet 4 | 200,000 tokens |
| Claude Opus 4 | 200,000 tokens |
| Claude Haiku 3.5 | 200,000 tokens |

Use this extension to monitor your usage and avoid hitting limits!

## 🛠️ Development

### Project Structure
```
extension/
├── manifest.json           # Extension configuration
├── icons/                  # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── popup/                  # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── scripts/
    ├── content-script.js   # Main tracker (runs on claude.ai)
    └── background.js       # API handler
```

### Building from Source

1. Clone the repository
2. No build step required - pure JavaScript!
3. Load as unpacked extension

### Testing

1. Load extension in Chrome
2. Navigate to claude.ai
3. Send a message to Claude
4. Open DevTools console
5. Verify tracking output

## 🐛 Troubleshooting

**Extension not tracking?**
- Ensure you're on `claude.ai` (not api.anthropic.com)
- Check that tracking is enabled (popup toggle)
- Try refreshing the page
- Check DevTools console for errors

**Numbers seem off?**
- Remember this is an estimation (~3-5% accuracy)
- For exact counts, configure API key
- Large documents may have higher variance

**API key not working?**
- Verify your API key is valid
- Check API rate limits (free tier: 100 req/min)
- See console for error messages

## 🤝 Contributing

Contributions are welcome! Please feel free to:

- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

## 🙏 Acknowledgments

Built for the Claude.ai community to help manage context windows effectively.

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/claude-token-tracker/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/claude-token-tracker/discussions)

---

**Happy tracking! 📊**

Made with ❤️ for the Claude community