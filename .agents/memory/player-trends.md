---
name: Player trend comparisons
description: Rules for comparing saved-player performance from local point-recorded matches.
---

## Rule
Compare selected percentage metrics using the combined won-attempt numerator and total-attempt denominator across matches, not an unweighted average of match percentages. Keep each player's match history ordered by date, orient opponent-side records from that player's perspective, and show match context and sample counts. A metric with no recorded attempts is unavailable, not 0%.

**Why:** The user wants side-by-side trends from recorded match data, with enough context and sample size to interpret the percentages fairly.

**How to apply:** Calculate only from on-device point logs. Preserve per-match dates, opponent/event details, and counts; do not add external rankings or combine percentages without their denominators.
