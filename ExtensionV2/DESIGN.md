# Claude Token Tracker V2 - Design Document

## 📋 Tartalom

1. [Áttekintés](#áttekintés)
2. [Session Tracking (Kulcsfontosságú!)](#session-tracking)
3. [Adatstruktúra](#adatstruktúra)
4. [Szinkronizálás és Auto-fix](#szinkronizálás-és-auto-fix)
5. [Stats számítás (Inkrementális)](#stats-számítás)
6. [Blacklist rendszer](#blacklist-rendszer)
7. [User beállítások](#user-beállítások)

---

## Áttekintés

### Cél
Token használat **mérése** (NEM limitálás!) három session típusban:
- **Current Session** (5 óra)
- **Weekly Session** (7 nap)
- **Monthly Session** (30 nap)

### ⚠️ FONTOS: Ezek SESSIONÖK, NEM LIMITEK!
- **Anthropic LIMITÁL** → Blokkolja a használatot limit elérése esetén
- **Mi MÉRÜNK** → Csak statisztikát mutatunk, átláthatóságot adunk
- **NEM tárolunk totál stats-ot!** Csak a 3 session ablakban lévő adatokat
- A 3 session-ön kívüli régi message-ek MEGMARADNAK a chat-ben (archívum), de **nem számolódnak** bele a stats-ba

### Kulcs különbségek az Anthropic-hoz képest
- **Anthropic**: Limitál (blokkolja a használatot limit elérése esetén)
- **Mi**: Csak mérünk (statisztika, átláthatóság)
- **Anthropic**: Fix reset időpontok
- **Mi**: 5hr & weekly szinkronban Anthropic-kal, monthly user által állítható

### Szinkronizáció az Anthropic-kal
- **5 órás és heti session**: Automatikusan szinkronban Anthropic-kal (same logic)
- **Havi session**: User által beállítható reset időpont (default: első üzenet időpontja)

---

## Session Tracking

### 1. Current Session (5 óra)

**Működés:**
- **Indulás**: Első üzenet amikor >5 óra telt el az előző session óta
- **Időtartam**: 5 óra (300 perc)
- **Reset**: Automatikus, 5 óra után
- **Tartalom**: Csak az elmúlt 5 órában küldött message pair-ek

**Példa:**
```
T0: 10:00 - User küld üzenetet
  → Current session kezdődik: 10:00 - 15:00

T1: 11:00 - User küld üzenetet
  → Ugyanaz a session (még nem telt el 5 óra)

T2: 16:00 - User küld üzenetet
  → ÚJ session kezdődik: 16:00 - 21:00
  → Előző session (10:00-15:00) INAKTÍV lesz
```

**Reset logika:**
```javascript
const lastMessageTime = new Date(lastMessage.created_at)
const now = new Date()
const hoursSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60)

if (hoursSinceLastMessage > 5) {
  // ÚJ SESSION
  startNewCurrentSession()
} else {
  // FOLYTATÁS
  continueCurrentSession()
}
```

---

### 2. Weekly Session (7 nap)

**Működés:**
- **Reset időpont**: Heti fix időpont (pl. csütörtök 9:59 AM) - Anthropic szerinti
- **Tartalom**: Elmúlt 7 nap MINDEN message pair-je
- **Opus tracking**: Opus használat **benne van** a totál használatban, csak **külön is megmutatjuk**

**Reset logika:**
```javascript
// User által beállítható (default: Anthropic timing)
const weeklyReset = {
  dayOfWeek: 4,  // Csütörtök (0 = vasárnap)
  hour: 9,
  minute: 59
}

function getNextWeeklyReset() {
  const now = new Date()
  const next = new Date(now)

  // Következő csütörtök 9:59
  next.setDate(now.getDate() + (weeklyReset.dayOfWeek - now.getDay() + 7) % 7)
  next.setHours(weeklyReset.hour, weeklyReset.minute, 0, 0)

  if (next < now) {
    next.setDate(next.getDate() + 7)  // Következő hét
  }

  return next
}
```

**Opus számolás (SUBSET a totálban):**
- **FONTOS**: Opus használat **benne van** a heti totál használatban!
- Csak **külön is megmutatjuk**, hogy hány volt belőle Opus
- **Példa**:
  - Heti totál: 100 message pair, 10,000 token
  - Ebből Opus: 30 message pair, 4,000 token
  - **NEM** 100+30=130! Továbbra is 100 marad a heti használat!
- Detektálás: `message.model` field ellenőrzése (`claude-opus-*`)
- Stats struktúra:
```javascript
{
  stats: {
    total_pairs: 100,
    total_tokens: 10000,
    opus_subset: {      // SUBSET, nem külön számláló!
      total_pairs: 30,
      total_tokens: 4000
    }
  }
}

---

### 3. Monthly Session (30 nap)

**Működés:**
- **Reset időpont**: User által beállítható
- **Default**: Első üzenet időpontja (user első használata)
- **Tartalom**: Elmúlt 30 nap MINDEN message pair-je
- **SPECIÁLIS**: Folyamatos session (nem törlődik, csak előrecsúszik)

**Miért user által beállítható?**
- Anthropic billing cycle nem publikus
- User választhat:
  - Első használat dátuma (pl. 15-e minden hónapban)
  - Naptári hónap (1-e minden hónapban)
  - Custom (bármilyen nap)

**Konfiguráció** (BEÁLLÍTHATÓ, de most nem implementáljuk az UI-t):
```javascript
const monthlyReset = {
  day: 15,  // Hónap 15. napja
  hour: 0,
  minute: 0
}
```

**Reset logika (FOLYAMATOS):**
```javascript
function getNextMonthlyReset() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), monthlyReset.day, monthlyReset.hour, monthlyReset.minute)

  if (next < now) {
    next.setMonth(next.getMonth() + 1)  // Következő hónap
  }

  return next
}
```

**FONTOS különbség az 5hr/weekly session-től:**
- **5hr & weekly**: Ha lejár → TÖRLÉS, újraindítás CSAK új üzenet érkezésekor
- **Monthly**: Ha lejár → ÚJ session indul, de ELŐZŐ session adatok MEGMARADNAK (folyamatos)
- Példa:
  ```
  2025-01-15: Havi session #1 kezdődik
  2025-02-15: Havi session #2 kezdődik (session #1 MEGMARAD archívumban)
  2025-03-15: Havi session #3 kezdődik (session #1,#2 MEGMARAD)
  ```

---

### Session adatok tárolása

**NEM** tároljuk az összes message-t újra! Csak **hivatkozások**:

```json
{
  "user": {
    "sessions": {
      "current": {
        "started_at": "2025-10-17T10:00:00Z",
        "expires_at": "2025-10-17T15:00:00Z",
        "active": true,
        "message_pairs": [
          {
            "chat_id": "chat1",
            "pair_indexes": [
              { "human": 0, "assistant": 1 },
              { "human": 2, "assistant": 3 }
            ]
          }
        ],
        "stats": {
          "total_pairs": 2,
          "total_chars": 1234,
          "total_tokens_estimated": 475,
          "total_tokens_actual": 0
        }
      },

      "weekly": {
        "reset_at": "2025-10-24T09:59:00Z",
        "message_pairs": [
          {
            "chat_id": "chat1",
            "pair_indexes": [...]
          },
          {
            "chat_id": "chat2",
            "pair_indexes": [...]
          }
        ],
        "stats": {
          "total_pairs": 15,
          "total_chars": 12000,
          "total_tokens_estimated": 4500,
          "opus_subset": {
            "total_pairs": 5,
            "total_chars": 4000,
            "total_tokens_estimated": 1500
          }
        }
      },

      "monthly": {
        "reset_at": "2025-11-15T00:00:00Z",
        "message_pairs": [...],
        "stats": {...}
      }
    }
  }
}
```

**Előnyök:**
- ✅ Kis tárhely (csak hivatkozások)
- ✅ Chat objektum nem duplikálódik
- ✅ Session stats gyors számolás
- ✅ Régi chatek megmaradnak (archívum)

---

### Session tisztítás (Cleanup)

**MIKOR ellenőrizzük:**
- **MINDEN worker request-nél** (automatikus)
- User kérésre (manuális)

**TRIGGER:**
```javascript
// worker-v2.js - MINDEN request elején
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  // AUTOMATIKUS cleanup check MINDEN request előtt
  await checkAndCleanupExpiredSessions()

  // Aztán a normál request handling...
  if (message.type === 'TRACKER_V2_STORAGE') {
    handleStorageAction(message.action, message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }))
  }

  return true
})
```

**Cleanup logika SESSION TÍPUSONKÉNT:**

**1. Current Session (5hr) - TÖRLÉS ha lejárt**
```javascript
async function checkCurrentSession() {
  const user = await getUser()
  const current = user.sessions.current

  if (!current || !current.active) return

  const now = new Date()
  const expiresAt = new Date(current.expires_at)

  if (now > expiresAt) {
    // LEJÁRT → TÖRLÉS
    user.sessions.current = null
    await saveUser(user)
    console.log('⏰ Current session expired and deleted')
  }
}

// Új session CSAK új message érkezésekor
async function onNewMessage(message) {
  const user = await getUser()

  if (!user.sessions.current) {
    // ÚJ session indítása
    user.sessions.current = createNewCurrentSession(message.created_at)
    await saveUser(user)
    console.log('🆕 New current session started')
  }

  // Message hozzáadása...
}
```

**2. Weekly Session - TÖRLÉS ha lejárt**
```javascript
async function checkWeeklySession() {
  const user = await getUser()
  const weekly = user.sessions.weekly

  if (!weekly) return

  const now = new Date()
  const resetAt = new Date(weekly.reset_at)

  if (now > resetAt) {
    // LEJÁRT → TÖRLÉS
    user.sessions.weekly = null
    await saveUser(user)
    console.log('⏰ Weekly session expired and deleted')
  }
}

// Új session CSAK új message érkezésekor
async function onNewMessage(message) {
  const user = await getUser()

  if (!user.sessions.weekly) {
    // ÚJ session indítása
    user.sessions.weekly = createNewWeeklySession()
    await saveUser(user)
    console.log('🆕 New weekly session started')
  }

  // Message hozzáadása...
}
```

**3. Monthly Session - FOLYAMATOS (nem törlődik)**
```javascript
async function checkMonthlySession() {
  const user = await getUser()
  const monthly = user.sessions.monthly

  if (!monthly) {
    // Nincs session → új indítása
    user.sessions.monthly = createNewMonthlySession()
    await saveUser(user)
    return
  }

  const now = new Date()
  const resetAt = new Date(monthly.reset_at)

  if (now > resetAt) {
    // LEJÁRT → ÚJ session, de ELŐZŐ MEGMARAD

    // Archívum létrehozása (opcionális)
    if (!user.sessions.monthly_archive) {
      user.sessions.monthly_archive = []
    }

    // Előző session archívba (max 12 hónap)
    user.sessions.monthly_archive.push({
      ...monthly,
      archived_at: now.toISOString()
    })

    // Max 12 havi archívum
    if (user.sessions.monthly_archive.length > 12) {
      user.sessions.monthly_archive.shift()  // FIFO
    }

    // ÚJ session AZONNAL (nem vár új message-re!)
    user.sessions.monthly = createNewMonthlySession()

    await saveUser(user)
    console.log('📅 New monthly session started (previous archived)')
  }
}
```

**ÖSSZEFOGLALÁS:**
| Session | Lejárat után | Újraindítás | Adatok megmaradnak? |
|---------|-------------|-------------|---------------------|
| **5hr** | TÖRLÉS | Új message-re | NEM |
| **Weekly** | TÖRLÉS | Új message-re | NEM |
| **Monthly** | ARCHÍVUM | AZONNAL | IGEN (max 12 hónap) |

---

### Message Pairs (Párok kezelése)

**Definíció:**
- **Message pair** = 1 human message + 1 assistant válasz
- Session stats CSAK **teljes pár** alapján számolódik

**Példa:**
```javascript
// Chat messages:
[
  { index: 0, sender: "human", text: "Hello" },
  { index: 1, sender: "assistant", text: "Hi!" },       // ✅ Pair #1
  { index: 2, sender: "human", text: "Help me" },
  { index: 3, sender: "assistant", text: "Sure!" },     // ✅ Pair #2
  { index: 4, sender: "human", text: "Question..." }    // ❌ Nincs pair (incomplete)
]

// Session stats:
{
  total_pairs: 2,     // NEM 3! Az utolsó nem számít
  message_pairs: [
    { human: 0, assistant: 1 },
    { human: 2, assistant: 3 }
    // index 4 NINCS benne!
  ]
}
```

**Incomplete pair esetek:**
1. **Chat betelt** (limit reached) → utolsó human message nincs pair
2. **Folyamatban lévő válasz** → még nincs assistant message
3. **Hiba történt** → assistant nem válaszolt
4. **User megszakította** → stop button

**Kezelés:**
```javascript
async function addMessageToSession(chatId, humanIndex, assistantIndex = null) {
  const user = await getUser()

  // CSAK teljes pair kerül session-be
  if (assistantIndex === null) {
    console.log('⏳ Incomplete pair, waiting for assistant response')
    return  // NEM adjuk hozzá a session-höz!
  }

  // Teljes pair hozzáadása
  const pair = { human: humanIndex, assistant: assistantIndex }

  // Current session
  if (user.sessions.current) {
    user.sessions.current.message_pairs.push({ chat_id: chatId, pair })
  }

  // Weekly session
  if (user.sessions.weekly) {
    user.sessions.weekly.message_pairs.push({ chat_id: chatId, pair })
  }

  // Monthly session
  if (user.sessions.monthly) {
    user.sessions.monthly.message_pairs.push({ chat_id: chatId, pair })
  }

  await saveUser(user)
}
```

**FONTOS:**
- Chat stats MINDEN message-t tartalmaz (incomplete is!)
- Session stats CSAK teljes párokat tartalmaz
- Incomplete pair NINCS jelezve flag-gel (egyszerűen nincs session-ben)

---

## Adatstruktúra

### User szint

```json
{
  "user": {
    "uuid": "user-uuid",
    "name": "User Name",
    "email": "user@example.com",
    "tracked_since": "2025-10-17T00:00:00Z",

    "connectors": {
      "gcal": { "enabled": true, "config": null },
      "gdrive": { "enabled": true, "config": { "allow_indexing": false } },
      "github": { "enabled": true, "config": {} },
      "gmail": { "enabled": true, "config": null }
    },

    "defaults": {
      "work_function": "Other",
      "conversation_preferences": {
        "text": "1.)Velem mindig magyarul...",
        "stats": {
          "chars": 234,
          "tokens_estimated": 90,
          "tokens_actual": 0
        }
      },
      "locale": null
    },

    "github_repos": {
      "owner/repo/branch": {
        "owner": "owner",
        "repo": "repo",
        "branch": "branch",
        "cached_at": "2025-10-17T10:00:00Z",
        "expires_at": "2025-10-24T10:00:00Z",
        "file_count": 76,
        "files": [...]
      }
    },

    "sessions": {
      "current": {...},
      "weekly": {...},
      "monthly": {...},
      "monthly_archive": [...],  // Max 12 hónap archívum

      "config": {
        "current_duration_hours": 5,  // Állítható (default: 5)
        "weekly_reset": {
          "dayOfWeek": 4,  // Csütörtök (állítható)
          "hour": 9,
          "minute": 59
        },
        "monthly_reset": {
          "day": 15,       // Állítható (default: első message dátuma)
          "hour": 0,
          "minute": 0
        }
      }
    },

    "stats_changelog": [
      {
        "timestamp": "2025-10-17T12:00:00Z",
        "type": "message_added",
        "chat_id": "chat1",
        "message_index": 5,
        "delta": {
          "chars": 123,
          "tokens_estimated": 47
        }
      }
      // ... max 100 bejegyzés (FIFO)
    ]
  }
}
```

---

### Chat szint

```json
{
  "chat": {
    "uuid": "chat-uuid",
    "name": "Chat Name",
    "project_uuid": "project-uuid",
    "created_at": "2025-10-17T10:00:00Z",
    "updated_at": "2025-10-17T12:00:00Z",

    "messages": [
      {
        "uuid": "msg-uuid",
        "index": 0,
        "sender": "human",
        "content": [...],
        "created_at": "2025-10-17T10:00:00Z",
        "sync_sources": [...],
        "model": null,  // Csak assistant message-eknél! (pl. "claude-opus-4-20250514")

        "stats": {
          "chars": 123,
          "tokens_estimated": 47,
          "tokens_actual": null,
          "by_type": {
            "text": { "chars": 123, "tokens_estimated": 47 }
          }
        },

        "data_status": {
          "complete": true,
          "validated": true,
          "locked": false,
          "issues": [],
          "last_sync": "2025-10-17T10:00:00Z"
        }
      }
    ],

    "stats": {
      "total_messages": 12,
      "total_pairs": 6,
      "total_chars": 5000,
      "total_tokens_estimated": 1900,
      "by_sender": {
        "human": {...},
        "assistant": {...}
      }
    },

    "data_status": {
      "complete": true,
      "all_messages_complete": true,
      "incomplete_message_count": 0
    }
  }
}
```

**FONTOS:**
- Chat stats = TELJES history stats (nem session-függő!)
- Chat objektum SOHA nem duplikálódik
- Session-ök csak hivatkoznak a message-ekre

---

### Project szint

```json
{
  "project": {
    "uuid": "project-uuid",
    "name": "Project Name",
    "created_at": "2025-10-17T00:00:00Z",
    "chat_ids": ["chat1", "chat2"],

    "stats": {
      "total_chats": 2,
      "total_messages": 50,
      "total_chars": 25000,
      "total_tokens_estimated": 9500
    },

    "data_status": {
      "complete": true,
      "incomplete_chat_count": 0
    }
  }
}
```

**FONTOS:** Project stats = TELJES stats (összes chat), NEM session-függő!

---

## Szinkronizálás és Auto-fix

### EVENT-alapú, NEM időzített!

**Rossz:**
```
❌ Minden 30 másodpercben scan
❌ Folyamatos polling
❌ Erőforrás pazarlás
```

**Jó:**
```
✅ EVENT: github_repo_cached
✅ Scan: CSAK érintett message-ek
✅ Auto-fix: CSAK ezek
✅ Inkrementális stats frissítés
```

---

### Auto-fix folyamat

**1. GitHub repo cache-elve (EVENT)**
```javascript
// page-injected-v2.js
onGitHubTreeResponse(owner, repo, branch, files) {
  saveGitHubRepo(owner, repo, branch, files)

  window.postMessage({
    type: 'GITHUB_REPO_CACHED',
    data: { owner, repo, branch }
  })
}
```

**2. Worker észleli**
```javascript
// tracker-v2.js
window.addEventListener('message', (event) => {
  if (event.data.type === 'GITHUB_REPO_CACHED') {
    handleGitHubRepoCached(event.data)
  }
})
```

**3. Auto-fix scan**
```javascript
async function handleGitHubRepoCached({ owner, repo, branch }) {
  const repoKey = `${owner}/${repo}/${branch}`

  // Keress CSAK azokat ahol hiányzik
  const affectedMessages = await findMessagesWithIssue(
    'missing_github_files',
    `github_repo:${repoKey}`
  )

  if (affectedMessages.length === 0) return

  console.log(`🔧 Fixing ${affectedMessages.length} messages`)

  for (const msg of affectedMessages) {
    await fixMessageGitHubFiles(msg, repoKey)
  }
}
```

**4. Message fix + Delta propagálás**
```javascript
async function fixMessageGitHubFiles(message, repoKey) {
  const repoFiles = await getGitHubRepo(repoKey)

  // Új stats
  const oldStats = message.stats
  const newStats = calculateMessageStats(message, repoFiles)

  // Delta
  const delta = {
    chars: newStats.chars - oldStats.chars,
    tokens_estimated: newStats.tokens_estimated - oldStats.tokens_estimated
  }

  // Frissítés
  message.stats = newStats
  message.data_status.issues = message.data_status.issues.filter(
    i => i.type !== 'missing_github_files'
  )
  message.data_status.complete = (message.data_status.issues.length === 0)

  await saveMessage(message)

  // DELTA PROPAGÁLÁS (inkrementális!)
  await propagateStatsDelta(message.chat_id, delta)
}
```

---

### Data Status & Issues

**Message/Chat/Project szinten:**
```json
{
  "data_status": {
    "complete": false,
    "validated": false,
    "locked": false,
    "last_sync": "2025-10-17T10:00:00Z",

    "issues": [
      {
        "id": "issue-uuid",
        "type": "missing_github_files",
        "severity": "warning",
        "description": "GitHub file list missing",
        "can_auto_fix": true,
        "required_data": ["github_repo:owner/repo/branch"],
        "created_at": "2025-10-17T10:00:00Z"
      }
    ]
  }
}
```

**Issue típusok:**
- `missing_github_files` - GitHub file lista hiányzik
- `missing_attachment_content` - Attachment tartalom hiányzik
- `missing_gdrive_file` - GDrive fájl hiányzik
- `stats_outdated` - Stats újraszámolás kell
- `missing_actual_tokens` - Nincs API token adat
- `incomplete_data` - Valami hiányzik (általános)

**Severity:**
- `info` - Információ (nem blokkoló)
- `warning` - Figyelmeztetés (hiányos, de működik)
- `error` - Hiba (blokkoló, nem működik)

**Locked flag:**
- `true` → Adat TELJES és HELYES, NE írjuk felül!
- `false` → Szinkronizálható

---

## Stats számítás

### Inkrementális (Delta-alapú)

**NEM** számoljuk újra az egész chat-et minden message változáskor!

**Rossz:**
```
Message frissül
  → Chat: MINDEN message összeadása (12 message!)
  → Project: MINDEN chat összeadása (50 chat!)
  → LASSÚ!
```

**Jó:**
```
Message frissül
  → Delta: +100 char, +38 token
  → Chat stats += delta
  → Project stats += delta
  → GYORS!
```

---

### Delta propagálás

```javascript
async function propagateStatsDelta(chatId, delta) {
  // 1. Chat
  const chat = await getChat(chatId)
  chat.stats.total_chars += delta.chars
  chat.stats.total_tokens_estimated += delta.tokens_estimated
  await saveChat(chat)

  // 2. Project
  const project = await getProject(chat.project_uuid)
  project.stats.total_chars += delta.chars
  project.stats.total_tokens_estimated += delta.tokens_estimated
  await saveProject(project)

  // 3. Sessions (ha a message benne van a session-ben)
  await updateSessionStats(chatId, message.index, delta)

  // 4. Changelog (max 100 entry, FIFO)
  await addToChangelog({
    type: 'message_updated',
    chat_id: chatId,
    message_index: message.index,
    delta: delta
  })
}

async function addToChangelog(entry) {
  const user = await getUser()

  if (!user.stats_changelog) {
    user.stats_changelog = []
  }

  user.stats_changelog.push({
    timestamp: new Date().toISOString(),
    ...entry
  })

  // Max 100 entry (FIFO)
  if (user.stats_changelog.length > 100) {
    user.stats_changelog.shift()
  }

  await saveUser(user)
}
```

---

### Teljes újraszámolás (ritkán!)

**Mikor:**
- User kéri: `window.claudeTrackerV2.recalculateAllStats()`
- Export előtt (opcionális validáció)
- Gyanús stats (changelog audit)

```javascript
async function recalculateChatStats(chatId) {
  const chat = await getChat(chatId)

  let totalChars = 0
  let totalTokens = 0

  for (const message of chat.messages) {
    totalChars += message.stats.chars
    totalTokens += message.stats.tokens_estimated
  }

  // Validáció
  if (totalChars !== chat.stats.total_chars) {
    console.warn('⚠️ Stats mismatch! Fixing...')
    chat.stats.total_chars = totalChars
    chat.stats.total_tokens_estimated = totalTokens
    await saveChat(chat)
  }
}
```

---

## Blacklist rendszer

### Cél
Chat/Project tracking megakadályozása

### Működés
- **Blacklist** → NEM menti az adatokat
- **Delete** → Törli az adatokat, de újra menti

### Storage
```json
{
  "blacklist": {
    "projects": ["project-uuid-1"],
    "chats": ["chat-uuid-1", "chat-uuid-2"]
  }
}
```

### Ellenőrzés minden mentés előtt
```javascript
async function setChat(chatId, chatData) {
  // Chat szintű blacklist
  if (await isChatBlacklisted(chatId)) {
    console.warn('Chat blacklisted, skipping')
    return null
  }

  // Project szintű blacklist
  if (chatData.project_uuid && await isProjectBlacklisted(chatData.project_uuid)) {
    console.warn('Project blacklisted, skipping')
    return null
  }

  // Mentés...
}
```

### API
```javascript
// Blacklist
window.claudeTrackerV2.blacklistCurrentChat()
window.claudeTrackerV2.blacklistCurrentProject()

// Unblacklist
window.claudeTrackerV2.unblacklistChat(chatId)

// Lekérdezés
window.claudeTrackerV2.getBlacklist()
```

---

## User beállítások

### Connectors
```json
{
  "connectors": {
    "gcal": { "enabled": true },
    "gdrive": { "enabled": true, "config": {...} },
    "github": { "enabled": true },
    "gmail": { "enabled": true }
  }
}
```

### Defaults
```json
{
  "defaults": {
    "work_function": "Other",
    "conversation_preferences": {
      "text": "...",
      "stats": {
        "chars": 234,
        "tokens_estimated": 90,
        "tokens_actual": 0
      }
    }
  }
}
```

**FONTOS:** NEM számít bele semmibe, csak tárolva van!

---

## Nyitott kérdések

### ✅ Megoldott kérdések:

1. **Opus tracking** → IGEN, **subset** a totálban (nem külön számláló)
2. **Session reset config** → IGEN, user állítható (de UI most nem kell)
3. **Stats changelog** → IGEN, max 100 entry (FIFO)
4. **Session cleanup** → 5hr/weekly: TÖRLÉS, monthly: ARCHÍVUM (max 12 hónap)
5. **Message pair** → 1 human + 1 assistant, incomplete párok kezelése kell
6. **Opus detektálás** → `message.model` field (assistant message-eknél)

### ❓ Még tisztázandó:

1. **Incomplete message pair kezelés:**
   - Ha nincs assistant válasz (betelt chat, hiba, stb.)
   - Belekerül-e a session stats-ba? (várhatóan NEM)
   - Jelezni kell-e flag-gel?

2. **Issue auto-fix retry:**
   - Hányszor próbálkozzon?
   - Mi legyen sikertelen fix esetén?
   - Timeout van?

3. **Session stats frissítés sorrend:**
   - Message save → Chat stats → Project stats → Session stats?
   - Vagy párhuzamosan?

---

## TODO (Implementáció)

- [ ] User sessions struktúra (current, weekly, monthly)
- [ ] Session cleanup logika (weekly, monthly reset)
- [ ] Session stats számítás
- [ ] Message pair hozzáadás session-höz
- [ ] Opus külön tracking (ha kell)
- [ ] User settings (connectors, defaults) mentése
- [ ] Delta-alapú stats propagálás
- [ ] Issue system (data_status)
- [ ] Auto-fix (EVENT-alapú, GitHub repo cache)
- [ ] Locked flag mechanizmus
- [ ] Session config (reset időpontok)
- [ ] Console API (session lekérdezés, stats)

---

## Változásnapló

### 2025-10-17 - Session Tracking Tisztázások

**Frissítések a user visszajelzése alapján:**

1. **Opus tracking pontosítás:**
   - Opus használat **benne van** a totál használatban (SUBSET)
   - **NEM** külön számláló! Csak megmutatjuk, hogy hány volt belőle Opus
   - Példa: 100 total, 30 opus → marad 100 (nem 130!)

2. **Session config állíthatósága:**
   - Current, weekly, monthly session reset ideje **user által állítható**
   - **UI NINCS** implementálva (csak config struct készül)
   - Default értékek: 5hr, csütörtök 9:59, első message dátuma

3. **Session cleanup logika:**
   - **Minden worker request elején** automatikus check
   - **5hr & weekly**: Lejárat után TÖRLÉS, újraindítás CSAK új message-re
   - **Monthly**: Lejárat után ARCHÍVUM (max 12 hónap), új session AZONNAL indul

4. **Stats changelog:**
   - User szinten tárolva
   - Max **100 entry** (FIFO)
   - Debugging és audit célra

5. **Message pair definíció:**
   - 1 human + 1 assistant message
   - **Incomplete pair** (nincs assistant válasz): NINCS benne session stats-ban
   - Chat stats tartalmazza az incomplete-et is
   - Esetek: chat betelt, hiba, user megszakítás

6. **Opus detektálás:**
   - `message.model` field használata
   - Csak assistant message-eknél van érték
   - Példa: `"claude-opus-4-20250514"`

7. **Data struktúra bővítés:**
   - User: `sessions.monthly_archive` (max 12 hónap)
   - User: `sessions.config` (reset időpontok)
   - User: `stats_changelog` (max 100)
   - Message: `model` field (opus detektáláshoz)

---

### 2025-10-17 - Inicializálás

- Session tracking tervezés indítása
- Alap adatstruktúra megtervezése
- Auto-fix EVENT-alapú mechanizmus
