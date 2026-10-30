---
name: Tennis match set structure and reporting
description: Product requirements for multi-set tennis records, tiebreak-only sets, and whole-match analysis.
---

**Rule:** A match record may contain any number of sequential sets. Each set can be standard or a match tiebreak with its own target; match tiebreaks are won by two. Prior sets open in read-only review, while statistics and the PDF cover the whole match.

**Why:** The user stated that matches may have many sets, sometimes including a tiebreak-only set with custom tournament targets, and asked to inspect any set without changing current scoring.

**How to apply:** Preserve each set's points inside one match record; set review must not expose point-recording or set mutation controls. Calculate summaries and PDF output across all sets. Keep scoring data on-device as described in `android-scoring-storage.md`.

**Rule:** Editing match details must not rewrite saved points, completed-set records, score totals, or analytics inputs. Correcting the first server may update the current set's server sequence, but must not alter server values already stored on individual points.

**Why:** Match details can be corrected after play, but recorded scoring history must remain trustworthy.

**How to apply:** Treat match-detail edits as metadata-only updates. Preserve historical set records and point arrays; recalculate only the current next-server indicator when the current first server changes.

**Rule:** Backup score validation must distinguish active tiebreak scores from regular game scores. During a tiebreak, the displayed score strings are numeric point counts that match the numeric tiebreak counters; regular games use tennis labels.

**Why:** A valid backup from an in-progress match tiebreak was rejected when the validator accepted only regular tennis score labels.

**How to apply:** Keep backup validation aligned with the scoring engine for standard games, standard-set tiebreaks, and match-tiebreak sets.

**Rule:** Only completed sets with an unambiguous format-specific score count toward a match winner. Tied set scores have no named set winner, tied set totals have no named match winner, and in-progress matches stay labeled in progress.

**Why:** The user asked to prevent false winner labels when set scores are tied or the match is unfinished.

**How to apply:** Use regular game totals for standard sets and tiebreak-point totals for match-tiebreak sets. Do not substitute a player when a stored winner is absent.
