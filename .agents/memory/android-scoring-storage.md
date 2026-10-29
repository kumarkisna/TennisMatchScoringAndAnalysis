---
name: Android scoring storage
description: Durable storage constraint for the Android tennis-scoring app.
---

**Rule:** The Android tennis-scoring app is standalone: save matches and player profiles only on the device; do not require accounts, sync scores, or share matches through the server. Keep existing local matches accessible regardless of their former account owner, and leave web/API artifacts and server records untouched.

**Why:** The user wants a private Android app with no password system or online storage; web work is deferred, and existing server data must not be deleted.

**How to apply:** Use local AsyncStorage for Android match and player data, keep legacy device matches visible, remove Android account/sync/share flows, and preserve the separate web/API work for later.
