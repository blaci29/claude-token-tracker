# Installation Guide

## Method 1: Chrome Web Store (Recommended)
*(Coming soon)*

## Method 2: Install Locally (Developer Mode)

### Step 1: Download the Extension

**Option A: Download from GitHub**
1. Go to the [releases page](https://github.com/yourusername/claude-token-tracker/releases)
2. Download the latest `extension.zip`
3. Extract the zip file

**Option B: Clone the repository**
```bash
git clone https://github.com/yourusername/claude-token-tracker.git
cd claude-token-tracker/extension
```

### Step 2: Load in Chrome/Edge

1. **Open Extensions Page**
   - Chrome: Navigate to `chrome://extensions/`
   - Edge: Navigate to `edge://extensions/`

2. **Enable Developer Mode**
   - Toggle "Developer mode" switch (top-right corner)

3. **Load the Extension**
   - Click "Load unpacked" button
   - Select the `extension` folder (containing manifest.json)

4. **Confirm Installation**
   - You should see "Claude Token Tracker" in your extensions list
   - Extension icon appears in toolbar

### Step 3: Start Using

1. **Navigate to Claude.ai**
   - Open [claude.ai](https://claude.ai) in your browser
   
2. **Verify It's Working**
   - Open DevTools (F12)
   - Check console for: `✅ Claude Token Tracker initialized and ready!`
   
3. **Start Chatting**
   - Send a message to Claude
   - Watch token counts in console
   - Click extension icon for summary stats

## Optional: Configure Exact Token Counting

For precise token counts using Anthropic's API:

1. **Get an API Key**
   - Sign up at [console.anthropic.com](https://console.anthropic.com/)
   - Generate an API key

2. **Configure in Extension**
   - Click the extension icon
   - Click "Configure API Key"
   - Paste your API key
   - Click OK

3. **Verify**
   - Exact token counts will now be fetched automatically
   - Check console for confirmation messages

## Troubleshooting

### "Cannot read properties of undefined"
- Make sure you extracted all files properly
- Verify manifest.json is in the root of the selected folder

### Extension not appearing in toolbar
- Click the puzzle piece icon (Extensions)
- Pin Claude Token Tracker

### Not tracking on Claude.ai
- Refresh the claude.ai page
- Check DevTools console for errors
- Verify extension is enabled in extensions page

### API key not working
- Verify your API key is valid
- Check you're not exceeding rate limits
- See console for specific error messages

## Updating

### Auto-update (from Chrome Web Store)
Extensions update automatically when new versions are published.

### Manual update (Developer Mode)
1. Download the new version
2. Delete old extension folder
3. Repeat installation steps

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Claude Token Tracker"
3. Click "Remove"
4. Confirm deletion

**Note:** All tracking data will be deleted.

## Need Help?

- Check [README.md](README.md) for full documentation
- Report issues on [GitHub](https://github.com/yourusername/claude-token-tracker/issues)
- Join discussions on [GitHub Discussions](https://github.com/yourusername/claude-token-tracker/discussions)

---

Happy tracking! 📊