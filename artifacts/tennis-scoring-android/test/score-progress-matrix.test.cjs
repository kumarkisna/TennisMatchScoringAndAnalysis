const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const screenSource = fs.readFileSync(
  path.join(__dirname, '../app/matches/[id].tsx'),
  'utf8',
);
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
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: asyncStorage, ...asyncStorage };
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
const localMatches = require('../lib/local-matches.ts');
const { getStandardPointProgress } = require('../lib/score-progress.ts');
Module._load = originalLoad;
delete require.extensions['.ts'];

const regularMatrixStart = screenSource.indexOf(
  '{matrixRegularGameNumbers.map((gameNumber) => {',
);
const regularMatrixEnd = screenSource.indexOf(
  '\n\n            {!matrixTiebreakIsLive',
  regularMatrixStart,
);
const regularMatrix = screenSource.slice(regularMatrixStart, regularMatrixEnd);
const scoreCellStart = screenSource.indexOf('function ScoreProgressCell(');
const scoreCellEnd = screenSource.indexOf('\nfunction MatrixLaneLabel', scoreCellStart);
const scoreCell = screenSource.slice(scoreCellStart, scoreCellEnd);

test('each standard-game point renders in chronological two-player lanes', () => {
  assert.ok(regularMatrixStart >= 0);
  assert.ok(regularMatrixEnd > regularMatrixStart);
  assert.match(regularMatrix, /getStandardPointProgress\(gamePoints\)/);
  assert.match(regularMatrix, /\['tracked', 'opponent'\] as const\)\.map/);
  assert.match(regularMatrix, /matrix-game-\$\{gameNumber\}-lane-\$\{side\}/);
  assert.match(regularMatrix, /const progress = gameScoreProgress\[pointIndex\]/);
  assert.match(regularMatrix, /const point = gamePoints\[pointIndex\]/);
  assert.match(regularMatrix, /point=\{point\}/);
  assert.match(
    regularMatrix,
    /progress\.trackedScore\s*:\s*progress\.opponentScore/,
  );
});

test('the shot code is highlighted only in the point winner’s lane', () => {
  assert.ok(scoreCellStart >= 0);
  assert.ok(scoreCellEnd > scoreCellStart);
  assert.match(scoreCell, /const isPointWinner = point\?\.winner === side/);
  assert.match(scoreCell, /backgroundColor: isPointWinner \? sideColor/);
  assert.match(scoreCell, /isPointWinner \? pointCode : '\\u00a0'/);
  assert.match(scoreCell, /score \$\{score\}/);
});

test('undo removes the latest shot from its lane and restores both point scores', async () => {
  storageValues.clear();
  const match = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: null,
    round: null,
    trackedPlayer: 'Tracked Player',
    opponent: 'Opponent Player',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  const recordedPoints = [
    { winner: 'tracked', endingCode: 'A' },
    { winner: 'opponent', endingCode: 'F' },
    { winner: 'tracked', endingCode: 'B' },
    { winner: 'opponent', endingCode: 'V' },
  ];
  for (const point of recordedPoints) {
    await localMatches.recordLocalPoint(match.id, point);
  }

  const before = await localMatches.getLocalMatch(match.id);
  assert.ok(before);
  assert.equal(before.score.trackedPoints, '30');
  assert.equal(before.score.opponentPoints, '30');
  const matrixLanes = (points) => {
    const progress = getStandardPointProgress(points);
    return Object.fromEntries(
      ['tracked', 'opponent'].map((side) => [
        side,
        points.map((point, index) => ({
          pointId: point.id,
          score:
            side === 'tracked'
              ? progress[index].trackedScore
              : progress[index].opponentScore,
          code:
            point.winner === side
              ? point.endingCode || (side === 'tracked' ? 'T' : 'O')
              : null,
        })),
      ]),
    );
  };

  const beforeLanes = matrixLanes(before.points);
  assert.deepEqual(
    beforeLanes.tracked.map(({ code }) => code),
    ['A', null, 'B', null],
  );
  assert.deepEqual(
    beforeLanes.opponent.map(({ code }) => code),
    [null, 'F', null, 'V'],
  );
  assert.deepEqual(
    beforeLanes.tracked.map(({ score }) => score),
    ['15', '15', '30', '30'],
  );
  assert.deepEqual(
    beforeLanes.opponent.map(({ score }) => score),
    ['0', '15', '15', '30'],
  );

  const removedPoint = before.points.at(-1);
  assert.equal(removedPoint.winner, 'opponent');
  const after = await localMatches.undoLocalPoint(match.id);
  assert.equal(after.score.trackedPoints, '30');
  assert.equal(after.score.opponentPoints, '15');
  const afterLanes = matrixLanes(after.points);

  assert.equal(after.points.length, 3);
  assert.deepEqual(
    after.points.map((point) => point.id),
    before.points.slice(0, -1).map((point) => point.id),
  );
  assert.deepEqual(
    afterLanes.tracked.map(({ code }) => code),
    ['A', null, 'B'],
  );
  assert.deepEqual(
    afterLanes.opponent.map(({ code }) => code),
    [null, 'F', null],
  );
  assert.equal(
    afterLanes.opponent.some(({ pointId }) => pointId === removedPoint.id),
    false,
  );
  assert.deepEqual(
    afterLanes.tracked.map(({ score }) => score),
    ['15', '15', '30'],
  );
  assert.deepEqual(
    afterLanes.opponent.map(({ score }) => score),
    ['0', '15', '15'],
  );

  const undoMutationStart = screenSource.indexOf('const undoPoint = useMutation({');
  const undoMutationEnd = screenSource.indexOf(
    'const editPointWinner = useMutation({',
    undoMutationStart,
  );
  const undoMutation = screenSource.slice(undoMutationStart, undoMutationEnd);
  assert.match(undoMutation, /mutationFn: \(\) => undoLocalPoint\(matchId\)/);
  assert.match(undoMutation, /onSuccess: onUpdated/);
  assert.match(screenSource, /for \(const point of viewedSet\.points\)/);
});

test('tiebreak point history uses the same two-lane chronological layout', () => {
  const tiebreakStart = screenSource.indexOf('const matrixTiebreakRow =');
  const tiebreakEnd = screenSource.indexOf(
    '\n\n  return (',
    tiebreakStart,
  );
  const tiebreakRow = screenSource.slice(tiebreakStart, tiebreakEnd);

  assert.ok(tiebreakStart >= 0);
  assert.ok(tiebreakEnd > tiebreakStart);
  assert.match(tiebreakRow, /\['tracked', 'opponent'\] as const\)\.map/);
  assert.match(tiebreakRow, /matrix-tiebreak-lane-\$\{side\}/);
  assert.match(tiebreakRow, /const point = matrixTiebreakPoints\[index\]/);
  assert.match(tiebreakRow, /point=\{point\}/);
});

test('narrow screens can scroll the point columns while player lanes stay stacked', () => {
  assert.match(
    screenSource,
    /<ScrollView\s+ref=\{tiebreakMatrixScrollRef\}[\s\S]*?horizontal\s+showsHorizontalScrollIndicator=\{false\}/,
  );
  assert.match(
    screenSource,
    /matrixScoreLane: \{ minHeight: 38, borderTopWidth: StyleSheet\.hairlineWidth, flexDirection: 'row'/,
  );
  assert.match(
    screenSource,
    /matrixColumnCount = Math\.max\(\s*1,/,
  );
});

test('the matrix follows each newest tiebreak point and keeps earlier points scrollable', () => {
  assert.match(
    screenSource,
    /const tiebreakMatrixScrollRef = useRef<ScrollViewInstance \| null>\(null\);/,
  );
  assert.match(
    screenSource,
    /const matrixSetToFollow = displayedSet \?\? currentSet \?\? setHistory\.at\(-1\);/,
  );
  assert.match(
    screenSource,
    /const matrixSetTiebreakPoints =\s*matrixSetToFollow\?\.points\.filter\(\(point\) => point\.isTiebreak\) \?\? \[\];/,
  );
  assert.match(
    screenSource,
    /const newestTiebreakPointIndex = matrixSetTiebreakPoints\.length - 1;/,
  );
  assert.match(
    screenSource,
    /tiebreakMatrixScrollRef\.current\?\.scrollTo\(\{\s*x: newestTiebreakPoint\s*\?\s*Math\.max\(0, newestTiebreakPointIndex \* MATRIX_POINT_COLUMN_STEP\)\s*:\s*0,\s*y: 0,\s*animated: false,/,
  );
  assert.match(
    screenSource,
    /\[\s*matchId,\s*matrixSetToFollow\?\.setNumber,\s*newestTiebreakPoint\?\.id,\s*newestTiebreakPointIndex,\s*\]/,
  );
  assert.match(
    screenSource,
    /<ScrollView\s+ref=\{tiebreakMatrixScrollRef\}\s+testID="matrix-point-history-scroll"\s+accessibilityLabel="Set point history"\s+accessibilityHint="Swipe horizontally to review earlier points without changing their order\."\s+horizontal/,
  );
  assert.match(
    screenSource,
    /const point = matrixTiebreakPoints\[index\]/,
  );
});
