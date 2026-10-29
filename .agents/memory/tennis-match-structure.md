---
name: Tennis match set structure and reporting
description: Product requirements for multi-set tennis records, tiebreak-only sets, and whole-match analysis.
---

**Rule:** A match record may contain any number of sequential sets. Each set can be standard or a match tiebreak with its own target; match tiebreaks are won by two. Player statistics and the PDF report cover the whole match.

**Why:** The user stated that matches may have many sets, sometimes including a tiebreak-only set, with custom targets for tournament-specific rules, and requested whole-match player analysis and PDF output.

**How to apply:** Preserve each set's points inside one match record and calculate summaries across all its sets. Keep scoring data on-device as described in `android-scoring-storage.md`.
