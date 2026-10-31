import {
  getSetWinner,
  type HeadToHeadReport,
} from '@/lib/head-to-head';
import {
  calculateBreakPointStats,
  getLocalPointHistory,
} from '@/lib/local-matches';
import { POINT_CODE_LABELS } from '@/lib/player-report-html';
import {
  getAnonymizedReportPlayerLabels,
  anonymizeReportPlayerNames,
  escapeReportHtml as escapeHtml,
} from '@/lib/report-html-utils';
import { formatPlayerMatchOutcomeSummary } from '@/lib/player-insights';
import type { LocalReportBenchmarkPreset } from '@/lib/local-benchmarks';
import {
  allHeadToHeadReportSections,
  type HeadToHeadReportSection,
} from '@/lib/report-sections';
import { buildReportReviewVersion } from '@/lib/report-review';

type HeadToHeadBenchmarkMetrics = Pick<
  LocalReportBenchmarkPreset,
  'firstServePointsWon' | 'secondServePointsWon' | 'serviceGamesWon'
>;

type HeadToHeadBenchmarkRevision = HeadToHeadBenchmarkMetrics &
  Pick<LocalReportBenchmarkPreset, 'id' | 'updatedAt'>;

export function buildHeadToHeadReportReviewVersion(
  reportVersion: string,
  selectedSections: readonly HeadToHeadReportSection[],
  benchmarks: readonly HeadToHeadBenchmarkRevision[],
  reportLabelVersion: string,
): string {
  if (!reportVersion) return '';
  const benchmarkVersion = JSON.stringify(
    benchmarks.map(
      ({
        id,
        updatedAt,
        firstServePointsWon,
        secondServePointsWon,
        serviceGamesWon,
      }) => ({
        id,
        updatedAt,
        firstServePointsWon,
        secondServePointsWon,
        serviceGamesWon,
      }),
    ),
  );
  return (
    buildReportReviewVersion(
      reportVersion,
      selectedSections,
      benchmarkVersion,
      reportLabelVersion,
    ) ?? ''
  );
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  const monthName = new Date(Date.UTC(year, month - 1, day)).toLocaleString(
    undefined,
    { month: 'long', timeZone: 'UTC' },
  );
  return `${monthName} ${day}, ${year}`;
}

function rate(wins: number, attempts: number): string {
  if (attempts <= 0) return '—';
  return `${wins}/${attempts} · ${((wins / attempts) * 100).toFixed(1)}%`;
}

function averageAces(aces: number, denominator: number, unit: string): string {
  if (denominator <= 0) return '—';
  return `${(aces / denominator).toFixed(2)} (${aces} aces / ${denominator} ${unit})`;
}

function setScore(set: HeadToHeadReport['meetings'][number]['summary']['setScores'][number]): string {
  if (set.format === 'match_tiebreak') {
    return `Set ${set.setNumber}: match tie-break ${set.trackedTiebreakPoints}–${set.opponentTiebreakPoints} (target ${set.tiebreakTarget}, win by 2)`;
  }
  const games = `${set.trackedGames}–${set.opponentGames}`;
  const tiebreak =
    set.trackedTiebreakPoints > 0 || set.opponentTiebreakPoints > 0
      ? ` (tie-break ${set.trackedTiebreakPoints}–${set.opponentTiebreakPoints})`
      : '';
  return `Set ${set.setNumber}: ${games}${tiebreak}`;
}

function setResult(
  set: HeadToHeadReport['meetings'][number]['summary']['setScores'][number],
  trackedPlayer: string,
  opponent: string,
): string {
  if (!set.isComplete) return 'In progress';
  const winner = getSetWinner(set);
  if (!winner) return 'Not determined';
  return winner === 'tracked' ? trackedPlayer : opponent;
}

function matchResult(
  report: HeadToHeadReport,
  winner: 'tracked' | 'opponent' | null,
  status: 'in_progress' | 'complete',
  outcome: { reason: 'retirement' | 'walkover'; winner: 'tracked' | 'opponent' } | null,
): string {
  if (status !== 'complete') return 'In progress';
  if (outcome) {
    const awardedWinner = outcome.winner === 'tracked' ? report.trackedPlayer : report.opponent;
    return `Winner by ${outcome.reason}: ${awardedWinner}`;
  }
  if (!winner) return 'Result not determined';
  return winner === 'tracked' ? report.trackedPlayer : report.opponent;
}

function tableRows(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) => {
      const [label, ...values] = row;
      return `
        <tr>
          <td>${escapeHtml(label ?? '')}</td>
          ${values.map((value) => `<td>${escapeHtml(value ?? '—')}</td>`).join('')}
        </tr>`;
    })
    .join('');
}

function breakPointMeetingTables(
  report: HeadToHeadReport,
  trackedPlayer: string,
  opponent: string,
): { coverageRows: string; resultRows: string; momentRows: string } {
  const coverageRows: string[] = [];
  const resultRows: string[] = [];
  const momentRows: string[] = [];

  report.meetings.forEach((meeting, meetingIndex) => {
    const meetingLabel =
      `Meeting ${meetingIndex + 1} · ${formatDate(meeting.summary.matchDate)}`;
    const match = meeting.match;
    if (!match) {
      coverageRows.push(`
        <tr>
          <td>${escapeHtml(meetingLabel)}</td>
          <td>No point log saved</td>
          <td>Unavailable — no point log</td>
        </tr>`);
      resultRows.push(`
        <tr>
          <td>${escapeHtml(meetingLabel)}</td>
          <td>No point log</td>
          <td>No point log</td>
          <td>No point log</td>
          <td>No point log</td>
        </tr>`);
      return;
    }

    const sets = [
      ...match.completedSets,
      {
        setNumber: match.setNumber,
        format: match.setFormat,
        points: match.points,
      },
    ];
    const savedPointCount = sets.reduce(
      (total, set) => total + set.points.length,
      0,
    );
    const pointStats = calculateBreakPointStats([], 'standard');
    for (const set of sets) {
      const setStats = calculateBreakPointStats(set.points, set.format);
      for (const side of ['tracked', 'opponent'] as const) {
        for (const metric of [
          'opportunities',
          'converted',
          'faced',
          'saved',
        ] as const) {
          pointStats[side][metric] += setStats[side][metric];
        }
      }
    }
    const meetingMomentRows = sets
      .flatMap((set) =>
        getLocalPointHistory(set.points, set.format, 'break_points')
          .reverse()
          .map(({ point, breakPointOutcome, breakPointScoreBefore }) => {
            if (!breakPointOutcome || !breakPointScoreBefore) return '';
            const outcome =
              breakPointOutcome === 'saved' ? 'Saved by' : 'Converted by';
            const pointWinner =
              point.winner === 'tracked' ? trackedPlayer : opponent;
            return `
              <tr>
                <td>${escapeHtml(meetingLabel)}</td>
                <td>Set ${set.setNumber}</td>
                <td>Game ${point.gameNumber}</td>
                <td>${point.sequenceNumber}</td>
                <td>${escapeHtml(breakPointScoreBefore.trackedScore)}</td>
                <td>${escapeHtml(breakPointScoreBefore.opponentScore)}</td>
                <td>${escapeHtml(`${outcome} ${pointWinner}`)}</td>
              </tr>`;
          }),
      )
      .filter(Boolean);
    const momentsFound =
      savedPointCount === 0
        ? 'Unavailable — no point log'
        : meetingMomentRows.length === 0
          ? 'None found in saved points'
          : `${meetingMomentRows.length} found`;

    coverageRows.push(`
      <tr>
        <td>${escapeHtml(meetingLabel)}</td>
        <td>${savedPointCount === 0 ? 'No point log saved' : `${savedPointCount} points saved`}</td>
        <td>${momentsFound}</td>
      </tr>`);
    const resultCell = (
      numerator: number,
      denominator: number,
    ): string => {
      if (savedPointCount === 0) return 'No point log';
      if (denominator === 0) return 'No chances';
      return `${numerator}/${denominator} · ${(
        (numerator / denominator) *
        100
      ).toFixed(1)}%`;
    };
    resultRows.push(`
      <tr>
        <td>${escapeHtml(meetingLabel)}</td>
        <td>${escapeHtml(resultCell(pointStats.tracked.converted, pointStats.tracked.opportunities))}</td>
        <td>${escapeHtml(resultCell(pointStats.tracked.saved, pointStats.tracked.faced))}</td>
        <td>${escapeHtml(resultCell(pointStats.opponent.converted, pointStats.opponent.opportunities))}</td>
        <td>${escapeHtml(resultCell(pointStats.opponent.saved, pointStats.opponent.faced))}</td>
      </tr>`);
    momentRows.push(...meetingMomentRows);
  });

  return {
    coverageRows: coverageRows.join(''),
    resultRows: resultRows.join(''),
    momentRows: momentRows.join(''),
  };
}

export function buildHeadToHeadReportHtml(
  report: HeadToHeadReport,
  selectedSections: readonly HeadToHeadReportSection[] =
    allHeadToHeadReportSections(),
  options: {
    hidePlayerNames?: boolean;
    labels?: { trackedPlayer: string; opponent: string };
    benchmarks?: readonly HeadToHeadBenchmarkMetrics[];
  } = {},
): string {
  const hidePlayerNames = options.hidePlayerNames ?? false;
  const anonymizedLabels = hidePlayerNames
    ? getAnonymizedReportPlayerLabels(
        report.trackedPlayer,
        report.opponent,
        options.labels,
      )
    : null;
  const trackedPlayer = anonymizedLabels?.trackedPlayer ?? report.trackedPlayer;
  const opponent = anonymizedLabels?.opponent ?? report.opponent;
  const displayReport = { ...report, trackedPlayer, opponent };
  const includes = (section: HeadToHeadReportSection) =>
    selectedSections.includes(section);
  const { insights } = report;
  const displayText = (value: string) =>
    hidePlayerNames
      ? anonymizeReportPlayerNames(value, report.trackedPlayer, report.opponent)
      : value;
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
  const benchmarks = options.benchmarks ?? [];
  const benchmarkHeaders = benchmarks
    .map((_, index) => `<th>User reference ${index + 1}</th>`)
    .join('');
  const noBenchmarkValues = benchmarks.map(() => '—');
  const benchmarkValues = (
    key: keyof HeadToHeadBenchmarkMetrics,
  ) =>
    benchmarks.map((benchmark) =>
      benchmark[key] === null ? '—' : `${benchmark[key]!.toFixed(1)}%`,
    );

  const serveRows = tableRows([
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
      'Service points won',
      rate(trackedServe.servicePointsWon, trackedServe.servicePoints),
      rate(opponentServe.servicePointsWon, opponentServe.servicePoints),
      ...noBenchmarkValues,
    ],
    [
      'Service games won',
      rate(insights.serviceGames.tracked.gamesWon, insights.serviceGames.tracked.gamesPlayed),
      rate(insights.serviceGames.opponent.gamesWon, insights.serviceGames.opponent.gamesPlayed),
      ...benchmarkValues('serviceGamesWon'),
    ],
    [
      'Aces tagged',
      `${trackedServe.aces} · ${trackedServe.servicePoints} service points`,
      `${opponentServe.aces} · ${opponentServe.servicePoints} service points`,
      ...noBenchmarkValues,
    ],
    [
      'Double faults tagged',
      `${trackedServe.doubleFaults} · ${trackedServe.servicePoints} service points`,
      `${opponentServe.doubleFaults} · ${opponentServe.servicePoints} service points`,
      ...noBenchmarkValues,
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
      averageAces(
        trackedServe.aces,
        report.performance.matchesInSample,
        'matches',
      ),
      averageAces(
        opponentServe.aces,
        report.performance.matchesInSample,
        'matches',
      ),
      ...noBenchmarkValues,
    ],
  ]);

  const returnRows = tableRows([
    [
      'Return points won',
      rate(trackedReturnWon, insights.trackedReturnPoints),
      rate(opponentReturnWon, trackedServe.servicePoints),
    ],
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
      'Return games won',
      rate(trackedReturnGamesWon, trackedReturnGamesPlayed),
      rate(opponentReturnGamesWon, opponentReturnGamesPlayed),
    ],
    [
      'Total points won',
      rate(insights.trackedPointsWon, insights.pointCount),
      rate(insights.opponentPointsWon, insights.pointCount),
    ],
    [
      'Rally-shot winner points',
      report.performance.rallyWinnerTagCount > 0
        ? rate(report.performance.rallyWinnerCount, insights.pointCount)
        : '—',
      report.performance.rallyWinnerTagCount > 0
        ? rate(report.performance.opponentRallyWinnerCount, insights.pointCount)
        : '—',
    ],
    [
      'Unforced errors',
      report.performance.unforcedErrorTagCount > 0
        ? `${report.performance.trackedUnforcedErrors} · ${insights.pointCount} recorded points`
        : '—',
      report.performance.unforcedErrorTagCount > 0
        ? `${report.performance.opponentUnforcedErrors} · ${insights.pointCount} recorded points`
        : '—',
    ],
  ]);

  const breakPointRows = tableRows([
    [
      'Break points converted',
      rate(
        insights.breakPoints.tracked.converted,
        insights.breakPoints.tracked.opportunities,
      ),
      rate(
        insights.breakPoints.opponent.converted,
        insights.breakPoints.opponent.opportunities,
      ),
    ],
    [
      'Break points missed',
      rate(
        insights.breakPoints.tracked.opportunities -
          insights.breakPoints.tracked.converted,
        insights.breakPoints.tracked.opportunities,
      ),
      rate(
        insights.breakPoints.opponent.opportunities -
          insights.breakPoints.opponent.converted,
        insights.breakPoints.opponent.opportunities,
      ),
    ],
    [
      'Break points saved',
      rate(insights.breakPoints.tracked.saved, insights.breakPoints.tracked.faced),
      rate(insights.breakPoints.opponent.saved, insights.breakPoints.opponent.faced),
    ],
    [
      'Break points lost while serving',
      rate(
        insights.breakPoints.tracked.faced - insights.breakPoints.tracked.saved,
        insights.breakPoints.tracked.faced,
      ),
      rate(
        insights.breakPoints.opponent.faced - insights.breakPoints.opponent.saved,
        insights.breakPoints.opponent.faced,
      ),
    ],
  ]);
  const personalBreakPoints = report.personalAverageInsights.breakPoints.tracked;
  const personalBreakPointRows = [
    [
      'Break points converted',
      rate(personalBreakPoints.converted, personalBreakPoints.opportunities),
    ],
    [
      'Break points missed',
      rate(
        personalBreakPoints.opportunities - personalBreakPoints.converted,
        personalBreakPoints.opportunities,
      ),
    ],
    [
      'Break points saved',
      rate(personalBreakPoints.saved, personalBreakPoints.faced),
    ],
    [
      'Break points lost while serving',
      rate(
        personalBreakPoints.faced - personalBreakPoints.saved,
        personalBreakPoints.faced,
      ),
    ],
  ]
    .map(
      ([label, average]) => `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td>${escapeHtml(average)}</td>
        </tr>`,
    )
    .join('');
  const personalAverageSurfaces =
    report.personalAverageBreakPointsBySurface;
  const personalAverageSurfaceRows = tableRows([
    [
      'Matches included',
      ...personalAverageSurfaces.map(({ matchCount }) => String(matchCount)),
    ],
    [
      'Break points converted',
      ...personalAverageSurfaces.map(({ breakPoints }) =>
        rate(breakPoints.converted, breakPoints.opportunities),
      ),
    ],
    [
      'Break points missed',
      ...personalAverageSurfaces.map(({ breakPoints }) =>
        rate(
          breakPoints.opportunities - breakPoints.converted,
          breakPoints.opportunities,
        ),
      ),
    ],
    [
      'Break points saved',
      ...personalAverageSurfaces.map(({ breakPoints }) =>
        rate(breakPoints.saved, breakPoints.faced),
      ),
    ],
    [
      'Break points lost while serving',
      ...personalAverageSurfaces.map(({ breakPoints }) =>
        rate(breakPoints.faced - breakPoints.saved, breakPoints.faced),
      ),
    ],
  ]);

  const matchRows = report.meetings
    .map((meeting) => {
      const summary = meeting.summary;
      const scores = summary.setScores.length
        ? summary.setScores
            .map(
              (set) =>
                `${escapeHtml(setScore(set))} — ${escapeHtml(
                  setResult(set, trackedPlayer, opponent),
                )}`,
            )
            .join('<br />')
        : 'No set score recorded';
      return `
        <tr>
          <td>${escapeHtml(formatDate(summary.matchDate))}</td>
          <td>${escapeHtml(matchResult(displayReport, summary.winner, summary.status, summary.matchOutcome))}</td>
          <td>${scores}</td>
          <td>${meeting.insights.pointCount}</td>
        </tr>`;
    })
    .join('');
  const breakPointTables = breakPointMeetingTables(
    report,
    trackedPlayer,
    opponent,
  );

  const latestMeeting = report.meetings[0];
  const latestMeetingScores = latestMeeting?.summary.setScores.length
    ? latestMeeting.summary.setScores
        .map(
          (set) =>
            `${setScore(set)} — ${setResult(set, trackedPlayer, opponent)}`,
        )
        .join(' · ')
    : 'No set score recorded';
  const latestMeetingResult = latestMeeting
    ? matchResult(
        displayReport,
        latestMeeting.summary.winner,
        latestMeeting.summary.status,
        latestMeeting.summary.matchOutcome,
      )
    : 'No meetings recorded';

  const tagRows = report.performance.codeInsights.length
    ? report.performance.codeInsights
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(POINT_CODE_LABELS[item.code])}</td>
              <td>${item.count}</td>
              <td>${rate(item.trackedWon, item.count)}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="3">No point-ending tags recorded.</td></tr>';

  const directionRows = report.performance.shotDirections
    .filter((item) => item.count > 0)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.count}</td>
          <td>${item.trackedWinPercent === null ? 'Need 3 tags' : rate(item.trackedWon, item.count)}</td>
        </tr>`,
    )
    .join('');
  const rallyRows = report.performance.rallyLengths
    .filter((item) => item.count > 0)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.count}</td>
          <td>${item.trackedWinPercent === null ? 'Need 3 tags' : rate(item.trackedWon, item.count)}</td>
        </tr>`,
    )
    .join('');
  const feedbackRows = report.performance.feedback
    .map((item) => `<li>${escapeHtml(displayText(item))}</li>`)
    .join('');
  const winsAndLosses =
    `${report.matchesWon}–${report.matchesLost}` +
    (report.completedMatchesWithoutWinner > 0
      ? ` · ${report.completedMatchesWithoutWinner} complete without a clear winner`
      : '');
  const matchOutcomeBreakdown = formatPlayerMatchOutcomeSummary(
    report.matchOutcomeTotals,
  );
  const setRecord =
    `${report.setsWon}–${report.setsLost}` +
    (report.completedSetsWithoutWinner > 0
      ? ` · ${report.completedSetsWithoutWinner} complete without a clear winner`
      : '');
  const contextTables = directionRows || rallyRows
    ? `
      <h2>Point context tags</h2>
      ${
        directionRows
          ? `<h3>Shot direction</h3><table><thead><tr><th>Direction</th><th>Tagged points</th><th>Tracked-player point wins</th></tr></thead><tbody>${directionRows}</tbody></table>`
          : '<p>No shot directions were recorded.</p>'
      }
      ${
        rallyRows
          ? `<h3>Rally length</h3><table><thead><tr><th>Length</th><th>Tagged points</th><th>Tracked-player point wins</th></tr></thead><tbody>${rallyRows}</tbody></table>`
          : '<p>No rally-length tags were recorded.</p>'
      }`
    : '<p class="note">No shot-direction or rally-length tags were recorded.</p>';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Head-to-Head Report — ${escapeHtml(trackedPlayer)} vs ${escapeHtml(opponent)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      body { color: #183a30; font-family: Arial, Helvetica, sans-serif; margin: 0; }
      main { padding: 14mm; }
      .eyebrow { color: #a45c45; font-size: 9px; font-weight: 700; letter-spacing: 1.8px; }
      h1 { font-size: 23px; margin: 7px 0 14px; }
      h2 { break-after: avoid; page-break-after: avoid; font-size: 14px; margin: 22px 0 9px; }
      h3 { break-after: avoid; page-break-after: avoid; font-size: 11px; margin: 13px 0 6px; }
      .pairing { background: #f2f1e9; border-radius: 8px; break-inside: avoid; display: grid; gap: 12px; grid-template-columns: 1fr auto 1fr; page-break-inside: avoid; padding: 12px; }
      .player-label { color: #60746c; font-size: 8px; font-weight: 700; letter-spacing: 1px; }
      .player-name { font-size: 14px; font-weight: 700; margin-top: 5px; overflow-wrap: anywhere; }
      .versus { align-self: center; color: #718078; font-size: 10px; font-weight: 700; }
      .cards { break-inside: avoid; display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); margin: 13px 0; page-break-inside: avoid; }
      .card { background: #f2f1e9; border-radius: 8px; break-inside: avoid; page-break-inside: avoid; padding: 10px; }
      .label { color: #60746c; font-size: 8px; font-weight: 700; letter-spacing: .7px; }
      .value { color: #245d4b; font-size: 16px; font-weight: 700; margin-top: 5px; }
      .sample { color: #60746c; font-size: 8px; line-height: 1.4; margin-top: 3px; }
      .latest-meeting { background: #fbfaf6; border: 1px solid #dcded4; border-radius: 7px; break-inside: avoid; margin: 0 0 12px; page-break-inside: avoid; padding: 9px 11px; }
      .latest-meeting-detail { color: #183a30; font-size: 9px; line-height: 1.45; margin-top: 4px; overflow-wrap: anywhere; }
      .note { color: #60746c; font-size: 9px; line-height: 1.5; }
      .feedback { background: #f2f1e9; border-left: 3px solid #a45c45; padding: 8px 12px; }
      .feedback li { font-size: 9px; line-height: 1.5; margin: 4px 0; }
      table { border-collapse: collapse; break-inside: auto; font-size: 8.5px; width: 100%; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th { background: #245d4b; color: #fff; text-align: left; }
      th, td { border-bottom: 1px solid #dcded4; overflow-wrap: anywhere; padding: 6px 5px; vertical-align: top; }
      th:first-child, td:first-child { width: 40%; }
      .matches-table th:first-child, .matches-table td:first-child { width: 18%; }
      .matches-table th:nth-child(2), .matches-table td:nth-child(2) { width: 21%; }
      .matches-table th:nth-child(3), .matches-table td:nth-child(3) { width: 46%; }
      .matches-table th:nth-child(4), .matches-table td:nth-child(4) { width: 15%; }
      .surface-break-point-table th:first-child, .surface-break-point-table td:first-child { width: 28%; }
      .surface-break-point-table th:not(:first-child), .surface-break-point-table td:not(:first-child) { text-align: center; }
      .surface-break-point-table th { font-size: 7.5px; padding-left: 3px; padding-right: 3px; }
      .surface-break-point-table td:not(:first-child) { white-space: nowrap; }
      .break-point-coverage-table { break-inside: auto; font-size: 8px; page-break-inside: auto; table-layout: fixed; }
      .break-point-coverage-table th:first-child, .break-point-coverage-table td:first-child { width: 32%; }
      .break-point-coverage-table th:nth-child(2), .break-point-coverage-table td:nth-child(2) { width: 29%; }
      .break-point-coverage-table th:nth-child(3), .break-point-coverage-table td:nth-child(3) { width: 39%; }
      .break-point-coverage-table tr { break-inside: avoid; page-break-inside: avoid; }
      .break-point-results-table { break-inside: auto; font-size: 7.5px; page-break-inside: auto; table-layout: fixed; }
      .break-point-results-table th:first-child, .break-point-results-table td:first-child { width: 20%; }
      .break-point-results-table th:not(:first-child), .break-point-results-table td:not(:first-child) { width: 20%; text-align: center; }
      .break-point-results-table thead { display: table-header-group; }
      .break-point-results-table tr { break-inside: avoid; page-break-inside: avoid; }
      .break-point-context-table { break-inside: auto; font-size: 8px; page-break-inside: auto; table-layout: fixed; }
      .break-point-context-table th:first-child, .break-point-context-table td:first-child { width: 23%; }
      .break-point-context-table th:nth-child(2), .break-point-context-table td:nth-child(2),
      .break-point-context-table th:nth-child(3), .break-point-context-table td:nth-child(3),
      .break-point-context-table th:nth-child(4), .break-point-context-table td:nth-child(4) { width: 8%; }
      .break-point-context-table th:nth-child(5), .break-point-context-table td:nth-child(5),
      .break-point-context-table th:nth-child(6), .break-point-context-table td:nth-child(6) { width: 16%; }
      .break-point-context-table th:nth-child(7), .break-point-context-table td:nth-child(7) { width: 21%; }
      .break-point-context-table thead { display: table-header-group; }
      .break-point-context-table tr { break-inside: avoid; page-break-inside: avoid; }
      @media print { html, body { margin: 0; } main { padding: 14mm; } }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">HEAD-TO-HEAD · MATCH ANALYSIS</div>
      <h1>Head-to-Head Report</h1>
      <div class="pairing">
        <div><div class="player-label">TRACKED PLAYER</div><div class="player-name">${escapeHtml(trackedPlayer)}</div></div>
        <div class="versus">VS</div>
        <div><div class="player-label">OPPONENT</div><div class="player-name">${escapeHtml(opponent)}</div></div>
      </div>
      ${includes('overview') ? `<div class="cards">
        <div class="card"><div class="label">MATCH RECORD</div><div class="value">${winsAndLosses}</div><div class="sample">${report.matchesRecorded} recorded · ${report.completedMatches} complete</div><div class="sample">${escapeHtml(matchOutcomeBreakdown)}</div></div>
        <div class="card"><div class="label">SET RECORD</div><div class="value">${setRecord}</div><div class="sample">${report.setsRecorded} recorded · ${report.completedSets} complete</div></div>
        <div class="card"><div class="label">POINTS WON</div><div class="value">${rate(insights.trackedPointsWon, insights.pointCount)}</div><div class="sample">${insights.pointCount} recorded points</div></div>
        <div class="card"><div class="label">IN PROGRESS</div><div class="value">${report.matchesInProgress}</div><div class="sample">not included in match W–L</div></div>
      </div>
      <div class="latest-meeting">
        <div class="label">${latestMeeting ? `LATEST MEETING · ${escapeHtml(formatDate(latestMeeting.summary.matchDate))}` : 'LATEST MEETING'}</div>
        <div class="latest-meeting-detail">${escapeHtml(latestMeetingResult)} · ${escapeHtml(latestMeetingScores)}</div>
      </div>
      ` : ''}
      <p class="note"><strong>Report basis:</strong> Only matches recorded with ${escapeHtml(trackedPlayer)} as the tracked player are included. Reverse-oriented records are excluded. Rates show wins and attempts; optional tags describe only what was entered and their absence does not mean an event did not occur. Coaching notes are based on this local sample, not outside player data.</p>

      ${includes('meetings') ? `
      <h2>Meetings and set scores</h2>
      <table class="matches-table">
        <thead><tr><th>Match date</th><th>Result</th><th>Set scores · tracked player first</th><th>Points logged</th></tr></thead>
        <tbody>${matchRows || '<tr><td colspan="4">No matches recorded.</td></tr>'}</tbody>
      </table>
      ` : ''}

      ${includes('serve') ? `
      <h2>Serve</h2>
      <table><thead><tr><th>Statistic</th><th>${escapeHtml(trackedPlayer)}</th><th>${escapeHtml(opponent)}</th>${benchmarkHeaders}</tr></thead><tbody>${serveRows}</tbody></table>
      ` : ''}
      ${includes('return-points') ? `
      <h2>Return and points</h2>
      <table><thead><tr><th>Statistic</th><th>${escapeHtml(trackedPlayer)}</th><th>${escapeHtml(opponent)}</th></tr></thead><tbody>${returnRows}</tbody></table>
      <p class="note">Rally-shot winner points use recorded forehand, backhand, volley, overhead, and drop-shot tags; aces are excluded. Unforced errors count tagged net, long, or wide errors that awarded the point to the opponent; forced errors and double faults are separate.</p>
      ` : ''}
      ${includes('break-points') ? `
      <h2>Break points</h2>
      <p class="note">“Missed” means a break-point opportunity was not converted. “Lost while serving” means a faced break point was not saved. Only recorded chances are included; tie-break points are excluded.</p>
      <table><thead><tr><th>Statistic</th><th>${escapeHtml(trackedPlayer)}</th><th>${escapeHtml(opponent)}</th></tr></thead><tbody>${breakPointRows}</tbody></table>
      <h3>${escapeHtml(trackedPlayer)} · personal average</h3>
      <p class="note">Pooled break-point chances across ${report.personalAverageMatches} saved ${report.personalAverageMatches === 1 ? 'match' : 'matches'} where this player was recorded as the tracked player, including this pairing when present.</p>
      <table><thead><tr><th>Statistic</th><th>Personal average</th></tr></thead><tbody>${personalBreakPointRows}</tbody></table>
      <h3>Personal break-point rates by court surface</h3>
      <p class="note">Each rate pools recorded chances from point-recorded matches on that surface. The match count is shown separately, and Other is included as its own group. Rates are unavailable where no chances were recorded.</p>
      <table class="surface-break-point-table">
        <thead><tr><th>Statistic</th>${personalAverageSurfaces.map(({ surface }) => `<th>${escapeHtml(surface)}</th>`).join('')}</tr></thead>
        <tbody>${personalAverageSurfaceRows}</tbody>
      </table>
      ` : ''}

      ${includes('break-point-context') ? `
      <h2>Break-point moments by meeting</h2>
      <p class="note"><strong>Point-log coverage by meeting.</strong> Counts use saved point records only and include tie-break points. “No point log saved” means there is no saved point sequence to assess; a moment not listed does not establish that no unrecorded chance occurred.</p>
      <table class="break-point-coverage-table">
        <thead><tr><th>Meeting</th><th>Saved point records</th><th>Break-point moments found</th></tr></thead>
        <tbody>${breakPointTables.coverageRows || '<tr><td colspan="3">No meetings are available.</td></tr>'}</tbody>
      </table>
      <p class="note">Each rate is successes/chances: returns show converted break points/opportunities, and serves show saved break points/faced chances. “No point log” and “No chances” are unavailable, not zero performance.</p>
      <table class="break-point-results-table">
        <thead>
          <tr><th rowspan="2">Meeting</th><th colspan="2">${escapeHtml(trackedPlayer)}</th><th colspan="2">${escapeHtml(opponent)}</th></tr>
          <tr><th>Return · converted / chances</th><th>Serve · saved / faced</th><th>Return · converted / chances</th><th>Serve · saved / faced</th></tr>
        </thead>
        <tbody>${breakPointTables.resultRows || '<tr><td colspan="5">No meetings are available.</td></tr>'}</tbody>
      </table>
      <p class="note">Meetings are listed newest first. Scores are the tracked player's and opponent's game scores immediately before each chance. Saved means the server won; converted means the returner won. Tie-break points are excluded from the break-point moments below.</p>
      <table class="break-point-context-table">
        <thead><tr><th>Meeting</th><th>Set</th><th>Game</th><th>Point</th><th>${escapeHtml(trackedPlayer)} score before</th><th>${escapeHtml(opponent)} score before</th><th>Outcome</th></tr></thead>
        <tbody>${breakPointTables.momentRows || '<tr><td colspan="7">No moments are available to list; see point-log coverage above.</td></tr>'}</tbody>
      </table>
      ` : ''}

      ${includes('point-ending') ? `
      <h2>Recorded point-ending tags</h2>
      <p class="note">${report.performance.taggedPointCount} of ${insights.pointCount} points had a tag. Each row shows the tracked player's wins among points with that tag.</p>
      <table><thead><tr><th>Tag</th><th>Occurrences</th><th>Tracked-player wins</th></tr></thead><tbody>${tagRows}</tbody></table>
      ` : ''}
      ${includes('point-context') ? `
      ${contextTables}
      ` : ''}

      ${includes('coaching') ? `
      <h2>Coaching observations</h2>
      <ul class="feedback">${feedbackRows || '<li>More recorded points and tags are needed for an evidence-based observation.</li>'}</ul>
      ` : ''}
      <p class="note">All figures were calculated on this device from the saved match records shown above.</p>
    </main>
  </body>
</html>`;
}
