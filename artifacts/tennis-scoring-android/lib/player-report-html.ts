import type { PointCode } from '@/lib/local-matches';
import type {
  ContextPerformanceInsight,
  PlayerPerformanceSummary,
  PlayerReportInsights,
} from '@/lib/player-insights';

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

const codeLabels: Record<PointCode, string> = {
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[character] ?? character;
  });
}

function exactPercent(numerator: number, denominator: number): string {
  return denominator === 0 ? '—' : `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function rate(numerator: number, denominator: number): string {
  return denominator === 0
    ? '—'
    : `${numerator}/${denominator} (${exactPercent(numerator, denominator)})`;
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

function setTrendNote(sets: PlayerReportInsights['sets']): string {
  const samples = sets
    .filter((set) => set.pointCount >= 5)
    .map((set) => ({
      set,
      percent: (set.trackedPointsWon / set.pointCount) * 100,
    }));
  if (samples.length < 2) return '';

  const best = [...samples].sort((a, b) => b.percent - a.percent)[0];
  const lowest = [...samples].sort((a, b) => a.percent - b.percent)[0];
  if (!best || !lowest) return '';

  const spread = Math.round(best.percent - lowest.percent);
  if (spread < 8) {
    return `<p class="trend-note">Point-win rates stayed within ${spread} percentage points across sets with at least five logged points.</p>`;
  }

  return `<p class="trend-note"><strong>Set-to-set shift:</strong> point-win rate was ${exactPercent(best.set.trackedPointsWon, best.set.pointCount)} in set ${best.set.setNumber} and ${exactPercent(lowest.set.trackedPointsWon, lowest.set.pointCount)} in set ${lowest.set.setNumber} (${spread} percentage-point difference). This is descriptive, not a prediction.</p>`;
}

export function buildPlayerReportHtml(
  match: ReportMatch,
  insights: PlayerReportInsights,
  summary: PlayerPerformanceSummary,
): string {
  const escape = escapeHtml;
  const shotRows = summary.codeInsights.length
    ? summary.codeInsights
        .map(
          (item) => `
            <tr>
              <td><strong>${escape(item.code)}</strong></td>
              <td>${escape(codeLabels[item.code])}</td>
              <td>${item.count}</td>
              <td>${rate(item.trackedWon, item.count)}</td>
              <td>${exactPercent(item.count, summary.taggedPointCount)}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="5">No shot or ending tags recorded.</td></tr>';
  const feedbackRows = summary.feedback
    .map((item) => `<li>${escape(item)}</li>`)
    .join('');
  const trackedServe = insights.serveStats.tracked;
  const opponentServe = insights.serveStats.opponent;
  const trackedReturnWon = insights.returnPointsWon;
  const opponentReturnWon =
    trackedServe.servicePoints - trackedServe.servicePointsWon;
  const serveRowsData: [string, number, number, number, number][] = [
    [
      'First serve in',
      trackedServe.firstServePoints,
      trackedServe.servicePoints,
      opponentServe.firstServePoints,
      opponentServe.servicePoints,
    ],
    [
      'First-serve points won',
      trackedServe.firstServePointsWon,
      trackedServe.firstServePoints,
      opponentServe.firstServePointsWon,
      opponentServe.firstServePoints,
    ],
    [
      'Second-serve points won',
      trackedServe.secondServePointsWon,
      trackedServe.secondServePoints,
      opponentServe.secondServePointsWon,
      opponentServe.secondServePoints,
    ],
    [
      'All service points won',
      trackedServe.servicePointsWon,
      trackedServe.servicePoints,
      opponentServe.servicePointsWon,
      opponentServe.servicePoints,
    ],
    [
      'Return points won',
      trackedReturnWon,
      insights.trackedReturnPoints,
      opponentReturnWon,
      trackedServe.servicePoints,
    ],
    [
      'First-serve faults',
      trackedServe.firstServeFaults,
      trackedServe.servicePoints,
      opponentServe.firstServeFaults,
      opponentServe.servicePoints,
    ],
  ];
  const serveCountRows = [
    { label: 'Aces', tracked: trackedServe.aces, opponent: opponentServe.aces },
    {
      label: 'Double faults',
      tracked: trackedServe.doubleFaults,
      opponent: opponentServe.doubleFaults,
    },
  ]
    .map(
      (item) => `
        <tr>
          <td>${item.label}</td>
          <td>${item.tracked}</td>
          <td>${item.opponent}</td>
        </tr>`,
    )
    .join('');
  const serveRows = serveRowsData
    .map(
      ([label, trackedWon, trackedTotal, opponentWon, opponentTotal]) => `
        <tr>
          <td>${label}</td>
          <td>${rate(trackedWon, trackedTotal)}</td>
          <td>${rate(opponentWon, opponentTotal)}</td>
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
              <td>${rate(set.trackedPointsWon, set.pointCount)}</td>
              <td>${rate(set.servicePointsWon, set.trackedServicePoints)}</td>
              <td>${rate(set.returnPointsWon, set.trackedReturnPoints)}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="5">No set data recorded.</td></tr>';
  const taggedPercent = exactPercent(summary.taggedPointCount, insights.pointCount);
  const directionRows = contextRows(
    summary.shotDirections,
    'No tracked-player shot directions recorded.',
  );
  const rallyRows = contextRows(
    summary.rallyLengths,
    'No rally-length tags recorded.',
  );
  const pointsWonTile = rate(insights.trackedPointsWon, insights.pointCount);
  const serviceWonTile = rate(insights.servicePointsWon, insights.trackedServicePoints);
  const returnWonTile = rate(insights.returnPointsWon, insights.trackedReturnPoints);
  const event = match.event?.trim() || 'Match session';
  const round = match.round?.trim() || 'Not specified';
  const coach = match.chairCoach?.trim() || 'Not specified';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(match.trackedPlayer)} — Tennis performance analysis</title>
    <style>
      @page { size: A4; margin: 15mm; }
      * { box-sizing: border-box; }
      body { color: #183a30; font-family: Arial, Helvetica, sans-serif; margin: 0; }
      .eyebrow { color: #a45c45; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
      h1 { font-size: 28px; margin: 8px 0 4px; }
      .versus { color: #60746c; font-size: 14px; margin: 0; }
      .meta { border-bottom: 1px solid #dcded4; color: #53685f; display: grid; font-size: 11px; gap: 8px 18px; grid-template-columns: 1fr 1fr; margin: 18px 0; padding-bottom: 16px; }
      .meta strong { color: #183a30; }
      h2 { break-after: avoid; font-size: 15px; margin: 22px 0 10px; }
      .stats { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
      .tile { background: #f2f1e9; border-radius: 8px; break-inside: avoid; padding: 11px; }
      .tile-label { color: #60746c; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
      .tile-value { color: #245d4b; font-size: 18px; font-weight: 700; margin: 5px 0 2px; }
      .tile-detail { color: #60746c; font-size: 9px; }
      .summary { background: #f2f1e9; border-left: 3px solid #245d4b; font-size: 11px; line-height: 1.5; padding: 10px 13px; }
      .feedback { background: #f2f1e9; border-left: 3px solid #a45c45; margin-top: 8px; padding: 8px 13px; }
      .feedback li { font-size: 10px; line-height: 1.5; margin: 4px 0; }
      table { border-collapse: collapse; break-inside: auto; font-size: 9px; width: 100%; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th { background: #245d4b; color: white; text-align: left; }
      th, td { border-bottom: 1px solid #dcded4; padding: 7px 5px; vertical-align: top; }
      .sub { color: #718078; display: block; font-size: 8px; margin-top: 3px; }
      .trend-note { background: #f7f4eb; border-radius: 6px; color: #53685f; font-size: 10px; line-height: 1.5; margin: 9px 0 0; padding: 9px 11px; }
      .note { color: #718078; font-size: 8px; line-height: 1.5; margin-top: 20px; }
      .note a { color: #245d4b; }
      h3 { break-after: avoid; color: #183a30; font-size: 11px; margin: 14px 0 6px; }
      .context-coverage { color: #60746c; font-size: 9px; margin: 3px 0 7px; }
    </style>
  </head>
  <body>
    <div class="eyebrow">TENNISSCORING · PLAYER PERFORMANCE ANALYSIS</div>
    <h1>${escape(match.trackedPlayer)}</h1>
    <p class="versus">vs ${escape(match.opponent)}</p>
    <div class="meta">
      <div><strong>Date:</strong> ${escape(match.matchDate)}</div>
      <div><strong>Event:</strong> ${escape(event)}</div>
      <div><strong>Round:</strong> ${escape(round)}</div>
      <div><strong>Sets recorded:</strong> ${insights.sets.length}</div>
      <div><strong>Surface:</strong> ${escape(match.surface)}</div>
      <div><strong>Chair / coach:</strong> ${escape(coach)}</div>
      <div><strong>Status:</strong> ${match.matchStatus === 'complete' ? 'Complete' : 'In progress'}</div>
      <div><strong>Points logged:</strong> ${insights.pointCount}</div>
    </div>

    <h2>Match performance at a glance</h2>
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
    </div>

    <div class="summary" style="margin-top: 12px">
      <strong>Quick read:</strong>
      ${insights.pointCount === 0
        ? 'No points have been recorded yet, so performance percentages are not available.'
        : `${escape(match.trackedPlayer)} won ${rate(insights.trackedPointsWon, insights.pointCount)} of logged points. The serve rate was ${rate(insights.servicePointsWon, insights.trackedServicePoints)} and the return rate was ${rate(insights.returnPointsWon, insights.trackedReturnPoints)}.`}
    </div>

    <h2>Serve and return comparison</h2>
    <table>
      <thead>
        <tr><th>Metric</th><th>${escape(match.trackedPlayer)}</th><th>${escape(match.opponent)}</th></tr>
      </thead>
      <tbody>${serveCountRows}${serveRows}</tbody>
    </table>
    ${setTrendNote(insights.sets)}

    <h2>Performance by set</h2>
    <table>
      <thead>
        <tr><th>Set</th><th>Score / format</th><th>Points won</th><th>Serve points</th><th>Return points</th></tr>
      </thead>
      <tbody>${setRows}</tbody>
    </table>

    <h2>Coaching notes from this sample</h2>
    <ul class="feedback">${feedbackRows}</ul>

    <h2>Shot and point-ending analysis</h2>
    <table>
      <thead>
        <tr><th>Tag</th><th>Point ending</th><th>Count</th><th>Tracked-player points won</th><th>Share of tags</th></tr>
      </thead>
      <tbody>${shotRows}</tbody>
    </table>
    <h2>Tactical context</h2>
    <p class="context-coverage">
      Direction records the tracked player's last shot on a point. Rally length counts shots including the serve.
      A category's win rate is shown only after at least 3 tagged points.
    </p>
    <h3>Tracked-player shot direction</h3>
    <p class="context-coverage">${summary.shotDirectionTaggedCount} of ${insights.pointCount} points tagged with direction</p>
    <table>
      <thead><tr><th>Direction</th><th>Tagged points</th><th>Tracked-player point win rate</th></tr></thead>
      <tbody>${directionRows}</tbody>
    </table>
    <h3>Rally length</h3>
    <p class="context-coverage">${summary.rallyLengthTaggedCount} of ${insights.pointCount} points tagged with rally length</p>
    <table>
      <thead><tr><th>Length (shots)</th><th>Tagged points</th><th>Tracked-player point win rate</th></tr></thead>
      <tbody>${rallyRows}</tbody>
    </table>
    <p class="note">
      Generated on this device from the saved point log. Rates show count/denominator and percentage; tagged-ending analysis only covers tagged points. Small samples are directional, not conclusions. Break-point statistics are omitted because the logger does not record point-level game score. Category layout references:
      <a href="https://www.atptour.com/en/scores/stats-centre/archive/2018/605/ms001">ATP Tour Stats Centre</a> and
      <a href="https://www.itftennis.com/en/match?matchId=faa89f46-3451-48b3-9fae-cba92da84cf6">ITF match statistics</a>.
      No online match data or tour-average benchmarks are used.
    </p>
  </body>
</html>`;
}
