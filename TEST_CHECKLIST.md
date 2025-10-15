# Settings Page Testing Checklist

## 1. Save Notification ✅
- [ ] Click "Save" button
- [ ] Green notification appears bottom-right with ✅
- [ ] Shows "Settings saved successfully!"
- [ ] Disappears after 3 seconds

## 2. Storage Info
- [ ] Shows actual MB usage (e.g., "0.05 MB (0.5%)")
- [ ] Shows quota (e.g., "10 MB")
- [ ] Updates after import/reset

## 3. Export Data ✅
- [ ] Click "Export Data (JSON)"
- [ ] Downloads JSON file
- [ ] File contains chats, settings, timers

## 4. Import Data
- [ ] Click "Import Data"
- [ ] Select exported JSON
- [ ] Prompt shows:
   - "⚠️ IMPORT WARNING ⚠️"
   - Number of chats to import
   - Must type "IMPORT" to confirm
- [ ] After import: green notification + storage updates

## 5. Reset All Data
- [ ] Click "Reset All Data"
- [ ] Prompt shows:
   - "⚠️ DANGER: PERMANENT DATA DELETION ⚠️"
   - Lists what will be deleted
   - Must type "DELETE ALL" to confirm
- [ ] After reset: notification + storage resets to ~0 MB

## How to Test:
1. Reload extension: chrome://extensions/ → Reload
2. Right-click extension icon → Options
3. Test each feature above
4. Check console for errors (F12)
