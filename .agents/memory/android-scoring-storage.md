---
name: Android scoring storage
description: Durable storage constraint for the Android tennis-scoring app.
---

**Rule:** Keep match details, scores, point logs, and derived insights on the user's device; do not send scoring records to an external database.

**Why:** The user explicitly asked for scoring to be saved locally on the mobile device rather than on an external database.

**How to apply:** Use app-private device storage for scoring state. Treat future sync or sharing as a separate feature requiring an explicit request.
