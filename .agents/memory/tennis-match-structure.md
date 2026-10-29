---
name: Tennis match set structure and reporting
description: Product requirements for multi-set tennis records, tiebreak-only sets, and whole-match analysis.
---

**Rule:** A match record may contain any number of sequential sets. Each set can be standard or a match tiebreak with its own target; match tiebreaks are won by two. Prior sets open in read-only review, while statistics and the PDF cover the whole match.

**Why:** The user stated that matches may have many sets, sometimes including a tiebreak-only set with custom tournament targets, and asked to inspect any set without changing current scoring.

**How to apply:** Preserve each set's points inside one match record; set review must not expose point-recording or set mutation controls. Calculate summaries and PDF output across all sets. Keep scoring data on-device as described in `android-scoring-storage.md`.
