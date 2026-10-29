import type { LocalInsights, LocalMatch, PointCode } from '@/lib/local-matches';
import type { PlayerPerformanceSummary } from '@/lib/player-insights';

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

function percent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export function buildPlayerReportHtml(
  match: LocalMatch,
  insights: LocalInsights,
  summary: PlayerPerformanceSummary,
): string {
  const escape = escapeHtml;
  const shotRows = summary.codeInsights.length
    ? summary.codeInsights
        .map(
          (item) => `
            <tr>
              <td>${escape(item.code)}</td>
              <td>${escape(codeLabels[item.code])}</td>
              <td>${item.count}</td>
              <td>${item.trackedWon} / ${item.count} (${item.trackedWinPercent}%)</td>
              <td>${item.sharePercent}%</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="5">No shot or ending tags recorded.</td></tr>';
  const feedbackRows = summary.feedback
    .map((item) => `<li>${escape(item)}</li>`)
    .join('');
  const event = match.event?.trim() || 'Match session';
  const round = match.round?.trim() || 'Not specified';
  const coach = match.chairCoach?.trim() || 'Not specified';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(match.trackedPlayer)} — Tennis report</title>
    <style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { color: #183a30; font-family: Arial, Helvetica, sans-serif; margin: 0; }
      .eyebrow { color: #a45c45; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
      h1 { font-size: 28px; margin: 8px 0 4px; }
      .versus { color: #60746c; font-size: 14px; margin: 0; }
      .meta { border-bottom: 1px solid #dcded4; color: #53685f; display: grid; font-size: 11px; gap: 8px 18px; grid-template-columns: 1fr 1fr; margin: 18px 0; padding-bottom: 16px; }
      .meta strong { color: #183a30; }
      h2 { font-size: 15px; margin: 22px 0 10px; }
      .stats { display: grid; gap: 9px; grid-template-columns: 1fr 1fr; }
      .tile { background: #f2f1e9; border-radius: 8px; padding: 12px; }
      .tile-label { color: #60746c; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
      .tile-value { color: #245d4b; font-size: 22px; font-weight: 700; margin: 5px 0 2px; }
      .tile-detail { color: #60746c; font-size: 10px; }
      .feedback { background: #f2f1e9; border-left: 3px solid #245d4b; padding: 10px 14px; }
      .feedback li { font-size: 11px; line-height: 1.55; margin: 5px 0; }
      table { border-collapse: collapse; font-size: 10px; width: 100%; }
      th { background: #245d4b; color: white; text-align: left; }
      th, td { border-bottom: 1px solid #dcded4; padding: 8px 6px; }
      .note { color: #718078; font-size: 9px; line-height: 1.45; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="eyebrow">TENNISSCORING · PLAYER REPORT</div>
    <h1>${escape(match.trackedPlayer)}</h1>
    <p class="versus">vs ${escape(match.opponent)}</p>
    <div class="meta">
      <div><strong>Date:</strong> ${escape(match.matchDate)}</div>
      <div><strong>Event:</strong> ${escape(event)}</div>
      <div><strong>Round:</strong> ${escape(round)}</div>
      <div><strong>Set:</strong> ${match.setNumber}</div>
      <div><strong>Surface:</strong> ${escape(match.surface)}</div>
      <div><strong>Chair / coach:</strong> ${escape(coach)}</div>
      <div><strong>Score:</strong> ${match.score.trackedGames}–${match.score.opponentGames}</div>
      <div><strong>Recorded points:</strong> ${insights.pointCount}</div>
    </div>

    <h2>Performance percentages</h2>
    <div class="stats">
      <div class="tile">
        <div class="tile-label">POINTS WON</div>
        <div class="tile-value">${percent(summary.overallWinPercent)}</div>
        <div class="tile-detail">${insights.trackedPointsWon} of ${insights.pointCount} recorded points</div>
      </div>
      <div class="tile">
        <div class="tile-label">SERVE WIN RATE</div>
        <div class="tile-value">${percent(summary.serviceWinPercent)}</div>
        <div class="tile-detail">${insights.servicePointsWon} of ${insights.trackedServicePoints} tracked-player service points</div>
      </div>
      <div class="tile">
        <div class="tile-label">RETURN WIN RATE</div>
        <div class="tile-value">${percent(summary.returnWinPercent)}</div>
        <div class="tile-detail">${insights.returnPointsWon} of ${insights.trackedReturnPoints} tracked-player return points</div>
      </div>
      <div class="tile">
        <div class="tile-label">FIRST-SERVE FAULT RATE</div>
        <div class="tile-value">${percent(summary.firstServeFaultPercent)}</div>
        <div class="tile-detail">${insights.trackedFirstServeFaults} marked faults across ${insights.trackedServicePoints} tracked-player service points</div>
      </div>
    </div>

    <h2>Feedback</h2>
    <ul class="feedback">${feedbackRows}</ul>

    <h2>Shot and point-ending percentages</h2>
    <table>
      <thead>
        <tr><th>Code</th><th>Ending</th><th>Tags</th><th>Tracked-player wins</th><th>Share</th></tr>
      </thead>
      <tbody>${shotRows}</tbody>
    </table>
    <p class="note">This report is generated on this device from the recorded points and tags. Percentages describe this match only; small samples should be treated as directional feedback.</p>
  </body>
</html>`;
}
