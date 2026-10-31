---
name: Player trend comparisons
description: Rules for comparing saved-player performance from local point-recorded matches.
---

## Rule
Compare selected percentage metrics using the combined won-attempt numerator and total-attempt denominator across matches, not an unweighted average of match percentages. Keep each player's match history ordered by date, orient opponent-side records from that player's perspective, and show match context and sample counts. A metric with no recorded attempts is unavailable, not 0%. Show ordinary results, retirements, walkovers, and in-progress matches separately from point-stat totals; a no-play result does not create a point sample.

**Why:** The user wants side-by-side trends from recorded match data, with enough context and sample size to interpret the percentages fairly. Retirements and walkovers still matter for match records, but counting them as zero-point samples would distort performance rates.

**How to apply:** Calculate point statistics only from on-device point logs, and calculate match outcomes from saved match results. Preserve per-match dates, opponent/event details, and counts; do not add external rankings or combine percentages without their denominators.

## Comparison sample notices

**Rule:** When comparing players, base any sample-balance notice on the selected metric's recorded attempt totals within the active date range. Keep each player's won/attempt counts visible, and describe a zero-attempt percentage as unavailable, never as 0%.

**Why:** The user asked for warnings that explain uneven comparison samples while avoiding unsupported claims about statistical certainty. A ratio alone can exaggerate trivial differences, so the current notice requires at least a 2× ratio and a difference of 10 or more attempts; this is a descriptive cue, not a significance test.

**How to apply:** Recalculate the notice when the selected metric or date range changes. State the actual totals and avoid conclusions about confidence or reliability.

## Stroke-rating history

**Rule:** Treat per-set stroke ratings as subjective self-ratings recorded for the match's tracked player. When a saved player appears as the opponent, do not attribute the tracked player's ratings to them. Average only rated sets; preserve each date, set number, sample count, and the unavailable state for missing ratings.

**Why:** Ratings are observations entered on the tracked player's match sheet, not objectively measured match statistics. Crediting them to the opposing player or treating blank sets as zero would misrepresent both ownership and meaning.

**How to apply:** Build stroke-rating history only from on-device set reviews where the selected player was tracked. Keep summaries descriptive, and retain set-level ratings in local backups and match reports.
