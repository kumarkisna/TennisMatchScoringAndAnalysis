const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const screenSource = fs.readFileSync(
  path.join(__dirname, '../app/matches/[id].tsx'),
  'utf8',
);
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
  assert.match(regularMatrix, /point=\{gamePoints\[pointIndex\]\}/);
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
    /<ScrollView\s+horizontal\s+showsHorizontalScrollIndicator=\{false\}/,
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
