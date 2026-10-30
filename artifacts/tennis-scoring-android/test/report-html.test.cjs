const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const strokeOptions = [
  { value: 'first_serve', label: 'First serve' },
];
const originalLoad = Module._load;
let playerReportExports;
let localMatchExports;

Module._load = function (request, parent, isMain) {
  if (request === '@/lib/local-matches') {
    return localMatchExports ?? { STROKE_TYPE_OPTIONS: strokeOptions };
  }
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: {} };
  }
  if (request === '@/lib/head-to-head') {
    return { getSetWinner: () => null };
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
const { buildPlayerReportHtml } = require('../lib/player-report-html.ts');
playerReportExports = { buildPlayerReportHtml };
const { buildHeadToHeadReportHtml } = require('../lib/head-to-head-report-html.ts');
Module._load = originalLoad;
const { createAndPreviewLocalPdf } = require('../lib/report-pdf.ts');
const {
  calculateBreakPointStats,
  calculateLocalInsights,
  getBreakPointPointOutcomes,
} = localMatchExports;

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
  trackedUnforcedErrors: 0,
  opponentUnforcedErrors: 0,
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
  );

  assertCleanReport(html);
  assert.match(html, /City Open/);
  assert.match(html, /Quarterfinal/);
  assert.match(html, /Alex/);
  assert.match(html, /Jordan/);
  assert.match(html, /Strong serve\./);
  assert.match(html, />Serve</);
  assert.match(html, />Return</);
  assert.match(html, /Reference 1/);
  assert.doesNotMatch(html, /Cincinnati/i);
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
    ['serve'],
  );

  assert.match(html, /<h2>Serve<\/h2>/);
  assert.doesNotMatch(html, /<h2>Return<\/h2>/);
  assert.doesNotMatch(html, /<h2>Set scores and winners<\/h2>/);
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
    ['serve'],
  );

  assert.match(html, /<h2>Serve<\/h2>/);
  assert.doesNotMatch(html, /<h2>Meetings and set scores<\/h2>/);
  assert.doesNotMatch(html, /<h2>Return and points<\/h2>/);
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
