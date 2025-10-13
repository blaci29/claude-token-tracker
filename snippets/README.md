# Claude Token Tracker

Real-time token usage tracking for Claude.ai conversations. Monitor your context window usage with automatic character and token counting.

## Features

- ✅ **Automatic tracking** - Monitors every conversation round automatically
- 📊 **Detailed statistics** - Tracks user input, documents, thinking, and assistant responses separately
- 📄 **Document support** - Counts tokens in attached files (txt, pdf, etc.)
- 🧠 **Thinking mode support** - Includes thinking blocks in token calculations
- 💾 **Memory optimized** - Stores only statistics, not full conversation text
- 📈 **Global statistics** - Cumulative tracking across all conversation rounds
- 🔄 **Export functionality** - Export data as JSON or blob URL

## Installation

### Method 1: Browser Console Snippet (Recommended)

1. Open Claude.ai in your browser
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to the **Sources** tab → **Snippets** (left sidebar)
4. Click **+ New snippet**
5. Name it "Claude Token Tracker"
6. Paste the contents of `claude-token-tracker.js`
7. Right-click the snippet → **Run**

The tracker will now monitor all your conversations in that tab!

### Method 2: Browser Console

1. Open Claude.ai
2. Open Developer Tools Console (F12)
3. Copy and paste the entire `claude-token-tracker.js` script
4. Press Enter

Note: This method requires re-running the script each time you refresh the page.

## Usage

Once the tracker is running, it will automatically monitor your conversations. After each response from Claude, you'll see statistics in the console:

```
═══════════════════════════════════════════════════════
✅ ROUND #1 COMPLETED @ 14:32:15
═══════════════════════════════════════════════════════
📤 USER:      156 chars (~60 tokens)
📄 DOCUMENTS (1): 5,267 chars (~2,026 tokens)
🧠 THINKING:  842 chars (~324 tokens)
💬 ASSISTANT: 1,234 chars (~475 tokens)

📊 ROUND TOTAL: 7,499 chars (~2,885 tokens)
───────────────────────────────────────────────────────
🌍 GLOBAL TOTALS:
   Total rounds: 1
   User:      156 chars (~60 tokens)
   Documents: 5,267 chars (~2,026 tokens)
   Thinking:  842 chars (~324 tokens)
   Assistant: 1,234 chars (~475 tokens)
   ─────────────────────────────────────
   TOTAL:     7,499 chars (~2,885 tokens)
═══════════════════════════════════════════════════════
```

## Available Commands

Open the browser console and use these commands:

### `window.showAllRounds()`
Display all tracked rounds in a table format:
```javascript
window.showAllRounds()
```

### `window.exportJSON()`
Export all tracking data as JSON (automatically copies to clipboard):
```javascript
window.exportJSON()
```

### `window.getTrackerURL()`
Generate a blob URL to view the full JSON data:
```javascript
const url = window.getTrackerURL()
// Open the URL in a new tab to view the data
```

### `window.resetTracker()`
Reset all tracking data (with confirmation prompt):
```javascript
window.resetTracker()
```

### `window.claudeTracker`
Access the raw tracker object:
```javascript
// View current statistics
console.log(window.claudeTracker.global)

// View last round
console.log(window.claudeTracker.last)

// View all rounds
console.log(window.claudeTracker.rounds)
```

## Token Estimation

The tracker uses a character-to-token ratio of **2.6 characters per token**, which provides approximately **3-5% accuracy** compared to Claude's actual token counting.

### Why estimation?

- Real-time tracking without API calls
- No API key required
- Zero latency
- Works offline

### Accuracy considerations

Token estimation is affected by:
- Language (non-English text may have different ratios)
- Special characters and Unicode
- Code vs natural language
- Formatting and whitespace

For production use cases requiring exact token counts, consider integrating with Anthropic's Token Counting API.

## Data Structure

The tracker stores data in the following structure:

```javascript
{
  global: {
    totalChars: 15420,
    totalTokens: 5931,
    totalUserChars: 1250,
    totalUserTokens: 481,
    totalDocChars: 8500,
    totalDocTokens: 3269,
    totalThinkingChars: 2100,
    totalThinkingTokens: 808,
    totalAssistantChars: 3570,
    totalAssistantTokens: 1373,
    roundCount: 5
  },
  rounds: [
    {
      roundNumber: 1,
      timestamp: "14:32:15",
      user: { chars: 156, tokens: 60 },
      documents: { chars: 5267, tokens: 2026, count: 1 },
      thinking: { chars: 842, tokens: 324 },
      assistant: { chars: 1234, tokens: 475 },
      total: { chars: 7499, tokens: 2885 }
    }
    // ... more rounds
  ],
  last: { /* last round data */ }
}
```

## Context Window Limits

Claude models have different context window sizes:

| Model | Context Window |
|-------|----------------|
| Claude Sonnet 4.5 | 200,000 tokens |
| Claude Sonnet 4 | 200,000 tokens |
| Claude Opus 4 | 200,000 tokens |
| Claude Haiku 3.5 | 200,000 tokens |

Use this tracker to stay aware of your usage and avoid hitting limits!

## How It Works

The tracker intercepts network requests to Claude.ai's completion endpoint and monitors:

1. **User Input** - Text you type and send
2. **Documents** - Files you attach (extracted content)
3. **Thinking** - Claude's internal reasoning (when thinking mode is enabled)
4. **Assistant Response** - Claude's actual response text

All data is captured in real-time from the Server-Sent Events (SSE) stream that Claude uses to stream responses.

## Privacy & Security

- ✅ **Everything runs locally** in your browser
- ✅ **No data is sent anywhere**
- ✅ **No external API calls** (unless you add token counting integration)
- ✅ **Only statistics are stored**, not full conversation text
- ✅ **Open source** - audit the code yourself

## Limitations

- Estimation only (~3-5% accuracy)
- Does not account for system prompts or tool definitions
- Requires manual installation per browser tab
- Resets on page refresh (unless using Snippets)
- Only works on Claude.ai web interface

## Troubleshooting

### Tracker not working?

1. Make sure you're on `claude.ai` (not api.anthropic.com)
2. Check that the script ran without errors in the console
3. Try refreshing the page and re-running the script
4. Ensure you have a conversation open

### Not seeing round summaries?

The tracker only outputs statistics after Claude completes a response. Send a message and wait for the response to complete.

### Numbers seem off?

Remember, this is an estimation. For exact counts, consider using Anthropic's Token Counting API with your API key.

## Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## License

MIT License - feel free to use, modify, and distribute as needed.

## Acknowledgments

Built for the Claude.ai community to help manage context windows effectively.

---

**Happy tracking! 📊**
