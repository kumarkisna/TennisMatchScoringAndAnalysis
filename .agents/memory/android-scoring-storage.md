---
name: Android scoring storage
description: Durable storage constraint for the Android tennis-scoring app.
---

**Rule:** Save match scoring locally first, keep player profiles on-device, and sync only newly created signed-in matches to the private API. Never auto-upload or assign legacy local matches to an account.

**Why:** Offline capture must continue without a network, and shared-device history must not cross account boundaries. Explicit ownership and sharing are required before match histories are available online.

**How to apply:** Preserve local records through sync failures, keep saved player profiles device-only, and leave pre-account match history unclaimed unless the user explicitly chooses to recover it.
