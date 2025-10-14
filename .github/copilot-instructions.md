# Claude Token Tracker - Project Requirements

## Core Functionality

Always keep the commented sections; we will remove them separately.

### 1. Floating Overlay Widget
- **Purpose**: Display real-time statistics for the current chat and round
- **Location**: Draggable overlay on Claude.ai chat pages
- **Content**:
  - Current chat summary (total tokens, rounds, character count)
  - Current round statistics (user input, documents, thinking, assistant response, tools)
  - Token AND character count for each section
  - Minimize/maximize functionality
  - Must work without breaking when extension reloads

### 2. Statistics Page Structure

#### Section Order (Top to Bottom):
1. **4-Hour Session**
   - Total chars and tokens used in current 4-hour window
   - Character count - Token count
   - Progress bar (time limit)
   - Char - Token breakdown by type (User, Documents, Thinking, Assistant, Tools)
   - **Total rounds count in this session**
   - "Set end time" input (vésztartalék): `___ hr ___ min`
   - Reset timer display: "Resets in 3 hr 34 min"

2. **Weekly Session**
   - Total chars and tokens used in current weekly window
   - Character count - Token count
   - Progress bar (time limit)
   - Char - Token breakdown by type (User, Documents, Thinking, Assistant, Tools)
   - **Opus tokens (separate line, but included in total)**
   - **Total rounds count in this session**
   - "Set end time" input (vésztartalék): Day picker + time picker
   - Reset timer display: "Resets Thu 9:59 AM"

3. **All Time Statistics**
   - Total chars and tokens across all conversations
   - Character count - Token count
   - Char - Token breakdown by type
   - Total rounds count
   - No progress bar (no limit)

4. **Conversations List**
   - All chats sorted by most recent activity
   - Each chat shows:
     - Chat title (NOT "Untitled Chat" - extract from `<title>` tag)
     - Last active time
     - Round count
     - Total chars and tokens
   - **Click behavior**: Navigate to chat detail view showing:
     - Chat metadata
     - All rounds with token/character breakdown
     - Round-by-round statistics

### 3. Title Detection Rules
**CRITICAL**: Always extract chat title from `<title>` tag when round completes
- Format: "Chat Title | Claude"
- Split by `|`, take first part, trim whitespace
- NEVER default to "Untitled Chat" if title exists in DOM
- Add debug logging to verify title extraction

### 4. Timer System Behavior
- **Automatic window management**: 
  - Start new 4-hour/weekly window automatically when expired
  - Track rounds by ID: `chatId:roundNumber`
  - Calculate tokens from round IDs (not stored token count)
- **Vésztartalék (backup) controls**: Manual end time override
- **Display format**:
  - 4-hour: "Resets in X hr Y min"
  - Weekly: "Resets DayName HH:MM AM/PM"

### 5. Data Structure Requirements
- Storage: `{ chats, timers, settings }`
- Timers: `{ fourHour: { startTime, endTime, roundIds: [] }, weekly: {...} }`
- Each chat: `{ id, url, title, rounds: [], stats: { byType, byModel, totalTokens, totalChars } }`
- Each round: `{ user, documents, thinking, assistant, toolContent, total: { tokens, chars } }`

### 6. Extension Context Invalidation Handling
**All `chrome.runtime.sendMessage` calls MUST be wrapped in try-catch**
- Check `chrome?.runtime?.id` before sending messages
- Gracefully handle invalidated context (extension reload)
- Never spam console with errors after extension reload

## What NOT to Change Without Permission
- Timer system logic (unless explicitly broken)
- Storage structure (may break existing data)
- Message handler response format
- Title detection logic (unless verified broken)
- Existing working features when adding new ones

## Testing Checklist
Before considering a feature "done":
1. ✅ Title correctly extracted from page (not "Untitled Chat")
2. ✅ Tokens displayed in all sections (4h, weekly, all time)
3. ✅ Character counts shown alongside tokens
4. ✅ Round counts displayed in session sections
5. ✅ Loading animation disappears after data loads
6. ✅ Chat click opens detail view (not external tab)
7. ✅ No console errors on extension reload
8. ✅ Overlay remains functional after page navigation
9. ✅ Timer displays correct reset time format
10. ✅ Vésztartalék inputs work and update timers

## Common Pitfalls to Avoid
1. **Double-wrapping responses**: Don't wrap `{ success, data }` twice in message handlers
2. **Cache issues**: Increment version query param in HTML when JS changes (`stats.js?v=X`)
3. **Async title updates**: Title may not exist when round first saves - handle gracefully
4. **Array vs Object**: `chat.rounds` is an array, index with `[roundNumber - 1]`
5. **Context invalidation**: ALWAYS try-catch chrome API calls in content scripts

## Development Workflow
1. Make ONE change at a time
2. Test thoroughly before moving to next change
3. Verify no regressions in existing features
4. Add console.log for debugging new features
5. Remove or silence debug logs in production code
6. Update this document when requirements change
