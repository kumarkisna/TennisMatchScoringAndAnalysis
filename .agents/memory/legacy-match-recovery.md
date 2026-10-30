---
name: Legacy match recovery
description: Safe ownership rules for server records created before account ownership.
---

**Rule:** Recover a legacy server match only when the claimant proves possession of that match's original device sync secret. Account sign-in, player names, and match details are not proof. Missing or invalid tokens and already-claimed records remain inaccessible.

**Why:** Historical records have no trustworthy account mapping, so transferring them based on a first login or guessable details could expose private match data.

**How to apply:** Compare the supplied per-match token with its stored hash, require the legacy-owner state, and transfer ownership through a locked conditional update. Never claim records in bulk.
