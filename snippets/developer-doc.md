# Claude Token Tracker - Developer Documentation

This document explains how the tracker works internally and how to maintain/extend it if Claude.ai's architecture changes.

## Table of Contents
- [Configuration & Settings](#configuration--settings)
- [How Claude.ai Works](#how-claudeai-works)
- [How the Tracker Works](#how-the-tracker-works)
- [Debugging Guide](#debugging-guide)
- [Model Statistics Tracking](#model-statistics-tracking)
- [Extending the Tracker](#extending-the-tracker)
- [Troubleshooting Changes](#troubleshooting-changes)

---

## Configuration & Settings

The tracker now includes a comprehensive settings system at the top of the script. All user-configurable options are centralized in the `SETTINGS` object.

### Available Settings

#### Debug Mode
```javascript
DEBUG_MODE_ON_START: false  // Enable debug mode on startup?
```

#### Console Spam Filtering
```javascript
HIDE_CLAUDE_CONSOLE_SPAM: true  // Filter out Claude.ai's console spam?

CONSOLE_SPAM_PATTERNS: [
  'IsolatedSegment',
  'NOTIFICATION API DEBUG',
  'Violation',
  'Preferences fetched',
  'Intercom',
  // ... and more
]
```
This feature aggressively filters console output from Claude.ai's own logging, keeping your console clean and focused on tracker output.

#### Token Estimation

**Central Setting:**
```javascript
CHARS_PER_TOKEN: 2.6  // Default chars per token for all content types
```

**Fine-tuned Settings:**
```javascript
TOKEN_ESTIMATION: {
  userMessage: null,      // User's text input (null = use central 2.6)
  userDocuments: null,    // Attached files/documents
  thinking: null,         // Claude's thinking process
  assistant: null,        // Claude's visible response
  toolContent: null,      // Artifacts, code files
}
```

**Fine-tuning Guide:**
- **Code (dense):** 2.0-2.4 chars/token (many symbols, brackets, operators)
  - Recommended: `thinking: 2.4`, `toolContent: 2.2`
- **Natural text:** 2.6 chars/token (regular conversation)
  - Recommended: `userMessage: 2.6`, `assistant: 2.6`
- **Documents (sparse):** 2.8-3.0 chars/token (PDFs, formatted text)
  - Recommended: `userDocuments: 2.8`

#### Other Settings
```javascript
LARGE_DOCUMENT_THRESHOLD: 100000      // Warning threshold in characters
CLEAR_TEXTS_AFTER_SAVE: true          // Clear text content after saving round?
SAVE_DELAY_MS: 500                    // Delay before saving round
IMPORTANT_ENDPOINTS: ['/completion']  // Endpoints for detailed debug logging
```

---

## How Claude.ai Works

### Architecture Overview

Claude.ai uses a **Server-Sent Events (SSE) stream** for real-time communication:

```
User → Claude.ai → POST /completion → SSE Stream → Browser
```

### Request Structure

When you send a message, the browser makes a POST request to `/completion` with this structure:

```javascript
{
  "prompt": "Your message text",
  "attachments": [
    {
      "extracted_content": "File content here...",
      "content": "Alternative content field..."
    }
  ],
  "files": [
    {
      "content": "File data...",
      "extracted_content": "Extracted text..."
    }
  ]
}
```

**What we track from requests:**
- `prompt` → User message text
- `attachments[].extracted_content` → Document content
- `files[].content` → File content

### Response Structure (SSE Stream)

Claude's response comes as a **stream of events**. Each event has this format:

```
data: {"type": "event_type", ...}
```

### Event Types (Current as of October 2025)

#### 1. `message_start`
Indicates a new message is starting.
```javascript
{
  "type": "message_start",
  "message": { ... }
}
```

#### 2. `content_block_start`
A new content block is starting. Types we care about:
- `thinking` - Claude's internal reasoning
- `text` - Regular text response
- `tool_use` - Tool/function call (includes file creation)
- `tool_result` - Result from tool execution

```javascript
{
  "type": "content_block_start",
  "index": 0,
  "content_block": {
    "type": "thinking" | "text" | "tool_use" | "tool_result"
  }
}
```

#### 3. `content_block_delta`
Incremental content updates. Delta types we track:

**a) `thinking_delta`** - Thinking text
```javascript
{
  "type": "content_block_delta",
  "index": 0,
  "delta": {
    "type": "thinking_delta",
    "thinking": "Text chunk here..."
  }
}
```

**b) `text_delta`** - Assistant response text
```javascript
{
  "type": "content_block_delta",
  "index": 1,
  "delta": {
    "type": "text_delta",
    "text": "Response text chunk..."
  }
}
```

**c) `input_json_delta`** - Tool input (file content, artifacts)
```javascript
{
  "type": "content_block_delta",
  "index": 2,
  "delta": {
    "type": "input_json_delta",
    "partial_json": "File content chunk..."
  }
}
```

**d) `tool_use_block_update_delta`** - Tool metadata updates
```javascript
{
  "type": "content_block_delta",
  "index": 2,
  "delta": {
    "type": "tool_use_block_update_delta",
    "message": "Creating file...",
    "display_content": { ... }
  }
}
```

**e) `thinking_summary_delta`** - Thinking summary (we ignore this)

#### 4. `content_block_stop`
Content block completed.

#### 5. `message_delta`
Message-level updates. We watch for:
```javascript
{
  "type": "message_delta",
  "delta": {
    "stop_reason": "end_turn" | "max_tokens" | ...
  }
}
```
→ This signals the response is complete!

#### 6. `ping`
Keep-alive ping (ignore)

---

## How the Tracker Works

### Core Components

```
┌─────────────────────────────────────────┐
│ 1. Fetch Interceptor                    │
│    - Intercepts /completion requests    │
│    - Captures user input + documents    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ 2. SSE Stream Processor                 │
│    - Reads event stream                 │
│    - Routes events to capture functions │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ 3. Content Capture                      │
│    - thinking_delta → Thinking text     │
│    - text_delta → Assistant text        │
│    - input_json_delta → Tool content    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ 4. Round Completion                     │
│    - Triggered by message_delta         │
│    - Calculates tokens                  │
│    - Prints summary                     │
│    - Clears memory                      │
└─────────────────────────────────────────┘
```

### Key Code Sections

#### 1. Console Spam Filtering
```javascript
// Aggressive console filtering to hide Claude.ai's own logs
if (SETTINGS.HIDE_CLAUDE_CONSOLE_SPAM) {
  const _originalConsoleLog = console.log;
  // ... override all console methods with filtering
  function shouldFilter(args) {
    // Check against spam patterns
    return SETTINGS.CONSOLE_SPAM_PATTERNS.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}
```

#### 2. Fetch Interception
```javascript
const _originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
  if (url.includes('/completion')) {
    // Extract user message and documents
    const body = JSON.parse(options.body);
    const promptText = body.prompt || '';
    
    // DOM-based model detection
    let modelName = detectModelFromDOM();
    
    // ... capture documents from attachments/files
  }
  return _originalFetch(url, options);
};
```

#### 3. DOM-Based Model Detection
```javascript
function detectModelFromDOM() {
  // PRIORITY 1: Model selector dropdown (most reliable)
  const modelButton = document.querySelector(
    '[data-testid="model-selector-dropdown"] .whitespace-nowrap'
  );
  
  // FALLBACK: Try other selectors
  const fallbackSelectors = [
    '[class*="model-name"]',
    '.font-claude-response .whitespace-nowrap'
  ];
  // ... check for text containing 'Sonnet', 'Opus', 'Haiku'
}
```
**Note:** The API does NOT provide model information, so we rely entirely on DOM scraping.

#### 4. SSE Stream Processing
```javascript
async function processSSEStream(stream) {
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    // Parse SSE lines
    // Route to appropriate handlers
  }
}
```

#### 5. Content Capture
```javascript
// Thinking
if (data.delta?.type === 'thinking_delta') {
  currentRound.thinking.text += data.delta.thinking;
}

// Assistant text
if (data.delta?.type === 'text_delta') {
  currentRound.assistant.text += data.delta.text;
}

// Tool content (files/artifacts)
if (data.delta?.type === 'input_json_delta') {
  currentRound.toolContent.text += data.delta.partial_json;
}
```

#### 6. Token Estimation (Configurable)
```javascript
function getTokenEstimationRate(type) {
  // Check for specific override for this content type
  if (SETTINGS.TOKEN_ESTIMATION[type] !== null) {
    return SETTINGS.TOKEN_ESTIMATION[type];
  }
  // Fall back to central setting
  return SETTINGS.CHARS_PER_TOKEN;
}

function estimateTokens(chars, type = 'userMessage') {
  const rate = getTokenEstimationRate(type);
  return Math.ceil(chars / rate);
}
```
**Default ratio: 2.6 characters per token** (~3-5% accuracy)
**Customizable per content type** for improved accuracy

#### 7. Model Statistics Tracking
```javascript
function initModelStats(modelName) {
  // Initialize per-model statistics tracking
  if (!window.claudeTracker.global.modelStats[modelName]) {
    window.claudeTracker.global.modelStats[modelName] = {
      rounds: 0,
      roundsWithThinking: 0,
      roundsWithoutThinking: 0,
      // ... token stats per content type
    };
  }
}
```
**New feature:** Track statistics separately for each Claude model (Sonnet, Opus, Haiku)

---

## Debugging Guide

### Enable Enhanced Debug Mode

```javascript
window.enableDebug()
```

This will activate **enhanced debug mode** with:
- **Every SSE event** logged with full details
- **Fetch URL logging** for all requests
- **Important endpoint inspection** (automatic response body analysis)
- **Deep object search** for token/usage/model fields
- **Debug log accumulation** for later export

Console output example:
```
🐛 ═══════════════════════════════════════════════════
🐛 📡 IMPORTANT ENDPOINT: /completion
🐛 📤 METHOD: POST
🐛 📦 RESPONSE BODY KEYS: ['type', 'message', 'usage']
🐛 🔍 INTERESTING FIELDS FOUND:
   - usage.input_tokens: 1234
   - usage.output_tokens: 5678
   - model: "claude-sonnet-4-5"
🐛 ═══════════════════════════════════════════════════

🐛 SSE Event: content_block_delta
   Full data: {...}
   📦 Delta type: text_delta
   📦 Text length: 42
```

### New Debug Commands

```javascript
window.saveDebugLog()       // Download debug log as .txt file
window.getDebugSummary()    // Display summary in console
window.disableDebug()       // Turn off debug mode
```

#### Debug Log Export
Saves complete debug session to timestamped file:
```
claude-tracker-debug-2025-10-13T14-30-00.txt
```

Contains:
- All fetch requests
- Response bodies from important endpoints
- SSE events with full data
- Automatically discovered fields (token, usage, model, etc.)

#### Debug Summary
Shows statistics about current debug session:
- Entry counts by type (FETCH_REQUEST, SSE_EVENT, etc.)
- All interesting fields discovered across all requests
- Field occurrence counts

### Important Endpoints

The tracker now filters debug output by endpoint importance:
```javascript
IMPORTANT_ENDPOINTS: ['/completion', '/chat', '/model', '/chat_preferences']
```

Only these endpoints get **deep inspection** (automatic field discovery, response body analysis). Other endpoints are just logged with URL.

### Deep Object Search

Automatic discovery of relevant fields in API responses:
```javascript
function deepSearchObject(obj, searchKeys = [
  'token', 'usage', 'model', 'size', 'count', 'chars'
])
```

Recursively searches through response objects to find any fields matching these keywords. Useful for discovering new API fields without manually inspecting JSON.

---

## Model Statistics Tracking

The tracker now maintains **separate statistics for each Claude model** used in the conversation.

### Model Detection

Model names are detected from the DOM (API doesn't provide this):
```javascript
// Primary: Model selector dropdown
[data-testid="model-selector-dropdown"] .whitespace-nowrap

// Fallbacks:
[class*="model-name"]
.font-claude-response .whitespace-nowrap
```

Typical model names detected:
- "Claude 3.5 Sonnet"
- "Claude Sonnet 4"
- "Claude Opus"
- "Claude Haiku"

### Statistics Tracked Per Model

For each model, the tracker records:
- Total rounds with this model
- Rounds with thinking enabled
- Rounds without thinking
- Total characters and tokens (all content types)
- Breakdown by content type (user, documents, thinking, assistant, tools)

### View Model Statistics

```javascript
window.showModelStats()
```

Outputs detailed statistics for each model:
```
🤖 MODEL STATISTICS
═══════════════════════════════════════════════════════

📊 Claude 3.5 Sonnet
─────────────────────────────────────────────────────
   Total rounds: 15
   Rounds with thinking: 8
   Rounds without thinking: 7
   
   📥 USER INPUT:
      User messages: 45,234 chars (~17,398 tokens)
      Documents: 12,000 chars (~4,615 tokens)
      ─────────────────────────────
      USER SUBTOTAL: 57,234 chars (~22,013 tokens)
   
   🤖 CLAUDE OUTPUT:
      Thinking: 23,456 chars (~9,021 tokens)
      Assistant: 34,567 chars (~13,295 tokens)
      Tool Content: 8,900 chars (~3,423 tokens)
      ─────────────────────────────
      CLAUDE SUBTOTAL: 66,923 chars (~25,739 tokens)
   
   ═════════════════════════════════════
   TOTAL: 124,157 chars (~47,752 tokens)
```

Also displays a summary table:
```
┌─────────────────────┬────────┬─────────────┬────────────────┬─────────────┐
│ model               │ rounds │ withThinking│ withoutThinking│ totalTokens │
├─────────────────────┼────────┼─────────────┼────────────────┼─────────────┤
│ Claude 3.5 Sonnet   │ 15     │ 8           │ 7              │ 47,752      │
│ Claude Opus         │ 3      │ 3           │ 0              │ 12,345      │
└─────────────────────┴────────┴─────────────┴────────────────┴─────────────┘
```

### Use Cases

- **Compare thinking usage** across models
- **Track cost per model** (if you know pricing)
- **Analyze conversation patterns** by model type
- **Optimize model selection** based on actual usage

---

### What to Look For

When debugging, check:

1. **Event types** - Are new event types appearing?
2. **Delta types** - Are new delta types in `content_block_delta`?
3. **Data structure** - Has the structure of events changed?
4. **Missing content** - Is text appearing in Claude's response but not being tracked?

### Common Debugging Scenarios

#### Scenario 1: Text Not Being Captured

**Symptom:** Assistant response shows in UI but tracker shows 0 characters

**Debug steps:**
1. Enable debug mode: `window.enableDebug()`
2. Send a message
3. Look for events with `delta.text` or similar fields
4. Check if the `delta.type` has changed

**Solution:** Add new capture condition in `processSSEStream`

#### Scenario 2: Files Not Being Tracked

**Symptom:** Created files don't add to token count

**Debug steps:**
1. Enable debug mode
2. Create a file using `create_file`
3. Look for `tool_use` content blocks
4. Find delta events with file content
5. Identify the delta type (currently `input_json_delta`)

**Solution:** Ensure `input_json_delta` is being captured

#### Scenario 3: Multiple Content Types

**Symptom:** Some responses counted, others not

**Debug steps:**
1. Compare debug logs from different types of responses
2. Identify which content block types are missing
3. Add handlers for those types

---

## Extending the Tracker

### Adding a New Content Type

If Claude.ai adds a new content type (e.g., images, audio):

**Step 1:** Identify the event structure
```javascript
window.enableDebug()
// Use the feature and examine logs
```

**Step 2:** Add to tracker state
```javascript
currentRound: {
  // ... existing fields
  newContentType: { text: '', chars: 0, tokens: 0 }
}
```

**Step 3:** Add capture logic
```javascript
if (data.type === 'content_block_delta' && 
    data.delta?.type === 'new_content_delta') {
  const text = data.delta.content || '';
  currentRound.newContentType.text += text;
}
```

**Step 4:** Update calculations
```javascript
const newContentChars = round.newContentType.text.length;
const newContentTokens = estimateTokens(newContentChars);
// Add to totals
```

**Step 5:** Update display
```javascript
console.log(`🆕 NEW CONTENT: ${newContentChars} chars (~${newContentTokens} tokens)`);
```

### Adding Exact Token Counting

To integrate with Anthropic's Token Counting API:

1. Store text temporarily (already done)
2. After round completion, send to API:
```javascript
fetch('https://api.anthropic.com/v1/messages/count_tokens', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5',
    messages: [ /* construct messages */ ]
  })
})
```
3. Update `savedRound` with exact tokens
4. Clear text from memory

**Note:** This requires handling CORS (use browser extension or proxy)

---

## Troubleshooting Changes

### If Claude.ai Updates Break the Tracker

#### Check 1: URL Changes
```javascript
// Current: url.includes('/completion')
// If changed, update to new endpoint
```

#### Check 2: Request Structure
```javascript
// Check if prompt field renamed
const promptText = body.prompt || body.message || body.input;
```

#### Check 3: SSE Format
```javascript
// Verify SSE events still start with 'data: '
if (line.startsWith('data: ')) { ... }
```

#### Check 4: Event Types
Enable debug and check if event types have changed:
- `message_start` still exists?
- `content_block_delta` renamed?
- New event types introduced?

#### Check 5: Delta Types
Most likely to change! Check:
- `thinking_delta` → might become `reasoning_delta`
- `text_delta` → might become `message_delta`
- `input_json_delta` → might become `tool_input_delta`

### Version Detection

Add this to detect Claude version changes:
```javascript
// In message_start event
if (data.message?.model) {
  console.log('Claude version:', data.message.model);
}
```

### Backup Strategy

If major changes occur:
1. Save current working version
2. Enable debug mode
3. Capture full event stream to JSON
4. Analyze differences
5. Update capture logic incrementally
6. Test each change

---

## API Reference

### Tracker Object
```javascript
window.claudeTracker = {
  global: { 
    totalChars: 0,
    totalTokens: 0,
    // ... other totals
    roundCount: 0,
    modelStats: {  // NEW: Per-model statistics
      'Claude 3.5 Sonnet': { /* stats */ },
      'Claude Opus': { /* stats */ }
    }
  },
  rounds: [ /* array of completed rounds */ ],
  last: { /* most recent round */ },
  currentRound: { /* round in progress */ }
}
```

### Functions
```javascript
// === BASIC COMMANDS ===
window.showAllRounds()    // Display all rounds in a table
window.exportJSON()       // Export data as JSON to clipboard
window.getTrackerURL()    // Generate blob URL for data
window.resetTracker()     // Clear all data

// === MODEL STATISTICS (NEW) ===
window.showModelStats()   // Display per-model statistics

// === DEBUG COMMANDS ===
window.enableDebug()      // Enable enhanced debug mode
window.disableDebug()     // Disable debug mode
window.saveDebugLog()     // Download complete debug log as .txt file
window.getDebugSummary()  // Show debug statistics in console
```

---

## Testing Checklist

When updating the tracker, test:

- [ ] Simple text message
- [ ] Message with attached document (PDF, TXT)
- [ ] Message that creates files (create_file tool)
- [ ] Message with code blocks
- [ ] Message with thinking enabled
- [ ] Long message (>100k characters)
- [ ] Multiple messages in succession
- [ ] Model switching (change model mid-conversation)
- [ ] Debug mode on/off
- [ ] Model statistics display
- [ ] Debug log export
- [ ] Console spam filtering (verify clean console)

---

## New Features Summary (v1.3)

### 1. Console Spam Filtering
- Aggressively filters Claude.ai's own console output
- Configurable patterns via `CONSOLE_SPAM_PATTERNS`
- Keeps console clean for tracker output only

### 2. Configurable Token Estimation
- Central `CHARS_PER_TOKEN` setting (default: 2.6)
- Per-content-type overrides in `TOKEN_ESTIMATION` object
- Fine-tune for code vs natural text vs documents

### 3. Enhanced Debug Mode
- Automatic endpoint importance filtering
- Deep object search for API fields
- Debug log export to file
- Debug summary statistics
- Response body inspection for important endpoints

### 4. Model Statistics Tracking
- Per-model statistics (Sonnet, Opus, Haiku)
- Thinking usage comparison across models
- Detailed breakdown by content type
- New command: `window.showModelStats()`

### 5. DOM-Based Model Detection
- Multiple selector fallbacks for reliability
- Works even when API doesn't provide model info
- Detects model name from UI elements

### 6. Memory Optimization
- Optional text clearing after round save
- Configurable save delay
- Large document warnings

---

## Resources

- **Anthropic API Docs:** https://docs.anthropic.com/
- **SSE Specification:** https://html.spec.whatwg.org/multipage/server-sent-events.html
- **Browser DevTools:** F12 → Network → Filter by "completion"

---

## Maintenance Notes

**Last Updated:** October 2025 (v1.3)

**Known Working With:**
- Claude Sonnet 4.5
- Claude Sonnet 3.5
- Claude.ai web interface

**Current Version Features:**
- Console spam filtering
- Configurable token estimation per content type
- Enhanced debug mode with log export
- Model-specific statistics tracking
- DOM-based model detection with fallbacks
- Memory optimization options

**Key Dependencies:**
- Server-Sent Events (SSE)
- Fetch API
- Browser storage APIs
- DOM selectors (for model detection)

**Breaking Change Risk (High to Low):**
1. **DOM selectors for model detection** (high risk - UI changes frequently)
2. **Delta types** (high risk - API evolution)
3. Event structure (medium risk)
4. Request format (medium risk)
5. URL endpoints (low risk)
6. SSE format (very low risk)

**Configuration Changes:**
- All settings now centralized in `SETTINGS` object
- Easy to modify without diving into code
- Token estimation customizable per content type
- Console filtering patterns easily updated

---

## Contact

For questions or issues, open a GitHub issue or discussion.

**Quick Debug Checklist:**
1. Enable debug mode: `window.enableDebug()`
2. Reproduce the issue
3. Save debug log: `window.saveDebugLog()`
4. Check debug summary: `window.getDebugSummary()`
5. Examine exported log file for patterns

**Settings to Check First:**
- `HIDE_CLAUDE_CONSOLE_SPAM` - Is console filtering too aggressive?
- `CHARS_PER_TOKEN` - Are token estimates way off?
- `TOKEN_ESTIMATION` - Are specific content types estimated poorly?
- `IMPORTANT_ENDPOINTS` - Missing an endpoint for inspection?
- `CONSOLE_SPAM_PATTERNS` - Is tracker output being filtered?

**Common Issues:**

**Model shows as "unknown":**
- Check if DOM selectors changed (inspect model selector element)
- Update `detectModelFromDOM()` with new selectors

**Token estimates inaccurate:**
- Fine-tune `CHARS_PER_TOKEN` or per-type rates
- Different content types have different densities
- Use actual API token counts to calibrate

**Console too noisy:**
- Add patterns to `CONSOLE_SPAM_PATTERNS`
- Check if tracker's own output is being filtered

**Missing content in tracking:**
- Enable debug mode and look for new delta types
- Check SSE events for new content block types
- Update capture logic in `processSSEStream()`

**Remember:** When in doubt, `window.enableDebug()` and `window.saveDebugLog()`!