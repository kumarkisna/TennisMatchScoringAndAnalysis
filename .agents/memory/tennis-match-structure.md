---
name: Tennis match set structure and reporting
description: Product requirements for multi-set tennis records, tiebreak-only sets, and whole-match analysis.
---

**Rule:** A match record may contain any number of sequential sets. Each set can be standard or a match tiebreak with its own target; match tiebreaks are won by two. Prior sets are reviewable, and point-winner corrections can be made from their point matrices.

**Why:** The user stated that matches may have many sets, sometimes including a tiebreak-only set with custom tournament targets, and asked to inspect any set without changing current scoring.

**How to apply:** Preserve each set's points inside one match record; only the live set accepts new points, but any saved point can be explicitly corrected. Recalculate summaries and PDFs across all sets. Keep scoring data on-device as described in `android-scoring-storage.md`.

**Rule:** Editing match details must not rewrite saved points, completed-set records, score totals, or analytics inputs. Correcting the first server may update the current set's server sequence, but must not alter server values already stored on individual points.

**Why:** Match details can be corrected after play, but recorded scoring history must remain trustworthy.

**How to apply:** Treat match-detail edits as metadata-only updates. Preserve historical set records and point arrays; recalculate only the current next-server indicator when the current first server changes.

**Rule:** A point-winner correction must replay that set and every later set so point order, game numbers, tiebreak status, and serving order stay consistent. Reject a correction if it would leave recorded points after a completed set or make a completed set incomplete before later sets.

**Why:** Changing an earlier winner can shift game boundaries and the server sequence; silently changing only the winner would corrupt saved scores and analysis.

**How to apply:** Keep the point's notes and tags attached while rebuilding its derived scoring fields. Do not write any changes until the full replay passes these consistency checks.

**Rule:** Backup score validation must distinguish active tiebreak scores from regular game scores. During a tiebreak, the displayed score strings are numeric point counts that match the numeric tiebreak counters; regular games use tennis labels.

**Why:** A valid backup from an in-progress match tiebreak was rejected when the validator accepted only regular tennis score labels.

**How to apply:** Keep backup validation aligned with the scoring engine for standard games, standard-set tiebreaks, and match-tiebreak sets.

**Rule:** An ace must award the point to that point's server, and a double fault must award it to the returner. Validate the pairing during new point saves and point-winner corrections using the actual game or tiebreak serve order.

**Why:** The user requires these combinations to be rejected before they can create false serve statistics or reports; ATP describes an ace as an untouched legal serve, and ITF Rule 24 awards the point after two consecutive service faults to the receiver.

**How to apply:** Reject mismatches at the on-device storage boundary and show an inline correction message without clearing point-entry details. Replayed corrections must re-check each point against its recalculated server; do not count invalid legacy ace/double-fault tags in analytics.

**Rule:** Only completed sets with an unambiguous format-specific score count toward a match winner. Tied set scores have no named set winner, tied set totals have no named match winner, and in-progress matches stay labeled in progress.

**Why:** The user asked to prevent false winner labels when set scores are tied or the match is unfinished.

**How to apply:** Use regular game totals for standard sets and tiebreak-point totals for match-tiebreak sets. Do not substitute a player when a stored winner is absent.

**Rule:** Match outcomes are optional in older backups. If present, accept only retirement or walkover reasons and a tracked/opponent awarded-winner side; reject malformed outcomes before changing any on-device data.

**Why:** The user needs older backups to remain restorable while invalid match results must never partially import or alter existing local records.

**How to apply:** Validate the complete backup before starting any import writes. Keep regression tests for invalid reasons, invalid winner sides, unchanged local storage, and legacy backups without outcome fields.

**Rule:** Importing a valid backup must preserve the device's existing selected tracked player. Use the backup's selected player only when the device has no active player.

**Why:** The user wants backup restore to add records without silently switching the player they are currently tracking.

**How to apply:** Capture the active player before merging, map imported player and match IDs as needed, and test restoring a backup with a different active player while confirming new records import and the existing selection remains.

**Rule:** Match point history and its active filter always apply to the selected set. Show all points newest first; break-point mode includes only saved or converted chances, and match-tiebreak sets have no break-point moments.

**Why:** The user expects to review each set independently, retain the chosen history filter while switching sets, and see an explicit empty result for match tiebreaks.

**How to apply:** Build history from the selected set's points and format, preserve the filter during set selection, and restore that set's own list when returning to it.

**Rule:** The Android app records tennis matches only; standalone practice-only sessions are out of scope.

**Why:** The user said separate practice-session recording would add too much and asked to leave it out.

**How to apply:** Keep practice-only sessions out of the data model and navigation unless the user later requests them.
