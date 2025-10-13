# 📊 Claude Token Tracker

A professional Chrome extension for real-time token usage tracking on Claude.ai with chat-based analytics and usage limits.

## ✨ Features

### 🎯 Core Tracking
- **Chat-Based Organization**: Automatic detection and tracking of individual conversations
- **Real-Time Monitoring**: Instant token counting as you use Claude
- **Comprehensive Breakdown**: Separate tracking for:
  - User messages
  - Uploaded documents
  - Claude's thinking process
  - Assistant responses
  - Tool/artifact content

### ⏱️ Usage Limits
- **4-Hour Timer**: Track usage within 4-hour windows with customizable end times
- **Weekly Tracking**: Automatic weekly resets with configurable start day/time
- **Smart Warnings**: Notifications at 90% of estimated limits
- **Manual Reset**: Quick reset buttons for both timers

### 📈 Analytics
- **Global Statistics**: Overview of all-time, weekly, and 4-hour usage
- **Model Breakdown**: See which Claude models you use most
- **Per-Chat Details**: Dive deep into individual conversations
- **Round History**: Complete timeline of every interaction

### 🎨 User Interface
- **Popup**: Quick access to current stats and controls
- **Floating Overlay**: Optional on-page widget showing live chat stats
- **Stats Page**: Comprehensive analytics dashboard
- **Settings Page**: Full customization of tracking behavior

### 🔧 Customization
- **Token Estimation**: Adjust chars/token ratios globally or per content type
- **Console Filter**: Aggressive filtering of Claude.ai's noisy console output
- **Export/Import**: Full data portability in JSON format
- **Privacy First**: All data stored locally, no external tracking

## 🚀 Installation

### From Chrome Web Store
*Coming soon...*

### Manual Installation (Development)

1. **Download the extension:**
   ```bash
   git clone https://github.com/yourname/claude-token-tracker.git
   cd claude-token-tracker
   ```

2. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the extension folder

3. **Verify installation:**
   - You should see the Claude Token Tracker icon in your toolbar
   - Visit claude.ai and start a conversation
   - Click the extension icon to see tracking data

## 📖 Usage

### Basic Usage

1. **Start Tracking:**
   - The extension tracks automatically when enabled
   - Toggle tracking on/off via the popup

2. **View Stats:**
   - Click extension icon for quick overview
   - Click "📊 Statistics" for detailed analytics
   - Use "⚙️ Settings" to customize behavior

3. **Usage Timers:**
   - Start 4-hour timer to track usage within a window
   - Weekly timer starts automatically on configured day
   - Both timers show warnings at 90% of estimated limits

### Floating Overlay

Enable the floating overlay to see real-time stats while using Claude:

1. Click extension icon
2. Toggle "👁️ Round Viewer" on
3. Widget appears on Claude.ai
4. Drag to reposition
5. Click minimize button to collapse

### Customizing Token Estimation

The extension estimates tokens using character counts. Fine-tune this:

1. Open Settings page
2. Adjust "Central Ratio" (default: 2.6 chars/token)
3. Override specific content types if needed:
   - Code-heavy content: 2.0-2.4
   - Regular text: ~2.6
   - Documents: 2.8-3.0

### Export & Import

**Export your data:**
- Settings page → "📥 Export Data (JSON)"
- OR Stats page → "📥 Export" (current view or all data)

**Import data:**
- Settings page → "📤 Import Data"
- Select your JSON file

## 🏗️ Architecture

### Components

```
claude-token-tracker/
├── manifest.json           # Extension configuration
├── src/
│   ├── background/         # Service Worker (data processing)
│   │   ├── worker.js
│   │   ├── storage.js
│   │   ├── timer.js
│   │   └── aggregator.js
│   ├── content/            # Content Scripts (data collection)
│   │   ├── tracker.js
│   │   ├── interceptor.js
│   │   ├── dom-observer.js
│   │   └── overlay.js
│   ├── popup/              # Extension popup
│   ├── options/            # Settings page
│   ├── stats/              # Statistics page
│   ├── shared/             # Shared utilities
│   └── assets/             # Icons and styles
└── README.md
```

### Data Flow

1. **Content Script** intercepts requests and streams
2. **Service Worker** receives data, calculates tokens, stores
3. **UI Components** query Service Worker for display

### Storage Structure

```javascript
{
  chats: {
    "chatId": {
      id, url, title, type,
      rounds: [ /* array of round objects */ ],
      stats: { /* aggregated statistics */ }
    }
  },
  timers: {
    fourHour: { /* 4-hour timer state */ },
    weekly: { /* weekly timer state */ }
  },
  settings: { /* user configuration */ }
}
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Development Setup

```bash
# Clone repo
git clone https://github.com/yourname/claude-token-tracker.git

# Load in Chrome as unpacked extension
# Make changes and reload extension to test
```

### Code Style

- Use meaningful variable names
- Comment complex logic
- Follow existing patterns
- Test on Claude.ai before committing

## 📝 License

MIT License - see LICENSE file for details

## 🐛 Issues & Support

Found a bug? Have a suggestion?

- [Report an issue](https://github.com/yourname/claude-token-tracker/issues)
- [GitHub Discussions](https://github.com/yourname/claude-token-tracker/discussions)

## ☕ Support the Project

If you find this extension helpful, consider supporting its development:

- [Ko-fi](https://ko-fi.com/yourname)
- [Buy Me a Coffee](https://buymeacoffee.com/yourname)
- ⭐ Star the repo on GitHub

## 📋 Changelog

### v1.0.0 (Current)
- Initial release
- Chat-based tracking
- 4-hour and weekly timers
- Customizable token estimation
- Export/import functionality
- Floating overlay widget
- Comprehensive statistics

### Future Plans
- API-based exact token counting
- Cloud backup (optional)
- Advanced analytics & charts
- Project-specific aggregations
- CSV export
- Dark mode

## 🙏 Acknowledgments

- Claude.ai team at Anthropic for building an amazing product
- Open source community for inspiration and tools

## 📞 Contact

- GitHub: [@yourname](https://github.com/yourname)
- Email: your.email@example.com

---

Made with ❤️ for the Claude community