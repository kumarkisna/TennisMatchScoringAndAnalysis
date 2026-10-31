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

let activeModules;
let selectedBackupContents = '';
let savedDeviceBackup = null;
let sharedBackup = null;
let sharedUri = '';
let networkRequestCount = 0;
const originalFetch = global.fetch;
global.fetch = async () => {
  networkRequestCount += 1;
  throw new Error('A local backup flow must not make network requests.');
};

const fileSystem = {
  cacheDirectory: 'file://cache/',
  EncodingType: { UTF8: 'utf8' },
  async readAsStringAsync() {
    return selectedBackupContents;
  },
  async writeAsStringAsync(uri, contents) {
    sharedUri = uri;
    sharedBackup = contents;
  },
  StorageAccessFramework: {
    async requestDirectoryPermissionsAsync() {
      return { granted: true, directoryUri: 'content://downloads' };
    },
    async createFileAsync(directoryUri, fileName, mimeType) {
      savedDeviceBackup = {
        uri: `${directoryUri}/${fileName}`,
        fileName,
        mimeType,
        contents: '',
      };
      return savedDeviceBackup.uri;
    },
    async writeAsStringAsync(uri, contents) {
      assert.equal(uri, savedDeviceBackup.uri);
      savedDeviceBackup.contents = contents;
    },
  },
};

const documentPicker = {
  async getDocumentAsync() {
    return {
      canceled: false,
      assets: [{ uri: 'content://downloads/tennis-backup.json' }],
    };
  },
};

const sharing = {
  async isAvailableAsync() {
    return true;
  },
  async shareAsync(uri) {
    assert.equal(uri, sharedUri);
  },
};

const originalLoad = Module._load;
const originalTsExtension = require.extensions['.ts'];

Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: asyncStorage, ...asyncStorage };
  }
  if (request === '@/lib/local-matches') return activeModules.localMatches;
  if (request === '@/lib/local-players') return activeModules.localPlayers;
  if (request === '@/lib/local-report-labels') {
    return activeModules.localReportLabels;
  }
  if (request === '@/lib/local-benchmarks') {
    return activeModules.localBenchmarks;
  }
  if (request === 'expo-file-system/legacy') return fileSystem;
  if (request === 'expo-document-picker') {
    return { __esModule: true, ...documentPicker };
  }
  if (request === 'expo-sharing') return { __esModule: true, ...sharing };
  if (request === 'react-native') return { Platform: { OS: 'android' } };
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
const localReportLabelsPath = path.join(
  __dirname,
  '../lib/local-report-labels.ts',
);
const localBenchmarksPath = path.join(
  __dirname,
  '../lib/local-benchmarks.ts',
);
const localBackupPath = path.join(__dirname, '../lib/local-backup.ts');
const versionOneBackupFixturePath = path.join(
  __dirname,
  'fixtures/local-backup-v1.json',
);

function readVersionOneBackupFixture() {
  return fs.readFileSync(versionOneBackupFixturePath, 'utf8');
}

function loadLocalModules() {
  delete require.cache[require.resolve(localMatchesPath)];
  delete require.cache[require.resolve(localPlayersPath)];
  delete require.cache[require.resolve(localReportLabelsPath)];
  delete require.cache[require.resolve(localBenchmarksPath)];
  activeModules = {
    localMatches: require(localMatchesPath),
    localPlayers: require(localPlayersPath),
    localReportLabels: require(localReportLabelsPath),
    localBenchmarks: require(localBenchmarksPath),
  };
}

function loadBackupModule() {
  delete require.cache[require.resolve(localBackupPath)];
  return require(localBackupPath);
}

async function createSampleRecords() {
  const profileLinks = activeModules.localPlayers.moveLocalPlayerProfileLink(
    activeModules.localPlayers.pairLocalPlayerProfileLinks(
      [
        'https://atp.example.org/players/sana-iyer',
        'http://club.example.org/players/sana-iyer',
        'https://itf.example.org/player/sana-iyer',
      ],
      ['ATP profile', 'Club page', 'ITF profile'],
    ),
    1,
    'up',
  );
  const player = await activeModules.localPlayers.addLocalPlayer('Sana Iyer', {
    dateOfBirth: '2005-07-09',
    atpPlayerId: 'ATP-12345',
    itfPlayerId: 'ITF-54321',
    atpRanking: 285,
    itfRanking: 121,
    nationality: 'India',
    playingHand: 'right',
    heightCm: 180,
    weightKg: 75,
    phoneNumbers: ['+1 415 555 0123'],
    ...activeModules.localPlayers.serializeLocalPlayerProfileLinks(profileLinks),
  });
  await activeModules.localPlayers.setActiveLocalPlayerId(player.id);

  const match = await activeModules.localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'City Open',
    round: 'Final',
    trackedPlayer: player.name,
    trackedPlayerId: player.id,
    opponent: 'Maya Rao',
    chairCoach: 'Coach Lee',
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await activeModules.localMatches.recordLocalPoint(match.id, {
    winner: 'tracked',
    endingCode: 'A',
    firstServeFault: false,
    strokes: [
      {
        player: 'tracked',
        strokeType: 'first_serve',
        result: 'winner',
        note: 'Wide serve',
      },
    ],
  });
  for (let point = 1; point < 24; point += 1) {
    await activeModules.localMatches.recordLocalPoint(match.id, {
      winner: 'tracked',
    });
  }
  await activeModules.localMatches.updateLocalGameNote(
    match.id,
    1,
    6,
    'Stayed composed to close out the set.',
  );
  await activeModules.localMatches.addLocalSet(match.id, 'match_tiebreak', 7);
  await activeModules.localMatches.recordLocalPoint(match.id, {
    winner: 'opponent',
  });

  return { player, match };
}

test.after(() => {
  Module._load = originalLoad;
  if (originalTsExtension) {
    require.extensions['.ts'] = originalTsExtension;
  } else {
    delete require.extensions['.ts'];
  }
  if (originalFetch) {
    global.fetch = originalFetch;
  } else {
    delete global.fetch;
  }
});

test('ten-point stroke ratings survive backup restore and legacy conversion', async () => {
  storageValues.clear();
  savedDeviceBackup = null;
  selectedBackupContents = '';
  networkRequestCount = 0;
  loadLocalModules();
  const { match } = await createSampleRecords();
  const matchRecord = await activeModules.localMatches.getLocalMatch(match.id);
  assert.ok(matchRecord);
  await activeModules.localMatches.updateLocalSetReview(match.id, 2, {
    ...matchRecord.review,
    strokeRatings: { first_serve: 8 },
  });

  await loadBackupModule().saveLocalBackupToDevice();
  const exportedContents = savedDeviceBackup.contents;
  const exported = JSON.parse(exportedContents);
  assert.equal(exported.matches[0].review.strokeRatingScale, 10);
  assert.equal(exported.matches[0].review.strokeRatings.first_serve, 8);

  storageValues.clear();
  loadLocalModules();
  selectedBackupContents = exportedContents;
  await loadBackupModule().loadLocalBackupFromDevice();
  let restoredMatch = await activeModules.localMatches.getLocalMatch(match.id);
  assert.ok(restoredMatch);
  assert.equal(restoredMatch.review.strokeRatings.first_serve, 8);
  assert.equal(restoredMatch.review.strokeRatingScale, 10);

  const legacyBackup = JSON.parse(exportedContents);
  delete legacyBackup.matches[0].review.strokeRatingScale;
  legacyBackup.matches[0].review.strokeRatings.first_serve = 4;
  storageValues.clear();
  loadLocalModules();
  selectedBackupContents = JSON.stringify(legacyBackup);
  await loadBackupModule().loadLocalBackupFromDevice();
  restoredMatch = await activeModules.localMatches.getLocalMatch(match.id);
  assert.ok(restoredMatch);
  assert.equal(restoredMatch.review.strokeRatings.first_serve, 8);
  assert.equal(restoredMatch.review.strokeRatingScale, 10);
  assert.equal(networkRequestCount, 0);
});

test('backup save, share, and restore preserve all players and sets without network access', async () => {
  storageValues.clear();
  savedDeviceBackup = null;
  sharedBackup = null;
  sharedUri = '';
  networkRequestCount = 0;
  loadLocalModules();
  const { player, match } = await createSampleRecords();
  const reportNameLabels = {
    trackedPlayer: 'Local Athlete',
    opponent: 'Guest Player',
  };
  await activeModules.localReportLabels.saveLocalReportNameLabels(
    reportNameLabels,
  );
  const seasonBenchmarkSettings =
    await activeModules.localBenchmarks.saveLocalReportBenchmarkPreset({
      name: 'Sana season baseline',
      firstServePointsWon: 74.2,
      secondServePointsWon: 57.1,
      serviceGamesWon: 88.3,
    });
  const seasonPreset = seasonBenchmarkSettings.presets.find(
    (preset) => preset.name === 'Sana season baseline',
  );
  assert.ok(seasonPreset);
  const eventBenchmarkSettings =
    await activeModules.localBenchmarks.saveLocalReportBenchmarkPreset({
      name: 'City Open target',
      firstServePointsWon: 78.5,
      secondServePointsWon: 60.2,
      serviceGamesWon: 91.4,
    });
  const eventPreset = eventBenchmarkSettings.presets.find(
    (preset) => preset.name === 'City Open target',
  );
  assert.ok(eventPreset);
  const benchmarkSettings =
    await activeModules.localBenchmarks.setSelectedLocalReportBenchmarkPresets([
      eventPreset.id,
      seasonPreset.id,
    ]);
  await activeModules.localMatches.recordLocalMatchOutcome(match.id, {
    reason: 'retirement',
    winner: 'opponent',
  });
  const backup = loadBackupModule();

  const saveResult = await backup.saveLocalBackupToDevice();
  assert.equal(saveResult.cancelled, false);
  assert.ok(saveResult.fileName.endsWith('.json'));
  assert.equal(savedDeviceBackup.mimeType, 'application/json');
  const exported = JSON.parse(savedDeviceBackup.contents);
  assert.equal(exported.format, 'tennis-scoring-local-backup');
  assert.equal(exported.version, 1);
  assert.equal(exported.activePlayerId, player.id);
  assert.deepEqual(exported.reportNameLabels, reportNameLabels);
  assert.deepEqual(exported.reportBenchmarks, benchmarkSettings);
  assert.deepEqual(exported.reportBenchmarks.selectedPresetIds, [
    eventPreset.id,
    seasonPreset.id,
  ]);
  assert.equal(exported.players[0].dateOfBirth, '2005-07-09');
  assert.equal(exported.players[0].itfPlayerId, 'ITF-54321');
  assert.equal(exported.players[0].atpRanking, 285);
  assert.equal(exported.players[0].itfRanking, 121);
  assert.equal(exported.players[0].heightCm, 180);
  assert.equal(exported.players[0].weightKg, 75);
  assert.deepEqual(exported.players[0].phoneNumbers, ['+1 415 555 0123']);
  assert.deepEqual(exported.players[0].profileUrls, [
    'http://club.example.org/players/sana-iyer',
    'https://atp.example.org/players/sana-iyer',
    'https://itf.example.org/player/sana-iyer',
  ]);
  assert.deepEqual(exported.players[0].profileUrlLabels, [
    'Club page',
    'ATP profile',
    'ITF profile',
  ]);
  assert.equal(exported.matches[0].id, match.id);
  assert.deepEqual(exported.matches[0].matchOutcome, {
    reason: 'retirement',
    winner: 'opponent',
  });
  assert.equal(exported.matches[0].completedSets.length, 1);
  assert.equal(exported.matches[0].completedSets[0].points.length, 24);
  assert.equal(
    exported.matches[0].completedSets[0].points[0].strokes[0].note,
    'Wide serve',
  );
  assert.equal(
    exported.matches[0].completedSets[0].gameNotes[0].note,
    'Stayed composed to close out the set.',
  );
  assert.equal(exported.matches[0].setFormat, 'match_tiebreak');
  assert.equal(exported.matches[0].tiebreakTarget, 7);
  assert.equal(exported.matches[0].points.length, 1);
  assert.equal(exported.matches[0].points[0].isTiebreak, true);
  for (const field of [
    'ownerUserId',
    'syncStatus',
    'syncToken',
    'remoteMatchId',
    'pendingPointDeletes',
    'syncError',
  ]) {
    assert.equal(field in exported.matches[0], false);
  }
  assert.equal('syncStatus' in exported.matches[0].points[0], false);
  assert.equal(
    'syncStatus' in exported.matches[0].completedSets[0].points[0],
    false,
  );

  await backup.shareLocalBackup();
  assert.ok(sharedUri.startsWith('file://cache/'));
  assert.equal(JSON.parse(sharedBackup).matches[0].completedSets[0].points.length, 24);
  assert.deepEqual(JSON.parse(sharedBackup).reportNameLabels, reportNameLabels);
  assert.deepEqual(JSON.parse(sharedBackup).reportBenchmarks, benchmarkSettings);
  assert.equal(networkRequestCount, 0);

  const legacyBackup = JSON.parse(savedDeviceBackup.contents);
  Object.assign(legacyBackup.matches[0], {
    ownerUserId: 'former-user',
    syncStatus: 'local_only',
    syncToken: 'legacy-token',
    remoteMatchId: 'remote-match',
    pendingPointDeletes: ['removed-point'],
    syncError: null,
  });
  legacyBackup.matches[0].points[0].syncStatus = 'pending';
  legacyBackup.matches[0].completedSets[0].points[0].syncStatus = 'synced';

  storageValues.clear();
  loadLocalModules();
  selectedBackupContents = JSON.stringify(legacyBackup);
  const restoreResult = await loadBackupModule().loadLocalBackupFromDevice();
  assert.deepEqual(restoreResult, {
    cancelled: false,
    playersAdded: 1,
    playersSkipped: 0,
    matchesAdded: 1,
    matchesSkipped: 0,
  });

  const restoredPlayer = (await activeModules.localPlayers.listLocalPlayers())[0];
  const restoredMatch = await activeModules.localMatches.getLocalMatch(match.id);
  assert.equal(restoredPlayer.name, 'Sana Iyer');
  assert.deepEqual(
    await activeModules.localReportLabels.getLocalReportNameLabels(),
    reportNameLabels,
  );
  assert.deepEqual(
    await activeModules.localBenchmarks.getLocalReportBenchmarkSettings(),
    benchmarkSettings,
  );
  loadLocalModules();
  assert.deepEqual(
    await activeModules.localBenchmarks.getLocalReportBenchmarkSettings(),
    benchmarkSettings,
  );
  assert.equal(restoredPlayer.dateOfBirth, '2005-07-09');
  assert.equal(restoredPlayer.itfPlayerId, 'ITF-54321');
  assert.equal(restoredPlayer.atpRanking, 285);
  assert.equal(restoredPlayer.itfRanking, 121);
  assert.equal(restoredPlayer.heightCm, 180);
  assert.equal(restoredPlayer.weightKg, 75);
  assert.deepEqual(restoredPlayer.profileUrls, [
    'http://club.example.org/players/sana-iyer',
    'https://atp.example.org/players/sana-iyer',
    'https://itf.example.org/player/sana-iyer',
  ]);
  assert.deepEqual(restoredPlayer.profileUrlLabels, [
    'Club page',
    'ATP profile',
    'ITF profile',
  ]);
  assert.equal(
    await activeModules.localPlayers.getActiveLocalPlayerId(),
    restoredPlayer.id,
  );
  assert.ok(restoredMatch);
  assert.deepEqual(restoredMatch.matchOutcome, {
    reason: 'retirement',
    winner: 'opponent',
  });
  assert.equal(restoredMatch.trackedPlayerId, restoredPlayer.id);
  assert.equal('syncStatus' in restoredMatch, false);
  assert.equal(restoredMatch.completedSets.length, 1);
  assert.equal(restoredMatch.completedSets[0].points.length, 24);
  assert.equal('syncStatus' in restoredMatch.points[0], false);
  assert.equal('syncStatus' in restoredMatch.completedSets[0].points[0], false);
  assert.equal(
    restoredMatch.completedSets[0].points[0].strokes[0].note,
    'Wide serve',
  );
  assert.equal(
    restoredMatch.completedSets[0].gameNotes[0].note,
    'Stayed composed to close out the set.',
  );
  assert.equal(restoredMatch.setFormat, 'match_tiebreak');
  assert.equal(restoredMatch.tiebreakTarget, 7);
  assert.equal(restoredMatch.points.length, 1);
  assert.equal(restoredMatch.points[0].isTiebreak, true);
  const restoredRecord = JSON.parse(
    storageValues.get(`@tennis-scoring/matches/record-v1/${match.id}`),
  );
  for (const field of [
    'ownerUserId',
    'syncStatus',
    'syncToken',
    'remoteMatchId',
    'pendingPointDeletes',
    'syncError',
  ]) {
    assert.equal(field in restoredRecord, false);
  }
  assert.equal('syncStatus' in restoredRecord.points[0], false);
  assert.equal('syncStatus' in restoredRecord.completedSets[0].points[0], false);

  const repeatedImport = await loadBackupModule().loadLocalBackupFromDevice();
  assert.equal(repeatedImport.playersAdded, 0);
  assert.equal(repeatedImport.playersSkipped, 1);
  assert.equal(repeatedImport.matchesAdded, 0);
  assert.equal(repeatedImport.matchesSkipped, 1);

  const beforeInvalidImport = [...storageValues.entries()];
  const invalidProfileUrls = [
    ['unsupported scheme', 'ftp://example.org/players/new-player'],
    ['embedded credentials', 'https://player:secret@example.org/profile'],
  ];
  for (const [caseName, invalidUrl] of invalidProfileUrls) {
    const invalidProfileBackup = JSON.parse(savedDeviceBackup.contents);
    invalidProfileBackup.players[0].name = `New valid player before ${caseName}`;
    invalidProfileBackup.players.push({
      ...invalidProfileBackup.players[0],
      id: `invalid-profile-${caseName.replace(/\s+/g, '-')}`,
      name: `Player with ${caseName}`,
      profileUrls: [invalidUrl],
      profileUrlLabels: ['Invalid profile'],
    });
    selectedBackupContents = JSON.stringify(invalidProfileBackup);
    await assert.rejects(
      loadBackupModule().loadLocalBackupFromDevice(),
      /invalid player details\. No data was imported/,
    );
    assert.deepEqual(
      [...storageValues.entries()],
      beforeInvalidImport,
      `A backup with a ${caseName} profile URL must not partially import players or matches.`,
    );
  }

  const invalidLabelsBackup = JSON.parse(savedDeviceBackup.contents);
  invalidLabelsBackup.reportNameLabels = {
    trackedPlayer: 'Same label',
    opponent: ' same   label ',
  };
  selectedBackupContents = JSON.stringify(invalidLabelsBackup);
  await assert.rejects(
    loadBackupModule().loadLocalBackupFromDevice(),
    /invalid report labels\. No data was imported/,
  );
  assert.deepEqual(
    [...storageValues.entries()],
    beforeInvalidImport,
    'Invalid report labels must not partially import players or matches.',
  );

  const invalidBenchmarksBackup = JSON.parse(savedDeviceBackup.contents);
  invalidBenchmarksBackup.players[0].name = 'Player from invalid benchmark backup';
  invalidBenchmarksBackup.reportBenchmarks.selectedPresetIds = [
    'missing-benchmark-id',
  ];
  selectedBackupContents = JSON.stringify(invalidBenchmarksBackup);
  await assert.rejects(
    loadBackupModule().loadLocalBackupFromDevice(),
    /invalid report benchmarks\. No data was imported/,
  );
  assert.deepEqual(
    [...storageValues.entries()],
    beforeInvalidImport,
    'Invalid report benchmarks must not partially import players or matches.',
  );

  const duplicateBackup = JSON.parse(savedDeviceBackup.contents);
  duplicateBackup.matches.push(duplicateBackup.matches[0]);
  selectedBackupContents = JSON.stringify(duplicateBackup);
  await assert.rejects(
    loadBackupModule().loadLocalBackupFromDevice(),
    /duplicate or invalid record references/,
  );
  assert.deepEqual([...storageValues.entries()], beforeInvalidImport);

  const invalidBackup = JSON.parse(savedDeviceBackup.contents);
  invalidBackup.matches[0].matchDate = 'not-a-date';
  selectedBackupContents = JSON.stringify(invalidBackup);
  await assert.rejects(
    loadBackupModule().loadLocalBackupFromDevice(),
    /invalid match or point history/,
  );
  assert.deepEqual([...storageValues.entries()], beforeInvalidImport);
  assert.equal(networkRequestCount, 0);
});

test('malformed match outcomes reject a backup before changing device data', async () => {
  storageValues.clear();
  networkRequestCount = 0;
  loadLocalModules();
  const { player, match } = await createSampleRecords();
  await activeModules.localMatches.recordLocalMatchOutcome(match.id, {
    reason: 'walkover',
    winner: 'tracked',
  });
  const validBackup = JSON.parse(
    await loadBackupModule().createLocalBackupJson(),
  );
  const playersBefore = await activeModules.localPlayers.listLocalPlayers();
  const matchBefore = await activeModules.localMatches.getLocalMatch(match.id);
  const activePlayerBefore =
    await activeModules.localPlayers.getActiveLocalPlayerId();
  const storageBefore = [...storageValues.entries()];

  const invalidOutcomeCases = [
    {
      description: 'unsupported outcome reason',
      reason: 'disqualification',
      winner: 'tracked',
    },
    {
      description: 'unsupported awarded-winner side',
      reason: 'walkover',
      winner: 'server',
    },
  ];

  for (const [index, invalidOutcome] of invalidOutcomeCases.entries()) {
    const invalidBackup = JSON.parse(JSON.stringify(validBackup));
    invalidBackup.players.push({
      ...invalidBackup.players[0],
      id: `candidate-${index}`,
      name: `Candidate ${index}`,
    });
    invalidBackup.matches[0].matchOutcome = {
      reason: invalidOutcome.reason,
      winner: invalidOutcome.winner,
    };
    selectedBackupContents = JSON.stringify(invalidBackup);

    await assert.rejects(
      loadBackupModule().loadLocalBackupFromDevice(),
      /invalid match or point history\. No data was imported/,
      `A backup with an ${invalidOutcome.description} must be rejected.`,
    );
    assert.deepEqual(
      [...storageValues.entries()],
      storageBefore,
      `A backup with an ${invalidOutcome.description} must not write to device storage.`,
    );
    assert.deepEqual(
      await activeModules.localPlayers.listLocalPlayers(),
      playersBefore,
    );
    assert.deepEqual(
      await activeModules.localMatches.getLocalMatch(match.id),
      matchBefore,
    );
    assert.equal(
      await activeModules.localPlayers.getActiveLocalPlayerId(),
      activePlayerBefore,
    );
    assert.equal(networkRequestCount, 0);
  }

  assert.equal(playersBefore[0].id, player.id);
});

test('backup restore keeps game notes with their sets and games and allows local edits', async () => {
  storageValues.clear();
  savedDeviceBackup = null;
  networkRequestCount = 0;
  loadLocalModules();

  const player = await activeModules.localPlayers.addLocalPlayer('Sana Iyer');
  await activeModules.localPlayers.setActiveLocalPlayerId(player.id);
  const match = await activeModules.localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'Game Notes Backup Test',
    round: 'Final',
    trackedPlayer: player.name,
    trackedPlayerId: player.id,
    opponent: 'Maya Rao',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });

  const setNotes = [
    { setNumber: 1, gameNumber: 6, note: 'Set one: changed direction on game point.' },
    { setNumber: 2, gameNumber: 3, note: 'Set two: improved first-serve placement.' },
  ];
  for (const { setNumber, gameNumber, note } of setNotes) {
    for (let point = 0; point < 24; point += 1) {
      await activeModules.localMatches.recordLocalPoint(match.id, {
        winner: 'tracked',
      });
    }
    await activeModules.localMatches.updateLocalGameNote(
      match.id,
      setNumber,
      gameNumber,
      note,
    );
    if (setNumber < setNotes.length) {
      await activeModules.localMatches.addLocalSet(match.id, 'standard');
    }
  }
  await activeModules.localMatches.addLocalSet(match.id, 'standard');

  const saveResult = await loadBackupModule().saveLocalBackupToDevice();
  assert.equal(saveResult.cancelled, false);
  const exported = JSON.parse(savedDeviceBackup.contents);
  assert.deepEqual(
    exported.matches[0].completedSets.map((set) => ({
      setNumber: set.setNumber,
      gameNotes: set.gameNotes,
    })),
    setNotes.map(({ setNumber, gameNumber, note }) => ({
      setNumber,
      gameNotes: [{ gameNumber, note }],
    })),
  );

  storageValues.clear();
  loadLocalModules();
  selectedBackupContents = savedDeviceBackup.contents;
  const restoreResult = await loadBackupModule().loadLocalBackupFromDevice();
  assert.deepEqual(restoreResult, {
    cancelled: false,
    playersAdded: 1,
    playersSkipped: 0,
    matchesAdded: 1,
    matchesSkipped: 0,
  });

  let restoredMatch = await activeModules.localMatches.getLocalMatch(match.id);
  assert.ok(restoredMatch);
  assert.deepEqual(
    restoredMatch.completedSets.map((set) => ({
      setNumber: set.setNumber,
      gameNotes: set.gameNotes,
    })),
    setNotes.map(({ setNumber, gameNumber, note }) => ({
      setNumber,
      gameNotes: [{ gameNumber, note }],
    })),
  );

  await activeModules.localMatches.updateLocalGameNote(
    match.id,
    2,
    3,
    'Set two: revised after restoring the backup.',
  );
  loadLocalModules();
  restoredMatch = await activeModules.localMatches.getLocalMatch(match.id);
  assert.ok(restoredMatch);
  assert.deepEqual(restoredMatch.completedSets[0].gameNotes, [
    { gameNumber: 6, note: 'Set one: changed direction on game point.' },
  ]);
  assert.deepEqual(restoredMatch.completedSets[1].gameNotes, [
    {
      gameNumber: 3,
      note: 'Set two: revised after restoring the backup.',
    },
  ]);
  assert.equal(networkRequestCount, 0);
});

test('backup restore remaps both saved player links and keeps each player history offline', async () => {
  storageValues.clear();
  networkRequestCount = 0;
  loadLocalModules();

  const trackedPlayer = await activeModules.localPlayers.addLocalPlayer(
    'Sana Iyer',
    {
      profileUrls: ['https://atp.example.org/players/sana-iyer'],
      profileUrlLabels: ['ATP profile'],
    },
  );
  const opponentPlayer = await activeModules.localPlayers.addLocalPlayer(
    'Maya Rao',
    {
      profileUrls: ['https://itf.example.org/players/maya-rao'],
      profileUrlLabels: ['ITF profile'],
    },
  );
  await activeModules.localPlayers.setActiveLocalPlayerId(trackedPlayer.id);
  const match = await activeModules.localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'Local Profile Link Test',
    round: 'Quarter-final',
    trackedPlayer: trackedPlayer.name,
    trackedPlayerId: trackedPlayer.id,
    opponent: opponentPlayer.name,
    opponentPlayerId: opponentPlayer.id,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await activeModules.localMatches.recordLocalPoint(match.id, {
    winner: 'tracked',
    endingCode: 'A',
    firstServeFault: false,
  });
  await activeModules.localMatches.recordLocalPoint(match.id, {
    winner: 'opponent',
  });

  const backupJson = await loadBackupModule().createLocalBackupJson();
  const exported = JSON.parse(backupJson);
  assert.equal(exported.matches[0].trackedPlayerId, trackedPlayer.id);
  assert.equal(exported.matches[0].opponentPlayerId, opponentPlayer.id);
  assert.deepEqual(
    exported.players.find((player) => player.id === trackedPlayer.id)
      .profileUrlLabels,
    ['ATP profile'],
  );
  assert.deepEqual(
    exported.players.find((player) => player.id === opponentPlayer.id)
      .profileUrlLabels,
    ['ITF profile'],
  );

  storageValues.clear();
  loadLocalModules();
  selectedBackupContents = backupJson;
  const restoreResult = await loadBackupModule().loadLocalBackupFromDevice();
  const restoredRoster = await activeModules.localPlayers.listLocalPlayers();
  const restoredTrackedPlayer = restoredRoster.find(
    (player) => player.name === 'Sana Iyer',
  );
  const restoredOpponentPlayer = restoredRoster.find(
    (player) => player.name === 'Maya Rao',
  );
  const restoredMatch = await activeModules.localMatches.getLocalMatch(match.id);

  assert.deepEqual(restoreResult, {
    cancelled: false,
    playersAdded: 2,
    playersSkipped: 0,
    matchesAdded: 1,
    matchesSkipped: 0,
  });
  assert.ok(restoredTrackedPlayer);
  assert.ok(restoredOpponentPlayer);
  assert.notEqual(restoredTrackedPlayer.id, trackedPlayer.id);
  assert.notEqual(restoredOpponentPlayer.id, opponentPlayer.id);
  assert.deepEqual(restoredTrackedPlayer.profileUrls, [
    'https://atp.example.org/players/sana-iyer',
  ]);
  assert.deepEqual(restoredTrackedPlayer.profileUrlLabels, ['ATP profile']);
  assert.deepEqual(restoredOpponentPlayer.profileUrls, [
    'https://itf.example.org/players/maya-rao',
  ]);
  assert.deepEqual(restoredOpponentPlayer.profileUrlLabels, ['ITF profile']);
  assert.ok(restoredMatch);
  assert.equal(restoredMatch.trackedPlayerId, restoredTrackedPlayer.id);
  assert.equal(restoredMatch.opponentPlayerId, restoredOpponentPlayer.id);
  assert.notEqual(restoredMatch.trackedPlayerId, restoredMatch.opponentPlayerId);
  assert.equal(
    await activeModules.localPlayers.getActiveLocalPlayerId(),
    restoredTrackedPlayer.id,
  );

  const trackedHistory =
    await activeModules.localMatches.listLocalPlayerMatchInsights(
      restoredTrackedPlayer.id,
      restoredRoster,
    );
  const opponentHistory =
    await activeModules.localMatches.listLocalPlayerMatchInsights(
      restoredOpponentPlayer.id,
      restoredRoster,
    );
  assert.equal(trackedHistory.length, 1);
  assert.equal(trackedHistory[0].match.id, match.id);
  assert.equal(trackedHistory[0].playerSide, 'tracked');
  assert.equal(trackedHistory[0].insights.pointCount, 2);
  assert.equal(opponentHistory.length, 1);
  assert.equal(opponentHistory[0].match.id, match.id);
  assert.equal(opponentHistory[0].playerSide, 'opponent');
  assert.equal(opponentHistory[0].insights.pointCount, 2);
  assert.equal(networkRequestCount, 0);
});

test('backup restore keeps the existing main player while importing new records', async () => {
  storageValues.clear();
  networkRequestCount = 0;
  loadLocalModules();

  const backupTrackedPlayer =
    await activeModules.localPlayers.addLocalPlayer('Backup Tracked Player');
  const backupOpponent =
    await activeModules.localPlayers.addLocalPlayer('Backup Opponent');
  await activeModules.localPlayers.setActiveLocalPlayerId(
    backupTrackedPlayer.id,
  );
  const importedMatch = await activeModules.localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'Imported Match',
    trackedPlayer: backupTrackedPlayer.name,
    trackedPlayerId: backupTrackedPlayer.id,
    opponent: backupOpponent.name,
    opponentPlayerId: backupOpponent.id,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await activeModules.localMatches.recordLocalPoint(importedMatch.id, {
    winner: 'tracked',
  });
  const backupContents = await loadBackupModule().createLocalBackupJson();
  const exportedBackup = JSON.parse(backupContents);
  assert.equal(exportedBackup.activePlayerId, backupTrackedPlayer.id);

  storageValues.clear();
  loadLocalModules();
  const existingMainPlayer =
    await activeModules.localPlayers.addLocalPlayer('Existing Main Player');
  await activeModules.localPlayers.setActiveLocalPlayerId(
    existingMainPlayer.id,
  );
  const existingMatch = await activeModules.localMatches.createLocalMatch({
    matchDate: '2026-10-29',
    event: 'Already Saved Match',
    trackedPlayer: existingMainPlayer.name,
    trackedPlayerId: existingMainPlayer.id,
    opponent: 'Local Opponent',
    surface: 'Clay',
    firstServer: 'opponent',
    setNumber: 1,
  });
  assert.notEqual(exportedBackup.activePlayerId, existingMainPlayer.id);
  selectedBackupContents = backupContents;

  const restoreResult = await loadBackupModule().loadLocalBackupFromDevice();
  const restoredPlayers = await activeModules.localPlayers.listLocalPlayers();
  const restoredTrackedPlayer = restoredPlayers.find(
    (player) => player.name === backupTrackedPlayer.name,
  );
  const restoredOpponent = restoredPlayers.find(
    (player) => player.name === backupOpponent.name,
  );
  const restoredMatch =
    await activeModules.localMatches.getLocalMatch(importedMatch.id);
  const retainedMatch =
    await activeModules.localMatches.getLocalMatch(existingMatch.id);

  assert.deepEqual(restoreResult, {
    cancelled: false,
    playersAdded: 2,
    playersSkipped: 0,
    matchesAdded: 1,
    matchesSkipped: 0,
  });
  assert.ok(restoredTrackedPlayer);
  assert.ok(restoredOpponent);
  assert.ok(restoredMatch);
  assert.equal(restoredMatch.trackedPlayerId, restoredTrackedPlayer.id);
  assert.equal(restoredMatch.opponentPlayerId, restoredOpponent.id);
  assert.equal(restoredMatch.points.length, 1);
  assert.ok(retainedMatch);
  assert.equal(
    await activeModules.localPlayers.getActiveLocalPlayerId(),
    existingMainPlayer.id,
  );
  assert.equal(networkRequestCount, 0);
});

test('restoring custom report labels leaves saved records unchanged', async () => {
  storageValues.clear();
  networkRequestCount = 0;
  loadLocalModules();
  const { match } = await createSampleRecords();
  const backupLabels = {
    trackedPlayer: 'Court One',
    opponent: 'Court Two',
  };
  await activeModules.localReportLabels.saveLocalReportNameLabels(backupLabels);
  const backupContents = await loadBackupModule().createLocalBackupJson();

  await activeModules.localReportLabels.saveLocalReportNameLabels({
    trackedPlayer: 'Private A',
    opponent: 'Private B',
  });
  const playersBeforeRestore = await activeModules.localPlayers.listLocalPlayers();
  const matchBeforeRestore = await activeModules.localMatches.getLocalMatch(
    match.id,
  );
  selectedBackupContents = backupContents;

  const result = await loadBackupModule().loadLocalBackupFromDevice();

  assert.deepEqual(result, {
    cancelled: false,
    playersAdded: 0,
    playersSkipped: 1,
    matchesAdded: 0,
    matchesSkipped: 1,
  });
  assert.deepEqual(
    await activeModules.localPlayers.listLocalPlayers(),
    playersBeforeRestore,
  );
  assert.deepEqual(
    await activeModules.localMatches.getLocalMatch(match.id),
    matchBeforeRestore,
  );
  assert.deepEqual(
    await activeModules.localReportLabels.getLocalReportNameLabels(),
    backupLabels,
  );
  assert.equal(networkRequestCount, 0);
});

test('backups written before match outcomes still restore offline', async () => {
  storageValues.clear();
  savedDeviceBackup = null;
  networkRequestCount = 0;
  loadLocalModules();
  const { match } = await createSampleRecords();
  await activeModules.localMatches.recordLocalMatchOutcome(match.id, {
    reason: 'walkover',
    winner: 'tracked',
  });
  await loadBackupModule().saveLocalBackupToDevice();
  const legacyBackup = JSON.parse(savedDeviceBackup.contents);
  delete legacyBackup.matches[0].matchOutcome;

  storageValues.clear();
  loadLocalModules();
  selectedBackupContents = JSON.stringify(legacyBackup);
  const restoreResult = await loadBackupModule().loadLocalBackupFromDevice();
  const restoredMatch = await activeModules.localMatches.getLocalMatch(match.id);

  assert.equal(restoreResult.cancelled, false);
  assert.equal(restoredMatch.matchOutcome, null);
  assert.equal(networkRequestCount, 0);
});

test('older backups without profile labels still restore their saved URLs', async () => {
  storageValues.clear();
  networkRequestCount = 0;
  loadLocalModules();
  await createSampleRecords();
  const backup = JSON.parse(await loadBackupModule().createLocalBackupJson());
  delete backup.players[0].profileUrlLabels;

  storageValues.clear();
  loadLocalModules();
  selectedBackupContents = JSON.stringify(backup);
  const restoreResult = await loadBackupModule().loadLocalBackupFromDevice();
  const [restoredPlayer] = await activeModules.localPlayers.listLocalPlayers();

  assert.equal(restoreResult.cancelled, false);
  assert.deepEqual(restoredPlayer.profileUrls, [
    'http://club.example.org/players/sana-iyer',
    'https://atp.example.org/players/sana-iyer',
    'https://itf.example.org/player/sana-iyer',
  ]);
  assert.ok(restoredPlayer.profileUrls.every((url) => /^https?:\/\//i.test(url)));
  assert.deepEqual(restoredPlayer.profileUrlLabels, [
    '',
    '',
    '',
  ]);
  assert.equal(networkRequestCount, 0);
});

test('version-one fixture restores representative player and match history', async () => {
  storageValues.clear();
  networkRequestCount = 0;
  loadLocalModules();
  const existingLabels = {
    trackedPlayer: 'Saved Tracked',
    opponent: 'Saved Opponent',
  };
  await activeModules.localReportLabels.saveLocalReportNameLabels(
    existingLabels,
  );
  const existingBenchmarkSettings =
    await activeModules.localBenchmarks.saveLocalReportBenchmarkPreset({
      name: 'Keep on this device',
      firstServePointsWon: 72,
      secondServePointsWon: null,
      serviceGamesWon: 84,
    });
  const existingBenchmark = existingBenchmarkSettings.presets.find(
    (preset) => preset.name === 'Keep on this device',
  );
  assert.ok(existingBenchmark);
  const benchmarksBeforeLegacyRestore =
    await activeModules.localBenchmarks.setSelectedLocalReportBenchmarkPresets([
      existingBenchmark.id,
    ]);
  const legacyFixture = JSON.parse(readVersionOneBackupFixture());
  assert.equal('reportBenchmarks' in legacyFixture, false);
  selectedBackupContents = JSON.stringify(legacyFixture);

  const result = await loadBackupModule().loadLocalBackupFromDevice();
  const [restoredPlayer] = await activeModules.localPlayers.listLocalPlayers();
  const restoredMatch = await activeModules.localMatches.getLocalMatch(
    'fixture-match-v1',
  );

  assert.deepEqual(result, {
    cancelled: false,
    playersAdded: 1,
    playersSkipped: 0,
    matchesAdded: 1,
    matchesSkipped: 0,
  });
  assert.equal(restoredPlayer.name, 'Ravi Fixture');
  assert.equal(restoredPlayer.phoneNumbers.length, 0);
  assert.deepEqual(restoredPlayer.profileUrlLabels, ['', '']);
  assert.ok(restoredMatch);
  assert.equal(restoredMatch.trackedPlayerId, restoredPlayer.id);
  assert.equal(restoredMatch.points.length, 1);
  assert.equal(restoredMatch.points[0].endingCode, 'A');
  assert.equal(
    restoredMatch.points[0].strokes[0].note,
    'Serve down the T',
  );
  assert.equal(
    await activeModules.localPlayers.getActiveLocalPlayerId(),
    restoredPlayer.id,
  );
  assert.deepEqual(
    await activeModules.localReportLabels.getLocalReportNameLabels(),
    existingLabels,
  );
  assert.deepEqual(
    await activeModules.localBenchmarks.getLocalReportBenchmarkSettings(),
    benchmarksBeforeLegacyRestore,
  );
  assert.equal(networkRequestCount, 0);
});

test('loading a backup refreshes the home screen report benchmark settings', () => {
  const homeScreen = fs.readFileSync(
    path.join(__dirname, '../app/index.tsx'),
    'utf8',
  );

  assert.match(homeScreen, /LOCAL_REPORT_BENCHMARKS_KEY/);
  assert.match(
    homeScreen,
    /queryClient\.invalidateQueries\(\{\s*queryKey:\s*LOCAL_REPORT_BENCHMARKS_KEY/,
  );
  assert.match(
    homeScreen,
    /Report benchmarks and their selected order were restored if the backup includes them/,
  );
});

test('unsupported backup versions are rejected without changing device data', async () => {
  storageValues.clear();
  networkRequestCount = 0;
  loadLocalModules();
  await createSampleRecords();
  const existingData = [...storageValues.entries()];
  const fixture = JSON.parse(readVersionOneBackupFixture());

  for (const version of [0, 2, 99]) {
    selectedBackupContents = JSON.stringify({ ...fixture, version });
    await assert.rejects(
      loadBackupModule().loadLocalBackupFromDevice(),
      new RegExp(`Backup version ${version} is not supported`),
    );
    assert.deepEqual(
      [...storageValues.entries()],
      existingData,
      `Unsupported backup version ${version} must not change device data.`,
    );
  }
  assert.equal(networkRequestCount, 0);
});
