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
  if (request === '@/lib/report-review') {
    return originalLoad.call(
      this,
      path.join(__dirname, '../lib/report-review.ts'),
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
playerInsightsExports = require('../lib/player-insights.ts');
playerReportExports = require('../lib/player-report-html.ts');
headToHeadExports = require('../lib/head-to-head.ts');
const { buildPlayerReportHtml } = playerReportExports;
const {
  buildHeadToHeadReportHtml,
  buildHeadToHeadReportReviewVersion,
} = require('../lib/head-to-head-report-html.ts');
const {
  buildReportReviewVersion,
  getReportNameVisibilityVersion,
  isReportReviewCurrent,
} = require('../lib/report-review.ts');
const { summarizeMatchNotes, summarizePlayerPerformance } = playerInsightsExports;
const {
  aggregateLocalInsights,
  buildHeadToHeadReport,
  getHeadToHeadOpponentOptions,
} = headToHeadExports;
Module._load = originalLoad;
const {
  createAndPreviewLocalPdf,
  shareReviewedLocalPdf,
} = require('../lib/report-pdf.ts');
const headToHeadScreenSource = fs.readFileSync(
  path.join(__dirname, '../app/head-to-head.tsx'),
  'utf8',
);
const homeScreenSource = fs.readFileSync(
  path.join(__dirname, '../app/index.tsx'),
  'utf8',
);
const playerMatchScreenSource = fs.readFileSync(
  path.join(__dirname, '../app/matches/[id].tsx'),
  'utf8',
);
const reportNameVisibilityHookSource = fs.readFileSync(
  path.join(__dirname, '../hooks/useLocalReportNameVisibility.ts'),
  'utf8',
);
const reportSectionPickerSource = fs.readFileSync(
  path.join(__dirname, '../components/ReportSectionPicker.tsx'),
  'utf8',
);
const localReportLayoutManagerSource = fs.readFileSync(
  path.join(__dirname, '../components/LocalReportLayoutManager.tsx'),
  'utf8',
);
const {
  addLocalSet,
  appendLocalNotePrompt,
  calculateBreakPointStats,
  calculateLocalInsights,
  createLocalMatch,
  deleteLocalMatch,
  editLocalPointWinner,
  getLocalInsights,
  getLocalMatch,
  getBreakPointPointOutcomes,
  getLocalPointHistory,
  LOCAL_MATCH_NOTE_PROMPTS,
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
    'game-notes',
    'break-points',
  ]);
  assert.deepEqual(
    PLAYER_REPORT_SECTION_PRESETS[2].sections,
    allPlayerReportSections(),
  );
  assert.ok(allPlayerReportSections().includes('break-point-context'));
  assert.ok(
    PLAYER_REPORT_SECTION_PRESETS[2].sections.includes('break-point-context'),
  );
  assert.ok(
    !PLAYER_REPORT_SECTION_PRESETS[0].sections.includes('break-point-context'),
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
  assert.ok(allHeadToHeadReportSections().includes('break-point-context'));
  assert.ok(
    HEAD_TO_HEAD_REPORT_SECTION_PRESETS[2].sections.includes(
      'break-point-context',
    ),
  );
  assert.ok(
    !HEAD_TO_HEAD_REPORT_SECTION_PRESETS[1].sections.includes(
      'break-point-context',
    ),
  );
});

test('single-match and head-to-head report pickers expose saved local layouts', () => {
  assert.match(playerMatchScreenSource, /reportType="player"/);
  assert.match(headToHeadScreenSource, /reportType="head-to-head"/);
  assert.match(reportSectionPickerSource, /<LocalReportLayoutManager/);
  assert.match(reportSectionPickerSource, /onPress=\{\(\) => onToggle\(id\)\}/);
  assert.match(headToHeadScreenSource, /getLocalMatch\(meeting\.summary\.id\)/);
  assert.match(localReportLayoutManagerSource, /saveLocalReportLayout\(/);
  assert.match(localReportLayoutManagerSource, /renameLocalReportLayout\(/);
  assert.match(localReportLayoutManagerSource, /deleteLocalReportLayout\(/);
  assert.match(localReportLayoutManagerSource, /onApply\(validSections\)/);
  assert.match(localReportLayoutManagerSource, /LOCAL_REPORT_LAYOUTS_KEY/);
});

test('both report screens use the same saved local hide-names preference', () => {
  for (const screenSource of [playerMatchScreenSource, headToHeadScreenSource]) {
    assert.match(screenSource, /useLocalReportNameVisibility/);
    assert.match(screenSource, /reportNameVisibility\.toggle/);
    assert.match(screenSource, /reportNameVisibility\.isReady/);
    assert.match(screenSource, /reportNameVisibility\.isSaving/);
    assert.match(
      screenSource,
      /getReportNameVisibilityVersion\(\s*hidePlayerNames/,
    );
    assert.match(screenSource, /!reportLabelsReady/);
  }

  assert.match(
    reportNameVisibilityHookSource,
    /LOCAL_REPORT_NAME_VISIBILITY_KEY/,
  );
  assert.match(
    reportNameVisibilityHookSource,
    /saveLocalReportHideNamesPreference/,
  );
  assert.match(
    reportNameVisibilityHookSource,
    /queryClient\.setQueryData\(\s*LOCAL_REPORT_NAME_VISIBILITY_KEY,\s*hidePlayerNames/s,
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

function reportRowsInTable(html, className) {
  const start = html.indexOf(`<table class="${className}">`);
  assert.notEqual(start, -1, `Missing report table: ${className}`);
  const bodyStart = html.indexOf('<tbody>', start) + '<tbody>'.length;
  const bodyEnd = html.indexOf('</tbody>', bodyStart);
  return [...html.slice(bodyStart, bodyEnd).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((match) => match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function emptySurfaceBreakPointBaselines() {
  return ['Hard', 'Clay', 'Grass', 'Carpet', 'Other'].map((surface) => ({
    surface,
    matchCount: 0,
    breakPoints: { ...emptyBreakPoints },
  }));
}

function emptyMatchOutcomeTotals() {
  const emptyCategory = { count: 0, wins: 0, losses: 0, noWinner: 0 };
  return {
    ordinary: { ...emptyCategory },
    retirements: { ...emptyCategory },
    walkovers: { ...emptyCategory },
    inProgress: 0,
  };
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
    matchOutcomeTotals: emptyMatchOutcomeTotals(),
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
    personalAverageBreakPointsBySurface: emptySurfaceBreakPointBaselines(),
  };
}

async function createSavedPointReportFixture({
  matchDate = '2026-10-30',
  event = 'Saved-point report check',
  rallyPointIndex = 2,
  errorPointIndex = 3,
  pointInputs = [
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
  ],
} = {}) {
  const match = await createLocalMatch({
    matchDate,
    event,
    round: 'Final',
    trackedPlayer: 'Tracked',
    opponent: 'Opponent',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  let savedMatch = match;
  for (const input of pointInputs) {
    savedMatch = await recordLocalPoint(match.id, input);
  }

  return {
    matchId: match.id,
    rallyPointId: savedMatch.points[rallyPointIndex].id,
    errorPointId: savedMatch.points[errorPointIndex].id,
  };
}

async function createTwoSetSavedPointReportFixture() {
  const match = await createLocalMatch({
    matchDate: '2026-10-30',
    event: 'Two-set report correction check',
    round: 'Final',
    trackedPlayer: 'Tracked',
    opponent: 'Opponent',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  const firstSetWinners =
    'ttttttotottttootttttootototottotoooooooottootoootttt';
  let savedMatch = match;
  for (const [index, winnerCode] of [...firstSetWinners].entries()) {
    savedMatch = await recordLocalPoint(match.id, {
      winner: winnerCode === 't' ? 'tracked' : 'opponent',
      endingCode:
        index === 0 ? 'A' : index === 6 ? 'N' : index === 20 ? 'F' : null,
    });
  }
  savedMatch = await addLocalSet(match.id, 'standard');
  const laterSetInputs = [
    { winner: 'tracked', firstServeFault: true },
    { winner: 'tracked' },
    { winner: 'tracked' },
    { winner: 'tracked' },
    { winner: 'opponent' },
    { winner: 'opponent', endingCode: 'N' },
  ];
  for (const input of laterSetInputs) {
    savedMatch = await recordLocalPoint(match.id, input);
  }

  return {
    matchId: match.id,
    rallyPointId: savedMatch.completedSets[0].points[20].id,
  };
}

async function buildSavedPointReportSnapshot(
  matchId,
  meetingIds = [matchId],
) {
  const match = await getLocalMatch(matchId);
  assert.ok(match, 'Expected the corrected match to remain saved locally');
  const insights = calculateLocalInsights(match);
  const performance = summarizePlayerPerformance(insights, 1);
  const playerHtml = buildPlayerReportHtml(match, insights, performance);
  const summaries = await listLocalMatches();
  const summary = summaries.find(({ id }) => id === matchId);
  assert.ok(summary, 'Expected a match-book entry for the saved match');
  const meetings = await Promise.all(
    meetingIds.map(async (meetingId) => {
      const meetingSummary = summaries.find(({ id }) => id === meetingId);
      assert.ok(meetingSummary, `Expected saved meeting ${meetingId}`);
      const meetingInsights = await getLocalInsights(meetingId);
      assert.ok(meetingInsights, `Expected insights for meeting ${meetingId}`);
      return { summary: meetingSummary, insights: meetingInsights };
    }),
  );
  const headToHeadReport = buildHeadToHeadReport(
    match.trackedPlayer,
    match.opponent,
    meetings,
  );

  return {
    match,
    insights,
    performance,
    playerHtml,
    headToHeadReport,
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
  surface = 'Hard',
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
      matchDate,
      event: null,
      round: null,
      setNumber: 1,
      trackedPlayer,
      opponent,
      surface,
      status: 'complete',
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

test('surface break-point averages pool chances and mark missing rates unavailable', () => {
  const hardOne = breakPointMeeting(
    'alex-bailey-hard',
    'Alex',
    'Bailey',
    { opportunities: 4, converted: 2, faced: 5, saved: 3 },
    { opportunities: 1, converted: 1, faced: 3, saved: 2 },
    '2026-10-01',
    'Hard',
  );
  const hardTwo = breakPointMeeting(
    'alex-casey-hard',
    'Alex',
    'Casey',
    { opportunities: 6, converted: 3, faced: 4, saved: 2 },
    { opportunities: 2, converted: 1, faced: 3, saved: 2 },
    '2026-10-02',
    'Hard',
  );
  const clay = breakPointMeeting(
    'alex-casey-clay',
    'Alex',
    'Casey',
    { opportunities: 2, converted: 1, faced: 2, saved: 1 },
    { opportunities: 1, converted: 0, faced: 2, saved: 1 },
    '2026-10-03',
    'Clay',
  );
  const grassWithoutChances = breakPointMeeting(
    'alex-drew-grass',
    'Alex',
    'Drew',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-10-04',
    'Grass',
  );
  const carpet = breakPointMeeting(
    'alex-ellis-carpet',
    'Alex',
    'Ellis',
    { opportunities: 3, converted: 2, faced: 2, saved: 1 },
    { opportunities: 0, converted: 0, faced: 1, saved: 0 },
    '2026-10-05',
    'Carpet',
  );
  const otherSurface = breakPointMeeting(
    'alex-fox-other',
    'Alex',
    'Fox',
    { opportunities: 9, converted: 8, faced: 8, saved: 4 },
    { opportunities: 1, converted: 1, faced: 2, saved: 1 },
    '2026-10-06',
    'Other',
  );
  const otherSurfaceWithoutChances = breakPointMeeting(
    'alex-gale-other-no-chances',
    'Alex',
    'Gale',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-10-07',
    'Other',
  );
  const reverseOriented = breakPointMeeting(
    'bailey-alex-hard',
    'Bailey',
    'Alex',
    { opportunities: 100, converted: 100, faced: 100, saved: 0 },
    { opportunities: 100, converted: 0, faced: 100, saved: 0 },
    '2026-10-08',
    'Hard',
  );

  const report = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    [hardOne],
    [
      hardOne,
      hardTwo,
      clay,
      grassWithoutChances,
      carpet,
      otherSurface,
      otherSurfaceWithoutChances,
      reverseOriented,
    ],
  );

  assert.equal(report.personalAverageMatches, 7);
  assert.deepEqual(
    report.personalAverageBreakPointsBySurface.map(
      ({ surface, matchCount, breakPoints }) => ({
        surface,
        matchCount,
        breakPoints,
      }),
    ),
    [
      {
        surface: 'Hard',
        matchCount: 2,
        breakPoints: { opportunities: 10, converted: 5, faced: 9, saved: 5 },
      },
      {
        surface: 'Clay',
        matchCount: 1,
        breakPoints: { opportunities: 2, converted: 1, faced: 2, saved: 1 },
      },
      {
        surface: 'Grass',
        matchCount: 1,
        breakPoints: { opportunities: 0, converted: 0, faced: 0, saved: 0 },
      },
      {
        surface: 'Carpet',
        matchCount: 1,
        breakPoints: { opportunities: 3, converted: 2, faced: 2, saved: 1 },
      },
      {
        surface: 'Other',
        matchCount: 2,
        breakPoints: { opportunities: 9, converted: 8, faced: 8, saved: 4 },
      },
    ],
  );

  const html = buildHeadToHeadReportHtml(report);
  assert.deepEqual(
    reportRows(html, 'Personal break-point rates by court surface'),
    [
      'Matches included 2 1 1 1 2',
      'Break points converted 5/10 · 50.0% 1/2 · 50.0% — 2/3 · 66.7% 8/9 · 88.9%',
      'Break points missed 5/10 · 50.0% 1/2 · 50.0% — 1/3 · 33.3% 1/9 · 11.1%',
      'Break points saved 5/9 · 55.6% 1/2 · 50.0% — 1/2 · 50.0% 4/8 · 50.0%',
      'Break points lost while serving 4/9 · 44.4% 1/2 · 50.0% — 1/2 · 50.0% 4/8 · 50.0%',
    ],
  );
  assert.match(
    html,
    /Other is included as its own group/,
  );
  assert.doesNotMatch(
    buildHeadToHeadReportHtml(report, ['overview']),
    /Personal break-point rates by court surface/,
  );

  const otherWithoutChancesReport = buildHeadToHeadReport(
    'Alex',
    'Gale',
    [otherSurfaceWithoutChances],
    [otherSurfaceWithoutChances],
  );
  const otherWithoutChancesHtml = buildHeadToHeadReportHtml(
    otherWithoutChancesReport,
  );
  assert.deepEqual(
    reportRows(otherWithoutChancesHtml, 'Personal break-point rates by court surface'),
    [
      'Matches included 0 0 0 0 1',
      'Break points converted — — — — —',
      'Break points missed — — — — —',
      'Break points saved — — — — —',
      'Break points lost while serving — — — — —',
    ],
  );
  assert.match(
    headToHeadScreenSource,
    /Hard · Clay · Grass · Carpet · Other/,
  );
  assert.match(
    headToHeadScreenSource,
    /including Other/,
  );
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

test('head-to-head report lists anonymized break-point moments by meeting', () => {
  function meetingWithPointLog(id, matchDate) {
    const meeting = breakPointMeeting(
      id,
      'Alex',
      'Bailey',
      { opportunities: 2, converted: 1, faced: 3, saved: 3 },
      { opportunities: 3, converted: 0, faced: 2, saved: 1 },
      matchDate,
    );
    const { match: sampleMatch } = breakPointSampleMatch();
    return {
      ...meeting,
      match: {
        ...sampleMatch,
        id,
        matchDate,
        trackedPlayer: 'Alex',
        opponent: 'Bailey',
      },
    };
  }

  const olderMeeting = meetingWithPointLog('alex-bailey-older', '2026-10-01');
  const newerMeeting = meetingWithPointLog('alex-bailey-newer', '2026-10-05');
  const meetingWithoutBreakPointMoments = breakPointMeeting(
    'alex-bailey-no-moments',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-09-30',
  );
  const { match: noMomentSampleMatch } = breakPointSampleMatch();
  meetingWithoutBreakPointMoments.match = {
    ...noMomentSampleMatch,
    id: 'alex-bailey-no-moments',
    matchDate: '2026-09-30',
    trackedPlayer: 'Alex',
    opponent: 'Bailey',
    completedSets: [
      setFixture(
        1,
        'standard',
        gamePoints(1, 1, 'tracked', ['tracked', 'tracked', 'tracked', 'tracked']),
      ),
    ],
    setNumber: 2,
    setFormat: 'standard',
    points: [],
  };
  const meetingWithoutPointLog = breakPointMeeting(
    'alex-bailey-no-point-log',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-09-29',
  );
  const report = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    [
      olderMeeting,
      newerMeeting,
      meetingWithoutBreakPointMoments,
      meetingWithoutPointLog,
    ],
    [
      olderMeeting,
      newerMeeting,
      meetingWithoutBreakPointMoments,
      meetingWithoutPointLog,
    ],
  );
  const html = buildHeadToHeadReportHtml(
    report,
    ['break-point-context'],
    {
      hidePlayerNames: true,
      labels: { trackedPlayer: 'Main athlete', opponent: 'Visitor' },
    },
  );
  const rows = reportRowsInTable(html, 'break-point-context-table');

  assert.equal(rows.length, 12);
  assert.match(
    rows[0],
    /Meeting 1 · October 5, 2026 Set 1 Game 1 4 0 40 Saved by Main athlete/,
  );
  assert.match(
    rows[6],
    /Meeting 2 · October 1, 2026 Set 1 Game 1 4 0 40 Saved by Main athlete/,
  );
  assert.match(html, /Main athlete score before/);
  assert.match(html, /Visitor score before/);
  assert.doesNotMatch(html, /Alex|Bailey/);
  const coverageRows = reportRowsInTable(html, 'break-point-coverage-table');
  const savedPointCount = [
    ...newerMeeting.match.completedSets.flatMap((set) => set.points),
    ...newerMeeting.match.points,
  ].length;
  assert.equal(coverageRows.length, 4);
  assert.match(
    coverageRows[0],
    new RegExp(`Meeting 1 · October 5, 2026 ${savedPointCount} points saved 6 found`),
  );
  assert.match(
    coverageRows[2],
    /Meeting 3 · September 30, 2026 4 points saved None found in saved points/,
  );
  assert.match(
    coverageRows[3],
    /Meeting 4 · September 29, 2026 No point log saved Unavailable — no point log/,
  );
  assert.doesNotMatch(coverageRows[2], /24 points saved/);
  assert.doesNotMatch(
    buildHeadToHeadReportHtml(report, ['overview']),
    /<h2>Break-point moments by meeting<\/h2>/,
  );
  assert.equal(
    Object.hasOwn(
      newerMeeting.match.completedSets[0].points[3],
      'breakPointScoreBefore',
    ),
    false,
  );

  newerMeeting.match.completedSets[0].points[3].winner = 'opponent';
  const correctedRows = reportRowsInTable(
    buildHeadToHeadReportHtml(
      report,
      ['break-point-context'],
      {
        hidePlayerNames: true,
        labels: { trackedPlayer: 'Main athlete', opponent: 'Visitor' },
      },
    ),
    'break-point-context-table',
  );
  assert.match(
    correctedRows[0],
    /Meeting 1 · October 5, 2026 Set 1 Game 1 4 0 40 Converted by Visitor/,
  );

  const noPointDataHtml = buildHeadToHeadReportHtml(
    buildHeadToHeadReport(
      'Alex',
      'Bailey',
      [meetingWithoutPointLog],
      [meetingWithoutPointLog],
    ),
    ['break-point-context'],
  );
  assert.match(
    noPointDataHtml,
    /No moments are available to list; see point-log coverage above\./,
  );
});

test('deleting matches clears final head-to-head history and invalidates reviewed PDFs', async () => {
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

  const reviewedVersion = buildHeadToHeadReportReviewVersion(
    remainingReport.meetings
      .map(({ summary }) => `${summary.id}:${summary.updatedAt}`)
      .join('|'),
    allHeadToHeadReportSections(),
    [],
    getReportNameVisibilityVersion(false, {}),
  );
  assert.ok(reviewedVersion);
  const finalMatchId = remainingReport.meetings[0].summary.id;
  assert.equal(await deleteLocalMatch(finalMatchId), true);
  const afterFinalDeletion = await trackedMeetingsFromLocalMatches();
  assert.deepEqual(afterFinalDeletion.summaries, []);
  assert.deepEqual(afterFinalDeletion.meetings, []);
  assert.deepEqual(
    getHeadToHeadOpponentOptions('Alex', afterFinalDeletion.summaries),
    [],
  );

  const emptyHistoryReport = buildHeadToHeadReport(
    'Alex',
    'Casey',
    [],
    afterFinalDeletion.meetings,
  );
  assert.equal(emptyHistoryReport.meetings.length, 0);
  assert.equal(emptyHistoryReport.matchesRecorded, 0);
  assert.equal(emptyHistoryReport.completedMatches, 0);
  assert.equal(emptyHistoryReport.personalAverageMatches, 0);
  assert.equal(emptyHistoryReport.insights.pointCount, 0);
  assert.deepEqual(emptyHistoryReport.insights.breakPoints.tracked, {
    opportunities: 0,
    converted: 0,
    faced: 0,
    saved: 0,
  });
  assert.deepEqual(emptyHistoryReport.insights.breakPoints.opponent, {
    opportunities: 0,
    converted: 0,
    faced: 0,
    saved: 0,
  });
  assert.deepEqual(
    emptyHistoryReport.personalAverageInsights.breakPoints.tracked,
    {
      opportunities: 0,
      converted: 0,
      faced: 0,
      saved: 0,
    },
  );
  assert.ok(
    emptyHistoryReport.personalAverageBreakPointsBySurface.every(
      ({ matchCount, breakPoints }) =>
        matchCount === 0 &&
        breakPoints.opportunities === 0 &&
        breakPoints.faced === 0,
    ),
  );
  const emptyHistoryHtml = buildHeadToHeadReportHtml(emptyHistoryReport);
  assert.match(emptyHistoryHtml, /0 recorded · 0 complete/);
  assert.match(emptyHistoryHtml, /Pooled break-point chances across 0 saved matches/);

  const emptyReportVersion = buildHeadToHeadReportReviewVersion(
    emptyHistoryReport.meetings
      .map(({ summary }) => `${summary.id}:${summary.updatedAt}`)
      .join('|'),
    allHeadToHeadReportSections(),
    [],
    getReportNameVisibilityVersion(false, {}),
  );
  assert.equal(emptyReportVersion, '');
  assert.equal(isReportReviewCurrent(reviewedVersion, emptyReportVersion), false);
  const hasReviewedReport = Boolean(emptyReportVersion) &&
    isReportReviewCurrent(reviewedVersion, emptyReportVersion) &&
    Boolean('file:///reviewed-head-to-head.pdf');
  assert.equal(hasReviewedReport, false);

  assert.match(homeScreenSource, /invalidateQueries\(\{\s*queryKey:\s*LOCAL_MATCH_LIST_KEY\s*\}\)/);
  assert.match(headToHeadScreenSource, /queryKey:\s*LOCAL_MATCH_LIST_KEY/);
  assert.match(headToHeadScreenSource, /!opponentOptions\.length/);
  assert.match(headToHeadScreenSource, /const reportHtml = report && reportBenchmarksQuery\.data/);
  assert.match(headToHeadScreenSource, /!fileUri\s*\|\|\s*!hasReviewedReport/);
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

test('head-to-head pooled stats update after editing one of multiple meetings', async () => {
  storageValues.clear();
  const trackedMeeting = await createSavedPointReportFixture({
    rallyPointIndex: 0,
    errorPointIndex: 1,
    pointInputs: [
      { winner: 'tracked', endingCode: 'F' },
      { winner: 'opponent', endingCode: 'N' },
      { winner: 'opponent', firstServeFault: true },
      { winner: 'tracked', endingCode: 'A' },
    ],
  });
  const controlMeeting = await createSavedPointReportFixture({
    matchDate: '2026-10-29',
    event: 'Unedited control meeting',
    pointInputs: [
      { winner: 'tracked', endingCode: 'A' },
      { winner: 'tracked', endingCode: 'V' },
      { winner: 'opponent', endingCode: 'N' },
      { winner: 'opponent', firstServeFault: true },
      { winner: 'tracked' },
      { winner: 'opponent' },
    ],
  });
  const meetingIds = [trackedMeeting.matchId, controlMeeting.matchId];
  const initial = await buildSavedPointReportSnapshot(
    trackedMeeting.matchId,
    meetingIds,
  );
  const controlBefore = await buildSavedPointReportSnapshot(
    controlMeeting.matchId,
  );
  const initialHeadToHead = initial.headToHeadReport;

  assert.equal(initialHeadToHead.matchesRecorded, 2);
  assert.deepEqual(
    initialHeadToHead.meetings.map(({ summary }) => summary.id),
    meetingIds,
  );
  assert.deepEqual(
    initialHeadToHead.insights,
    aggregateLocalInsights([initial.insights, controlBefore.insights]),
  );
  assert.equal(
    initialHeadToHead.insights.serveStats.tracked.aces,
    2,
    'both meetings should contribute one tracked-player ace',
  );
  assert.equal(initialHeadToHead.performance.rallyWinnerCount, 2);
  assert.equal(initialHeadToHead.performance.trackedUnforcedErrors, 2);

  await editLocalPointWinner(
    trackedMeeting.matchId,
    1,
    trackedMeeting.rallyPointId,
    'opponent',
  );
  await editLocalPointWinner(
    trackedMeeting.matchId,
    1,
    trackedMeeting.errorPointId,
    'tracked',
  );

  const afterCorrections = await buildSavedPointReportSnapshot(
    trackedMeeting.matchId,
    meetingIds,
  );
  const controlAfterCorrections = await buildSavedPointReportSnapshot(
    controlMeeting.matchId,
  );
  const correctedHeadToHead = afterCorrections.headToHeadReport;
  assert.deepEqual(controlAfterCorrections.insights, controlBefore.insights);
  assert.equal(controlAfterCorrections.playerHtml, controlBefore.playerHtml);
  assert.deepEqual(
    correctedHeadToHead.insights,
    aggregateLocalInsights([
      afterCorrections.insights,
      controlAfterCorrections.insights,
    ]),
  );
  assert.equal(correctedHeadToHead.matchesRecorded, 2);
  assert.equal(correctedHeadToHead.insights.serveStats.tracked.aces, 2);
  assert.equal(correctedHeadToHead.performance.rallyWinnerCount, 1);
  assert.equal(correctedHeadToHead.performance.trackedUnforcedErrors, 1);
  assert.equal(correctedHeadToHead.performance.opponentUnforcedErrors, 1);
  assert.notDeepEqual(
    correctedHeadToHead.performance,
    initialHeadToHead.performance,
  );

  await undoLocalPoint(trackedMeeting.matchId);
  const afterTaggedAceUndo = await buildSavedPointReportSnapshot(
    trackedMeeting.matchId,
    meetingIds,
  );
  const controlAfterUndo = await buildSavedPointReportSnapshot(
    controlMeeting.matchId,
  );
  const finalHeadToHead = afterTaggedAceUndo.headToHeadReport;

  assert.deepEqual(controlAfterUndo.insights, controlBefore.insights);
  assert.equal(controlAfterUndo.playerHtml, controlBefore.playerHtml);
  assert.notEqual(afterTaggedAceUndo.playerHtml, initial.playerHtml);
  assert.equal(finalHeadToHead.matchesRecorded, 2);
  assert.deepEqual(
    finalHeadToHead.insights,
    aggregateLocalInsights([
      afterTaggedAceUndo.insights,
      controlAfterUndo.insights,
    ]),
  );
  assert.equal(finalHeadToHead.insights.pointCount, 9);
  assert.equal(finalHeadToHead.insights.serveStats.tracked.aces, 1);
  assert.equal(
    finalHeadToHead.insights.serveStats.tracked.firstServePoints,
    initialHeadToHead.insights.serveStats.tracked.firstServePoints - 1,
  );
  assert.notEqual(
    finalHeadToHead.performance.firstServeInPercent,
    initialHeadToHead.performance.firstServeInPercent,
  );
  assert.equal(finalHeadToHead.performance.acesPerMatch, 0.5);
  assert.equal(finalHeadToHead.performance.rallyWinnerCount, 1);
  assert.equal(finalHeadToHead.performance.trackedUnforcedErrors, 1);
  assert.equal(finalHeadToHead.performance.opponentUnforcedErrors, 1);

  const initialServeRows = reportRowsAfterHeading(
    initial.headToHeadHtml,
    'Serve',
  );
  const finalServeRows = reportRowsAfterHeading(
    afterTaggedAceUndo.headToHeadHtml,
    'Serve',
  );
  for (const label of ['First serve in', 'Aces per match']) {
    assert.notEqual(
      finalServeRows.find((row) => row.startsWith(label)),
      initialServeRows.find((row) => row.startsWith(label)),
      `${label} should change in the pooled head-to-head report`,
    );
  }
  const initialPointRows = reportRowsAfterHeading(
    initial.headToHeadHtml,
    'Return and points',
  );
  const finalPointRows = reportRowsAfterHeading(
    afterTaggedAceUndo.headToHeadHtml,
    'Return and points',
  );
  for (const label of ['Rally-shot winner points', 'Unforced errors']) {
    assert.notEqual(
      finalPointRows.find((row) => row.startsWith(label)),
      initialPointRows.find((row) => row.startsWith(label)),
      `${label} should change in the pooled head-to-head report`,
    );
  }
});

test('multi-set point corrections refresh reports and preserve later-set data', async () => {
  storageValues.clear();
  const { matchId, rallyPointId } =
    await createTwoSetSavedPointReportFixture();
  const initial = await buildSavedPointReportSnapshot(matchId);
  const laterSetServers = [
    'tracked',
    'tracked',
    'tracked',
    'tracked',
    'opponent',
    'opponent',
  ];

  assert.equal(initial.match.completedSets.length, 1);
  assert.equal(initial.match.setNumber, 2);
  assert.equal(initial.match.firstServer, 'tracked');
  assert.equal(initial.match.completedSets[0].score.trackedGames, 6);
  assert.equal(initial.match.completedSets[0].score.opponentGames, 4);
  assert.deepEqual(
    initial.match.points.map((point) => point.server),
    laterSetServers,
  );
  assertPointAnalysisInBothReports(initial, {
    rallyTile: '0/58 (0.0%)',
    rallyTracked: '0/58 · 0.0%',
    rallyOpponent: '1/58 · 1.7%',
    errorTile: '2',
    errorTracked: '2 · 58 recorded points',
    errorOpponent: '0 · 58 recorded points',
    pointCount: 58,
  });
  assertServeMetricInBothReports(
    initial,
    'Second serve in',
    '1/1 (100.0%)',
    '1/1 · 100.0%',
    '—',
    '—',
  );
  assert.equal(initial.insights.serveStats.tracked.aces, 1);
  assert.equal(initial.insights.serveStats.tracked.firstServeFaults, 1);
  assert.equal(initial.insights.serveStats.opponent.firstServeFaults, 0);

  await editLocalPointWinner(matchId, 1, rallyPointId, 'tracked');
  const corrected = await buildSavedPointReportSnapshot(matchId);
  assert.equal(
    corrected.match.completedSets[0].points[20].winner,
    'tracked',
  );
  assert.equal(corrected.match.completedSets[0].firstServer, 'tracked');
  assert.equal(corrected.match.completedSets[0].score.trackedGames, 6);
  assert.equal(corrected.match.completedSets[0].score.opponentGames, 3);
  assert.equal(corrected.match.firstServer, 'opponent');
  assert.notDeepEqual(
    corrected.match.points.map((point) => point.server),
    initial.match.points.map((point) => point.server),
  );
  assert.deepEqual(
    corrected.match.points.map(({ server, ...point }) => point),
    initial.match.points.map(({ server, ...point }) => point),
  );
  assert.deepEqual(
    corrected.match.points.map((point) => point.server),
    ['opponent', 'opponent', 'opponent', 'opponent', 'tracked', 'tracked'],
  );
  assertPointAnalysisInBothReports(corrected, {
    rallyTile: '1/58 (1.7%)',
    rallyTracked: '1/58 · 1.7%',
    rallyOpponent: '0/58 · 0.0%',
    errorTile: '2',
    errorTracked: '2 · 58 recorded points',
    errorOpponent: '0 · 58 recorded points',
    pointCount: 58,
  });
  assertServeMetricInBothReports(
    corrected,
    'Second serve in',
    '—',
    '—',
    '1/1 (100.0%)',
    '1/1 · 100.0%',
  );
  assert.equal(corrected.insights.serveStats.tracked.firstServeFaults, 0);
  assert.equal(corrected.insights.serveStats.opponent.firstServeFaults, 1);

  await undoLocalPoint(matchId);
  const afterUndo = await buildSavedPointReportSnapshot(matchId);
  assert.deepEqual(
    afterUndo.match.completedSets[0],
    corrected.match.completedSets[0],
  );
  assert.deepEqual(
    afterUndo.match.points,
    corrected.match.points.slice(0, -1),
  );
  assert.deepEqual(
    afterUndo.match.points.map((point) => point.server),
    ['opponent', 'opponent', 'opponent', 'opponent', 'tracked'],
  );
  assertPointAnalysisInBothReports(afterUndo, {
    rallyTile: '1/57 (1.8%)',
    rallyTracked: '1/57 · 1.8%',
    rallyOpponent: '0/57 · 0.0%',
    errorTile: '1',
    errorTracked: '1 · 57 recorded points',
    errorOpponent: '0 · 57 recorded points',
    pointCount: 57,
  });
  assertServeMetricInBothReports(
    afterUndo,
    'Second serve in',
    '—',
    '—',
    '1/1 (100.0%)',
    '1/1 · 100.0%',
  );
});

test('player feedback interprets break-point results and marks small samples directional', () => {
  const match = performanceSampleMatch();
  const insights = {
    ...calculateLocalInsights(match),
    breakPoints: {
      tracked: { opportunities: 3, converted: 2, faced: 4, saved: 3 },
      opponent: { opportunities: 3, converted: 2, faced: 4, saved: 3 },
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
  assert.ok(
    directional.feedback.includes(
      'Directional only, not conclusive: the opponent converted 2 of 3 break-point chances (67%) and saved 3 of 4 break points faced (75%).',
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
  assert.match(
    reportHtml,
    /Directional only, not conclusive: the opponent converted 2 of 3 break-point chances \(67%\) and saved 3 of 4 break points faced \(75%\)/,
  );
  assert.match(reportHtml, /Match feedback from this sample/);
  const matchScreenSource = fs.readFileSync(
    path.join(__dirname, '../app/matches/[id].tsx'),
    'utf8',
  );
  assert.match(matchScreenSource, /MATCH FEEDBACK/);
  assert.match(matchScreenSource, /performance\.feedback\.map/);

  const establishedSample = summarizePlayerPerformance({
    ...insights,
    breakPoints: {
      tracked: { opportunities: 6, converted: 2, faced: 5, saved: 2 },
      opponent: { opportunities: 6, converted: 4, faced: 6, saved: 4 },
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
  assert.ok(
    establishedSample.feedback.includes(
      'Opponent break-point pattern: the opponent converted 4 of 6 break-point chances (67%) and saved 4 of 6 break points faced (67%).',
    ),
  );

  const mixedOpponentSample = summarizePlayerPerformance({
    ...insights,
    breakPoints: {
      tracked: { ...emptyBreakPoints },
      opponent: { opportunities: 3, converted: 2, faced: 6, saved: 4 },
    },
  });
  assert.ok(
    mixedOpponentSample.feedback.includes(
      'Directional only, not conclusive: the opponent converted 2 of 3 break-point chances (67%) and saved 4 of 6 break points faced (67%).',
    ),
  );

  const noBreakPointChances = summarizePlayerPerformance({
    ...insights,
    breakPoints: {
      tracked: { ...emptyBreakPoints },
      opponent: { ...emptyBreakPoints },
    },
  });
  assert.equal(
    noBreakPointChances.feedback.some((item) =>
      item.toLowerCase().includes('break-point'),
    ),
    false,
  );
});

test('break-point coaching omits zero-denominator conclusions and keeps available samples accurate', () => {
  const match = performanceSampleMatch();
  const baseInsights = calculateLocalInsights(match);
  const conversionOnly = {
    ...baseInsights,
    breakPoints: {
      tracked: { opportunities: 0, converted: 0, faced: 3, saved: 2 },
      opponent: { opportunities: 2, converted: 1, faced: 0, saved: 0 },
    },
  };
  const conversionOnlySummary = summarizePlayerPerformance(conversionOnly);

  assert.ok(
    conversionOnlySummary.feedback.includes(
      'Directional only, not conclusive: the tracked player saved 2 of 3 break points faced (67%).',
    ),
  );
  assert.ok(
    conversionOnlySummary.feedback.includes(
      'Directional only, not conclusive: the opponent converted 1 of 2 break-point chances (50%).',
    ),
  );
  assert.equal(
    conversionOnlySummary.feedback.some((item) =>
      item.includes('the tracked player converted'),
    ),
    false,
  );
  assert.equal(
    conversionOnlySummary.feedback.some((item) =>
      item.includes('the opponent saved'),
    ),
    false,
  );

  const conversionOnlyHtml = buildPlayerReportHtml(
    match,
    conversionOnly,
    conversionOnlySummary,
  );
  const conversionRows = reportRowsAfterHeading(
    conversionOnlyHtml,
    'Break-point pressure',
  );
  assert.match(
    conversionRows.find((row) => row.startsWith('Match total')),
    /2 chances[^—]*— — 1\/2 \(50\.0%\) 1\/2 \(50\.0%\)/,
  );
  const defenseRows = reportRows(
    conversionOnlyHtml,
    'Serving · break points faced',
  );
  assert.match(
    defenseRows.find((row) => row.startsWith('Match total')),
    /3 break points faced[^—]*2\/3 \(66\.7%\) 1\/3 \(33\.3%\) — —/,
  );

  const savingOnly = {
    ...baseInsights,
    breakPoints: {
      tracked: { opportunities: 2, converted: 1, faced: 0, saved: 0 },
      opponent: { opportunities: 0, converted: 0, faced: 3, saved: 2 },
    },
  };
  const savingOnlySummary = summarizePlayerPerformance(savingOnly);
  assert.ok(
    savingOnlySummary.feedback.includes(
      'Directional only, not conclusive: the tracked player converted 1 of 2 break-point chances (50%).',
    ),
  );
  assert.ok(
    savingOnlySummary.feedback.includes(
      'Directional only, not conclusive: the opponent saved 2 of 3 break points faced (67%).',
    ),
  );
  assert.equal(
    savingOnlySummary.feedback.some((item) =>
      item.includes('the tracked player saved'),
    ),
    false,
  );
  assert.equal(
    savingOnlySummary.feedback.some((item) =>
      item.includes('the opponent converted'),
    ),
    false,
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
  gameNotes = [],
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
    gameNotes,
    review: {
      strokeRatings: {},
      strokeNotes: {},
      footworkNote: '',
      tacticalNote: '',
      mentalNote: '',
    },
  };
}

function winnerReportHtml(
  sets,
  matchStatus = 'complete',
  matchOutcome = null,
  selectedSections = ['sets'],
) {
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
    selectedSections,
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

test('game notes print under the correct set and game without a point matrix', () => {
  const sets = [
    reportSetFixture({
      setNumber: 1,
      gameNotes: [
        { gameNumber: 3, note: 'Adjusted after a deep return.' },
        { gameNumber: 1, note: 'Opened the court with a wide serve.' },
        { gameNumber: 2, note: '   ' },
      ],
    }),
    reportSetFixture({
      setNumber: 2,
      gameNotes: [{ gameNumber: 1, note: 'Stayed patient in the rally.' }],
    }),
  ];
  const html = winnerReportHtml(sets, 'complete', null, [
    'sets',
    'game-notes',
  ]);
  const orderedNoteMarkers = [
    'Set 1</h3>',
    'Game 1:</strong> Opened the court with a wide serve.',
    'Game 3:</strong> Adjusted after a deep return.',
    'Set 2</h3>',
    'Game 1:</strong> Stayed patient in the rally.',
  ];
  const positions = orderedNoteMarkers.map((marker) => html.indexOf(marker));

  assert.match(html, /<h2>Game notes<\/h2>/);
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
  assert.doesNotMatch(html, /GAME\s*\/\s*SERVER/i);
  assert.doesNotMatch(html, /<table[^>]*point-matrix/i);

  const statisticsPresetHtml = winnerReportHtml(
    sets,
    'complete',
    null,
    PLAYER_REPORT_SECTION_PRESETS[1].sections,
  );
  assert.match(statisticsPresetHtml, /<h2>Game notes<\/h2>/);
  assert.match(
    statisticsPresetHtml,
    /Game 1:<\/strong> Opened the court with a wide serve\./,
  );

  const fullReportHtml = winnerReportHtml(
    sets,
    'complete',
    null,
    allPlayerReportSections(),
  );
  assert.equal(
    fullReportHtml.split('Opened the court with a wide serve.').length - 1,
    1,
  );

  const legacyLayoutHtml = winnerReportHtml(
    [
      reportSetFixture({
        gameNotes: [{ gameNumber: 2, note: 'Older saved layout note.' }],
      }),
    ],
    'complete',
    null,
    ['observations'],
  );
  assert.match(legacyLayoutHtml, /Game 2: Older saved layout note\./);
  assert.doesNotMatch(legacyLayoutHtml, /<h2>Game notes<\/h2>/);

  const emptyNotesHtml = winnerReportHtml(
    [
      reportSetFixture({
        gameNotes: [{ gameNumber: 1, note: ' \n  ' }],
      }),
    ],
    'complete',
    null,
    ['game-notes'],
  );
  assert.doesNotMatch(emptyNotesHtml, /<h2>Game notes<\/h2>/);
  assert.doesNotMatch(emptyNotesHtml, /<section class="game-note-group">/);
});

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

test('optional break-point moments report derives scores and respects anonymization', () => {
  const { match } = breakPointSampleMatch();
  const insights = { ...emptyInsight, ...calculateLocalInsights(match) };
  const hiddenHtml = buildPlayerReportHtml(
    match,
    insights,
    emptyPerformance,
    ['break-point-context'],
    [],
    { hidePlayerNames: true },
  );
  const rows = reportRowsAfterHeading(hiddenHtml, 'Break-point moments');

  assert.equal(rows.length, 6);
  assert.match(rows[0], /Set 1 Game 1 4 0 40 Saved by Player A/);
  assert.match(rows[1], /Set 1 Game 1 5 15 40 Saved by Player A/);
  assert.match(rows[2], /Set 1 Game 1 6 30 40 Saved by Player A/);
  assert.ok(rows.some((row) => /Set 1 Game 2/.test(row) && /AD 40/.test(row)));
  assert.ok(
    rows.some(
      (row) =>
        /Set 2 Game 1/.test(row) &&
        /Converted by Player A/.test(row),
    ),
  );
  assert.doesNotMatch(hiddenHtml, /Tracked|Opponent/);
  assert.doesNotMatch(hiddenHtml, /<h2>Break-point pressure<\/h2>/);
  assert.equal(
    Object.hasOwn(match.completedSets[0].points[3], 'breakPointScoreBefore'),
    false,
  );

  const currentSetMatch = {
    ...match,
    setNumber: 3,
    setFormat: 'standard',
    points: gamePoints(
      3,
      1,
      'opponent',
      ['tracked', 'tracked', 'tracked', 'tracked'],
    ),
  };
  const currentSetRows = reportRowsAfterHeading(
    buildPlayerReportHtml(
      currentSetMatch,
      insights,
      emptyPerformance,
      ['break-point-context'],
      [],
      { hidePlayerNames: true },
    ),
    'Break-point moments',
  );
  assert.ok(
    currentSetRows.some(
      (row) =>
        /Set 3 Game 1 4 40 0 Converted by Player A/.test(row),
    ),
    `Unexpected current-set rows: ${JSON.stringify(currentSetRows)}`,
  );

  const overviewOnlyHtml = buildPlayerReportHtml(
    match,
    insights,
    emptyPerformance,
    ['overview'],
  );
  assert.doesNotMatch(overviewOnlyHtml, /<h2>Break-point moments<\/h2>/);

  const matchTiebreakOnlyHtml = buildPlayerReportHtml(
    { ...match, completedSets: [], setFormat: 'match_tiebreak' },
    insights,
    emptyPerformance,
    ['break-point-context'],
    [],
    { hidePlayerNames: true },
  );
  assert.match(
    matchTiebreakOnlyHtml,
    /No saved or converted break-point moments were recorded\./,
  );

  match.completedSets[0].points[3].winner = 'opponent';
  const updatedRows = reportRowsAfterHeading(
    buildPlayerReportHtml(
      match,
      insights,
      emptyPerformance,
      ['break-point-context'],
      [],
      { hidePlayerNames: true },
    ),
    'Break-point moments',
  );
  assert.match(updatedRows[0], /Set 1 Game 1 4 0 40 Converted by Player B/);
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
    matchOutcomeTotals: emptyMatchOutcomeTotals(),
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
    personalAverageBreakPointsBySurface: emptySurfaceBreakPointBaselines(),
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

test('head-to-head summaries separate ordinary results, retirements, and walkovers', () => {
  const ordinaryWin = breakPointMeeting(
    'ordinary-win',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-10-28',
  );
  const ordinaryTie = breakPointMeeting(
    'ordinary-tie',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-10-29',
  );
  ordinaryTie.summary.winner = null;
  const retirement = breakPointMeeting(
    'retirement-loss',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-10-30',
  );
  retirement.summary.winner = 'opponent';
  retirement.summary.matchOutcome = { reason: 'retirement', winner: 'opponent' };
  const walkover = breakPointMeeting(
    'walkover-win',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-10-31',
  );
  walkover.summary.matchOutcome = { reason: 'walkover', winner: 'tracked' };
  walkover.insights.pointCount = 0;
  walkover.summary.pointCount = 0;
  const inProgress = breakPointMeeting(
    'in-progress',
    'Alex',
    'Bailey',
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    '2026-11-01',
  );
  inProgress.summary.status = 'in_progress';
  inProgress.summary.winner = null;
  inProgress.summary.matchOutcome = null;
  inProgress.insights.pointCount = 0;
  inProgress.summary.pointCount = 0;

  const report = buildHeadToHeadReport(
    'Alex',
    'Bailey',
    [ordinaryWin, ordinaryTie, retirement, walkover, inProgress],
  );

  assert.deepEqual(report.matchOutcomeTotals, {
    ordinary: { count: 2, wins: 1, losses: 0, noWinner: 1 },
    retirements: { count: 1, wins: 0, losses: 1, noWinner: 0 },
    walkovers: { count: 1, wins: 1, losses: 0, noWinner: 0 },
    inProgress: 1,
  });
  assert.equal(report.performance.matchesInSample, 3);
  const html = buildHeadToHeadReportHtml(report);
  assert.match(html, /Ordinary 2 \(1–0\) · 1 without a clear winner/);
  assert.match(html, /Retirements 1 \(0–1\)/);
  assert.match(html, /Walkovers 1 \(1–0\)/);
  assert.match(
    headToHeadScreenSource,
    /formatPlayerMatchOutcomeSummary\(report\.matchOutcomeTotals\)/,
  );
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
    matchOutcomeTotals: emptyMatchOutcomeTotals(),
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
    personalAverageBreakPointsBySurface: emptySurfaceBreakPointBaselines(),
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

test('privacy changes invalidate reviewed PDFs for both report types', () => {
  const labels = { trackedPlayer: 'Player A', opponent: 'Player B' };
  const updatedLabels = {
    trackedPlayer: 'Athlete One',
    opponent: 'Athlete Two',
  };
  const visibleNames = getReportNameVisibilityVersion(false, labels);
  const hiddenNames = getReportNameVisibilityVersion(true, labels);
  const updatedHiddenNames = getReportNameVisibilityVersion(true, updatedLabels);

  const singleNamedReview = buildReportReviewVersion(
    'match-1:2026-10-30',
    ['overview'],
    '[]',
    visibleNames,
  );
  const singleHiddenReview = buildReportReviewVersion(
    'match-1:2026-10-30',
    ['overview'],
    '[]',
    hiddenNames,
  );
  const singleUpdatedLabelsReview = buildReportReviewVersion(
    'match-1:2026-10-30',
    ['overview'],
    '[]',
    updatedHiddenNames,
  );
  assert.equal(isReportReviewCurrent(singleNamedReview, singleNamedReview), true);
  assert.equal(isReportReviewCurrent(singleNamedReview, singleHiddenReview), false);
  assert.equal(isReportReviewCurrent(singleHiddenReview, singleHiddenReview), true);
  assert.equal(
    isReportReviewCurrent(singleHiddenReview, singleUpdatedLabelsReview),
    false,
  );

  const headToHeadNamedReview = buildHeadToHeadReportReviewVersion(
    'meeting-1:2026-10-30',
    ['overview'],
    [],
    visibleNames,
  );
  const headToHeadHiddenReview = buildHeadToHeadReportReviewVersion(
    'meeting-1:2026-10-30',
    ['overview'],
    [],
    hiddenNames,
  );
  const headToHeadUpdatedLabelsReview = buildHeadToHeadReportReviewVersion(
    'meeting-1:2026-10-30',
    ['overview'],
    [],
    updatedHiddenNames,
  );
  assert.equal(
    isReportReviewCurrent(headToHeadNamedReview, headToHeadNamedReview),
    true,
  );
  assert.equal(
    isReportReviewCurrent(headToHeadNamedReview, headToHeadHiddenReview),
    false,
  );
  assert.equal(
    isReportReviewCurrent(headToHeadHiddenReview, headToHeadHiddenReview),
    true,
  );
  assert.equal(
    isReportReviewCurrent(headToHeadHiddenReview, headToHeadUpdatedLabelsReview),
    false,
  );

  const match = performanceSampleMatch();
  match.trackedPlayer = 'Alex';
  match.opponent = 'Bailey';
  match.event = 'Alex vs Bailey';
  const insights = calculateLocalInsights(match);
  const playerHtml = buildPlayerReportHtml(
    match,
    insights,
    summarizePlayerPerformance(insights),
    undefined,
    [],
    { hidePlayerNames: true, labels },
  );
  const meeting = breakPointMeeting(
    'privacy-review-alex-bailey',
    'Alex',
    'Bailey',
    { opportunities: 2, converted: 1, faced: 1, saved: 1 },
    { opportunities: 1, converted: 0, faced: 2, saved: 1 },
    '2026-10-30',
  );
  const headToHeadHtml = buildHeadToHeadReportHtml(
    buildHeadToHeadReport('Alex', 'Bailey', [meeting], [meeting]),
    undefined,
    { hidePlayerNames: true, labels },
  );
  for (const html of [playerHtml, headToHeadHtml]) {
    assert.match(html, /Player A/);
    assert.match(html, /Player B/);
    assert.doesNotMatch(html, /Alex|Bailey/i);
  }
});

test('anonymized single-match reports replace names in headings and match notes', () => {
  const match = performanceSampleMatch();
  match.trackedPlayer = 'Alex';
  match.opponent = 'Bailey';
  match.event = 'Alex vs Bailey';
  match.gameNotes = [
    { setNumber: 1, gameNumber: 1, note: 'Game note: Alex moved Bailey wide' },
  ];
  match.review.tacticalNote = 'Set observation: Alex targeted Bailey’s backhand';
  match.review.mentalNote = 'Set observation: Bailey looked composed against Alex';
  match.points[0].strokes = [
    {
      id: 'privacy-point-note',
      player: 'tracked',
      strokeType: 'forehand_drive',
      result: 'winner',
      note: 'Point note: Alex changed direction past Bailey',
    },
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
  assert.match(anonymousHtml, /Set observation: Player A targeted Player B/);
  assert.match(anonymousHtml, /Game note: Player A moved Player B wide/);
  assert.match(anonymousHtml, /Point note: Player A changed direction past Player B/);
  assert.match(namedHtml, /Set observation: Alex targeted Bailey/);
  assert.match(namedHtml, /Game note: Alex moved Bailey wide/);
  assert.match(namedHtml, /Point note: Alex changed direction past Bailey/);
  assert.match(namedHtml, /Bailey looked composed against Alex/);
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
  report.performance.feedback = [
    'Set observation: Alex adjusted to Bailey’s deep returns',
    'Point note: Bailey’s forehand pressured Alex',
    'Game note: Alex served wide to Bailey',
  ];
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
  assert.match(anonymousHtml, /Set observation: Player A adjusted to Player B/);
  assert.match(anonymousHtml, /Point note: Player B’s forehand pressured Player A/);
  assert.match(anonymousHtml, /Game note: Player A served wide to Player B/);
  assert.match(namedHtml, /Set observation: Alex adjusted to Bailey/);
  assert.match(namedHtml, /Point note: Bailey’s forehand pressured Alex/);
  assert.match(namedHtml, /Game note: Alex served wide to Bailey/);
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
      matchOutcomeTotals: emptyMatchOutcomeTotals(),
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
      personalAverageBreakPointsBySurface: emptySurfaceBreakPointBaselines(),
    },
    HEAD_TO_HEAD_REPORT_SECTION_PRESETS[1].sections,
  );

  assert.match(html, /<h2>Serve<\/h2>/);
  assert.match(html, /<h2>Meetings and set scores<\/h2>/);
  assert.match(html, /<h2>Return and points<\/h2>/);
  assert.doesNotMatch(html, /<h2>Point-ending tags<\/h2>/);
  assert.doesNotMatch(html, /<h2>Coaching observations<\/h2>/);
});

test('short report layouts retain readable match details and natural print flow', () => {
  const playerMatch = {
    matchDate: '2026-10-30',
    trackedPlayer: 'Alex Example',
    opponent: 'Jordan Example',
    surface: 'Hard',
    matchStatus: 'complete',
  };
  const playerInsights = {
    ...emptyInsight,
    sets: [reportSetFixture()],
  };
  const playerSummary = {
    ...summarizePlayerPerformance(playerInsights),
    feedback: [],
  };
  const reportLabels = {
    hidePlayerNames: true,
    labels: { trackedPlayer: 'Player North', opponent: 'Player South' },
  };
  const assertPrintableFlow = (html) => {
    assertCleanReport(html);
    assert.match(html, /overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(
      html,
      /(?:page-break-before:\s*(?:always|left|right)|break-before:\s*(?:page|left|right)|page-break-after:\s*always|break-after:\s*page)/i,
    );
    assert.doesNotMatch(html, /(?:^|[;{])\s*(?:min-height|height)\s*:\s*\d/i);
    assert.doesNotMatch(html, /<h[23]\b[^>]*>\s*<\/h[23]>/i);
  };

  const playerOverview = buildPlayerReportHtml(
    playerMatch,
    playerInsights,
    playerSummary,
    PLAYER_REPORT_SECTION_PRESETS[0].sections,
    [],
    reportLabels,
  );
  const playerStatistics = buildPlayerReportHtml(
    playerMatch,
    playerInsights,
    playerSummary,
    PLAYER_REPORT_SECTION_PRESETS[1].sections,
    [],
    reportLabels,
  );

  for (const html of [playerOverview, playerStatistics]) {
    assertPrintableFlow(html);
    assert.match(html, /Player North/);
    assert.match(html, /Player South/);
    assert.match(html, /October 30, 2026/);
    assert.doesNotMatch(html, /Alex Example|Jordan Example/);
  }
  assert.match(
    playerOverview,
    /Set scores and winners:<\/strong> Set 1 6–4 — Player North/,
  );
  assert.doesNotMatch(playerOverview, /<h2>Set scores and winners<\/h2>/);
  assert.match(playerStatistics, /<h2>Set scores and winners<\/h2>/);
  assert.match(playerStatistics, /<td>6–4<\/td>/);
  assert.match(playerStatistics, /<td>Player North<\/td>/);

  const meeting = breakPointMeeting(
    'short-layout-meeting',
    'Alex Example',
    'Jordan Example',
    { opportunities: 2, converted: 1, faced: 3, saved: 2 },
    { opportunities: 1, converted: 0, faced: 2, saved: 1 },
    '2026-10-01',
  );
  const headToHeadReport = buildHeadToHeadReport(
    'Alex Example',
    'Jordan Example',
    [meeting],
    [meeting],
  );
  const headToHeadOverview = buildHeadToHeadReportHtml(
    headToHeadReport,
    HEAD_TO_HEAD_REPORT_SECTION_PRESETS[0].sections,
    reportLabels,
  );
  const headToHeadStatistics = buildHeadToHeadReportHtml(
    headToHeadReport,
    HEAD_TO_HEAD_REPORT_SECTION_PRESETS[1].sections,
    reportLabels,
  );

  for (const html of [headToHeadOverview, headToHeadStatistics]) {
    assertPrintableFlow(html);
    assert.match(html, /Player North/);
    assert.match(html, /Player South/);
    assert.doesNotMatch(html, /Alex Example|Jordan Example/);
  }
  assert.match(headToHeadOverview, /Head-to-Head Report/);
  assert.doesNotMatch(
    headToHeadOverview,
    /<h2>Meetings and set scores<\/h2>/,
  );
  assert.match(headToHeadOverview, /LATEST MEETING · October 1, 2026/);
  assert.match(headToHeadOverview, /6–4 — Player North/);
  assert.match(headToHeadStatistics, /<h2>Meetings and set scores<\/h2>/);
  assert.match(headToHeadStatistics, /October 1, 2026/);
  assert.match(headToHeadStatistics, /6–4 — Player North/);
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
      matchOutcomeTotals: emptyMatchOutcomeTotals(),
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
      personalAverageBreakPointsBySurface: emptySurfaceBreakPointBaselines(),
    },
    [],
  );

  assert.match(playerHtml, /Tennis Match Report/);
  assert.match(playerHtml, /Alex/);
  assert.match(
    playerHtml,
    /Set scores and winners:<\/strong> No set scores recorded/,
  );
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
  const repeatedBreakPointGame =
    breakPointSampleMatch().repeatedAdvantageChances;
  const longPointSets = longSets.map((set) => {
    const points =
      set.format === 'standard'
        ? Array.from({ length: 6 }, (_, gameIndex) =>
            repeatedBreakPointGame.map((point, pointIndex) => {
              const flipSides = gameIndex % 2 === 1;
              const flipSide = (side) =>
                flipSides
                  ? side === 'tracked'
                    ? 'opponent'
                    : 'tracked'
                  : side;
              return {
                ...point,
                id: `long-set-${set.setNumber}-game-${gameIndex + 1}-point-${pointIndex + 1}`,
                sequenceNumber:
                  gameIndex * repeatedBreakPointGame.length + pointIndex + 1,
                setNumber: set.setNumber,
                gameNumber: gameIndex + 1,
                server: flipSide(point.server),
                winner: flipSide(point.winner),
              };
            }),
          ).flat()
        : [];
    return { ...set, points };
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
      completedSets: longPointSets,
      setNumber: 19,
      setFormat: 'standard',
      points: [],
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
  assert.match(html, /Game 8:<\/strong> Set 18 observation 8/);
  assert.match(html, /Cross-court/);
  assert.match(html, /5–8 shots/);
  assert.match(html, /Forehand winner/);
  assert.match(html, /Feedback 24:/);
  assert.match(html, /Point 144:/);
  const breakPointRows = reportRowsAfterHeading(html, 'Break-point moments');
  assert.equal(breakPointRows.length, 144);
  assert.match(
    breakPointRows[0],
    /Set 1 Game 1 \d+ AD 40 (Saved by|Converted by) Player [AB]/,
  );
  assert.ok(breakPointRows.some((row) => /Set 17 Game 6/.test(row)));
  assert.match(html, /thead\s*\{\s*display:\s*table-header-group;/);
  assert.match(html, /tr\s*\{[^}]*page-break-inside:\s*avoid/);
  assert.match(
    html,
    /\.break-point-context-table\s*\{[^}]*page-break-inside:\s*auto/,
  );
  assert.match(
    html,
    /\.break-point-context-table thead\s*\{[^}]*display:\s*table-header-group/,
  );
  assert.match(
    html,
    /\.break-point-context-table tr\s*\{[^}]*page-break-inside:\s*avoid/,
  );
  assert.match(html, /h2\s*\{[^}]*page-break-after:\s*avoid/);
  assert.match(html, /h3\s*\{[^}]*page-break-after:\s*avoid/);
  assert.match(html, /th, td\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.match(html, /\.feedback\s*\{[^}]*page-break-inside:\s*auto/);
  assert.match(html, /\.feedback li\s*\{[^}]*page-break-inside:\s*avoid/);
  assert.match(html, /\.observation-group\s*\{[^}]*page-break-inside:\s*avoid/);
  assert.match(html, /\.observation-list li\s*\{[^}]*page-break-inside:\s*avoid/);
  assert.match(html, /\.game-note-group\s*\{[^}]*page-break-inside:\s*auto/);
  assert.match(html, /\.game-note-list li\s*\{[^}]*page-break-inside:\s*avoid/);
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

test('head-to-head sharing reuses the exact reviewed local PDF URI', async () => {
  const events = [];
  const uri = 'file:///app/cache/head-to-head-report.pdf';

  await shareReviewedLocalPdf(uri, 'Share head-to-head report', {
    async isAvailableAsync() {
      events.push({ action: 'check-sharing' });
      return true;
    },
    async shareAsync(sharedUri, options) {
      events.push({ action: 'share', uri: sharedUri, options });
    },
  });

  assert.deepEqual(events, [
    { action: 'check-sharing' },
    {
      action: 'share',
      uri,
      options: {
        mimeType: 'application/pdf',
        dialogTitle: 'Share head-to-head report',
        UTI: 'com.adobe.pdf',
      },
    },
  ]);
});

test('head-to-head sharing refuses to open without a reviewed PDF URI', async () => {
  let availabilityChecks = 0;
  await assert.rejects(
    () =>
      shareReviewedLocalPdf('', 'Share head-to-head report', {
        async isAvailableAsync() {
          availabilityChecks += 1;
          return true;
        },
        async shareAsync() {},
      }),
    /Review the PDF before sharing it/,
  );
  assert.equal(availabilityChecks, 0);
});

test('head-to-head share requires the current reviewed PDF and never creates a new file', () => {
  const previewStart =
    headToHeadScreenSource.indexOf('async function previewReport()');
  const previewEnd =
    headToHeadScreenSource.indexOf('async function shareReport()', previewStart);
  const shareStart = headToHeadScreenSource.indexOf('async function shareReport()');
  const shareEnd = headToHeadScreenSource.indexOf(
    'function toggleReportSection',
    shareStart,
  );
  assert.notEqual(previewStart, -1);
  assert.notEqual(previewEnd, -1);
  assert.notEqual(shareStart, -1);
  assert.notEqual(shareEnd, -1);
  const previewBody = headToHeadScreenSource.slice(previewStart, previewEnd);
  const shareBody = headToHeadScreenSource.slice(shareStart, shareEnd);

  assert.match(previewBody, /createAndPreviewLocalPdf\(html, Platform\.OS, Print\)/);
  assert.doesNotMatch(previewBody, /shareReviewedLocalPdf|shareReport\(/);
  assert.match(
    headToHeadScreenSource,
    /setReviewedReport\(\{ version: reviewVersion, uri \}\)/,
  );
  assert.match(
    headToHeadScreenSource,
    /isReportReviewCurrent\(reviewedReport\?\.version, reportReviewVersion\)/,
  );
  assert.match(headToHeadScreenSource, /Boolean\(reviewedReport\?\.uri\)/);
  assert.match(headToHeadScreenSource, /\{hasReviewedReport \? \(/);
  assert.match(
    headToHeadScreenSource,
    /disabled=\{isReportBusy \|\| !reviewedReport\?\.uri\}/,
  );
  assert.match(shareBody, /const fileUri = reviewedReport\?\.uri/);
  assert.match(shareBody, /!fileUri\s*\|\|\s*!hasReviewedReport/);
  assert.match(shareBody, /shareReviewedLocalPdf\(/);
  assert.doesNotMatch(shareBody, /printToFileAsync|printAsync|shareAsync/);
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

test('match notes become contextual, evidence-linked post-match feedback', () => {
  const match = performanceSampleMatch();
  match.trackedPlayer = 'Krishan';
  match.opponent = 'Rudransh';
  const insights = calculateLocalInsights(match);
  const set = insights.sets[0];

  set.gameNotes.push(
    { gameNumber: 2, note: 'First serve placement opened the middle.' },
    { gameNumber: 3, note: 'Krishan stayed patient after a long rally.' },
    { gameNumber: 4, note: 'Ask the coach to review this moment.' },
  );
  set.review.footworkNote = 'Slow recovery after a wide ball.';
  set.review.tacticalNote = 'Cross-court depth opened space down the line.';
  set.review.mentalNote = 'Stayed composed under pressure.';
  set.review.strokeRatings = { forehand_drive: 3 };
  set.review.strokeNotes = {
    forehand_drive: 'Late contact on the forehand drive.',
  };
  insights.strokeNotes.push({
    setNumber: 1,
    gameNumber: 1,
    sequenceNumber: 3,
    player: 'tracked',
    strokeType: 'forehand_drive',
    result: 'error',
    note: 'Forehand contact was late.',
  });

  const forehandTally = insights.strokeTallies.find(
    (item) => item.player === 'tracked' && item.strokeType === 'forehand_drive',
  );
  Object.assign(forehandTally, {
    sampleCount: 1,
    inPlay: 0,
    errors: 1,
    winners: 0,
  });
  insights.rallyLengths = [
    { value: '4-6', count: 4, trackedWon: 3 },
  ];
  insights.shotDirections = [
    { value: 'cross_court', count: 4, trackedWon: 3 },
  ];
  insights.breakPoints.tracked = {
    opportunities: 2,
    converted: 1,
    faced: 1,
    saved: 1,
  };

  const themes = summarizeMatchNotes(insights);
  const byId = Object.fromEntries(themes.map((theme) => [theme.id, theme]));
  assert.equal(byId['serve-return'].observationCount, 1);
  assert.match(byId['serve-return'].observations[0].context, /Set 1 · Game 2/);
  assert.ok(
    byId['serve-return'].relatedStats.some((item) =>
      item.includes('Tracked-player first serves in:'),
    ),
  );
  assert.ok(
    byId.movement.relatedStats.some((item) => item.includes('3/4 (75%)')),
  );
  assert.ok(
    byId.tactics.relatedStats.some((item) => item.includes('cross-court tags')),
  );
  assert.ok(
    byId.mental.relatedStats.some((item) => item.includes('break points converted')),
  );
  assert.ok(
    byId.stroke.relatedStats.some((item) => item.includes('1 recorded (0 winners, 1 errors')),
  );
  assert.ok(byId.general.observations[0].context.includes('Set 1 · Game 4'));
  assert.match(byId.tactics.reviewQuestion, /do not prove a tactic caused an outcome/);

  const summary = summarizePlayerPerformance(insights);
  const reportHtml = buildPlayerReportHtml(match, insights, summary);
  assert.match(reportHtml, /Recorded notes grouped for review/);
  assert.match(reportHtml, /Related match data/);
  assert.match(reportHtml, /Review question/);
  assert.match(reportHtml, /Set 1 · Game 2/);
  assert.match(reportHtml, /Match feedback from this sample/);
  assert.match(playerMatchScreenSource, /summarizeMatchNotes\(insightsQuery\.data\)/);
  assert.match(playerMatchScreenSource, /NOTES TO REVIEW/);
  assert.match(playerMatchScreenSource, /RELATED MATCH DATA/);
  assert.match(playerMatchScreenSource, /Review question:/);
  assert.doesNotMatch(headToHeadScreenSource, /summarizeMatchNotes/);

  set.gameNotes[0].note =
    'Krishan served well against Rudransh <script>alert(1)</script>.';
  const anonymizedHtml = buildPlayerReportHtml(
    match,
    insights,
    summary,
    undefined,
    undefined,
    { hidePlayerNames: true },
  );
  assert.doesNotMatch(anonymizedHtml, /Krishan|Rudransh/);
  assert.match(anonymizedHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('matches without recorded notes have no invented note themes', () => {
  const insights = calculateLocalInsights(performanceSampleMatch());
  assert.deepEqual(summarizeMatchNotes(insights), []);
});

test('note prompt starters append to editable text without replacing it', () => {
  assert.deepEqual(
    LOCAL_MATCH_NOTE_PROMPTS.map((prompt) => prompt.label),
    [
      'What worked?',
      'What changed?',
      'Opponent pattern',
      'Next-match adjustment',
    ],
  );
  const worked = LOCAL_MATCH_NOTE_PROMPTS[0].starter;
  assert.equal(appendLocalNotePrompt('', worked), worked);
  assert.equal(
    appendLocalNotePrompt('Observed a wide return', worked),
    `Observed a wide return\n${worked}`,
  );
  assert.equal(
    appendLocalNotePrompt('First note\n', worked),
    `First note\n${worked}`,
  );
  assert.equal(
    appendLocalNotePrompt('Point note', worked, 200, ' · '),
    `Point note · ${worked}`,
  );
  assert.equal(appendLocalNotePrompt('Already full', worked, 8), 'Already full');
});
