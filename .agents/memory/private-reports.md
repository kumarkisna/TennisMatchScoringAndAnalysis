---
name: Unbranded private reports
description: The user requires private tennis reports to omit Replit and third-party branding.
---

## Rule
TennisScoring is a private app. Reports must not include the Replit app URL or marks, names, logos, or links for other companies.

**Why:** The user explicitly asked that private reports contain no other company's mark.

**How to apply:** Check generated report HTML and PDF output for print headers, source URLs, and third-party branding. Keep user-provided match and event details readable; use generic benchmark headings when a label carries outside-company attribution.

## Selectable report sections
Report section choices affect generated report content only. Keep the full report selected by default, and do not change match statistics, calculations, or saved records based on those choices.

**Why:** Users may want a focused report, while the complete report remains the expected default and saved match history stays authoritative.

**How to apply:** Pass the current selection into preview and PDF generation; keep report analytics and local match storage independent of the selection.

## Generic statistics remain visible
Reports must always retain the existing generic match statistics, even when point, game, and set-level coaching notes or shot analysis are added.

**Why:** The user asked for detailed analysis to supplement the generic statistics, not replace them.

**How to apply:** Keep serve, return, and break-point statistics in every report; add recorded shot counts, ratings, and observations alongside them.

## Benchmark references
Report PDFs may show at most two selected user benchmark presets at a time, with generic headings that do not expose preset names.

**Why:** A two-column reference layout remains readable in a printable report and avoids printing outside-company attribution from a user-entered preset name.

**How to apply:** Keep saved presets unlimited and editable on-device, but limit selected references to two and label exported columns as generic user references.

## Optional player-name anonymization

Single-match and head-to-head reports can hide player names behind editable neutral labels. Keep the labels in separate on-device report settings, use them in both report types and their previews/PDFs, redact player names from report text and custom labels, and leave saved match records unchanged.

**Why:** The user wants privacy choices that are consistent between report types without changing the original player or match records.

**How to apply:** Keep labels in local settings, never in match/player records. Include anonymization and custom labels in report review validity so a PDF reviewed with different labels cannot be shared as current.

## Break-point moment context

**Rule:** Single-match reports may include an optional timeline of saved and converted break-point moments by set and game, with both players' pre-point scores and the outcome.

**Why:** Coaches should be able to review the score context for each chance without reopening the point history.

**How to apply:** Derive outcomes and scores from each saved set's point sequence at report generation. Do not persist duplicate score data; use anonymized report labels and respect the selected-section list.
