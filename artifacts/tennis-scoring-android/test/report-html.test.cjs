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

Module._load = function (request, parent, isMain) {
  if (request === '@/lib/local-matches') {
    return {
      STROKE_TYPE_OPTIONS: strokeOptions,
    };
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

const { buildPlayerReportHtml } = require('../lib/player-report-html.ts');
playerReportExports = { buildPlayerReportHtml };
const { buildHeadToHeadReportHtml } = require('../lib/head-to-head-report-html.ts');
Module._load = originalLoad;

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
