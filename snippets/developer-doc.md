# Claude Token Tracker - Developer Documentation

This document explains how the tracker works internally and how to maintain/extend it if Claude.ai's architecture changes.

## Table of Contents
- [How Claude.ai Works](#how-claudeai-works)
- [How the Tracker Works](#how-the-tracker-works)
- [Debugging Guide](#debugging-guide)
- [Extending the Tracker](#extending-the-tracker)
- [Troubleshooting Changes](#troubleshooting-changes)

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

#### 1. Fetch Interception
```javascript
const _originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
  if (url.includes('/completion')) {
    // Extract user message and documents
    const body = JSON.parse(options.body);
    const promptText = body.prompt || '';
    // ... capture documents from attachments/files
  }
  return _originalFetch(url, options);
};
```

#### 2. SSE Stream Processing
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

#### 3. Content Capture
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

#### 4. Token Estimation
```javascript
function estimateTokens(chars) {
  return Math.ceil(chars / 2.6);
}
```
**Ratio: 2.6 characters per token** (~3-5% accuracy)

---

## Debugging Guide

### Enable Debug Mode

```javascript
window.enableDebug()
```

This will log **every SSE event** with full details:
```
🐛 SSE Event: content_block_delta
   Full data: {...}
   📦 Delta type: text_delta
   📦 Text length: 42
```

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
  global: { /* cumulative stats */ },
  rounds: [ /* array of completed rounds */ ],
  last: { /* most recent round */ },
  currentRound: { /* round in progress */ }
}
```

### Functions
```javascript
window.enableDebug()      // Enable detailed logging
window.disableDebug()     // Disable detailed logging
window.showAllRounds()    // Display all rounds in table
window.exportJSON()       // Export data to clipboard
window.getTrackerURL()    // Generate blob URL for data
window.resetTracker()     // Clear all data
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
- [ ] Debug mode on/off

---

## Resources

- **Anthropic API Docs:** https://docs.anthropic.com/
- **SSE Specification:** https://html.spec.whatwg.org/multipage/server-sent-events.html
- **Browser DevTools:** F12 → Network → Filter by "completion"

---

## Maintenance Notes

**Last Updated:** October 2025

**Known Working With:**
- Claude Sonnet 4.5
- Claude.ai web interface

**Key Dependencies:**
- Server-Sent Events (SSE)
- Fetch API
- Browser storage APIs

**Breaking Change Risk (High to Low):**
1. **Delta types** (most likely to change)
2. Event structure
3. Request format
4. URL endpoints
5. SSE format (least likely)

---

## Contact

For questions or issues, open a GitHub issue or discussion.

**Remember:** When in doubt, `window.enableDebug()` and examine the logs!