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
    for (const [key, value] of entries) {
      storageValues.set(key, String(value));
    }
  },
  async multiGet(keys) {
    return keys.map((key) => [
      key,
      storageValues.has(key) ? storageValues.get(key) : null,
    ]);
  },
};

const originalLoad = Module._load;
const originalTsExtension = require.extensions['.ts'];

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
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

const localMatchesPath = path.join(__dirname, '../lib/local-matches.ts');
const localPlayersPath = path.join(__dirname, '../lib/local-players.ts');

function loadStorageModulesAfterRestart() {
  delete require.cache[require.resolve(localMatchesPath)];
  delete require.cache[require.resolve(localPlayersPath)];

  return {
    localMatches: require(localMatchesPath),
    localPlayers: require(localPlayersPath),
  };
}

test.after(() => {
  Module._load = originalLoad;
  if (originalTsExtension) {
    require.extensions['.ts'] = originalTsExtension;
  } else {
    delete require.extensions['.ts'];
  }
});

test('saved match points, player profile, and main player survive app restart', async () => {
  storageValues.clear();
  const beforeRestart = loadStorageModulesAfterRestart();
  const player = await beforeRestart.localPlayers.addLocalPlayer('Sana Iyer', {
    dateOfBirth: '2005-07-09',
    atpPlayerId: 'ATP-12345',
    nationality: 'India',
    playingHand: 'right',
    phoneNumbers: ['+1 415 555 0123'],
    profileUrls: ['https://example.org/players/sana-iyer'],
  });
  await beforeRestart.localPlayers.setActiveLocalPlayerId(player.id);

  const match = await beforeRestart.localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'City Open',
    round: 'Final',
    trackedPlayer: player.name,
    opponent: 'Maya Rao',
    chairCoach: 'Coach Lee',
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await beforeRestart.localMatches.recordLocalPoint(match.id, {
    winner: 'tracked',
    endingCode: 'A',
    firstServeFault: false,
  });

  const afterRestart = loadStorageModulesAfterRestart();
  const [restoredMatch, restoredPlayer, activePlayerId, matchSummaries] =
    await Promise.all([
      afterRestart.localMatches.getLocalMatch(match.id),
      afterRestart.localPlayers.listLocalPlayers().then((players) =>
        players.find((item) => item.id === player.id),
      ),
      afterRestart.localPlayers.getActiveLocalPlayerId(),
      afterRestart.localMatches.listLocalMatches(),
    ]);

  assert.ok(restoredMatch);
  assert.equal(restoredMatch.matchDate, '2026-10-30');
  assert.equal(restoredMatch.trackedPlayer, 'Sana Iyer');
  assert.equal(restoredMatch.opponent, 'Maya Rao');
  assert.equal(restoredMatch.syncStatus, 'local_only');
  assert.equal(restoredMatch.points.length, 1);
  assert.equal(restoredMatch.points[0].winner, 'tracked');
  assert.equal(restoredMatch.points[0].endingCode, 'A');

  assert.ok(restoredPlayer);
  assert.equal(restoredPlayer.dateOfBirth, '2005-07-09');
  assert.equal(restoredPlayer.atpPlayerId, 'ATP-12345');
  assert.deepEqual(restoredPlayer.phoneNumbers, ['+1 415 555 0123']);
  assert.deepEqual(restoredPlayer.profileUrls, [
    'https://example.org/players/sana-iyer',
  ]);
  assert.equal(activePlayerId, player.id);

  assert.equal(matchSummaries.length, 1);
  assert.equal(matchSummaries[0].id, match.id);
  assert.equal(matchSummaries[0].pointCount, 1);
});
