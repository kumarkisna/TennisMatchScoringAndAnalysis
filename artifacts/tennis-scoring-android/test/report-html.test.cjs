const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const storageValues = new Map();
const asyncStorage = {
  async getItem(key) {
    return storageValues.has(key) ? storageValues.get(key) : null;
  },
  async setItem(key, value) {
    storageValues.set(key, String(value));
  },
  async removeItem(key) {
    storageValues.delete(key);
  },
  async multiSet(entries) {
    for (const [key, value] of entries) storageValues.set(key, String(value));
  },
  async multiGet(keys) {
    return keys.map((key) => [
      key,
      storageValues.has(key) ? storageValues.get(key) : null,
    ]);
  },
};

const strokeOptions = [
  { value: 'first_serve', label: 'First serve' },
];
const originalLoad = Module._load;
let playerReportExports;
let localMatchExports;
let playerInsightsExports;
let headToHeadExports;

Module._load = function (request, parent, isMain) {
  if (request === '@/lib/local-matches') {
    return localMatchExports ?? { STROKE_TYPE_OPTIONS: strokeOptions };
  }
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: asyncStorage, ...asyncStorage };
  }
  if (request === '@/lib/head-to-head') {
    return headToHeadExports ?? { getSetWinner: () => null };
  }
  if (request === '@/lib/player-insights') {
    return playerInsightsExports;
  }
  if (request === '@/lib/report-html-utils') {
    return originalLoad.call(
      this,
      path.join(__dirname, '../lib/report-html-utils.ts'),
      parent,
      isMain,
    );
  }
  if (request === '@/lib/report-sections') {
    return originalLoad.call(
      this,
      path.join(__dirname, '../lib/report-sections.ts'),
      parent,
      isMain,
    );
  }
  if (request === '@/lib/player-report-html') {
    return playerReportExports;
  }
  return originalLoad.call(this, request, parent, isMain);
};

require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  module._compile(outputText, filename);
};

localMatchExports = require('../lib/local-matches.ts');
playerReportExports = require('../lib/player-report-html.ts');
playerInsightsExports = require('../lib/player-insights.ts');
headToHeadExports = require('../lib/head-to-head.ts');
const { buildPlayerReportHtml } = playerReportExports;
const {
  buildHeadToHeadReportHtml,
  buildHeadToHeadReportReviewVersion,
} = require('../lib/head-to-head-report-html.ts');
const { summarizePlayerPerformance } = playerInsightsExports;
const { buildHeadToHeadReport, getHeadToHeadOpponentOptions } = headToHeadExports;
Module._load = originalLoad;
const { createAndPreviewLocalPdf } = require('../lib/report-pdf.ts');
const {
  calculateBreakPointStats,
  calculateLocalInsights,
  createLocalMatch,
  deleteLocalMatch,
  editLocalPointWinner,
  getLocalInsights,
  getLocalMatch,
  getBreakPointPointOutcomes,
  getLocalPointHistory,
  listLocalMatches,
  recordLocalPoint,
  undoLocalPoint,
} = localMatchExports;
const {
  allHeadToHeadReportSections,
  allPlayerReportSections,
  HEAD_TO_HEAD_REPORT_SECTION_PRESETS,
  PLAYER_REPORT_SECTION_PRESETS,
} = require('../lib/report-sections.ts');

test('report layouts provide overview, statistics, and full presets for both report types', () => {
  const expectedLabels = ['Overview only', 'Statistics', 'Full report'];
  assert.deepEqual(
    PLAYER_REPORT_SECTION_PRESETS.map(({ label }) => label),
    expectedLabels,
  );
  assert.deepEqual(
    HEAD_TO_HEAD_REPORT_SECTION_PRESETS.map(({ label }) => label),
    expectedLabels,
  );

  assert.deepEqual(PLAYER_REPORT_SECTION_PRESETS[0].sections, ['overview']);
  assert.deepEqual(PLAYER_REPORT_SECTION_PRESETS[1].sections, [
    'overview',
    'serve',
    'return',
    'sets',
    'break-points',
  ]);
  assert.deepEqual(
    PLAYER_REPORT_SECTION_PRESETS[2].sections,
    allPlayerReportSections(),
  );

  assert.deepEqual(HEAD_TO_HEAD_REPORT_SECTION_PRESETS[0].sections, ['overview']);
  assert.deepEqual(HEAD_TO_HEAD_REPORT_SECTION_PRESETS[1].sections, [
    'overview',
    'meetings',
    'serve',
    'return-points',
    'break-points',
  ]);
  assert.deepEqual(
    HEAD_TO_HEAD_REPORT_SECTION_PRESETS[2].sections,
    allHeadToHeadReportSections(),
  );
});

const emptySide = {
  servicePoints: 4,
  servicePointsWon: 3,
  firstServeFaults: 0,
  firstServePoints: 3,
  firstServePointsWon: 2,
  secondServePoints: 1,
  secondServePointsWon: 1,
  aces: 1,
  doubleFaults: 0,
};
const emptyBreakPoints = {
  opportunities: 0,
  converted: 0,
  faced: 0,
  saved: 0,
};
const emptyInsight = {
  pointCount: 4,
  trackedPointsWon: 3,
  opponentPointsWon: 1,
  servicePointsWon: 2,
  trackedServicePoints: 3,
  returnPointsWon: 1,
  trackedReturnPoints: 1,
  trackedFirstServeFaults: 0,
  trackedPoints: 3,
  codes: [],
  serveStats: { tracked: { ...emptySide }, opponent: { ...emptySide } },
  breakPoints: {
    tracked: { ...emptyBreakPoints },
    opponent: { ...emptyBreakPoints },
  },
  serviceGames: {
    tracked: { gamesPlayed: 1, gamesWon: 1 },
    opponent: { gamesPlayed: 1, gamesWon: 0 },
  },
  shotDirections: [],
  rallyLengths: [],
  sets: [],
  strokeTallies: [],
  strokeNotes: [],
};
const emptyPerformance = {
  taggedPointCount: 0,
  codeInsights: [],
  shotDirections: [],
  rallyLengths: [],
  feedback: ['Strong serve. https://coaching.example.com/private'],
  rallyWinnerCount: 0,
  rallyWinnerTagCount: 0,
  trackedUnforcedErrors: 0,
  opponentUnforcedErrors: 0,
  unforcedErrorTagCount: 0,
  opponentRallyWinnerCount: 0,
  shotDirectionTaggedCount: 0,
  rallyLengthTaggedCount: 0,
};

function assertCleanReport(html) {
  assert.doesNotMatch(html, /\b(?:https?:\/\/|ftp:\/\/|www\.)/i);
  assert.doesNotMatch(html, /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|test)\b/i);
  assert.doesNotMatch(html, /\b(?:Replit|TennisScoring)\b/i);
  assert.doesNotMatch(html, /<a\b|\bhref\s*=/i);
  assert.match(html, /@page\s*\{[^}]*margin:\s*0/);
  assert.match(html, /thead\s*\{\s*display:\s*table-header-group;/);
  assert.match(html, /break-inside:\s*avoid/);
}

function pointFixture(
  setNumber,
  gameNumber,
  server,
  winner,
  isTiebreak,
  sequenceNumber,
) {
  return {
    id: `set-${setNumber}-point-${sequenceNumber}`,
    sequenceNumber,
    setNumber,
    gameNumber,
    server,
    isTiebreak,
    winner,
    endingCode: null,
    firstServeFault: false,
    syncStatus: 'synced',
    createdAt: '2026-10-30T00:00:00.000Z',
  };
}

function gamePoints(setNumber, gameNumber, server, winners, isTiebreak = false, startAt = 1) {
  return winners.map((winner, index) =>
    pointFixture(
      setNumber,
      gameNumber,
      server,
      winner,
      isTiebreak,
      startAt + index,
    ),
  );
}

function taggedGamePoints(setNumber, gameNumber, server, points, startAt = 1) {
  return points.map(({ winner, endingCode = null, firstServeFault = false }, index) => ({
    ...pointFixture(
      setNumber,
      gameNumber,
      server,
      winner,
      false,
      startAt + index,
    ),
    endingCode,
    firstServeFault,
  }));
}

function setFixture(setNumber, format, points) {
  const score = {
    trackedGames: format === 'standard' ? 6 : 0,
    opponentGames: format === 'standard' ? 4 : 0,
    trackedPoints: '0',
    opponentPoints: '0',
    trackedTiebreakPoints: 0,
    opponentTiebreakPoints: 0,
    nextServer: 'tracked',
    isTiebreak: false,
    isComplete: true,
    winner: 'tracked',
  };
  const review = {
    strokeRatings: {},
    strokeNotes: {},
    footworkNote: '',
    tacticalNote: '',
    mentalNote: '',
  };
  return {
    setNumber,
    firstServer: 'tracked',
    format,
    tiebreakTarget: format === 'match_tiebreak' ? 7 : 10,
    score,
    points,
    gameNotes: [],
    review,
  };
}

function performanceSampleMatch() {
  const points = [
    ...taggedGamePoints(1, 1, 'tracked', [
      { winner: 'tracked', endingCode: 'F', firstServeFault: true },
      { winner: 'tracked', endingCode: 'A' },
      { winner: 'opponent', endingCode: 'N' },
      { winner: 'tracked', endingCode: 'B' },
      { winner: 'tracked' },
      { winner: 'opponent' },
    ]),
    ...taggedGamePoints(1, 2, 'opponent', [
      { winner: 'opponent', endingCode: 'F' },
      { winner: 'opponent', endingCode: 'A' },
      { winner: 'tracked', endingCode: 'D' },
      { winner: 'opponent' },
      { winner: 'opponent' },
      { winner: 'tracked' },
    ], 7),
    ...taggedGamePoints(1, 3, 'tracked', [
      { winner: 'tracked', endingCode: 'V' },
      { winner: 'tracked', endingCode: 'O' },
      { winner: 'opponent', endingCode: 'D' },
      { winner: 'tracked', endingCode: 'P' },
      { winner: 'tracked' },
      { winner: 'opponent' },
    ], 13),
    ...taggedGamePoints(1, 4, 'opponent', [
      { winner: 'opponent', firstServeFault: true },
      { winner: 'tracked', endingCode: 'W' },
      { winner: 'opponent', endingCode: 'L' },
      { winner: 'opponent', endingCode: 'A' },
      { winner: 'tracked' },
      { winner: 'opponent' },
    ], 19),
  ];
  const set = setFixture(1, 'standard', points);
  return {
    id: 'player-performance-sample',
    ownerUserId: null,
    matchDate: '2026-10-30',
    event: null,
    round: null,
    trackedPlayer: 'Tracked',
    trackedPlayerId: null,
    opponent: 'Opponent',
    opponentPlayerId: null,
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
    setFormat: 'standard',
    tiebreakTarget: 10,
    completedSets: [],
    matchStatus: 'complete',
    status: 'complete',
    score: set.score,
    points,
    gameNotes: [],
    review: set.review,
  };
}

function breakPointSampleMatch() {
  const savedZeroForty = gamePoints(
    1,
    1,
    'tracked',
    ['opponent', 'opponent', 'opponent', 'tracked', 'tracked', 'tracked', 'tracked', 'tracked'],
  );
  const repeatedAdvantageChances = gamePoints(
    1,
    2,
    'opponent',
    [
      'opponent',
      'tracked',
      'opponent',
      'tracked',
      'opponent',
      'tracked',
      'tracked',
      'opponent',
      'tracked',
      'tracked',
    ],
    false,
    9,
  );
  const standardTiebreakPoints = gamePoints(
    1,
    7,
    'tracked',
    ['opponent', 'opponent', 'opponent', 'opponent'],
    true,
    19,
  );
  const setOne = setFixture(1, 'standard', [
    ...savedZeroForty,
    ...standardTiebreakPoints,
    ...repeatedAdvantageChances,
  ]);
  const setTwo = setFixture(
    2,
    'standard',
    gamePoints(2, 1, 'opponent', ['tracked', 'tracked', 'tracked', 'tracked']),
  );
  const matchTiebreakSet = setFixture(
    3,
    'match_tiebreak',
    gamePoints(3, 1, 'opponent', ['tracked', 'tracked', 'tracked', 'tracked'], true),
  );

  return {
    match: {
      id: 'break-point-sample',
      ownerUserId: null,
      matchDate: '2026-10-30',
      event: 'Test match',
      round: 'Final',
      setNumber: matchTiebreakSet.setNumber,
      trackedPlayer: 'Tracked',
      trackedPlayerId: null,
      opponent: 'Opponent',
      opponentPlayerId: null,
      chairCoach: null,
      surface: 'Hard',
      firstServer: matchTiebreakSet.firstServer,
      setFormat: matchTiebreakSet.format,
      tiebreakTarget: matchTiebreakSet.tiebreakTarget,
      completedSets: [setOne, setTwo],
      matchStatus: 'complete',
      status: 'complete',
      syncStatus: 'local_only',
      syncToken: null,
      remoteMatchId: null,
      pendingPointDeletes: [],
      syncError: null,
      score: matchTiebreakSet.score,
      points: matchTiebreakSet.points,
      gameNotes: [],
      review: matchTiebreakSet.review,
      createdAt: '2026-10-30T00:00:00.000Z',
      updatedAt: '2026-10-30T00:00:00.000Z',
    },
    savedZeroForty,
    repeatedAdvantageChances,
    standardTiebreakPoints,
  };
}

function reportRows(html, heading) {
  const start = html.indexOf(`<h3>${heading}</h3>`);
  assert.notEqual(start, -1, `Missing report subsection: ${heading}`);
  const tableStart = html.indexOf('<tbody>', start) + '<tbody>'.length;
  const tableEnd = html.indexOf('</tbody>', tableStart);
  return [...html.slice(tableStart, tableEnd).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((match) => match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function reportRowsAfterHeading(html, heading) {
  const start = html.indexOf(`<h2>${heading}</h2>`);
  assert.notEqual(start, -1, `Missing report section: ${heading}`);
  const tableStart = html.indexOf('<tbody>', start) + '<tbody>'.length;
  const tableEnd = html.indexOf('</tbody>', tableStart);
  return [...html.slice(tableStart, tableEnd).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((match) => match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function headToHeadReportFixture(insights, performance, matchesRecorded = 1) {
  return {
    trackedPlayer: 'Tracked',
    opponent: 'Opponent',
    meetings: [],
    matchesRecorded,
    completedMatches: matchesRecorded,
    matchesWon: matchesRecorded > 0 ? 1 : 0,
    matchesLost: 0,
    completedMatchesWithoutWinner: 0,
    matchesInProgress: 0,
    setsRecorded: matchesRecorded,
    completedSets: matchesRecorded,
    setsWon: matchesRecorded,
    setsLost: 0,
    completedSetsWithoutWinner: 0,
    insights,
    performance,
    personalAverageInsights: insights,
    personalAveragePerformance: performance,
    personalAverageMatches: matchesRecorded,
  };
}

async function createSavedPointReportFixture() {
  const match = await createLocalMatch({
    matchDate: '2026-10-30',
    event: 'Saved-point report check',
    round: 'Final',
    trackedPlayer: 'Tracked',
    opponent: 'Opponent',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  const inputs = [
    { winner: 'opponent' },
    { winner: 'tracked', endingCode: 'A' },
    { winner: 'tracked', endingCode: 'F' },
    { winner: 'opponent', endingCode: 'N' },
    { winner: 'opponent', firstServeFault: true },
    { winner: 'opponent' },
    { winner: 'tracked' },
    { winner: 'opponent' },
    { winner: 'tracked' },
    { winner: 'opponent' },
    { winner: 'tracked', firstServeFault: true },
    { winner: 'opponent' },
    { winner: 'opponent', endingCode: 'A' },
    { winner: 'opponent' },
  ];

  let savedMatch = match;
  for (const input of inputs) {
    savedMatch = await recordLocalPoint(match.id, input);
  }

  return {
    matchId: match.id,
    rallyPointId: savedMatch.points[2].id,
    errorPointId: savedMatch.points[3].id,
  };
}

async function buildSavedPointReportSnapshot(matchId) {
  const match = await getLocalMatch(matchId);
  assert.ok(match, 'Expected the corrected match to remain saved locally');
  const insights = calculateLocalInsights(match);
  const performance = summarizePlayerPerformance(insights, 1);
  const playerHtml = buildPlayerReportHtml(match, insights, performance);
  const summary = (await listLocalMatches()).find(({ id }) => id === matchId);
  assert.ok(summary, 'Expected a match-book entry for the saved match');
  const meeting = { summary, insights };
  const headToHeadReport = buildHeadToHeadReport(
    match.trackedPlayer,
    match.opponent,
    [meeting],
  );

  return {
    insights,
    performance,
    playerHtml,
    headToHeadHtml: buildHeadToHeadReportHtml(headToHeadReport),
  };
}

function assertServeMetricInBothReports(
  snapshot,
  label,
  playerValue,
  headToHeadValue = playerValue,
  playerOpponentValue,
  headToHeadOpponentValue = playerOpponentValue,
) {
  for (const [html, expected, expectedOpponent] of [
    [snapshot.playerHtml, playerValue, playerOpponentValue],
    [snapshot.headToHeadHtml, headToHeadValue, headToHeadOpponentValue],
  ]) {
    const row = reportRowsAfterHeading(html, 'Serve').find((item) =>
      item.startsWith(label),
    );
    assert.ok(row, `Missing ${label} row`);
    assert.ok(
      row.startsWith(`${label} ${expected}`),
      `Expected ${label} to begin with "${expected}", received "${row}"`,
    );
    if (expectedOpponent !== undefined) {
      assert.ok(
        row.endsWith(expectedOpponent),
        `Expected ${label} to end with "${expectedOpponent}", received "${row}"`,
      );
    }
  }
}

function assertPointAnalysisInBothReports(
  snapshot,
  {
    rallyTile,
    rallyTracked,
    rallyOpponent,
    errorTile,
    errorTracked,
    errorOpponent,
    pointCount,
  },
) {
  const rallyTileStart = snapshot.playerHtml.indexOf('RALLY SHOT WINNERS');
  const errorTileStart = snapshot.playerHtml.indexOf('UNFORCED ERRORS');
  assert.notEqual(rallyTileStart, -1, 'Missing player rally-winner tile');
  assert.notEqual(errorTileStart, -1, 'Missing player unforced-error tile');
  assert.ok(
    snapshot.playerHtml
      .slice(rallyTileStart, rallyTileStart + 300)
      .includes(`<div class="tile-value">${rallyTile}</div>`),
    `Unexpected player rally-winner tile: ${rallyTile}`,
  );
  assert.ok(
    snapshot.playerHtml
      .slice(errorTileStart, errorTileStart + 300)
      .includes(`<div class="tile-value">${errorTile}</div>`),
    `Unexpected player unforced-error tile: ${errorTile}`,
  );

  const pointRows = reportRowsAfterHeading(
    snapshot.headToHeadHtml,
    'Return and points',
  );
  const rallyRow = pointRows.find((row) =>
    row.startsWith('Rally-shot winner points'),
  );
  const errorRow = pointRows.find((row) => row.startsWith('Unforced errors'));
  assert.ok(rallyRow, 'Missing head-to-head rally-winner row');
  assert.ok(errorRow, 'Missing head-to-head unforced-error row');
  assert.ok(
    rallyRow.startsWith(
      `Rally-shot winner points ${rallyTracked} ${rallyOpponent}`,
    ),
    `Unexpected head-to-head rally-winner row: ${rallyRow}`,
  );
  assert.ok(
    errorRow.startsWith(
      `Unforced errors ${errorTracked} ${errorOpponent}`,
    ),
    `Unexpected head-to-head unforced-error row: ${errorRow}`,
  );

  if (pointCount !== undefined) {
    assert.equal(snapshot.insights.pointCount, pointCount);
  }
}

function breakPointMeeting(
  id,
  trackedPlayer,
  opponent,
  trackedBreakPoints,
  opponentBreakPoints,
  matchDate,
) {
  const insights = {
    ...emptyInsight,
    pointCount: 24,
    breakPoints: {
      tracked: { ...trackedBreakPoints },
      opponent: { ...opponentBreakPoints },
    },
  };
  return {
    summary: {
      id,
      remoteMatchId: null,
      matchDate,
      event: null,
      round: null,
      setNumber: 1,
      trackedPlayer,
      opponent,
      surface: 'Hard',
      status: 'complete',
      syncStatus: 'local_only',
      pendingPointCount: 0,
      trackedGames: 6,
      opponentGames: 4,
      setScores: [
        {
          setNumber: 1,
          format: 'standard',
          tiebreakTarget: 10,
          trackedGames: 6,
          opponentGames: 4,
          trackedTiebreakPoints: 0,
          opponentTiebreakPoints: 0,
          isComplete: true,
        },
      ],
      pointCount: insights.pointCount,
      winner: 'tracked',
      updatedAt: `${matchDate}T12:00:00.000Z`,
    },
    insights,
  };
}

test('head-to-head personal break-point averages pool each tracked-player match once', () => {
  const alexVsBailey = breakPointMeeting(
    'alex-bailey',
    'Alex',
    'Bailey',
    { opportunities: 4, converted: 2, faced: 5, saved: 3 },
    { opportunities: 1, converted: 1, faced: 3, saved: 2 },
    '2026-10-01',
  );
  const alexVsCasey = breakPointMeeting(
    'alex-casey',
    'Alex',
    'Casey',
    { opportunities: 6, converted: 3, faced: 4, saved: 2 },
    { opportunities: 3, converted: 1, faced: 4, saved: 2 },
    '2026-10-02',
  );
  const reverseOriented = breakPointMeeting(
    'bailey-alex',
    'Bailey',
    'Alex',
    { opportunities: 100, converted: 100, faced: 100, saved: 0 },
    { opportunities: 100, converted: 0, faced: 100, saved: 0 },
    '2026-10-03',
  );
  const trackedOnlyAsOpponent = breakPointMeeting(
    'jordan-alex',
    'Jordan',
    'Alex',
    { opportunities: 50, converted: 0, faced: 50, saved: 0 },
    { opportunities: 50, converted: 50, faced: 50, saved: 50 },
    '2026-10-04',
  );

  const report = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    [alexVsBailey],
    [alexVsBailey, alexVsCasey, reverseOriented, trackedOnlyAsOpponent],
  );

  assert.equal(report.matchesRecorded, 1);
  assert.equal(report.personalAverageMatches, 2);
  assert.deepEqual(report.insights.breakPoints.tracked, {
    opportunities: 4,
    converted: 2,
    faced: 5,
    saved: 3,
  });
  assert.deepEqual(report.personalAverageInsights.breakPoints.tracked, {
    opportunities: 10,
    converted: 5,
    faced: 9,
    saved: 5,
  });

  const html = buildHeadToHeadReportHtml(report);
  assert.match(html, /Pooled break-point chances across 2 saved matches/);
  assert.deepEqual(reportRows(html, 'Alex · personal average'), [
    'Break points converted 5/10 · 50.0%',
    'Break points missed 5/10 · 50.0%',
    'Break points saved 5/9 · 55.6%',
    'Break points lost while serving 4/9 · 44.4%',
  ]);
});

test('head-to-head break-point rates are unavailable for empty samples', () => {
  const noChances = breakPointMeeting(
    'alex-bailey-no-break-points',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-10-05',
  );
  const report = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    [noChances],
    [noChances],
  );
  const html = buildHeadToHeadReportHtml(report);

  assert.equal(report.personalAverageMatches, 1);
  assert.match(html, /Pooled break-point chances across 1 saved match/);
  assert.deepEqual(reportRows(html, 'Alex · personal average'), [
    'Break points converted —',
    'Break points missed —',
    'Break points saved —',
    'Break points lost while serving —',
  ]);

  const partialChances = breakPointMeeting(
    'alex-bailey-partial-break-points',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 2, saved: 1 },
    { opportunities: 2, converted: 1, faced: 0, saved: 0 },
    '2026-10-06',
  );
  const partialReport = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    [partialChances],
    [partialChances],
  );
  const partialHtml = buildHeadToHeadReportHtml(partialReport);

  assert.deepEqual(reportRowsAfterHeading(partialHtml, 'Break points'), [
    'Break points converted — 1/2 · 50.0%',
    'Break points missed — 1/2 · 50.0%',
    'Break points saved 1/2 · 50.0% —',
    'Break points lost while serving 1/2 · 50.0% —',
  ]);
});

test('deleting a match removes its break points from the personal baseline and PDF', async () => {
  storageValues.clear();
  async function createBreakPointMatch(opponent, matchDate) {
    const match = await createLocalMatch({
      matchDate,
      event: `Tracked player vs ${opponent}`,
      round: 'Round 1',
      trackedPlayer: 'Alex',
      opponent,
      chairCoach: null,
      surface: 'Hard',
      firstServer: 'opponent',
      setNumber: 1,
    });
    for (let point = 0; point < 4; point += 1) {
      await recordLocalPoint(match.id, { winner: 'tracked' });
    }
    return match.id;
  }

  const deletedMatchId = await createBreakPointMatch('Bailey', '2026-10-01');
  await createBreakPointMatch('Casey', '2026-10-02');

  async function trackedMeetingsFromLocalMatches() {
    const summaries = await listLocalMatches();
    const meetings = (
      await Promise.all(
        summaries
          .filter(({ trackedPlayer }) => trackedPlayer === 'Alex')
          .map(async (summary) => {
            const insights = await getLocalInsights(summary.id);
            return insights ? { summary, insights } : null;
          }),
      )
    ).filter((meeting) => meeting !== null);
    return { summaries, meetings };
  }

  const beforeDeletion = await trackedMeetingsFromLocalMatches();
  const baileyMeetings = beforeDeletion.meetings.filter(
    ({ summary }) => summary.opponent === 'Bailey',
  );
  const initialReport = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    baileyMeetings,
    beforeDeletion.meetings,
  );
  assert.equal(initialReport.matchesRecorded, 1);
  assert.equal(initialReport.personalAverageMatches, 2);
  assert.deepEqual(initialReport.personalAverageInsights.breakPoints.tracked, {
    opportunities: 2,
    converted: 2,
    faced: 0,
    saved: 0,
  });
  const initialHtml = buildHeadToHeadReportHtml(initialReport);
  assert.match(initialHtml, /1 recorded · 0 complete/);
  assert.match(initialHtml, /Pooled break-point chances across 2 saved matches/);
  assert.deepEqual(reportRows(initialHtml, 'Alex · personal average'), [
    'Break points converted 2/2 · 100.0%',
    'Break points missed 0/2 · 0.0%',
    'Break points saved —',
    'Break points lost while serving —',
  ]);

  assert.equal(await deleteLocalMatch(deletedMatchId), true);
  assert.equal(await getLocalMatch(deletedMatchId), null);
  const afterDeletion = await trackedMeetingsFromLocalMatches();
  assert.deepEqual(getHeadToHeadOpponentOptions('Alex', afterDeletion.summaries), [
    'Casey',
  ]);

  const remainingReport = buildHeadToHeadReport(
    'Alex',
    'Casey',
    afterDeletion.meetings.filter(({ summary }) => summary.opponent === 'Casey'),
    afterDeletion.meetings,
  );
  assert.equal(remainingReport.matchesRecorded, 1);
  assert.equal(remainingReport.personalAverageMatches, 1);
  assert.deepEqual(remainingReport.personalAverageInsights.breakPoints.tracked, {
    opportunities: 1,
    converted: 1,
    faced: 0,
    saved: 0,
  });
  const remainingHtml = buildHeadToHeadReportHtml(remainingReport);
  assert.match(remainingHtml, /1 recorded · 0 complete/);
  assert.match(remainingHtml, /Pooled break-point chances across 1 saved match/);

  const deletedPairingReport = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    [],
    afterDeletion.meetings,
  );
  assert.equal(deletedPairingReport.matchesRecorded, 0);
  assert.equal(deletedPairingReport.personalAverageMatches, 1);
  assert.deepEqual(deletedPairingReport.personalAverageInsights.breakPoints.tracked, {
    opportunities: 1,
    converted: 1,
    faced: 0,
    saved: 0,
  });
  const deletedPairingHtml = buildHeadToHeadReportHtml(deletedPairingReport);
  assert.match(deletedPairingHtml, /0 recorded · 0 complete/);
  assert.match(deletedPairingHtml, /Pooled break-point chances across 1 saved match/);
});

test('player statistics match a deterministic four-game point log', () => {
  const match = performanceSampleMatch();
  const insights = calculateLocalInsights(match);
  const performance = summarizePlayerPerformance(insights, 1);

  assert.equal(insights.pointCount, 24);
  assert.equal(insights.trackedServicePoints, 12);
  assert.equal(insights.serveStats.tracked.firstServePoints, 10);
  assert.equal(insights.serveStats.tracked.secondServePoints, 2);
  assert.equal(insights.serveStats.tracked.doubleFaults, 1);
  assert.equal(insights.serveStats.tracked.aces, 1);
  assert.equal(insights.serveStats.opponent.firstServePoints, 10);
  assert.equal(insights.serveStats.opponent.secondServePoints, 2);
  assert.equal(insights.serveStats.opponent.doubleFaults, 1);
  assert.equal(insights.serveStats.opponent.aces, 2);
  assert.equal(insights.serviceGames.tracked.gamesPlayed, 2);
  assert.equal(insights.serviceGames.opponent.gamesPlayed, 2);

  assert.equal(performance.firstServeInPercent, 83);
  assert.equal(performance.secondServeInCount, 1);
  assert.equal(performance.secondServeAttemptCount, 2);
  assert.equal(performance.secondServeInPercent, 50);
  assert.equal(performance.rallyWinnerTagCount, 6);
  assert.equal(performance.rallyWinnerCount, 5);
  assert.equal(performance.rallyWinnerPercent, 21);
  assert.equal(performance.opponentRallyWinnerCount, 1);
  assert.equal(performance.opponentRallyWinnerPercent, 4);
  assert.equal(performance.trackedUnforcedErrors, 2);
  assert.equal(performance.opponentUnforcedErrors, 1);
  assert.equal(performance.unforcedErrorTagCount, 3);
  assert.equal(performance.acesPerServiceGame, 0.5);
  assert.equal(performance.acesPerSet, 1);
  assert.equal(performance.acesPerMatch, 1);

  const playerHtml = buildPlayerReportHtml(match, insights, performance);
  const playerServeRows = reportRowsAfterHeading(playerHtml, 'Serve');
  assert.match(
    playerServeRows.find((row) => row.startsWith('First serve in')),
    /10\/12.*83\.3%.*10\/12.*83\.3%/,
  );
  assert.match(
    playerServeRows.find((row) => row.startsWith('Second serve in')),
    /1\/2.*50\.0%.*1\/2.*50\.0%/,
  );
  assert.match(
    playerServeRows.find((row) => row.startsWith('Aces per service game')),
    /0\.50.*1\.00/,
  );
  assert.match(
    playerServeRows.find((row) => row.startsWith('Aces per set')),
    /1\.00.*2\.00/,
  );
  assert.match(
    playerServeRows.find((row) => row.startsWith('Aces per match')),
    /1\.00.*2\.00/,
  );
  assert.match(playerHtml, /5\/24 \(20\.8%\)/);
  assert.match(playerHtml, /UNFORCED ERRORS[\s\S]*?<div class="tile-value">2<\/div>/);

  const headToHeadHtml = buildHeadToHeadReportHtml(
    headToHeadReportFixture(insights, performance),
  );
  const headToHeadServeRows = reportRowsAfterHeading(headToHeadHtml, 'Serve');
  assert.match(
    headToHeadServeRows.find((row) => row.startsWith('First serve in')),
    /10\/12 · 83\.3%.*10\/12 · 83\.3%/,
  );
  assert.match(
    headToHeadServeRows.find((row) => row.startsWith('Second serve in')),
    /1\/2 · 50\.0%.*1\/2 · 50\.0%/,
  );
  assert.match(
    headToHeadServeRows.find((row) => row.startsWith('Aces per service game')),
    /0\.50.*1\.00/,
  );
  assert.match(
    headToHeadServeRows.find((row) => row.startsWith('Aces per set')),
    /1\.00.*2\.00/,
  );
  assert.match(
    headToHeadServeRows.find((row) => row.startsWith('Aces per match')),
    /1\.00.*2\.00/,
  );
  assert.match(
    headToHeadHtml,
    /Rally-shot winner points<\/td>\s*<td>5\/24 · 20\.8%<\/td>\s*<td>1\/24 · 4\.2%<\/td>/,
  );
  assert.match(
    headToHeadHtml,
    /Unforced errors<\/td>\s*<td>2 · 24 recorded points<\/td>\s*<td>1 · 24 recorded points<\/td>/,
  );
});

test('saved-point corrections and undo refresh match and head-to-head report stats', async () => {
  storageValues.clear();
  const { matchId, rallyPointId, errorPointId } =
    await createSavedPointReportFixture();

  const initial = await buildSavedPointReportSnapshot(matchId);
  assertServeMetricInBothReports(
    initial,
    'First serve in',
    '5/6 (83.3%)',
    '5/6 · 83.3%',
    '7/8 (87.5%)',
    '7/8 · 87.5%',
  );
  assertServeMetricInBothReports(
    initial,
    'Second serve in',
    '1/1 (100.0%)',
    '1/1 · 100.0%',
    '1/1 (100.0%)',
    '1/1 · 100.0%',
  );
  for (const label of [
    'Aces per service game',
    'Aces per set',
    'Aces per match',
  ]) {
    const unit =
      label === 'Aces per service game'
        ? 'service games'
        : label === 'Aces per set'
          ? 'sets with points'
          : 'match';
    assertServeMetricInBothReports(
      initial,
      label,
      '1.00',
      '1.00',
      `1.00 (1 aces / 1 ${unit})`,
      `1.00 (1 aces / 1 ${label === 'Aces per match' ? 'matches' : unit})`,
    );
  }
  assertPointAnalysisInBothReports(initial, {
    rallyTile: '1/14 (7.1%)',
    rallyTracked: '1/14 · 7.1%',
    rallyOpponent: '0/14 · 0.0%',
    errorTile: '1',
    errorTracked: '1 · 14 recorded points',
    errorOpponent: '0 · 14 recorded points',
    pointCount: 14,
  });

  await editLocalPointWinner(matchId, 1, rallyPointId, 'opponent');
  const afterRallyCorrection = await buildSavedPointReportSnapshot(matchId);
  assertServeMetricInBothReports(
    afterRallyCorrection,
    'First serve in',
    '5/6 (83.3%)',
    '5/6 · 83.3%',
    '7/8 (87.5%)',
    '7/8 · 87.5%',
  );
  assertServeMetricInBothReports(
    afterRallyCorrection,
    'Second serve in',
    '1/1 (100.0%)',
    '1/1 · 100.0%',
    '1/1 (100.0%)',
    '1/1 · 100.0%',
  );
  for (const label of [
    'Aces per service game',
    'Aces per set',
    'Aces per match',
  ]) {
    const unit =
      label === 'Aces per service game'
        ? 'service games'
        : label === 'Aces per set'
          ? 'sets with points'
          : 'match';
    assertServeMetricInBothReports(
      afterRallyCorrection,
      label,
      '1.00',
      '1.00',
      `1.00 (1 aces / 1 ${unit})`,
      `1.00 (1 aces / 1 ${label === 'Aces per match' ? 'matches' : unit})`,
    );
  }
  assertPointAnalysisInBothReports(afterRallyCorrection, {
    rallyTile: '0/14 (0.0%)',
    rallyTracked: '0/14 · 0.0%',
    rallyOpponent: '1/14 · 7.1%',
    errorTile: '1',
    errorTracked: '1 · 14 recorded points',
    errorOpponent: '0 · 14 recorded points',
    pointCount: 14,
  });

  await editLocalPointWinner(matchId, 1, errorPointId, 'tracked');
  const afterErrorCorrection = await buildSavedPointReportSnapshot(matchId);
  assertServeMetricInBothReports(
    afterErrorCorrection,
    'First serve in',
    '5/6 (83.3%)',
    '5/6 · 83.3%',
    '7/8 (87.5%)',
    '7/8 · 87.5%',
  );
  for (const label of [
    'Aces per service game',
    'Aces per set',
    'Aces per match',
  ]) {
    const unit =
      label === 'Aces per service game'
        ? 'service games'
        : label === 'Aces per set'
          ? 'sets with points'
          : 'match';
    assertServeMetricInBothReports(
      afterErrorCorrection,
      label,
      '1.00',
      '1.00',
      `1.00 (1 aces / 1 ${unit})`,
      `1.00 (1 aces / 1 ${label === 'Aces per match' ? 'matches' : unit})`,
    );
  }
  assertPointAnalysisInBothReports(afterErrorCorrection, {
    rallyTile: '0/14 (0.0%)',
    rallyTracked: '0/14 · 0.0%',
    rallyOpponent: '1/14 · 7.1%',
    errorTile: '0',
    errorTracked: '0 · 14 recorded points',
    errorOpponent: '1 · 14 recorded points',
    pointCount: 14,
  });

  await undoLocalPoint(matchId);
  const afterGamePointUndo = await buildSavedPointReportSnapshot(matchId);
  assertServeMetricInBothReports(
    afterGamePointUndo,
    'First serve in',
    '5/6 (83.3%)',
    '5/6 · 83.3%',
    '6/7 (85.7%)',
    '6/7 · 85.7%',
  );
  assertServeMetricInBothReports(
    afterGamePointUndo,
    'Aces per service game',
    '1.00',
    '1.00',
    '—',
    '—',
  );
  assertServeMetricInBothReports(
    afterGamePointUndo,
    'Aces per set',
    '1.00',
    '1.00',
    '1.00 (1 aces / 1 sets with points)',
    '1.00 (1 aces / 1 sets with points)',
  );
  assertServeMetricInBothReports(
    afterGamePointUndo,
    'Aces per match',
    '1.00',
    '1.00',
    '1.00 (1 aces / 1 match)',
    '1.00 (1 aces / 1 matches)',
  );
  assertPointAnalysisInBothReports(afterGamePointUndo, {
    rallyTile: '0/13 (0.0%)',
    rallyTracked: '0/13 · 0.0%',
    rallyOpponent: '1/13 · 7.7%',
    errorTile: '0',
    errorTracked: '0 · 13 recorded points',
    errorOpponent: '1 · 13 recorded points',
    pointCount: 13,
  });

  await undoLocalPoint(matchId);
  const afterAceUndo = await buildSavedPointReportSnapshot(matchId);
  assertServeMetricInBothReports(
    afterAceUndo,
    'Aces per service game',
    '1.00',
    '1.00',
    '—',
    '—',
  );
  assertServeMetricInBothReports(
    afterAceUndo,
    'Aces per set',
    '1.00',
    '1.00',
    '0.00 (0 aces / 1 sets with points)',
    '0.00 (0 aces / 1 sets with points)',
  );
  assertServeMetricInBothReports(
    afterAceUndo,
    'Aces per match',
    '1.00',
    '1.00',
    '0.00 (0 aces / 1 match)',
    '0.00 (0 aces / 1 matches)',
  );
  assertPointAnalysisInBothReports(afterAceUndo, {
    rallyTile: '0/12 (0.0%)',
    rallyTracked: '0/12 · 0.0%',
    rallyOpponent: '1/12 · 8.3%',
    errorTile: '0',
    errorTracked: '0 · 12 recorded points',
    errorOpponent: '1 · 12 recorded points',
    pointCount: 12,
  });

  await undoLocalPoint(matchId);
  await undoLocalPoint(matchId);
  const afterFaultUndo = await buildSavedPointReportSnapshot(matchId);
  assertServeMetricInBothReports(
    afterFaultUndo,
    'First serve in',
    '5/6 (83.3%)',
    '5/6 · 83.3%',
    '4/4 (100.0%)',
    '4/4 · 100.0%',
  );
  assertServeMetricInBothReports(
    afterFaultUndo,
    'Second serve in',
    '1/1 (100.0%)',
    '1/1 · 100.0%',
    '—',
    '—',
  );
  assertServeMetricInBothReports(
    afterFaultUndo,
    'Aces per match',
    '1.00',
    '1.00',
    '0.00 (0 aces / 1 match)',
    '0.00 (0 aces / 1 matches)',
  );

  for (let point = 0; point < 6; point += 1) {
    await undoLocalPoint(matchId);
  }
  const beforeTagUndos = await buildSavedPointReportSnapshot(matchId);
  assertServeMetricInBothReports(
    beforeTagUndos,
    'First serve in',
    '4/4 (100.0%)',
    '4/4 · 100.0%',
    '—',
    '—',
  );
  assertPointAnalysisInBothReports(beforeTagUndos, {
    rallyTile: '0/4 (0.0%)',
    rallyTracked: '0/4 · 0.0%',
    rallyOpponent: '1/4 · 25.0%',
    errorTile: '0',
    errorTracked: '0 · 4 recorded points',
    errorOpponent: '1 · 4 recorded points',
    pointCount: 4,
  });

  await undoLocalPoint(matchId);
  const afterErrorUndo = await buildSavedPointReportSnapshot(matchId);
  assertPointAnalysisInBothReports(afterErrorUndo, {
    rallyTile: '0/3 (0.0%)',
    rallyTracked: '0/3 · 0.0%',
    rallyOpponent: '1/3 · 33.3%',
    errorTile: '—',
    errorTracked: '—',
    errorOpponent: '—',
    pointCount: 3,
  });

  await undoLocalPoint(matchId);
  const afterRallyUndo = await buildSavedPointReportSnapshot(matchId);
  assertPointAnalysisInBothReports(afterRallyUndo, {
    rallyTile: '—',
    rallyTracked: '—',
    rallyOpponent: '—',
    errorTile: '—',
    errorTracked: '—',
    errorOpponent: '—',
    pointCount: 2,
  });
});

test('player feedback interprets break-point results and marks small samples directional', () => {
  const match = performanceSampleMatch();
  const insights = {
    ...calculateLocalInsights(match),
    breakPoints: {
      tracked: { opportunities: 3, converted: 2, faced: 4, saved: 3 },
      opponent: { ...emptyBreakPoints },
    },
  };
  const directional = summarizePlayerPerformance(insights);
  assert.ok(
    directional.feedback.includes(
      'Directional only, not conclusive: the tracked player converted 2 of 3 break-point chances (67%).',
    ),
  );
  assert.ok(
    directional.feedback.includes(
      'Directional only, not conclusive: the tracked player saved 3 of 4 break points faced (75%).',
    ),
  );

  const reportHtml = buildPlayerReportHtml(
    match,
    insights,
    directional,
  );
  assert.match(reportHtml, /Directional only, not conclusive/);
  assert.match(reportHtml, /converted 2 of 3 break-point chances \(67%\)/);
  assert.match(reportHtml, /saved 3 of 4 break points faced \(75%\)/);

  const establishedSample = summarizePlayerPerformance({
    ...insights,
    breakPoints: {
      tracked: { opportunities: 6, converted: 2, faced: 5, saved: 2 },
      opponent: { ...emptyBreakPoints },
    },
  });
  assert.ok(
    establishedSample.feedback.includes(
      'Break-point conversion is an area to work on: the tracked player converted 2 of 6 break-point chances (33%).',
    ),
  );
  assert.ok(
    establishedSample.feedback.includes(
      'Break-point defense is an area to work on: the tracked player saved 2 of 5 break points faced (40%).',
    ),
  );
});

test('untagged or zero-denominator report statistics are unavailable', () => {
  const match = {
    ...performanceSampleMatch(),
    id: 'empty-performance-sample',
    points: [],
  };
  const insights = calculateLocalInsights(match);
  const performance = summarizePlayerPerformance(insights, 0);

  assert.equal(insights.pointCount, 0);
  assert.equal(performance.firstServeInPercent, null);
  assert.equal(performance.secondServeInPercent, null);
  assert.equal(performance.rallyWinnerPercent, null);
  assert.equal(performance.opponentRallyWinnerPercent, null);
  assert.equal(performance.rallyWinnerTagCount, 0);
  assert.equal(performance.unforcedErrorTagCount, 0);
  assert.equal(performance.acesPerServiceGame, null);
  assert.equal(performance.acesPerSet, null);
  assert.equal(performance.acesPerMatch, null);

  const playerHtml = buildPlayerReportHtml(match, insights, performance);
  const playerServeRows = reportRowsAfterHeading(playerHtml, 'Serve');
  for (const label of [
    'First serve in',
    'Second serve in',
    'Aces per service game',
    'Aces per set',
    'Aces per match',
  ]) {
    assert.match(
      playerServeRows.find((row) => row.startsWith(label)),
      /—/,
      `${label} should be unavailable with no recorded points`,
    );
  }
  assert.match(playerHtml, /RALLY SHOT WINNERS[\s\S]*?<div class="tile-value">—<\/div>/);
  assert.match(playerHtml, /UNFORCED ERRORS[\s\S]*?<div class="tile-value">—<\/div>/);

  const headToHeadHtml = buildHeadToHeadReportHtml(
    headToHeadReportFixture(insights, performance, 0),
  );
  const headToHeadServeRows = reportRowsAfterHeading(headToHeadHtml, 'Serve');
  for (const label of [
    'First serve in',
    'Second serve in',
    'Aces per service game',
    'Aces per set',
    'Aces per match',
  ]) {
    assert.match(
      headToHeadServeRows.find((row) => row.startsWith(label)),
      /—/,
      `${label} should be unavailable with no recorded points`,
    );
  }
  assert.match(
    headToHeadHtml,
    /Rally-shot winner points<\/td>\s*<td>—<\/td>\s*<td>—<\/td>/,
  );
  assert.match(
    headToHeadHtml,
    /Unforced errors<\/td>\s*<td>—<\/td>\s*<td>—<\/td>/,
  );
});

function reportSetFixture({
  setNumber = 1,
  format = 'standard',
  trackedGames = 6,
  opponentGames = 4,
  trackedTiebreakPoints = 0,
  opponentTiebreakPoints = 0,
  tiebreakTarget = 10,
  isComplete = true,
  pointCount = 1,
  serveStats = null,
  codes = [],
} = {}) {
  return {
    setNumber,
    format,
    trackedGames,
    opponentGames,
    trackedTiebreakPoints,
    opponentTiebreakPoints,
    tiebreakTarget,
    isComplete,
    pointCount,
    serveStats,
    codes,
    breakPoints: {
      tracked: { ...emptyBreakPoints },
      opponent: { ...emptyBreakPoints },
    },
    gameNotes: [],
    review: {
      strokeRatings: {},
      strokeNotes: {},
      footworkNote: '',
      tacticalNote: '',
      mentalNote: '',
    },
  };
}

function winnerReportHtml(sets, matchStatus = 'complete', matchOutcome = null) {
  const insights = { ...emptyInsight, sets };
  return buildPlayerReportHtml(
    {
      matchDate: '2026-10-30',
      trackedPlayer: 'Tracked',
      opponent: 'Opponent',
      surface: 'Hard',
      matchStatus,
      matchOutcome,
    },
    insights,
    { ...summarizePlayerPerformance(insights), feedback: [] },
    ['sets'],
    [],
  );
}

function matchResultFrom(html) {
  const result = html.match(
    /<span class="date-result-label">MATCH RESULT<\/span>\s*<span class="date-result-value">([\s\S]*?)<\/span>/,
  );
  assert.ok(result, 'Expected the report to include a match result');
  return result[1];
}

function setWinnerFrom(html, setNumber) {
  const row = html.match(
    new RegExp(
      `<td>Set ${setNumber}<span class="sub">(Complete|In progress)<\\/span><\\/td>\\s*<td>([\\s\\S]*?)<\\/td>\\s*<td>([\\s\\S]*?)<\\/td>`,
    ),
  );
  assert.ok(row, `Expected the report to include Set ${setNumber}`);
  return { status: row[1], score: row[2], winner: row[3] };
}

test('single-match report removes URL-like text and keeps match details and analysis', () => {
  const insights = {
    ...emptyInsight,
    serveStats: {
      tracked: { ...emptySide },
      opponent: { ...emptySide },
    },
  };
  const summary = {
    ...emptyPerformance,
    feedback: ['Strong serve. https://coaching.example.com/private'],
  };
  const html = buildPlayerReportHtml(
    {
      matchDate: '2026-10-30',
      event: 'City Open www.events.example.org/results',
      round: 'Quarterfinal',
      chairCoach: 'Coach coach.example.net',
      trackedPlayer: 'Alex https://players.example.com/alex',
      opponent: 'Jordan',
      surface: 'Hard',
      matchStatus: 'complete',
    },
    insights,
    summary,
    undefined,
    [
      {
        firstServePointsWon: 75.1,
        secondServePointsWon: 56.4,
        serviceGamesWon: 86.8,
      },
      {
        firstServePointsWon: 79.2,
        secondServePointsWon: 61.7,
        serviceGamesWon: 94.3,
      },
    ],
  );

  assertCleanReport(html);
  assert.match(html, /City Open/);
  assert.match(html, /Quarterfinal/);
  assert.match(html, /Alex/);
  assert.match(html, /Jordan/);
  assert.match(html, /Strong serve\./);
  assert.match(html, />Serve</);
  assert.match(html, />Return</);
  assert.match(html, /User reference 1/);
  assert.match(html, /User reference 2/);
  assert.match(
    html,
    /<td>First-serve points won<\/td>.*?<td>75\.1%<\/td><td>79\.2%<\/td>/s,
  );
  assert.match(
    html,
    /<td>Second-serve points won<\/td>.*?<td>56\.4%<\/td><td>61\.7%<\/td>/s,
  );
  assert.match(
    html,
    /<td>Service games won<\/td>.*?<td>86\.8%<\/td><td>94\.3%<\/td>/s,
  );
  assert.doesNotMatch(html, /2026 Cincinnati|ATP|ITF/i);
  assert.doesNotMatch(html, /Cincinnati/i);

  const noReferences = buildPlayerReportHtml(
    {
      matchDate: '2026-10-30',
      trackedPlayer: 'Alex',
      opponent: 'Jordan',
      surface: 'Hard',
      matchStatus: 'complete',
    },
    insights,
    summary,
    undefined,
    [],
  );
  assert.doesNotMatch(noReferences, /User reference/);
});

test('single benchmark columns keep their generic source label and missing values blank', () => {
  const html = buildPlayerReportHtml(
    {
      matchDate: '2026-10-30',
      trackedPlayer: 'Alex',
      opponent: 'Jordan',
      surface: 'Hard',
      matchStatus: 'complete',
    },
    emptyInsight,
    emptyPerformance,
    undefined,
    [
      {
        firstServePointsWon: 72.4,
        secondServePointsWon: null,
        serviceGamesWon: 88,
      },
    ],
  );

  assert.match(html, /User reference 1/);
  assert.doesNotMatch(html, /User reference 2/);
  assert.match(
    html,
    /<td>First-serve points won<\/td>.*?<td>72\.4%<\/td>/s,
  );
  assert.match(
    html,
    /<td>Second-serve points won<\/td>.*?<td>—<\/td>/s,
  );
  assert.match(
    html,
    /<td>Service games won<\/td>.*?<td>88\.0%<\/td>/s,
  );
});

test('match result uses set majorities and the correct score for each set format', () => {
  const html = winnerReportHtml([
    reportSetFixture({
      setNumber: 1,
      format: 'standard',
      trackedGames: 6,
      opponentGames: 4,
      trackedTiebreakPoints: 0,
      opponentTiebreakPoints: 0,
    }),
    reportSetFixture({
      setNumber: 2,
      format: 'match_tiebreak',
      trackedGames: 0,
      opponentGames: 0,
      trackedTiebreakPoints: 10,
      opponentTiebreakPoints: 8,
      tiebreakTarget: 10,
    }),
    reportSetFixture({
      setNumber: 3,
      format: 'standard',
      trackedGames: 4,
      opponentGames: 6,
    }),
  ]);

  assert.equal(matchResultFrom(html), 'Tracked');
  assert.deepEqual(setWinnerFrom(html, 1), {
    status: 'Complete',
    score: '6–4',
    winner: 'Tracked',
  });
  assert.deepEqual(setWinnerFrom(html, 2), {
    status: 'Complete',
    score: 'Match tie-break 10–8 (target 10, win by 2)',
    winner: 'Tracked',
  });
  assert.deepEqual(setWinnerFrom(html, 3), {
    status: 'Complete',
    score: '4–6',
    winner: 'Opponent',
  });
});

test('tied set totals and tied completed set scores never name a match winner', () => {
  const tiedTotalsHtml = winnerReportHtml([
    reportSetFixture({ setNumber: 1, trackedGames: 6, opponentGames: 4 }),
    reportSetFixture({
      setNumber: 2,
      trackedGames: 4,
      opponentGames: 6,
    }),
  ]);
  assert.equal(matchResultFrom(tiedTotalsHtml), 'Complete · no set majority');

  const tiedScoreHtml = winnerReportHtml([
    reportSetFixture({
      setNumber: 1,
      trackedGames: 6,
      opponentGames: 6,
    }),
  ]);
  assert.equal(matchResultFrom(tiedScoreHtml), 'Complete · no set majority');
  assert.equal(setWinnerFrom(tiedScoreHtml, 1).winner, 'Not determined');
});

test('in-progress reports do not label the match won or lost', () => {
  const html = winnerReportHtml(
    [
      reportSetFixture({ setNumber: 1, trackedGames: 6, opponentGames: 4 }),
      reportSetFixture({
        setNumber: 2,
        trackedGames: 5,
        opponentGames: 5,
        isComplete: false,
      }),
    ],
    'in_progress',
  );

  assert.equal(matchResultFrom(html), 'In progress');
  assert.equal(setWinnerFrom(html, 1).winner, 'Tracked');
  assert.equal(setWinnerFrom(html, 2).winner, 'In progress');
});

test('retirement and walkover reports name the awarded winner without inventing set results', () => {
  const retirementHtml = winnerReportHtml(
    [
      reportSetFixture({
        setNumber: 1,
        trackedGames: 3,
        opponentGames: 4,
        isComplete: false,
      }),
    ],
    'complete',
    { reason: 'retirement', winner: 'opponent' },
  );
  assert.equal(matchResultFrom(retirementHtml), 'Winner by retirement: Opponent');
  assert.equal(setWinnerFrom(retirementHtml, 1).winner, 'In progress');
  assert.match(retirementHtml, /<strong>Outcome reason:<\/strong> Retirement/);

  const walkoverAfterCompletedSetHtml = winnerReportHtml(
    [
      reportSetFixture({
        setNumber: 1,
        trackedGames: 6,
        opponentGames: 2,
        pointCount: 24,
      }),
      reportSetFixture({
        setNumber: 2,
        trackedGames: 0,
        opponentGames: 0,
        isComplete: false,
        pointCount: 0,
      }),
    ],
    'complete',
    { reason: 'walkover', winner: 'tracked' },
  );
  assert.equal(setWinnerFrom(walkoverAfterCompletedSetHtml, 1).winner, 'Tracked');
  assert.doesNotMatch(walkoverAfterCompletedSetHtml, /Set 2<span class="sub">In progress/);

  const walkoverHtml = winnerReportHtml([], 'complete', {
    reason: 'walkover',
    winner: 'tracked',
  });
  assert.equal(matchResultFrom(walkoverHtml), 'Winner by walkover: Tracked');
  assert.match(walkoverHtml, /<strong>Outcome reason:<\/strong> Walkover/);
  assert.match(walkoverHtml, /No set data recorded\./);
});

test('single-match reports show per-set samples and keep unsupported metrics unavailable', () => {
  const noServes = {
    ...emptySide,
    servicePoints: 0,
    servicePointsWon: 0,
    firstServeFaults: 0,
    firstServePoints: 0,
    firstServePointsWon: 0,
    secondServePoints: 0,
    secondServePointsWon: 0,
    aces: 0,
    doubleFaults: 0,
  };
  const html = winnerReportHtml([
    reportSetFixture({
      setNumber: 1,
      pointCount: 20,
      serveStats: {
        tracked: {
          ...emptySide,
          servicePoints: 10,
          firstServePoints: 6,
          secondServePoints: 4,
          doubleFaults: 1,
          aces: 2,
        },
        opponent: { ...emptySide },
      },
      codes: [
        { code: 'F', count: 1, trackedWon: 1, opponentWon: 0 },
        { code: 'V', count: 1, trackedWon: 0, opponentWon: 1 },
        { code: 'A', count: 2, trackedWon: 2, opponentWon: 0 },
        { code: 'N', count: 2, trackedWon: 0, opponentWon: 2 },
        { code: 'L', count: 1, trackedWon: 1, opponentWon: 0 },
      ],
    }),
    reportSetFixture({
      setNumber: 2,
      pointCount: 5,
      serveStats: {
        tracked: { ...noServes },
        opponent: { ...noServes },
      },
    }),
  ]);

  assert.match(html, /Set-by-set player performance · Tracked/);
  assert.match(html, /60%<\/span><span class="sub">6 of 10 first serves/);
  assert.match(html, /75%<\/span><span class="sub">3 of 4 second serves/);
  assert.match(html, /1 \(50%\)<\/span><span class="sub">1 of 2 tagged rally winners/);
  assert.match(html, /2 aces \/ 10 tracked service points/);
  assert.match(html, /2 of 3 tagged error points/);
  assert.match(html, /No first serves recorded/);
  assert.match(html, /No second serves recorded/);
  assert.match(html, /No rally-winner tags/);
  assert.match(html, /No tracked service points recorded/);
  assert.match(html, /No unforced-error tags/);
});

test('match detail does not default an undetermined set winner to the tracked player', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../app/matches/[id].tsx'),
    'utf8',
  );

  assert.match(source, /match\.score\.isComplete && match\.score\.winner/);
  assert.match(source, /Set winner not determined/);
  assert.doesNotMatch(source, /match\.score\.winner\s*\?\?\s*'tracked'/);
});

test('match detail exposes set-by-set samples and point winner editing', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../app/matches/[id].tsx'),
    'utf8',
  );

  assert.match(source, /SET-BY-SET PERFORMANCE/);
  assert.match(source, /performance\.setBreakdown/);
  assert.match(source, /Tap T points to edit/);
  assert.match(source, /Change point winner\?/);
  assert.match(source, /editLocalPointWinner/);
});

test('break-point counts, set aggregation, exclusions, and report rates match scored sequences', () => {
  const {
    match,
    savedZeroForty,
    repeatedAdvantageChances,
    standardTiebreakPoints,
  } = breakPointSampleMatch();

  assert.deepEqual(calculateBreakPointStats(savedZeroForty, 'standard'), {
    tracked: { opportunities: 0, converted: 0, faced: 3, saved: 3 },
    opponent: { opportunities: 3, converted: 0, faced: 0, saved: 0 },
  });
  assert.deepEqual(
    calculateBreakPointStats(repeatedAdvantageChances, 'standard'),
    {
      tracked: { opportunities: 2, converted: 1, faced: 0, saved: 0 },
      opponent: { opportunities: 0, converted: 0, faced: 2, saved: 1 },
    },
  );
  assert.deepEqual(getBreakPointPointOutcomes(savedZeroForty, 'standard'), [
    null,
    null,
    null,
    'saved',
    'saved',
    'saved',
    null,
    null,
  ]);
  assert.deepEqual(
    getBreakPointPointOutcomes(repeatedAdvantageChances, 'standard'),
    [null, null, null, null, null, null, null, 'saved', null, 'converted'],
  );
  assert.deepEqual(
    getBreakPointPointOutcomes(standardTiebreakPoints, 'standard'),
    [null, null, null, null],
  );
  assert.deepEqual(
    getBreakPointPointOutcomes(match.points, 'match_tiebreak'),
    [null, null, null, null],
  );
  const completedBreakThenNextGame = [
    ...gamePoints(1, 1, 'opponent', ['tracked', 'tracked', 'tracked', 'tracked']),
    ...gamePoints(1, 2, 'tracked', ['tracked', 'tracked', 'tracked', 'tracked'], false, 5),
  ];
  assert.deepEqual(
    getBreakPointPointOutcomes(completedBreakThenNextGame, 'standard'),
    [null, null, null, 'converted', null, null, null, null],
  );

  const insights = calculateLocalInsights(match);
  assert.deepEqual(insights.sets.map((set) => set.breakPoints), [
    {
      tracked: { opportunities: 2, converted: 1, faced: 3, saved: 3 },
      opponent: { opportunities: 3, converted: 0, faced: 2, saved: 1 },
    },
    {
      tracked: { opportunities: 1, converted: 1, faced: 0, saved: 0 },
      opponent: { opportunities: 0, converted: 0, faced: 1, saved: 0 },
    },
    {
      tracked: { opportunities: 0, converted: 0, faced: 0, saved: 0 },
      opponent: { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    },
  ]);
  assert.deepEqual(insights.breakPoints, {
    tracked: { opportunities: 3, converted: 2, faced: 3, saved: 3 },
    opponent: { opportunities: 3, converted: 0, faced: 3, saved: 1 },
  });

  const html = buildPlayerReportHtml(
    {
      matchDate: '2026-10-30',
      event: 'Test match',
      round: 'Final',
      trackedPlayer: 'Tracked',
      opponent: 'Opponent',
      surface: 'Hard',
      matchStatus: 'complete',
    },
    { ...emptyInsight, ...insights },
    emptyPerformance,
    ['break-points'],
  );
  const conversionRows = reportRows(html, 'Returning · opportunities created');
  const defenseRows = reportRows(html, 'Serving · break points faced');

  assert.match(conversionRows[0], /Set 1.*1\/2 \(50\.0%\).*1\/2 \(50\.0%\).*0\/3 \(0\.0%\).*3\/3 \(100\.0%\)/);
  assert.match(conversionRows[1], /Set 2.*1\/1 \(100\.0%\).*0\/1 \(0\.0%\)/);
  assert.match(conversionRows[2], /Set 3 Excluded · match tie-break/);
  assert.match(conversionRows[3], /Match total.*2\/3 \(66\.7%\).*1\/3 \(33\.3%\).*0\/3 \(0\.0%\).*3\/3 \(100\.0%\)/);
  assert.match(defenseRows[0], /Set 1.*3\/3 \(100\.0%\).*0\/3 \(0\.0%\).*1\/2 \(50\.0%\).*1\/2 \(50\.0%\)/);
  assert.match(defenseRows[1], /Set 2.*—.*—.*0\/1 \(0\.0%\).*1\/1 \(100\.0%\)/);
  assert.match(defenseRows[2], /Set 3 Excluded · match tie-break/);
  assert.match(defenseRows[3], /Match total.*3\/3 \(100\.0%\).*0\/3 \(0\.0%\).*1\/3 \(33\.3%\).*2\/3 \(66\.7%\)/);
});

test('break-point history shows pre-point scores through deuce and advantage', () => {
  const {
    savedZeroForty,
    repeatedAdvantageChances,
    standardTiebreakPoints,
    match,
  } = breakPointSampleMatch();

  assert.deepEqual(
    getLocalPointHistory(savedZeroForty, 'standard', 'break_points').map(
      ({ breakPointScoreBefore }) => breakPointScoreBefore,
    ),
    [
      { trackedScore: '30', opponentScore: '40' },
      { trackedScore: '15', opponentScore: '40' },
      { trackedScore: '0', opponentScore: '40' },
    ],
  );

  assert.deepEqual(
    getLocalPointHistory(
      repeatedAdvantageChances,
      'standard',
      'break_points',
    ).map(({ breakPointOutcome, breakPointScoreBefore }) => ({
      outcome: breakPointOutcome,
      score: breakPointScoreBefore,
    })),
    [
      {
        outcome: 'converted',
        score: { trackedScore: 'AD', opponentScore: '40' },
      },
      {
        outcome: 'saved',
        score: { trackedScore: 'AD', opponentScore: '40' },
      },
    ],
  );

  const opponentAdvantageChances = gamePoints(
    1,
    3,
    'tracked',
    [
      'tracked',
      'opponent',
      'tracked',
      'opponent',
      'tracked',
      'opponent',
      'opponent',
      'tracked',
      'opponent',
      'opponent',
    ],
    false,
    29,
  );
  assert.deepEqual(
    getLocalPointHistory(
      opponentAdvantageChances,
      'standard',
      'break_points',
    ).map(({ breakPointScoreBefore }) => breakPointScoreBefore),
    [
      { trackedScore: '40', opponentScore: 'AD' },
      { trackedScore: '40', opponentScore: 'AD' },
    ],
  );

  const tieBreakHistory = getLocalPointHistory(
    standardTiebreakPoints,
    'standard',
    'all',
  );
  assert.ok(
    tieBreakHistory.every(
      ({ breakPointOutcome, breakPointScoreBefore }) =>
        breakPointOutcome === null && breakPointScoreBefore === null,
    ),
  );
  assert.ok(
    getLocalPointHistory(match.points, 'match_tiebreak', 'all').every(
      ({ breakPointOutcome, breakPointScoreBefore }) =>
        breakPointOutcome === null && breakPointScoreBefore === null,
    ),
  );
  assert.equal(
    Object.hasOwn(savedZeroForty[0], 'breakPointScoreBefore'),
    false,
  );
});

test('break-point report rates update after an outcome is undone and replaced', () => {
  const { match } = breakPointSampleMatch();
  const [setOne, ...otherCompletedSets] = match.completedSets;
  assert.ok(setOne);
  const convertedPoint = setOne.points.at(-1);
  assert.ok(convertedPoint);
  assert.equal(
    getBreakPointPointOutcomes(setOne.points, 'standard').at(-1),
    'converted',
  );

  const buildBreakPointReport = (completedSetPoints) => {
    const updatedMatch = {
      ...match,
      completedSets: [
        { ...setOne, points: completedSetPoints },
        ...otherCompletedSets,
      ],
    };
    const insights = calculateLocalInsights(updatedMatch);
    const html = buildPlayerReportHtml(
      {
        matchDate: '2026-10-30',
        event: 'Test match',
        round: 'Final',
        trackedPlayer: 'Tracked',
        opponent: 'Opponent',
        surface: 'Hard',
        matchStatus: 'complete',
      },
      { ...emptyInsight, ...insights },
      emptyPerformance,
      ['break-points'],
    );
    const totalRow = (heading) => {
      const row = reportRows(html, heading).find((item) =>
        item.startsWith('Match total'),
      );
      assert.ok(row, `Missing match total for ${heading}`);
      return row;
    };
    return {
      breakPoints: insights.breakPoints,
      conversionTotal: totalRow('Returning · opportunities created'),
      defenseTotal: totalRow('Serving · break points faced'),
    };
  };

  const afterUndo = buildBreakPointReport(setOne.points.slice(0, -1));
  assert.deepEqual(afterUndo.breakPoints, {
    tracked: { opportunities: 2, converted: 1, faced: 3, saved: 3 },
    opponent: { opportunities: 3, converted: 0, faced: 2, saved: 1 },
  });
  assert.match(
    afterUndo.conversionTotal,
    /Match total.*1\/2 \(50\.0%\).*1\/2 \(50\.0%\).*0\/3 \(0\.0%\).*3\/3 \(100\.0%\)/,
  );
  assert.match(
    afterUndo.defenseTotal,
    /Match total.*3\/3 \(100\.0%\).*0\/3 \(0\.0%\).*1\/2 \(50\.0%\).*1\/2 \(50\.0%\)/,
  );

  const replacementPoint = {
    ...convertedPoint,
    id: 'replacement-break-point',
    winner: 'opponent',
  };
  const afterReplacement = buildBreakPointReport([
    ...setOne.points.slice(0, -1),
    replacementPoint,
  ]);
  assert.deepEqual(afterReplacement.breakPoints, {
    tracked: { opportunities: 3, converted: 1, faced: 3, saved: 3 },
    opponent: { opportunities: 3, converted: 0, faced: 3, saved: 2 },
  });
  assert.match(
    afterReplacement.conversionTotal,
    /Match total.*1\/3 \(33\.3%\).*2\/3 \(66\.7%\).*0\/3 \(0\.0%\).*3\/3 \(100\.0%\)/,
  );
  assert.match(
    afterReplacement.defenseTotal,
    /Match total.*3\/3 \(100\.0%\).*0\/3 \(0\.0%\).*2\/3 \(66\.7%\).*1\/3 \(33\.3%\)/,
  );
});

test('head-to-head report removes URL-like text and keeps names and statistics', () => {
  const html = buildHeadToHeadReportHtml({
    trackedPlayer: 'Alex https://players.example.com/alex',
    opponent: 'Jordan',
    meetings: [],
    matchesRecorded: 1,
    completedMatches: 1,
    matchesWon: 1,
    matchesLost: 0,
    completedMatchesWithoutWinner: 0,
    matchesInProgress: 0,
    setsRecorded: 1,
    completedSets: 1,
    setsWon: 1,
    setsLost: 0,
    completedSetsWithoutWinner: 0,
    insights: emptyInsight,
    performance: {
      ...emptyPerformance,
      feedback: ['Strong serve. www.analysis.example.org/report'],
    },
    personalAverageInsights: emptyInsight,
    personalAveragePerformance: emptyPerformance,
    personalAverageMatches: 1,
  });

  assertCleanReport(html);
  assert.match(html, /Alex/);
  assert.match(html, /Jordan/);
  assert.match(html, /Strong serve\./);
  assert.match(html, /Head-to-Head Report/);
  assert.match(html, />Serve</);
  assert.match(html, />Return and points</);
  assert.match(html, /HEAD-TO-HEAD · MATCH ANALYSIS/);
  assert.doesNotMatch(html, /TENNISSCORING|LOCAL MATCH ANALYSIS/i);
});

test('head-to-head match rows identify retirement and walkover winners', () => {
  const retirementMeeting = breakPointMeeting(
    'alex-bailey-retirement',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-10-30',
  );
  retirementMeeting.summary.winner = 'opponent';
  retirementMeeting.summary.matchOutcome = {
    reason: 'retirement',
    winner: 'opponent',
  };
  const retirementReport = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    [retirementMeeting],
    [retirementMeeting],
  );
  const retirementHtml = buildHeadToHeadReportHtml(retirementReport);

  assert.match(retirementHtml, /Winner by retirement: Bailey/);
});

test('head-to-head reports compare selected local benchmarks without exposing preset names', () => {
  const report = {
    trackedPlayer: 'Alex',
    opponent: 'Jordan',
    meetings: [],
    matchesRecorded: 1,
    completedMatches: 1,
    matchesWon: 1,
    matchesLost: 0,
    completedMatchesWithoutWinner: 0,
    matchesInProgress: 0,
    setsRecorded: 1,
    completedSets: 1,
    setsWon: 1,
    setsLost: 0,
    completedSetsWithoutWinner: 0,
    insights: emptyInsight,
    performance: emptyPerformance,
    personalAverageInsights: emptyInsight,
    personalAveragePerformance: emptyPerformance,
    personalAverageMatches: 1,
  };
  const html = buildHeadToHeadReportHtml(report, undefined, {
    benchmarks: [
      {
        id: 'reference-one',
        name: 'Private season label',
        updatedAt: '2026-10-30T10:00:00.000Z',
        firstServePointsWon: 75.1,
        secondServePointsWon: 56.4,
        serviceGamesWon: 86.8,
      },
      {
        id: 'reference-two',
        name: 'Private event label',
        updatedAt: '2026-10-30T10:00:00.000Z',
        firstServePointsWon: 79.2,
        secondServePointsWon: null,
        serviceGamesWon: 94.3,
      },
    ],
  });

  assert.match(html, /User reference 1/);
  assert.match(html, /User reference 2/);
  assert.match(
    html,
    /<td>First-serve points won<\/td>.*?<td>75\.1%<\/td><td>79\.2%<\/td>/s,
  );
  assert.match(
    html,
    /<td>Second-serve points won<\/td>.*?<td>56\.4%<\/td><td>—<\/td>/s,
  );
  assert.match(
    html,
    /<td>Service games won<\/td>.*?<td>86\.8%<\/td><td>94\.3%<\/td>/s,
  );
  assert.doesNotMatch(html, /Private season label|Private event label/);
});

test('selected benchmark edits and selection changes invalidate reviewed head-to-head reports', () => {
  const selected = {
    id: 'local-season',
    updatedAt: '2026-10-30T10:00:00.000Z',
    firstServePointsWon: 75.1,
    secondServePointsWon: 56.4,
    serviceGamesWon: 86.8,
  };
  const reviewed = buildHeadToHeadReportReviewVersion(
    'match-1:2026-10-30',
    ['serve'],
    [selected],
    'named',
  );

  assert.notEqual(
    buildHeadToHeadReportReviewVersion(
      'match-1:2026-10-30',
      ['serve'],
      [{ ...selected, updatedAt: '2026-10-30T10:01:00.000Z' }],
      'named',
    ),
    reviewed,
  );
  assert.notEqual(
    buildHeadToHeadReportReviewVersion(
      'match-1:2026-10-30',
      ['serve'],
      [{ ...selected, firstServePointsWon: 77 }],
      'named',
    ),
    reviewed,
  );
  assert.notEqual(
    buildHeadToHeadReportReviewVersion(
      'match-1:2026-10-30',
      ['serve'],
      [],
      'named',
    ),
    reviewed,
  );
});

test('anonymized single-match reports replace names in headings and match notes', () => {
  const match = performanceSampleMatch();
  match.trackedPlayer = 'Alex';
  match.opponent = 'Bailey';
  match.event = 'Alex vs Bailey';
  match.gameNotes = [
    { setNumber: 1, gameNumber: 1, note: 'Alex moved Bailey wide' },
  ];
  const originalMatch = structuredClone(match);
  const insights = calculateLocalInsights(match);
  const summary = summarizePlayerPerformance(insights);

  const anonymousHtml = buildPlayerReportHtml(
    match,
    insights,
    summary,
    undefined,
    [],
    { hidePlayerNames: true },
  );
  const namedHtml = buildPlayerReportHtml(match, insights, summary);
  const customHtml = buildPlayerReportHtml(
    match,
    insights,
    summary,
    undefined,
    [],
    {
      hidePlayerNames: true,
      labels: { trackedPlayer: 'Main athlete', opponent: 'Visitor' },
    },
  );
  const accidentalNameHtml = buildPlayerReportHtml(
    match,
    insights,
    summary,
    undefined,
    [],
    {
      hidePlayerNames: true,
      labels: { trackedPlayer: 'Alex', opponent: 'Bailey' },
    },
  );

  assert.match(anonymousHtml, /Player A/);
  assert.match(anonymousHtml, /Player B/);
  assert.doesNotMatch(anonymousHtml, /Alex|Bailey/i);
  assert.match(customHtml, /Main athlete/);
  assert.match(customHtml, /Visitor/);
  assert.doesNotMatch(customHtml, /Alex|Bailey/i);
  assert.doesNotMatch(accidentalNameHtml, /Alex|Bailey/i);
  assert.match(accidentalNameHtml, /Player A/);
  assert.match(accidentalNameHtml, /Player B/);
  assert.match(namedHtml, /Alex/);
  assert.match(namedHtml, /Bailey/);
  assert.deepEqual(match, originalMatch);

  const initialsMatch = performanceSampleMatch();
  initialsMatch.trackedPlayer = 'A';
  initialsMatch.opponent = 'B';
  initialsMatch.event = 'Player A vs Player B';
  const initialsInsights = calculateLocalInsights(initialsMatch);
  const initialsHtml = buildPlayerReportHtml(
    initialsMatch,
    initialsInsights,
    summarizePlayerPerformance(initialsInsights),
    undefined,
    [],
    { hidePlayerNames: true },
  );
  assert.match(initialsHtml, /Player A/);
  assert.match(initialsHtml, /Player B/);
  assert.doesNotMatch(initialsHtml, /Player Player/);
});

test('anonymized head-to-head reports hide player names in match results', () => {
  const meeting = breakPointMeeting(
    'alex-bailey',
    'Alex',
    'Bailey',
    { opportunities: 4, converted: 2, faced: 5, saved: 3 },
    { opportunities: 1, converted: 1, faced: 3, saved: 1 },
    '2026-10-01',
  );
  const report = buildHeadToHeadReport('Alex', 'Bailey', [meeting], [meeting]);
  const originalReport = structuredClone(report);

  const anonymousHtml = buildHeadToHeadReportHtml(
    report,
    undefined,
    { hidePlayerNames: true },
  );
  const namedHtml = buildHeadToHeadReportHtml(report);
  const customHtml = buildHeadToHeadReportHtml(
    report,
    undefined,
    {
      hidePlayerNames: true,
      labels: { trackedPlayer: 'Main athlete', opponent: 'Visitor' },
    },
  );
  const accidentalNameHtml = buildHeadToHeadReportHtml(
    report,
    undefined,
    {
      hidePlayerNames: true,
      labels: { trackedPlayer: 'Alex', opponent: 'Bailey' },
    },
  );

  assert.match(anonymousHtml, /Player A/);
  assert.match(anonymousHtml, /Player B/);
  assert.doesNotMatch(anonymousHtml, /Alex|Bailey/i);
  assert.match(customHtml, /Main athlete/);
  assert.match(customHtml, /Visitor/);
  assert.doesNotMatch(customHtml, /Alex|Bailey/i);
  assert.doesNotMatch(accidentalNameHtml, /Alex|Bailey/i);
  assert.match(accidentalNameHtml, /Player A/);
  assert.match(accidentalNameHtml, /Player B/);
  assert.match(namedHtml, /Alex/);
  assert.match(namedHtml, /Bailey/);
  assert.deepEqual(report, originalReport);
});

test('single-match PDF includes only selected analysis sections', () => {
  const insights = {
    ...emptyInsight,
    serveStats: {
      tracked: { ...emptySide },
      opponent: { ...emptySide },
    },
  };
  const html = buildPlayerReportHtml(
    {
      matchDate: '2026-10-30',
      trackedPlayer: 'Alex',
      opponent: 'Jordan',
      surface: 'Hard',
      matchStatus: 'complete',
    },
    insights,
    emptyPerformance,
    PLAYER_REPORT_SECTION_PRESETS[1].sections,
  );

  assert.match(html, /<h2>Serve<\/h2>/);
  assert.match(html, /<h2>Return<\/h2>/);
  assert.match(html, /<h2>Set scores and winners<\/h2>/);
  assert.doesNotMatch(html, /<h2>Coaching notes<\/h2>/);
  assert.match(html, /<strong>Points logged:<\/strong> 4/);
});

test('head-to-head PDF includes only selected analysis sections', () => {
  const html = buildHeadToHeadReportHtml(
    {
      trackedPlayer: 'Alex',
      opponent: 'Jordan',
      meetings: [],
      matchesRecorded: 1,
      completedMatches: 1,
      matchesWon: 1,
      matchesLost: 0,
      completedMatchesWithoutWinner: 0,
      matchesInProgress: 0,
      setsRecorded: 1,
      completedSets: 1,
      setsWon: 1,
      setsLost: 0,
      completedSetsWithoutWinner: 0,
      insights: emptyInsight,
      performance: emptyPerformance,
      personalAverageInsights: emptyInsight,
      personalAveragePerformance: emptyPerformance,
      personalAverageMatches: 1,
    },
    HEAD_TO_HEAD_REPORT_SECTION_PRESETS[1].sections,
  );

  assert.match(html, /<h2>Serve<\/h2>/);
  assert.match(html, /<h2>Meetings and set scores<\/h2>/);
  assert.match(html, /<h2>Return and points<\/h2>/);
  assert.doesNotMatch(html, /<h2>Point-ending tags<\/h2>/);
  assert.doesNotMatch(html, /<h2>Coaching observations<\/h2>/);
});

test('clearing all sections keeps match details without analysis sections', () => {
  const playerHtml = buildPlayerReportHtml(
    {
      matchDate: '2026-10-30',
      trackedPlayer: 'Alex',
      opponent: 'Jordan',
      surface: 'Hard',
      matchStatus: 'complete',
    },
    {
      ...emptyInsight,
      serveStats: {
        tracked: { ...emptySide },
        opponent: { ...emptySide },
      },
    },
    emptyPerformance,
    [],
  );
  const headToHeadHtml = buildHeadToHeadReportHtml(
    {
      trackedPlayer: 'Alex',
      opponent: 'Jordan',
      meetings: [],
      matchesRecorded: 1,
      completedMatches: 1,
      matchesWon: 1,
      matchesLost: 0,
      completedMatchesWithoutWinner: 0,
      matchesInProgress: 0,
      setsRecorded: 1,
      completedSets: 1,
      setsWon: 1,
      setsLost: 0,
      completedSetsWithoutWinner: 0,
      insights: emptyInsight,
      performance: emptyPerformance,
      personalAverageInsights: emptyInsight,
      personalAveragePerformance: emptyPerformance,
      personalAverageMatches: 1,
    },
    [],
  );

  assert.match(playerHtml, /Tennis Match Report/);
  assert.match(playerHtml, /Alex/);
  assert.doesNotMatch(playerHtml, /<h2>/);
  assert.match(headToHeadHtml, /Head-to-Head Report/);
  assert.match(headToHeadHtml, /Jordan/);
  assert.doesNotMatch(headToHeadHtml, /<h2>/);
});

test('long match reports keep all set, feedback, observation, and shot details printable', () => {
  const longSets = Array.from({ length: 18 }, (_, index) => {
    const setNumber = index + 1;
    const isMatchTiebreak = setNumber % 3 === 0;
    return {
      setNumber,
      format: isMatchTiebreak ? 'match_tiebreak' : 'standard',
      isComplete: true,
      trackedGames: isMatchTiebreak ? 0 : 6,
      opponentGames: isMatchTiebreak ? 0 : 4,
      trackedTiebreakPoints: isMatchTiebreak ? 10 : setNumber % 2 ? 7 : 0,
      opponentTiebreakPoints: isMatchTiebreak ? 8 : setNumber % 2 ? 5 : 0,
      tiebreakTarget: isMatchTiebreak ? 10 : 7,
      pointCount: 36,
      breakPoints: {
        tracked: { ...emptyBreakPoints },
        opponent: { ...emptyBreakPoints },
      },
      gameNotes: Array.from({ length: 8 }, (_, noteIndex) => ({
        gameNumber: noteIndex + 1,
        note: `Set ${setNumber} observation ${noteIndex + 1}: the player adjusted court position and targeted the opponent's backhand during a long rally.`,
      })),
      review: {
        strokeRatings: { first_serve: 4 },
        strokeNotes: { first_serve: `Set ${setNumber} serve placement note.` },
        footworkNote: `Set ${setNumber}: recovery steps and court coverage were recorded in detail.`,
        tacticalNote: `Set ${setNumber}: varied pace and attacked short balls.`,
        mentalNote: `Set ${setNumber}: reset routine stayed consistent after lost points.`,
      },
    };
  });
  const html = buildPlayerReportHtml(
    {
      matchDate: '2026-10-30',
      event: 'Long Match Sample',
      round: 'Final',
      trackedPlayer: 'Player A',
      opponent: 'Player B',
      surface: 'Hard',
      matchStatus: 'complete',
    },
    {
      ...emptyInsight,
      pointCount: 648,
      sets: longSets,
      strokeTallies: [
        {
          player: 'tracked',
          strokeType: 'first_serve',
          inPlay: 122,
          errors: 31,
          winners: 52,
          sampleCount: 205,
        },
      ],
      strokeNotes: Array.from({ length: 144 }, (_, index) => ({
        setNumber: (index % 18) + 1,
        gameNumber: (index % 10) + 1,
        sequenceNumber: index + 1,
        player: index % 2 ? 'tracked' : 'opponent',
        strokeType: 'first_serve',
        result: index % 4 ? 'in_play' : 'winner',
        note: `Point ${index + 1}: controlled depth, recovered to the center, and followed the tactical plan.`,
      })),
    },
    {
      ...emptyPerformance,
      taggedPointCount: 280,
      codeInsights: [
        { code: 'A', count: 48, trackedWon: 48 },
        { code: 'F', count: 64, trackedWon: 51 },
        { code: 'B', count: 39, trackedWon: 28 },
        { code: 'V', count: 22, trackedWon: 18 },
        { code: 'O', count: 8, trackedWon: 7 },
        { code: 'P', count: 14, trackedWon: 10 },
        { code: 'N', count: 33, trackedWon: 7 },
        { code: 'L', count: 26, trackedWon: 8 },
        { code: 'W', count: 12, trackedWon: 4 },
        { code: 'D', count: 7, trackedWon: 0 },
        { code: 'FE', count: 7, trackedWon: 0 },
      ],
      shotDirections: [
        { label: 'Cross-court', count: 80, trackedWon: 51, trackedWinPercent: 63.75 },
        { label: 'Down the line', count: 50, trackedWon: 32, trackedWinPercent: 64 },
      ],
      rallyLengths: [
        { label: '1–4 shots', count: 84, trackedWon: 54, trackedWinPercent: 64 },
        { label: '5–8 shots', count: 102, trackedWon: 61, trackedWinPercent: 59.8 },
      ],
      shotDirectionTaggedCount: 130,
      rallyLengthTaggedCount: 186,
      feedback: Array.from(
        { length: 24 },
        (_, index) =>
          `Feedback ${index + 1}: continue using the first serve to create space, then recover with compact steps and choose a high-margin target under pressure.`,
      ),
    },
  );

  assertCleanReport(html);
  assert.equal(
    (html.match(/<td>Set \d+<span class="sub">Complete<\/span><\/td>/g) ?? []).length,
    18,
  );
  assert.match(html, /Match tie-break 10–8 \(target 10, win by 2\)/);
  assert.match(html, /Set 18 observations/);
  assert.match(html, /class="observation-group"/);
  assert.match(html, /Game 8: Set 18 observation 8/);
  assert.match(html, /Cross-court/);
  assert.match(html, /5–8 shots/);
  assert.match(html, /Forehand winner/);
  assert.match(html, /Feedback 24:/);
  assert.match(html, /Point 144:/);
  assert.match(html, /thead\s*\{\s*display:\s*table-header-group;/);
  assert.match(html, /tr\s*\{[^}]*page-break-inside:\s*avoid/);
  assert.match(html, /h2\s*\{[^}]*page-break-after:\s*avoid/);
  assert.match(html, /h3\s*\{[^}]*page-break-after:\s*avoid/);
  assert.match(html, /th, td\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(html, /\.feedback\s*\{[^}]*page-break-inside:\s*auto/);
  assert.match(html, /\.feedback li\s*\{[^}]*page-break-inside:\s*avoid/);
  assert.match(html, /\.observation-group\s*\{[^}]*page-break-inside:\s*avoid/);
  assert.match(html, /\.observation-list li\s*\{[^}]*page-break-inside:\s*avoid/);
});

test('native report preview creates a local PDF before opening that same file', async () => {
  const events = [];
  const html = '<h1>Private match report</h1>';
  const uri = 'file:///app/cache/player-report.pdf';
  const reviewedUri = await createAndPreviewLocalPdf(html, 'android', {
    async printToFileAsync(options) {
      events.push({ action: 'generate', options });
      return { uri };
    },
    async printAsync(options) {
      events.push({ action: 'preview', options });
    },
  });

  assert.equal(reviewedUri, uri);
  assert.deepEqual(events, [
    { action: 'generate', options: { html } },
    { action: 'preview', options: { uri } },
  ]);
});

test('web report preview keeps using the HTML print dialog without a local share file', async () => {
  const events = [];
  const html = '<h1>Private match report</h1>';
  const uri = await createAndPreviewLocalPdf(html, 'web', {
    async printToFileAsync(options) {
      events.push({ action: 'generate', options });
      return { uri: 'file:///unused.pdf' };
    },
    async printAsync(options) {
      events.push({ action: 'preview', options });
    },
  });

  assert.equal(uri, null);
  assert.deepEqual(events, [{ action: 'preview', options: { html } }]);
});
