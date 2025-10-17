# 📦 Claude Token Tracker V2 - Első Verzió

## 🎯 Státusz

**Verzió:** 2.0.0 (First Test Version)  
**Dátum:** 2025-10-16  
**Státusz:** ✅ Tesztelésre kész!

---

## 📂 Fájlok (6 + 2)

### ✅ Elkészült (6 új fájl):

1. **manifest.json** - Chrome Extension konfiguráció
2. **worker-v2.js** - Service Worker (storage handler)
3. **page-injected-v2.js** - Page context script (fetch intercept)
4. **tracker-v2.js** - Main content script (koordinátor)
5. **TESTING.md** - Részletes tesztelési útmutató
6. **README.md** - Ez a fájl

### 📋 Szükséges (előző chatből):

7. **constants-v2.js** - Konstansok és konfigurációk
8. **storage-v2.js** - StorageManagerV2 osztály

**Fontos:** A `constants-v2.js` és `storage-v2.js` már elkészült az előző chatben ("Project data structure design"). Ezeket is be kell másolnod a mappába!

### ❌ Opcionális (vizuális):

- `icon16.png`, `icon48.png`, `icon128.png` - Ikonok (nem kötelező)

---

## 🏗️ Architektúra

```
┌─────────────────────────────────────┐
│  page-injected-v2.js                │
│  (Page Context)                     │
│  - Fetch intercept                  │
│  - Console filter                   │
└──────────┬──────────────────────────┘
           │ window.postMessage
           ↓
┌─────────────────────────────────────┐
│  tracker-v2.js                      │
│  (Content Script)                   │
│  - Context detection                │
│  - Round tracking                   │
│  - Message listener                 │
└──────────┬──────────────────────────┘
           │ chrome.runtime.sendMessage
           ↓
┌─────────────────────────────────────┐
│  worker-v2.js                       │
│  (Service Worker)                   │
│  - Storage operations               │
└──────────┬──────────────────────────┘
           │ uses
           ↓
┌─────────────────────────────────────┐
│  storage-v2.js                      │
│  (Storage Manager)                  │
│  - chrome.storage.local wrapper     │
│  - Data persistence                 │
└─────────────────────────────────────┘
```

---

## ✨ Funkciók (v2.0)

### ✅ Működik:

- **Context Detection:**
  - User ID (cookie-ból)
  - Organization ID (URL-ből)
  - Project ID (URL-ből vagy `_no_project`)
  - Chat ID (URL-ből)
  - Chat name (DOM-ból)

- **URL Monitoring:**
  - Automatikus chat váltás követés
  - Projekt chat vs sima chat felismerés

- **Message Tracking:**
  - POST /completion intercept → round start
  - GET /chat_conversations → final data
  - Message pár (human + assistant) követés
  - Content array processing
  - Token számolás (estimated)

- **GitHub Support:**
  - GET /sync/github/repo/.../tree/... intercept
  - Tree cache (7 nap TTL)
  - Sync source file expansion

- **Storage Hierarchy:**
  - User → Organization → Project → Chat → Messages
  - Stats aggregation minden szinten
  - Message indexing (gyors keresés)

- **Debug Commands:**
  - `window.claudeTrackerV2.*` parancsok
  - Export/Import
  - Reset

### ❌ Még NEM működik (későbbi verziók):

- Retrospektív sync (hiányzó üzenetek pótlása)
- Valós token számok (API-ból)
- Image tracking
- Timer windows (4h/weekly)
- UI components (overlay, popup, stats, settings)
- Chrome Web Store publikálás

---

## 🚀 Gyors Start

### 1. Fájlok előkészítése

Másold egy mappába az ÖSSZES 8 fájlt:

```
claude-token-tracker-v2/
├── manifest.json              ✅ Új
├── constants-v2.js            📋 Előző chatből
├── storage-v2.js              📋 Előző chatből
├── worker-v2.js               ✅ Új
├── page-injected-v2.js        ✅ Új
├── tracker-v2.js              ✅ Új
├── TESTING.md                 ✅ Új
└── README.md                  ✅ Új
```

### 2. Chrome-ba töltés

1. `chrome://extensions/`
2. Developer mode ON
3. Load unpacked
4. Válaszd ki a mappát
5. Kész! ✅

### 3. Tesztelés

1. Nyisd meg: `https://claude.ai`
2. Console (F12)
3. Várj 2-3 másodpercet
4. Látnod kell:
   ```
   🔧 Claude Token Tracker V2 - Page Injected Script Starting...
   ✅ Console spam filter initialized
   ✅ Fetch interceptor initialized
   🚀 Claude Token Tracker V2 - Content Script Starting...
   🎯 Claude Token Tracker V2 - Content Script Ready!
   ```

5. Indíts egy új chatot és írj egy üzenetet
6. Nézd a console-t:
   ```
   📤 [V2] POST /completion intercepted
   🟢 [V2] Round started
   📥 [V2] Chat data received
   ✅ [V2] Chat saved
   ✅ [V2] Round completed
   ```

### 4. Debug parancsok kipróbálása

```javascript
// Context info
window.claudeTrackerV2.getContext()

// Chat összesítés
window.claudeTrackerV2.getChatSummary()

// Körök listája
window.claudeTrackerV2.listRounds()

// Export
window.claudeTrackerV2.exportData()
```

**Részletes útmutató:** Nézd meg a `TESTING.md` fájlt!

---

## 📊 Storage Struktúra

```javascript
{
  version: "2.0.0",
  initialized_at: "2025-10-16T12:00:00Z",
  
  user: { uuid, email, stats, ... },
  
  organizations: {
    "[orgId]": { uuid, name, stats, github_trees, ... }
  },
  
  projects: {
    "_no_project": { virtual: true, stats, chat_ids, ... },
    "[projectId]": { uuid, name, stats, chat_ids, ... }
  },
  
  chats: {
    "[chatId]": {
      uuid, name, project_uuid,
      message_count, message_pair_count,
      stats, message_indexes, ...
    }
  },
  
  messages: {
    "[chatId]:[index]": {
      uuid, chat_id, index, sender,
      content: [ { type, chars, tokens_estimated, ... } ],
      attachments, files, sync_sources,
      stats, ...
    }
  }
}
```

---

## 🎮 Debug Parancsok

> 💡 Tipp: A parancsok Promise-t adnak vissza, ezért a DevTools konzolban használj `await`-et (pl. `await window.claudeTrackerV2.getContext()`), így azonnal megkapod az eredményt.

### Context & Status

```javascript
window.claudeTrackerV2.getContext()           // User, Org, Project, Chat info
window.claudeTrackerV2.getCurrentRound()      // Active round status
```

### Chat & Messages

```javascript
window.claudeTrackerV2.getChatSummary()       // Current chat stats
window.claudeTrackerV2.getChatSummary(chatId) // Specific chat

window.claudeTrackerV2.listRounds()           // All message pairs
window.claudeTrackerV2.listRounds(chatId)     // Specific chat pairs

window.claudeTrackerV2.getMessage(index)      // Get message (current chat)
window.claudeTrackerV2.getMessage(chatId, i)  // Get message (specific chat)
```

### Project & Cache

```javascript
window.claudeTrackerV2.getProjectInfo()       // Current project
window.claudeTrackerV2.getProjectInfo(projId) // Specific project

window.claudeTrackerV2.getGithubCache()       // GitHub tree cache
```

### Export & Reset

```javascript
window.claudeTrackerV2.exportData()           // Export to clipboard
window.claudeTrackerV2.resetStorage()         // ⚠️ DELETE ALL DATA!
```

---

## 🐛 Hibaelhárítás

### Extension nem töltődik be

1. Ellenőrizd hogy mind a 8 fájl megvan
2. Nézd meg: `chrome://extensions/` → Errors
3. Service Worker: Inspect → Console

### Nincs console log

1. Hard refresh: Ctrl+Shift+R
2. Ellenőrizd Developer mode ON
3. Extension enabled?

### "CONSTANTS is not defined"

- Hiányzik a `constants-v2.js` vagy nem jó
- Nézd meg az előző chatet ("Project data structure design")

### "Storage action failed"

- Hiányzik a `storage-v2.js`
- Service Worker console-t nézd meg

**Részletes hibaelhárítás:** `TESTING.md`

---

## 📝 Changelog

### v2.0.0 (2025-10-16) - First Test Version

**Új funkciók:**
- ✅ User/Org/Project/Chat hierarchia
- ✅ Context detection (user, org, project, chat)
- ✅ URL monitoring
- ✅ Message tracking (fetch intercept)
- ✅ GitHub sync support + tree cache
- ✅ Storage manager + stats aggregation
- ✅ Debug commands
- ✅ Console spam filter

**Architektúra:**
- Page context script (fetch intercept)
- Content script (koordinátor)
- Service worker (storage)
- Module-based structure

**Limitációk:**
- Csak estimated tokens (nincs valós API call)
- Nincs UI (csak console + debug commands)
- Nincs retrospektív sync
- Nincs image tracking
- Nincs timer window

---

## 🎯 Következő Lépések

### Rövid távú (v2.1):

1. **Retrospektív sync** - Hiányzó üzenetek pótlása
2. **Image tracking** - Feltöltött képek követése
3. **Better error handling** - Robusztusabb hibakezelés

### Közép távú (v2.2-v2.3):

4. **Overlay UI** - Floating widget a fülön
5. **Popup UI** - Quick stats
6. **Settings page** - Token estimation beállítások

### Hosszú távú (v3.0):

7. **Stats page** - Részletes statisztikák
8. **Timer windows** - 4h/weekly tracking
9. **Real token API** - Valós token számok
10. **Chrome Web Store** - Publikálás

---

## 📄 Licenc

MIT License (vagy ahogy szeretnéd)

---

## 👤 Szerző

Laszlo Bekesi (@blaci30)

---

## 🆘 Támogatás

Ha elakadtál vagy hibát találtál:

1. Nézd meg a `TESTING.md` útmutatót
2. Ellenőrizd a console-t
3. Próbáld ki a debug parancsokat
4. Jelezd a hibát! 💪

---

**Hajrá a teszteléshez!** 🚀
