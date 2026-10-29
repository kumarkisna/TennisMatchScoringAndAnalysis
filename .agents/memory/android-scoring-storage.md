---
name: Android scoring storage
description: Durable storage constraint for the Android tennis-scoring app.
---

**Rule:** Keep the device copy of match details, scores, and point logs authoritative. Newly created matches may sync to the private API when online; older local-only records must not be uploaded automatically.

**Why:** The user requires local mobile storage and later requested offline capture with sync after reconnecting. The local copy must remain available even when sync is unavailable.

**How to apply:** Save scoring state on-device first, queue only new matches for idempotent private sync, and preserve local data on any sync failure. Do not silently migrate existing local-only history.
