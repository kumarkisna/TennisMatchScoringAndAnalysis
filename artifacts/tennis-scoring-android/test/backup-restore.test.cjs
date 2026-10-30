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
const localBackupPath = path.join(__dirname, '../lib/local-backup.ts');

function loadLocalModules() {
  delete require.cache[require.resolve(localMatchesPath)];
  delete require.cache[require.resolve(localPlayersPath)];
  activeModules = {
    localMatches: require(localMatchesPath),
    localPlayers: require(localPlayersPath),
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

test('backup save, share, and restore preserve all players and sets without network access', async () => {
  storageValues.clear();
  savedDeviceBackup = null;
  sharedBackup = null;
  sharedUri = '';
  networkRequestCount = 0;
  loadLocalModules();
  const { player, match } = await createSampleRecords();
  const backup = loadBackupModule();

  const saveResult = await backup.saveLocalBackupToDevice();
  assert.equal(saveResult.cancelled, false);
  assert.ok(saveResult.fileName.endsWith('.json'));
  assert.equal(savedDeviceBackup.mimeType, 'application/json');
  const exported = JSON.parse(savedDeviceBackup.contents);
  assert.equal(exported.format, 'tennis-scoring-local-backup');
  assert.equal(exported.activePlayerId, player.id);
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

  await backup.shareLocalBackup();
  assert.ok(sharedUri.startsWith('file://cache/'));
  assert.equal(JSON.parse(sharedBackup).matches[0].completedSets[0].points.length, 24);
  assert.equal(networkRequestCount, 0);

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

  const restoredPlayer = (await activeModules.localPlayers.listLocalPlayers())[0];
  const restoredMatch = await activeModules.localMatches.getLocalMatch(match.id);
  assert.equal(restoredPlayer.name, 'Sana Iyer');
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
  assert.equal(restoredMatch.trackedPlayerId, restoredPlayer.id);
  assert.equal(restoredMatch.syncStatus, 'local_only');
  assert.equal(restoredMatch.completedSets.length, 1);
  assert.equal(restoredMatch.completedSets[0].points.length, 24);
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
