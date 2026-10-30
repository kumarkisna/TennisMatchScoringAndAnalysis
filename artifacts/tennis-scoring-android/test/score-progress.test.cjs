const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

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

const {
  getStandardPointProgress,
  getTiebreakPointProgress,
} = require(path.join(__dirname, '../lib/score-progress.ts'));

test('standard game progress shows both players through deuce and advantage', () => {
  const points = [
    'tracked',
    'opponent',
    'tracked',
    'opponent',
    'tracked',
    'opponent',
    'tracked',
    'opponent',
  ].map((winner) => ({ winner }));

  assert.deepEqual(getStandardPointProgress(points), [
    { trackedScore: '15', opponentScore: '0' },
    { trackedScore: '15', opponentScore: '15' },
    { trackedScore: '30', opponentScore: '15' },
    { trackedScore: '30', opponentScore: '30' },
    { trackedScore: '40', opponentScore: '30' },
    { trackedScore: '40', opponentScore: '40' },
    { trackedScore: 'AD', opponentScore: '40' },
    { trackedScore: '40', opponentScore: '40' },
  ]);
});

test('completed standard game marks the winning point as GAME', () => {
  const points = ['tracked', 'tracked', 'tracked', 'opponent', 'tracked'].map(
    (winner) => ({ winner }),
  );

  assert.deepEqual(getStandardPointProgress(points).at(-1), {
    trackedScore: 'GAME',
    opponentScore: '15',
  });
});

test('tiebreak progress shows both point totals in chronological order', () => {
  const points = ['tracked', 'opponent', 'tracked', 'tracked', 'opponent'].map(
    (winner) => ({ winner }),
  );

  assert.deepEqual(getTiebreakPointProgress(points), [
    { trackedScore: '1', opponentScore: '0' },
    { trackedScore: '1', opponentScore: '1' },
    { trackedScore: '2', opponentScore: '1' },
    { trackedScore: '3', opponentScore: '1' },
    { trackedScore: '3', opponentScore: '2' },
  ]);
});
