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
const playerInsightsPath = path.join(__dirname, '../lib/player-insights.ts');

function loadStorageModulesAfterRestart() {
  delete require.cache[require.resolve(localMatchesPath)];
  delete require.cache[require.resolve(localPlayersPath)];

  return {
    localMatches: require(localMatchesPath),
    localPlayers: require(localPlayersPath),
  };
}

function loadPlayerInsights() {
  delete require.cache[require.resolve(playerInsightsPath)];
  return require(playerInsightsPath);
}

const originalModuleLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@/lib/local-matches') {
    return originalModuleLoad.call(this, localMatchesPath, parent, isMain);
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
  if (originalTsExtension) {
    require.extensions['.ts'] = originalTsExtension;
  } else {
    delete require.extensions['.ts'];
  }
});

test('saved match points and editable player profiles survive offline app restart', async (t) => {
  storageValues.clear();
  const originalFetch = global.fetch;
  let networkRequestCount = 0;
  global.fetch = async () => {
    networkRequestCount += 1;
    throw new Error('Offline local-storage flows must not make network requests.');
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const beforeRestart = loadStorageModulesAfterRestart();
  const player = await beforeRestart.localPlayers.addLocalPlayer('Sana Iyer', {
    dateOfBirth: '2005-07-09',
    atpPlayerId: 'ATP-12345',
    itfPlayerId: 'ITF-54321',
    atpRanking: 287,
    itfRanking: 121,
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
    trackedPlayerId: player.id,
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
  assert.equal(restoredMatch.trackedPlayerId, player.id);
  assert.equal(restoredMatch.opponent, 'Maya Rao');
  assert.equal(restoredMatch.syncStatus, 'local_only');
  assert.equal(restoredMatch.points.length, 1);
  assert.equal(restoredMatch.points[0].winner, 'tracked');
  assert.equal(restoredMatch.points[0].endingCode, 'A');

  assert.ok(restoredPlayer);
  assert.equal(restoredPlayer.dateOfBirth, '2005-07-09');
  assert.equal(restoredPlayer.atpPlayerId, 'ATP-12345');
  assert.equal(restoredPlayer.itfPlayerId, 'ITF-54321');
  assert.equal(restoredPlayer.atpRanking, 287);
  assert.equal(restoredPlayer.itfRanking, 121);
  assert.deepEqual(restoredPlayer.phoneNumbers, ['+1 415 555 0123']);
  assert.deepEqual(restoredPlayer.profileUrls, [
    'https://example.org/players/sana-iyer',
  ]);
  assert.equal(activePlayerId, player.id);

  assert.equal(matchSummaries.length, 1);
  assert.equal(matchSummaries[0].id, match.id);
  assert.equal(matchSummaries[0].pointCount, 1);

  await afterRestart.localMatches.updateLocalMatchDetails(match.id, {
    matchDate: restoredMatch.matchDate,
    event: 'City Open - Updated',
    round: restoredMatch.round,
    trackedPlayer: restoredMatch.trackedPlayer,
    opponent: restoredMatch.opponent,
    chairCoach: restoredMatch.chairCoach,
    surface: restoredMatch.surface,
    firstServer: restoredMatch.firstServer,
  });
  await afterRestart.localPlayers.updateLocalPlayer(player.id, restoredPlayer.name, {
    dateOfBirth: restoredPlayer.dateOfBirth,
    atpPlayerId: restoredPlayer.atpPlayerId,
    itfPlayerId: restoredPlayer.itfPlayerId,
    atpRanking: 285,
    itfRanking: restoredPlayer.itfRanking,
    nationality: restoredPlayer.nationality,
    playingHand: restoredPlayer.playingHand,
    heightCm: restoredPlayer.heightCm,
    weightKg: restoredPlayer.weightKg,
    phoneNumbers: restoredPlayer.phoneNumbers,
    profileUrls: restoredPlayer.profileUrls,
  });

  const afterEditRestart = loadStorageModulesAfterRestart();
  const [editedMatch, editedPlayers] = await Promise.all([
    afterEditRestart.localMatches.getLocalMatch(match.id),
    afterEditRestart.localPlayers.listLocalPlayers(),
  ]);
  const editedPlayer = editedPlayers.find((item) => item.id === player.id);
  assert.ok(editedMatch);
  assert.equal(editedMatch.event, 'City Open - Updated');
  assert.equal(editedMatch.trackedPlayerId, player.id);
  assert.equal(editedMatch.points.length, 1);
  assert.equal(editedMatch.points[0].winner, 'tracked');
  assert.equal(editedMatch.points[0].endingCode, 'A');
  assert.ok(editedPlayer);
  assert.equal(editedPlayer.dateOfBirth, '2005-07-09');
  assert.equal(editedPlayer.atpPlayerId, 'ATP-12345');
  assert.equal(editedPlayer.atpRanking, 285);
  assert.equal(editedPlayer.itfPlayerId, 'ITF-54321');
  assert.equal(editedPlayer.itfRanking, 121);
  assert.equal(editedPlayer.nationality, 'India');
  assert.equal(editedPlayer.playingHand, 'right');
  assert.deepEqual(editedPlayer.phoneNumbers, ['+1 415 555 0123']);
  assert.deepEqual(editedPlayer.profileUrls, [
    'https://example.org/players/sana-iyer',
  ]);
  assert.equal(networkRequestCount, 0);
});

test('legacy match links preserve names and trend metrics count points from every set', async () => {
  storageValues.clear();
  const { localMatches, localPlayers } = loadStorageModulesAfterRestart();
  const trackedPlayer = await localPlayers.addLocalPlayer('Sana Iyer');
  const opponentPlayer = await localPlayers.addLocalPlayer('Maya Rao');
  const match = await localMatches.createLocalMatch({
    matchDate: '2026-10-29',
    event: 'Autumn Open',
    round: 'Final',
    trackedPlayer: 'Sana Iyer',
    opponent: 'Maya Rao',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await localMatches.recordLocalPoint(match.id, {
    winner: 'tracked',
    endingCode: 'A',
  });
  await localMatches.recordLocalPoint(match.id, {
    winner: 'opponent',
    firstServeFault: true,
  });
  await localMatches.recordLocalPoint(match.id, {
    winner: 'tracked',
    endingCode: 'A',
  });
  await localMatches.recordLocalPoint(match.id, {
    winner: 'opponent',
  });
  const laterMatch = await localMatches.createLocalMatch({
    matchDate: '2026-10-31',
    event: 'Winter Series',
    round: null,
    trackedPlayer: 'Sana Iyer',
    opponent: 'Maya Rao',
    chairCoach: null,
    surface: 'Clay',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await localMatches.recordLocalPoint(laterMatch.id, { winner: 'tracked' });

  const recordKey = `@tennis-scoring/matches/record-v1/${match.id}`;
  const storedMatch = JSON.parse(storageValues.get(recordKey));
  const recordedPoints = storedMatch.points;
  recordedPoints[2].server = 'opponent';
  recordedPoints[2].gameNumber = 2;
  recordedPoints[3].server = 'opponent';
  recordedPoints[3].gameNumber = 2;
  storedMatch.completedSets = [
    {
      setNumber: 1,
      firstServer: 'tracked',
      format: storedMatch.setFormat,
      tiebreakTarget: storedMatch.tiebreakTarget,
      score: storedMatch.score,
      points: recordedPoints.slice(0, 2),
      gameNotes: [],
      review: storedMatch.review,
    },
  ];
  storedMatch.setNumber = 2;
  storedMatch.points = recordedPoints.slice(2).map((point) => ({
    ...point,
    setNumber: 2,
  }));
  delete storedMatch.trackedPlayerId;
  delete storedMatch.opponentPlayerId;
  storageValues.set(recordKey, JSON.stringify(storedMatch));

  const players = await localPlayers.listLocalPlayers();
  const history = await localMatches.listLocalPlayerMatchInsights(
    trackedPlayer.id,
    players,
  );
  assert.equal(history.length, 2);
  assert.deepEqual(
    history.map((record) => record.match.matchDate),
    ['2026-10-29', '2026-10-31'],
  );
  assert.equal(history[0].playerSide, 'tracked');
  assert.equal(history[0].insights.pointCount, 4);
  assert.equal(history[0].insights.trackedPointsWon, 2);
  assert.equal(history[0].insights.trackedServicePoints, 2);
  assert.equal(history[0].insights.servicePointsWon, 1);
  assert.equal(history[0].insights.trackedReturnPoints, 2);
  assert.equal(history[0].insights.returnPointsWon, 1);

  const linkedMatch = await localMatches.getLocalMatch(match.id);
  assert.equal(linkedMatch.trackedPlayerId, trackedPlayer.id);
  assert.equal(linkedMatch.opponentPlayerId, opponentPlayer.id);
  assert.equal(linkedMatch.trackedPlayer, 'Sana Iyer');
  assert.equal(linkedMatch.opponent, 'Maya Rao');
  assert.equal(linkedMatch.completedSets[0].points.length, 2);
  assert.equal(linkedMatch.points.length, 2);

  const trends = loadPlayerInsights().buildPlayerPerformanceHistory(history);
  assert.equal(trends.length, 2);
  assert.equal(trends[0].metrics.overall.percent, 50);
  assert.equal(trends[0].metrics.service.percent, 50);
  assert.equal(trends[0].metrics.return.percent, 50);
  assert.equal(trends[0].metrics.firstServe.percent, 100);
  assert.equal(trends[0].metrics.secondServe.percent, 0);
  assert.deepEqual(
    [trends[0].metrics.overall.won, trends[0].metrics.overall.total],
    [2, 4],
  );

  const opponentHistory = await localMatches.listLocalPlayerMatchInsights(
    opponentPlayer.id,
    players,
  );
  const opponentTrend = loadPlayerInsights().buildPlayerPerformanceHistory(
    opponentHistory,
  )[0];
  assert.equal(opponentTrend.metrics.secondServe.percent, null);
  assert.equal(opponentTrend.metrics.secondServe.total, 0);
});

test('legacy match names that match multiple saved identities stay unlinked', async () => {
  storageValues.clear();
  const { localMatches } = loadStorageModulesAfterRestart();
  const match = await localMatches.createLocalMatch({
    matchDate: '2026-10-29',
    event: null,
    round: null,
    trackedPlayer: 'Alex Kim',
    opponent: 'Riley Park',
    chairCoach: null,
    surface: 'Clay',
    firstServer: 'opponent',
    setNumber: 1,
  });
  await localMatches.recordLocalPoint(match.id, { winner: 'tracked' });
  const records = await localMatches.listLocalPlayerMatchInsights('alex-one', [
    { id: 'alex-one', name: 'Alex Kim' },
    { id: 'alex-two', name: 'Alex Kim' },
  ]);
  assert.equal(records.length, 0);
  const unchanged = await localMatches.getLocalMatch(match.id);
  assert.equal(unchanged.trackedPlayerId, null);
  assert.equal(unchanged.trackedPlayer, 'Alex Kim');
});
