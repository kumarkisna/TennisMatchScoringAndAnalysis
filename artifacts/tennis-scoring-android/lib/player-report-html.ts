import { STROKE_TYPE_OPTIONS, type PointCode, type StrokeType } from '@/lib/local-matches';
import type {
  ContextPerformanceInsight,
  PlayerPerformanceSummary,
  PlayerReportInsights,
} from '@/lib/player-insights';
import type { LocalReportBenchmarkPreset } from '@/lib/local-benchmarks';
import { escapeReportHtml as escapeHtml } from '@/lib/report-html-utils';
import {
  allPlayerReportSections,
  type PlayerReportSection,
} from '@/lib/report-sections';

interface ReportMatch {
  matchDate: string;
  event?: string | null;
  round?: string | null;
  chairCoach?: string | null;
  trackedPlayer: string;
  opponent: string;
  surface: string;
  matchStatus: 'in_progress' | 'complete';
}

export const POINT_CODE_LABELS: Record<PointCode, string> = {
  A: 'Ace',
  F: 'Forehand winner',
  B: 'Backhand winner',
  V: 'Net volley',
  O: 'Overhead',
  P: 'Drop shot',
  N: 'Into the net',
  L: 'Long',
  W: 'Wide',
  D: 'Double fault',
  FE: 'Forced error',
};

const STROKE_LABELS = Object.fromEntries(
  STROKE_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<StrokeType, string>;

function formatReportDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  const monthName = new Date(Date.UTC(year, month - 1, day)).toLocaleString(
    undefined,
    { month: 'long', timeZone: 'UTC' },
  );
  return `${monthName} ${day}, ${year}`;
}

function exactPercent(numerator: number, denominator: number): string {
  return denominator === 0 ? '—' : `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function rate(numerator: number, denominator: number): string {
  return denominator === 0
    ? '—'
    : `${numerator}/${denominator} (${exactPercent(numerator, denominator)})`;
}

function averageAces(aces: number, denominator: number, unit: string): string {
  return denominator === 0
    ? '—'
    : `${(aces / denominator).toFixed(2)} (${aces} aces / ${denominator} ${unit})`;
}

function contextRows<T extends string>(
  items: ContextPerformanceInsight<T>[],
  emptyLabel: string,
): string {
  if (items.every((item) => item.count === 0)) {
    return `<tr><td colspan="3">${emptyLabel}</td></tr>`;
  }
  return items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.count}</td>
          <td>${item.count === 0 ? '—' : item.trackedWinPercent === null ? 'Not shown · need 3 tags' : rate(item.trackedWon, item.count)}</td>
        </tr>`,
    )
    .join('');
}

function setScore(set: PlayerReportInsights['sets'][number]): string {
  if (set.format === 'match_tiebreak') {
    return `Match tie-break ${set.trackedTiebreakPoints}–${set.opponentTiebreakPoints} (target ${set.tiebreakTarget}, win by 2)`;
  }

  const games = `${set.trackedGames}–${set.opponentGames}`;
  return set.trackedTiebreakPoints > 0 || set.opponentTiebreakPoints > 0
    ? `${games} · tie-break ${set.trackedTiebreakPoints}–${set.opponentTiebreakPoints}`
    : games;
}

function setWinnerSide(
  set: PlayerReportInsights['sets'][number],
): 'tracked' | 'opponent' | null {
  if (!set.isComplete) return null;
  const trackedScore =
    set.format === 'match_tiebreak' ? set.trackedTiebreakPoints : set.trackedGames;
  const opponentScore =
    set.format === 'match_tiebreak' ? set.opponentTiebreakPoints : set.opponentGames;
  if (trackedScore === opponentScore) return null;
  return trackedScore > opponentScore ? 'tracked' : 'opponent';
}

function setWinnerLabel(
  set: PlayerReportInsights['sets'][number],
  trackedPlayer: string,
  opponent: string,
): string {
  if (!set.isComplete) return 'In progress';
  const winner = setWinnerSide(set);
  if (!winner) return 'Not determined';
  return winner === 'tracked' ? trackedPlayer : opponent;
}

function matchWinnerLabel(
  match: ReportMatch,
  sets: PlayerReportInsights['sets'],
): string {
  if (match.matchStatus !== 'complete') return 'In progress';
  const setWins = { tracked: 0, opponent: 0 };
  for (const set of sets) {
    const winner = setWinnerSide(set);
    if (winner) setWins[winner] += 1;
  }
  if (setWins.tracked === setWins.opponent) {
    return 'Complete · no set majority';
  }
  return setWins.tracked > setWins.opponent
    ? match.trackedPlayer
    : match.opponent;
}

export function buildPlayerReportHtml(
  match: ReportMatch,
  insights: PlayerReportInsights,
  summary: PlayerPerformanceSummary,
  selectedSections: readonly PlayerReportSection[] = allPlayerReportSections(),
  benchmarks: readonly Pick<
    LocalReportBenchmarkPreset,
    'firstServePointsWon' | 'secondServePointsWon' | 'serviceGamesWon'
  >[] = [],
): string {
  const includes = (section: PlayerReportSection) =>
    selectedSections.includes(section);
  const escape = escapeHtml;
  const shotRows = summary.codeInsights.length
    ? summary.codeInsights
        .map(
          (item) => `
            <tr>
              <td><strong>${escape(item.code)}</strong></td>
              <td>${escape(POINT_CODE_LABELS[item.code])}</td>
              <td>${item.count}</td>
              <td>${rate(item.trackedWon, item.count)}</td>
              <td>${exactPercent(item.count, summary.taggedPointCount)}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="5">No shot or ending tags recorded.</td></tr>';
  const codeLegendRows = (Object.entries(POINT_CODE_LABELS) as [PointCode, string][])
    .map(
      ([code, label]) => `
        <tr>
          <td><strong>${escape(code)}</strong></td>
          <td>${escape(label)}</td>
        </tr>`,
    )
    .join('');
  const feedbackRows = summary.feedback
    .map((item) => `<li>${escape(item)}</li>`)
    .join('');
  const strokeResultLabels = {
    in_play: 'In play',
    error: 'Error',
    winner: 'Winner',
  } as const;
  const strokeTallyRows = insights.strokeTallies
    .filter((item) => item.sampleCount > 0)
    .map((item) => `
      <tr>
        <td>${escape(item.player === 'tracked' ? match.trackedPlayer : match.opponent)}</td>
        <td>${escape(STROKE_LABELS[item.strokeType])}</td>
        <td>${item.inPlay}</td>
        <td>${item.errors}</td>
        <td>${item.winners}</td>
        <td>${item.sampleCount}</td>
      </tr>`)
    .join('');
  const strokeNoteRows = insights.strokeNotes
    .map((item) => `
      <tr>
        <td>Set ${item.setNumber}, Game ${item.gameNumber}, Point ${item.sequenceNumber}</td>
        <td>${escape(item.player === 'tracked' ? match.trackedPlayer : match.opponent)}</td>
        <td>${escape(STROKE_LABELS[item.strokeType])}</td>
        <td>${escape(strokeResultLabels[item.result])}</td>
        <td>${escape(item.note)}</td>
      </tr>`)
    .join('');
  const setObservationSections = insights.sets
    .map((set) => {
      const notes = [
        ...set.gameNotes
          .filter((item) => item.note.trim())
          .map((item) => `Game ${item.gameNumber}: ${item.note.trim()}`),
        ...Object.entries(set.review.strokeRatings).map(([type, rating]) => {
          const note = set.review.strokeNotes[type as keyof typeof set.review.strokeNotes];
          return `${STROKE_LABELS[type as keyof typeof STROKE_LABELS]} · rating ${rating}/5${note?.trim() ? ` · ${note.trim()}` : ''}`;
        }),
        ...Object.entries(set.review.strokeNotes)
          .filter(([type, note]) => !set.review.strokeRatings[type as keyof typeof set.review.strokeRatings] && note.trim())
          .map(([type, note]) => `${STROKE_LABELS[type as keyof typeof STROKE_LABELS]}: ${note.trim()}`),
        ...(set.review.footworkNote.trim()
          ? [`Footwork & court coverage: ${set.review.footworkNote.trim()}`]
          : []),
        ...(set.review.tacticalNote.trim()
          ? [`Tactical adjustments: ${set.review.tacticalNote.trim()}`]
          : []),
        ...(set.review.mentalNote.trim()
          ? [`Mental toughness / body language: ${set.review.mentalNote.trim()}`]
          : []),
      ];
      if (!notes.length) return '';
      return `<section class="observation-group"><h3>Set ${set.setNumber} observations</h3><ul class="observation-list">${notes.map((note) => `<li>${escape(note)}</li>`).join('')}</ul></section>`;
    })
    .filter(Boolean)
    .join('');
  const setObservations =
    setObservationSections || '<p class="context-coverage">No game or set observations recorded.</p>';
  const trackedServe = insights.serveStats.tracked;
  const opponentServe = insights.serveStats.opponent;
  const recordedSetCount = insights.sets.filter((set) => set.pointCount > 0).length;
  const trackedSecondServeIn = Math.max(
    0,
    trackedServe.secondServePoints - trackedServe.doubleFaults,
  );
  const opponentSecondServeIn = Math.max(
    0,
    opponentServe.secondServePoints - opponentServe.doubleFaults,
  );
  const trackedReturnWon = insights.returnPointsWon;
  const opponentReturnWon =
    trackedServe.servicePoints - trackedServe.servicePointsWon;
  const trackedFirstServeReturnWon =
    opponentServe.firstServePoints - opponentServe.firstServePointsWon;
  const opponentFirstServeReturnWon =
    trackedServe.firstServePoints - trackedServe.firstServePointsWon;
  const trackedSecondServeReturnWon =
    opponentServe.secondServePoints - opponentServe.secondServePointsWon;
  const opponentSecondServeReturnWon =
    trackedServe.secondServePoints - trackedServe.secondServePointsWon;
  const trackedReturnGamesPlayed = insights.serviceGames.opponent.gamesPlayed;
  const trackedReturnGamesWon =
    trackedReturnGamesPlayed - insights.serviceGames.opponent.gamesWon;
  const opponentReturnGamesPlayed = insights.serviceGames.tracked.gamesPlayed;
  const opponentReturnGamesWon =
    opponentReturnGamesPlayed - insights.serviceGames.tracked.gamesWon;
  const matchesWithPointData = insights.pointCount > 0 ? 1 : 0;
  const benchmarkValues = (
    key: 'firstServePointsWon' | 'secondServePointsWon' | 'serviceGamesWon',
  ) =>
    benchmarks.map((benchmark) =>
      benchmark[key] === null ? '—' : `${benchmark[key]!.toFixed(1)}%`,
    );
  const noBenchmarkValues = benchmarks.map(() => '—');
  const benchmarkHeaders = benchmarks
    .map((_, index) => `<th>User reference ${index + 1}</th>`)
    .join('');
  const serveRows = [
    ['Aces', String(trackedServe.aces), String(opponentServe.aces), ...noBenchmarkValues],
    [
      'Double faults',
      String(trackedServe.doubleFaults),
      String(opponentServe.doubleFaults),
      ...noBenchmarkValues,
    ],
    [
      'First serve in',
      rate(trackedServe.firstServePoints, trackedServe.servicePoints),
      rate(opponentServe.firstServePoints, opponentServe.servicePoints),
      ...noBenchmarkValues,
    ],
    [
      'Second serve in',
      rate(trackedSecondServeIn, trackedServe.secondServePoints),
      rate(opponentSecondServeIn, opponentServe.secondServePoints),
      ...noBenchmarkValues,
    ],
    [
      'First-serve points won',
      rate(trackedServe.firstServePointsWon, trackedServe.firstServePoints),
      rate(opponentServe.firstServePointsWon, opponentServe.firstServePoints),
      ...benchmarkValues('firstServePointsWon'),
    ],
    [
      'Second-serve points won',
      rate(trackedServe.secondServePointsWon, trackedServe.secondServePoints),
      rate(opponentServe.secondServePointsWon, opponentServe.secondServePoints),
      ...benchmarkValues('secondServePointsWon'),
    ],
    [
      'Service games played',
      String(insights.serviceGames.tracked.gamesPlayed),
      String(insights.serviceGames.opponent.gamesPlayed),
      ...noBenchmarkValues,
    ],
    [
      'Service games won',
      rate(
        insights.serviceGames.tracked.gamesWon,
        insights.serviceGames.tracked.gamesPlayed,
      ),
      rate(
        insights.serviceGames.opponent.gamesWon,
        insights.serviceGames.opponent.gamesPlayed,
      ),
      ...benchmarkValues('serviceGamesWon'),
    ],
    [
      'Aces per service game',
      averageAces(
        trackedServe.aces,
        insights.serviceGames.tracked.gamesPlayed,
        'service games',
      ),
      averageAces(
        opponentServe.aces,
        insights.serviceGames.opponent.gamesPlayed,
        'service games',
      ),
      ...noBenchmarkValues,
    ],
    [
      'Aces per set',
      averageAces(trackedServe.aces, recordedSetCount, 'sets with points'),
      averageAces(opponentServe.aces, recordedSetCount, 'sets with points'),
      ...noBenchmarkValues,
    ],
    [
      'Aces per match',
      averageAces(trackedServe.aces, matchesWithPointData, 'match'),
      averageAces(opponentServe.aces, matchesWithPointData, 'match'),
      ...noBenchmarkValues,
    ],
    [
      'Total service points won',
      rate(trackedServe.servicePointsWon, trackedServe.servicePoints),
      rate(opponentServe.servicePointsWon, opponentServe.servicePoints),
      ...noBenchmarkValues,
    ],
  ]
    .map(
      ([label, tracked, opponent, ...references]) => `
        <tr>
          <td>${escape(label ?? '')}</td>
          <td>${escape(tracked ?? '—')}</td>
          <td>${escape(opponent ?? '—')}</td>
          ${references.map((value) => `<td>${escape(value ?? '—')}</td>`).join('')}
        </tr>`,
    )
    .join('');
  const returnRows = [
    [
      'First-serve return points won',
      rate(trackedFirstServeReturnWon, opponentServe.firstServePoints),
      rate(opponentFirstServeReturnWon, trackedServe.firstServePoints),
    ],
    [
      'Second-serve return points won',
      rate(trackedSecondServeReturnWon, opponentServe.secondServePoints),
      rate(opponentSecondServeReturnWon, trackedServe.secondServePoints),
    ],
    [
      'Return games played',
      String(trackedReturnGamesPlayed),
      String(opponentReturnGamesPlayed),
    ],
    [
      'Return games won',
      rate(trackedReturnGamesWon, trackedReturnGamesPlayed),
      rate(opponentReturnGamesWon, opponentReturnGamesPlayed),
    ],
    [
      'Return points won',
      rate(trackedReturnWon, insights.trackedReturnPoints),
      rate(opponentReturnWon, trackedServe.servicePoints),
    ],
    [
      'Total points won',
      rate(insights.trackedPointsWon, insights.pointCount),
      rate(insights.pointCount - insights.trackedPointsWon, insights.pointCount),
    ],
  ]
    .map(
      ([label, tracked, opponent]) => `
        <tr>
          <td>${escape(label ?? '')}</td>
          <td>${escape(tracked ?? '—')}</td>
          <td>${escape(opponent ?? '—')}</td>
        </tr>`,
    )
    .join('');
  const setRows = insights.sets.length
    ? insights.sets
        .map(
          (set) => `
            <tr>
              <td>Set ${set.setNumber}<span class="sub">${set.isComplete ? 'Complete' : 'In progress'}</span></td>
              <td>${setScore(set)}</td>
              <td>${escape(setWinnerLabel(set, match.trackedPlayer, match.opponent))}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="3">No set data recorded.</td></tr>';
  const breakPointConversionRows = insights.sets.length
    ? insights.sets
        .map(
          (set) => `
            <tr>
              <td>Set ${set.setNumber}<span class="sub">${set.format === 'match_tiebreak' ? 'Excluded · match tie-break' : `${set.isComplete ? 'Complete' : 'In progress'} · ${set.breakPoints.tracked.opportunities + set.breakPoints.opponent.opportunities} chances`}</span></td>
              <td>${rate(set.breakPoints.tracked.converted, set.breakPoints.tracked.opportunities)}</td>
              <td>${rate(set.breakPoints.tracked.opportunities - set.breakPoints.tracked.converted, set.breakPoints.tracked.opportunities)}</td>
              <td>${rate(set.breakPoints.opponent.converted, set.breakPoints.opponent.opportunities)}</td>
              <td>${rate(set.breakPoints.opponent.opportunities - set.breakPoints.opponent.converted, set.breakPoints.opponent.opportunities)}</td>
            </tr>`,
        )
        .join('')
    : '';
  const breakPointDefenseRows = insights.sets.length
    ? insights.sets
        .map(
          (set) => `
            <tr>
              <td>Set ${set.setNumber}<span class="sub">${set.format === 'match_tiebreak' ? 'Excluded · match tie-break' : `${set.isComplete ? 'Complete' : 'In progress'} · ${set.breakPoints.tracked.faced + set.breakPoints.opponent.faced} faced`}</span></td>
              <td>${rate(set.breakPoints.tracked.saved, set.breakPoints.tracked.faced)}</td>
              <td>${rate(set.breakPoints.tracked.faced - set.breakPoints.tracked.saved, set.breakPoints.tracked.faced)}</td>
              <td>${rate(set.breakPoints.opponent.saved, set.breakPoints.opponent.faced)}</td>
              <td>${rate(set.breakPoints.opponent.faced - set.breakPoints.opponent.saved, set.breakPoints.opponent.faced)}</td>
            </tr>`,
        )
        .join('')
    : '';
  const matchBreakPoints = insights.breakPoints;
  const breakPointConversionMatchRow = `
    <tr class="total-row">
      <td>Match total<span class="sub">${matchBreakPoints.tracked.opportunities + matchBreakPoints.opponent.opportunities} chances · tie-break points excluded</span></td>
      <td>${rate(matchBreakPoints.tracked.converted, matchBreakPoints.tracked.opportunities)}</td>
      <td>${rate(matchBreakPoints.tracked.opportunities - matchBreakPoints.tracked.converted, matchBreakPoints.tracked.opportunities)}</td>
      <td>${rate(matchBreakPoints.opponent.converted, matchBreakPoints.opponent.opportunities)}</td>
      <td>${rate(matchBreakPoints.opponent.opportunities - matchBreakPoints.opponent.converted, matchBreakPoints.opponent.opportunities)}</td>
    </tr>`;
  const breakPointDefenseMatchRow = `
    <tr class="total-row">
      <td>Match total<span class="sub">${matchBreakPoints.tracked.faced + matchBreakPoints.opponent.faced} break points faced · tie-break points excluded</span></td>
      <td>${rate(matchBreakPoints.tracked.saved, matchBreakPoints.tracked.faced)}</td>
      <td>${rate(matchBreakPoints.tracked.faced - matchBreakPoints.tracked.saved, matchBreakPoints.tracked.faced)}</td>
      <td>${rate(matchBreakPoints.opponent.saved, matchBreakPoints.opponent.faced)}</td>
      <td>${rate(matchBreakPoints.opponent.faced - matchBreakPoints.opponent.saved, matchBreakPoints.opponent.faced)}</td>
    </tr>`;
  const taggedPercent = exactPercent(summary.taggedPointCount, insights.pointCount);
  const rallyWinnerRate =
    summary.rallyWinnerTagCount > 0
      ? rate(summary.rallyWinnerCount, insights.pointCount)
      : '—';
  const rallyWinnerDetail =
    summary.rallyWinnerTagCount > 0
      ? `${summary.rallyWinnerCount} tracked-player winner tags / ${insights.pointCount} points · aces excluded`
      : 'No rally-shot winner tags recorded; aces are excluded.';
  const unforcedErrorValue =
    summary.unforcedErrorTagCount > 0
      ? String(summary.trackedUnforcedErrors)
      : '—';
  const unforcedErrorDetail =
    summary.unforcedErrorTagCount > 0
      ? 'Net, long, and wide tags; double faults separate'
      : 'No unforced-error tags recorded.';
  const directionRows = contextRows(
    summary.shotDirections,
    'No tracked-player shot directions recorded.',
  );
  const rallyRows = contextRows(
    summary.rallyLengths,
    'No rally-length tags recorded.',
  );
  const contextSections =
    summary.shotDirectionTaggedCount === 0 &&
    summary.rallyLengthTaggedCount === 0
      ? '<p class="context-coverage">No shot-direction or rally-length tags were recorded. Add these optional tags during scoring to see their breakdowns.</p>'
      : `
        <h3>Tracked-player shot direction</h3>
        ${
          summary.shotDirectionTaggedCount === 0
            ? '<p class="context-coverage">No shot directions recorded.</p>'
            : `<p class="context-coverage">${summary.shotDirectionTaggedCount} of ${insights.pointCount} points tagged with direction</p>
               <table>
                 <thead><tr><th>Direction</th><th>Tagged points</th><th>Tracked-player point win rate</th></tr></thead>
                 <tbody>${directionRows}</tbody>
               </table>`
        }
        <h3>Rally length</h3>
        ${
          summary.rallyLengthTaggedCount === 0
            ? '<p class="context-coverage">No rally lengths recorded.</p>'
            : `<p class="context-coverage">${summary.rallyLengthTaggedCount} of ${insights.pointCount} points tagged with rally length</p>
               <table>
                 <thead><tr><th>Length (shots)</th><th>Tagged points</th><th>Tracked-player point win rate</th></tr></thead>
                 <tbody>${rallyRows}</tbody>
               </table>`
        }`;
  const pointsWonTile = rate(insights.trackedPointsWon, insights.pointCount);
  const serviceWonTile = rate(insights.servicePointsWon, insights.trackedServicePoints);
  const returnWonTile = rate(insights.returnPointsWon, insights.trackedReturnPoints);
  const event = match.event?.trim() || 'Match session';
  const round = match.round?.trim() || 'Not specified';
  const coach = match.chairCoach?.trim() || 'Not specified';
  const reportDate = formatReportDate(match.matchDate);
  const matchWinner = matchWinnerLabel(match, insights.sets);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tennis Match Report — ${escape(reportDate)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body { color: #183a30; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
      .report-page { padding: 14mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
      .eyebrow { color: #a45c45; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
      .report-title { color: #183a30; font-size: 23px; letter-spacing: -0.3px; margin: 5px 0 14px; }
      .match-heading { align-items: stretch; border-bottom: 1px solid #dcded4; display: grid; gap: 12px; grid-template-columns: 1fr auto 1fr; padding: 0 0 15px; }
      .player-block { background: #f2f1e9; border-radius: 8px; min-width: 0; padding: 12px; }
      .player-label { color: #60746c; font-size: 8px; font-weight: 700; letter-spacing: 1px; }
      .player-name { color: #183a30; font-size: 15px; line-height: 1.3; margin-top: 7px; overflow-wrap: anywhere; }
      .versus { align-self: center; color: #60746c; font-size: 11px; font-weight: 700; }
      .date-result { align-items: center; display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 12px 0 0; }
      .date-result-item { display: flex; flex-direction: column; gap: 4px; }
      .date-result-label { color: #60746c; font-size: 8px; font-weight: 700; letter-spacing: 1px; }
      .date-result-value { color: #183a30; font-size: 12px; font-weight: 700; }
      .meta { border-bottom: 1px solid #dcded4; color: #53685f; display: grid; font-size: 11px; gap: 8px 18px; grid-template-columns: 1fr 1fr; margin: 18px 0; padding-bottom: 16px; }
      .meta strong { color: #183a30; }
      h2 { break-after: avoid; page-break-after: avoid; font-size: 15px; margin: 22px 0 10px; }
      .stats { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
      .tile { background: #f2f1e9; border-radius: 8px; break-inside: avoid; padding: 11px; }
      .tile-label { color: #60746c; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
      .tile-value { color: #245d4b; font-size: 18px; font-weight: 700; margin: 5px 0 2px; }
      .tile-detail { color: #60746c; font-size: 9px; }
      .summary { background: #f2f1e9; border-left: 3px solid #245d4b; font-size: 11px; line-height: 1.5; padding: 10px 13px; }
      .feedback { background: #f2f1e9; border-left: 3px solid #a45c45; break-inside: auto; margin-top: 8px; padding: 8px 13px; page-break-inside: auto; }
      .feedback li { break-inside: avoid; font-size: 10px; line-height: 1.5; margin: 4px 0; page-break-inside: avoid; }
      .match-heading, .date-result, .meta, .stats, .summary { break-inside: avoid; page-break-inside: avoid; }
      p, li { orphans: 2; widows: 2; }
      table { border-collapse: collapse; break-inside: auto; font-size: 9px; width: 100%; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th { background: #245d4b; color: white; text-align: left; }
      th, td { border-bottom: 1px solid #dcded4; overflow-wrap: anywhere; padding: 7px 5px; vertical-align: top; }
      .code-key { font-size: 8px; }
      .code-key td:first-child { width: 18%; }
      .metric-table { font-size: 8px; table-layout: fixed; }
      .metric-table th, .metric-table td { overflow-wrap: anywhere; padding: 6px 4px; }
      .serve-table th:first-child, .serve-table td:first-child { width: 31%; }
      .serve-table th:nth-child(2), .serve-table td:nth-child(2),
      .serve-table th:nth-child(3), .serve-table td:nth-child(3) { width: 21%; }
      .serve-table th:nth-child(4), .serve-table td:nth-child(4) { width: 10%; }
      .serve-table th:nth-child(5), .serve-table td:nth-child(5) { width: 17%; }
      .return-table th:first-child, .return-table td:first-child { width: 42%; }
      .return-table th:nth-child(2), .return-table td:nth-child(2),
      .return-table th:nth-child(3), .return-table td:nth-child(3) { width: 29%; }
      .sub { color: #718078; display: block; font-size: 8px; margin-top: 3px; }
      .total-row { background: #f2f1e9; font-weight: 700; }
      .trend-note { background: #f7f4eb; border-radius: 6px; color: #53685f; font-size: 10px; line-height: 1.5; margin: 9px 0 0; padding: 9px 11px; }
      .note { break-inside: avoid; color: #718078; font-size: 8px; line-height: 1.5; margin-top: 8px; page-break-inside: avoid; }
      h3 { break-after: avoid; page-break-after: avoid; color: #183a30; font-size: 11px; margin: 14px 0 6px; }
      .context-coverage { color: #60746c; font-size: 9px; margin: 3px 0 7px; }
      .observation-group { break-inside: avoid; page-break-inside: avoid; }
      .observation-list { break-inside: auto; font-size: 9px; line-height: 1.5; margin: 5px 0 8px; page-break-inside: auto; padding-left: 18px; }
      .observation-list li { break-inside: avoid; page-break-inside: avoid; }
      @media print { html, body { margin: 0; } .report-page { padding: 14mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; } }
    </style>
  </head>
  <body>
    <main class="report-page">
    <div class="eyebrow">PLAYER DEVELOPMENT · LOCAL REPORT</div>
    <h1 class="report-title">Tennis Match Report</h1>
    <div class="match-heading">
      <div class="player-block">
        <div class="player-label">TRACKED PLAYER</div>
        <div class="player-name">${escape(match.trackedPlayer)}</div>
      </div>
      <div class="versus">VS</div>
      <div class="player-block">
        <div class="player-label">OPPONENT</div>
        <div class="player-name">${escape(match.opponent)}</div>
      </div>
    </div>
    <div class="date-result">
      <div class="date-result-item">
        <span class="date-result-label">MATCH DATE</span>
        <span class="date-result-value">${escape(reportDate)}</span>
      </div>
      <div class="date-result-item">
        <span class="date-result-label">MATCH RESULT</span>
        <span class="date-result-value">${escape(matchWinner)}</span>
      </div>
    </div>
    <div class="meta">
      <div><strong>Event:</strong> ${escape(event)}</div>
      <div><strong>Round:</strong> ${escape(round)}</div>
      <div><strong>Sets recorded:</strong> ${insights.sets.length}</div>
      <div><strong>Surface:</strong> ${escape(match.surface)}</div>
      <div><strong>Chair / coach:</strong> ${escape(coach)}</div>
      <div><strong>Status:</strong> ${match.matchStatus === 'complete' ? 'Complete' : 'In progress'}</div>
      <div><strong>Points logged:</strong> ${insights.pointCount}</div>
    </div>
    <p class="note">
      <strong>Report basis:</strong> Generated from saved match points. Rates include denominators; small samples are directional, not conclusions. Break-point counts are reconstructed from regular games; standard tie-break points and match tie-break sets are excluded. Any reference columns are user-entered preset values, not match results or live statistics.
    </p>

    ${includes('overview') ? `<h2>Match performance at a glance</h2>
    <div class="stats">
      <div class="tile">
        <div class="tile-label">POINTS WON</div>
        <div class="tile-value">${pointsWonTile}</div>
        <div class="tile-detail">Tracked-player points won</div>
      </div>
      <div class="tile">
        <div class="tile-label">SERVICE POINTS WON</div>
        <div class="tile-value">${serviceWonTile}</div>
        <div class="tile-detail">Tracked player serving</div>
      </div>
      <div class="tile">
        <div class="tile-label">RETURN POINTS WON</div>
        <div class="tile-value">${returnWonTile}</div>
        <div class="tile-detail">Tracked player returning</div>
      </div>
      <div class="tile">
        <div class="tile-label">ENDING TAG COVERAGE</div>
        <div class="tile-value">${taggedPercent}</div>
        <div class="tile-detail">${summary.taggedPointCount} of ${insights.pointCount} points tagged</div>
      </div>
      <div class="tile">
        <div class="tile-label">RALLY SHOT WINNERS</div>
        <div class="tile-value">${rallyWinnerRate}</div>
        <div class="tile-detail">${rallyWinnerDetail}</div>
      </div>
      <div class="tile">
        <div class="tile-label">UNFORCED ERRORS</div>
        <div class="tile-value">${unforcedErrorValue}</div>
        <div class="tile-detail">${unforcedErrorDetail}</div>
      </div>
    </div>

    <div class="summary" style="margin-top: 12px">
      <strong>Quick read:</strong>
      ${insights.pointCount === 0
        ? 'No points have been recorded yet, so performance percentages are not available.'
        : `${escape(match.trackedPlayer)} won ${rate(insights.trackedPointsWon, insights.pointCount)} of logged points. The serve rate was ${rate(insights.servicePointsWon, insights.trackedServicePoints)} and the return rate was ${rate(insights.returnPointsWon, insights.trackedReturnPoints)}.`}
    </div>` : ''}

    ${includes('serve') ? `<h2>Serve</h2>
    <table class="metric-table serve-table">
      <thead>
        <tr>
          <th>Stat</th>
          <th>${escape(match.trackedPlayer)} · match</th>
          <th>${escape(match.opponent)} · match</th>
          ${benchmarkHeaders}
        </tr>
      </thead>
      <tbody>${serveRows}</tbody>
    </table>
    <p class="context-coverage">
      Reference columns, when shown, contain user-entered saved preset values. They are not match results or live statistics. Service-game percentages use completed regular games; tie-breaks are excluded.
    </p>` : ''}

    ${includes('return') ? `<h2>Return</h2>
    <table class="metric-table return-table">
      <thead>
        <tr><th>Stat</th><th>${escape(match.trackedPlayer)} · match</th><th>${escape(match.opponent)} · match</th></tr>
      </thead>
      <tbody>${returnRows}</tbody>
    </table>` : ''}
    ${includes('sets') ? `
    <h2>Set scores and winners</h2>
    <table>
      <thead>
        <tr><th>Set</th><th>Score / format</th><th>Set winner</th></tr>
      </thead>
      <tbody>${setRows}</tbody>
    </table>` : ''}

    ${includes('break-points') ? `
    <h2>Break-point pressure</h2>
    <h3>Returning · opportunities created</h3>
    <table>
      <thead>
        <tr><th>Set</th><th>${escape(match.trackedPlayer)} converted</th><th>${escape(match.trackedPlayer)} missed</th><th>${escape(match.opponent)} converted</th><th>${escape(match.opponent)} missed</th></tr>
      </thead>
      <tbody>${breakPointConversionRows}${breakPointConversionMatchRow}</tbody>
    </table>
    <h3>Serving · break points faced</h3>
    <table>
      <thead>
        <tr><th>Set</th><th>${escape(match.trackedPlayer)} saved</th><th>${escape(match.trackedPlayer)} lost</th><th>${escape(match.opponent)} saved</th><th>${escape(match.opponent)} lost</th></tr>
      </thead>
      <tbody>${breakPointDefenseRows}${breakPointDefenseMatchRow}</tbody>
    </table>
    <p class="note" style="margin-top: 7px">Each value shows count/available chances and percentage. Missed = created opportunities not converted; lost = faced break points not saved. Repeated advantages in one game count separately. Tie-break points and match tie-break sets are excluded.</p>
    ` : ''}

    ${includes('coaching') ? `
    <h2>Coaching notes from this sample</h2>
    <ul class="feedback">${feedbackRows}</ul>
    ` : ''}

    ${includes('point-ending') ? `
    <h2>Shot and point-ending analysis</h2>
    <table>
      <thead>
        <tr><th>Tag</th><th>Point ending</th><th>Count</th><th>Tracked-player points won</th><th>Share of tags</th></tr>
      </thead>
      <tbody>${shotRows}</tbody>
    </table>
    <h3>Point code key</h3>
    <table class="code-key">
      <thead>
        <tr><th>Code</th><th>Full meaning</th></tr>
      </thead>
      <tbody>${codeLegendRows}</tbody>
    </table>
    ` : ''}
    ${includes('strokes') ? `
    <h2>Recorded stroke counts</h2>
    <p class="context-coverage">Only strokes explicitly recorded during point entry are counted. Each row’s total is the sample size for its in-play, error, and winner counts.</p>
    <table>
      <thead><tr><th>Player</th><th>Stroke type</th><th>In play</th><th>Errors</th><th>Winners</th><th>Total recorded</th></tr></thead>
      <tbody>${strokeTallyRows || '<tr><td colspan="6">No stroke entries recorded.</td></tr>'}</tbody>
    </table>
    ${strokeNoteRows ? `
      <h3>Point-level stroke notes</h3>
      <table>
        <thead><tr><th>Point</th><th>Player</th><th>Stroke</th><th>Result</th><th>Note</th></tr></thead>
        <tbody>${strokeNoteRows}</tbody>
      </table>` : ''}
    ` : ''}
    ${includes('observations') ? `
    <h2>Game and set observations</h2>
    ${setObservations}
    ` : ''}
    ${includes('tactical-context') ? `
    <h2>Tactical context</h2>
    <p class="context-coverage">
      Direction records the tracked player's last shot on a point. Rally length counts shots including the serve.
      A category's win rate is shown only after at least 3 tagged points.
    </p>
    ${contextSections}
    ` : ''}
    </main>
  </body>
</html>`;
}
