---
name: Android scoring storage
description: Durable storage constraint for the Android tennis-scoring app.
---

**Rule:** The Android scoring app is offline-only. Match details, point logs, saved players, and editable player profiles stay on the device; the app must not upload them to a server.

**Why:** The user explicitly changed the earlier sync requirement to offline-only storage and asked to save players for reuse in matches.

**How to apply:** Use local storage for Android scoring and player data; do not add automatic or manual API sync. Preserve existing server-side records and their access protections unless the user explicitly asks to remove them.
