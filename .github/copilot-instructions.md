# Claude Token Tracker - AI Agent Instructions

Profi webfejlesztő frontend fejlesztő js és browser extension fejlesztő vagy. A feladatod, hogy a következő fájlokat karbantartsd és fejleszd.
Velem mindig magyarul beszélj, de a kódban a kommentek leírások readme fájlok stb. mindig angolul legyenek.

## Project Overview
A Chrome Manifest V3 extension that tracks Claude.ai token usage in real-time by intercepting API requests and SSE streams. Uses character-based token estimation and provides chat-based analytics with automatic time-window tracking.

## Architecture & Data Flow

### 1. Multi-Layer Interception (Critical Pattern)
```
Page Context (page-injected.js)
  ↓ intercepts fetch() + console.filter
  ↓ posts messages to...
Content Script (interceptor.js)
  ↓ aggregates round data
  ↓ sends to...
Service Worker (worker.js)
  ↓ routes to modules...
Storage/Timer/Aggregator modules
```

**Why this matters**: Content scripts CAN'T access page fetch. Must inject script into page context, then relay via `window.postMessage` → `chrome.runtime.sendMessage`.

### 2. SSE Stream Processing Pattern
Claude streams responses via Server-Sent Events. Track these event types:
- `content_block_delta` with `delta.type`:
  - `text_delta` → Assistant response (`delta.text`)
  - `thinking_delta` → Claude's reasoning (`delta.thinking`)
  - `input_json_delta` → Tool/artifact content (`delta.partial_json`)
- `message_delta` with `delta.stop_reason` → Triggers round completion

**Example from `interceptor.js`**:
```javascript
if (data.type === 'content_block_delta') {
  if (delta.type === 'text_delta' && delta.text) {
    round.assistant.text += delta.text;
    round.assistant.chars = round.assistant.text.length;
  }
}
```

### 3. Storage Structure (DO NOT BREAK)
```javascript
// chrome.storage.local
{
  chats: {
    "[chatId]": {
      id, url, title, type,
      rounds: [],  // Array indexed by roundNumber-1
      stats: { totalTokens, totalChars, byType, byModel }
    }
  },
  timers: {
    fourHour: { startTime, endTime, roundIds: ["chatId:roundNum"] },
    weekly: { ... }
  },
  settings: { tokenEstimation, overlayEnabled, ... }
}
```

**Key insight**: Timers store `roundIds` not token counts. Tokens calculated dynamically by looking up rounds. This allows recalculation with updated ratios.

## Critical Implementation Rules

### Extension Context Invalidation
**ALL `chrome.runtime.sendMessage` calls in content scripts MUST:**
```javascript
try {
  if (!chrome?.runtime?.id) return; // Check before access
} catch (e) {
  return; // chrome.runtime access itself can throw
}

try {
  await chrome.runtime.sendMessage({ ... });
} catch (error) {
  // Silently fail - extension was reloaded
}
```
**Why**: Extension reload invalidates context. Without guards, console gets spammed with errors. See `dom-observer.js:138` for example.

### Title Detection Priority
1. Try DOM selector: `.min-w-0.flex-1 .truncate.font-base-bold`
2. Fallback to `<title>` tag: Split by `|`, take first part
3. NEVER default to "Untitled Chat" if title exists
**Reason**: Title may not exist when round starts, handle async updates gracefully.

### Message Handler Pattern
```javascript
// service worker (worker.js)
async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_DATA': return await getData(); // Return data directly
  }
}

// Wrapper auto-adds { success, data } envelope
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => sendResponse({ success: true, data: response }))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // Keep channel open
});
```
**Don't double-wrap**: Handler returns data, wrapper adds envelope.

### Timer Window Management
- Auto-creates new window when expired (4hr/7day duration)
- Stores round IDs, calculates tokens on-demand from storage
- "Vésztartalék" controls: Manual end time override for emergency cases
- See `timer.js:_checkAndStartWindow()` for auto-start logic

### Console Spam Filter
Implemented in TWO places (both page and content context):
- `page-injected.js`: Filters at page level (catches Claude.ai's logs)
- `tracker.js`: Filters in content script (catches extension logs)
Pattern list in `CONSTANTS.SPAM_PATTERNS`

## Development Workflows

### Testing Changes
1. Make changes → Save files
2. Go to `chrome://extensions/` → Click "Reload" on extension
3. Hard refresh Claude.ai page (Ctrl+Shift+R)
4. Check console for initialization logs
5. Test affected feature
6. Verify no regressions in other features

### Debugging Round Tracking
```javascript
// In browser console on claude.ai
window.claudeTokenTracker.getCurrentChat()  // See current chat data
window.claudeTokenTracker.getTimers()       // Check timer status
window.claudeTokenTracker.interceptor.currentRound // Live round data
```

### Cache Busting for Stats Page
When modifying `stats.js`, increment version in `stats.html`:
```html
<script src="stats.js?v=2"></script>  <!-- Increment version -->
```
**Why**: Extension pages cache aggressively, old JS can load.

## File Organization

### Content Scripts (run on claude.ai)
- `page-injected.js`: Injected into page context, intercepts fetch
- `interceptor.js`: Content script, receives data from page
- `tracker.js`: Entry point, initializes all components
- `overlay.js`: Floating widget UI
- `dom-observer.js`: Watches URL/title changes
- `*-inline.js`: Shared code without imports (for injection)

### Background (service worker)
- `worker.js`: Message router, central coordinator
- `storage.js`: Chrome storage wrapper
- `timer.js`: Automatic time window management
- `aggregator.js`: Statistics calculations

### Shared Modules
- `constants.module.js`: ES6 exports for service worker
- `constants.js`: Global var for content scripts
- Token estimation uses configurable char/token ratios

## Common Pitfalls

1. **Array Indexing**: `chat.rounds[roundNumber - 1]` (rounds are 1-indexed in UI, 0-indexed in array)
2. **Module Context**: Service worker uses ES6 imports, content scripts use globals
3. **Async Title**: Title may not exist when round saves, update retroactively
4. **Context Invalidation**: ALWAYS guard chrome.runtime calls in content scripts
5. **Double Wrapping**: Message handlers return data, wrapper adds `{ success, data }`
6. **Cache Issues**: Version query params for HTML-loaded JS files

## Key Files to Read First
1. `manifest.json`: Extension structure and permissions
2. `worker.js`: Message routing logic
3. `interceptor.js`: Data collection flow
4. `page-injected.js`: Fetch interception
5. `.github/copilot-instructions.md`: This file (keep updated!)

## Testing Checklist
- [ ] Round completes and saves to storage
- [ ] Title extracted correctly (not "Untitled Chat")
- [ ] Tokens calculated for all sections
- [ ] Timer windows auto-create when expired
- [ ] No console errors on extension reload
- [ ] Overlay updates on chat navigation
- [ ] Stats page loads without infinite spinner
- [ ] Settings persist across sessions
