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
  const player = await activeModules.localPlayers.addLocalPlayer('Sana Iyer', {
    dateOfBirth: '2005-07-09',
    atpPlayerId: 'ATP-12345',
    nationality: 'India',
    playingHand: 'right',
    phoneNumbers: ['+1 415 555 0123'],
    profileUrls: ['https://example.org/players/sana-iyer'],
  });
  await activeModules.localPlayers.setActiveLocalPlayerId(player.id);

  const match = await activeModules.localMatches.createLocalMatch({
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

  return { player, match };
}

test.after(() => {
  Module._load = originalLoad;
  if (originalTsExtension) {
    require.extensions['.ts'] = originalTsExtension;
  } else {
    delete require.extensions['.ts'];
  }
});

test('backup save, share, and restore preserve local players and full match history', async () => {
  storageValues.clear();
  savedDeviceBackup = null;
  sharedBackup = null;
  sharedUri = '';
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
  assert.deepEqual(exported.players[0].phoneNumbers, ['+1 415 555 0123']);
  assert.equal(exported.matches[0].id, match.id);
  assert.equal(exported.matches[0].points[0].strokes[0].note, 'Wide serve');

  await backup.shareLocalBackup();
  assert.ok(sharedUri.startsWith('file://cache/'));
  assert.equal(JSON.parse(sharedBackup).matches[0].points.length, 1);

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
  assert.deepEqual(restoredPlayer.profileUrls, [
    'https://example.org/players/sana-iyer',
  ]);
  assert.equal(
    await activeModules.localPlayers.getActiveLocalPlayerId(),
    restoredPlayer.id,
  );
  assert.ok(restoredMatch);
  assert.equal(restoredMatch.syncStatus, 'local_only');
  assert.equal(restoredMatch.points[0].strokes[0].note, 'Wide serve');

  const repeatedImport = await loadBackupModule().loadLocalBackupFromDevice();
  assert.equal(repeatedImport.playersAdded, 0);
  assert.equal(repeatedImport.playersSkipped, 1);
  assert.equal(repeatedImport.matchesAdded, 0);
  assert.equal(repeatedImport.matchesSkipped, 1);

  const beforeInvalidImport = [...storageValues.entries()];
  const invalidBackup = JSON.parse(savedDeviceBackup.contents);
  invalidBackup.matches[0].matchDate = 'not-a-date';
  selectedBackupContents = JSON.stringify(invalidBackup);
  await assert.rejects(
    loadBackupModule().loadLocalBackupFromDevice(),
    /invalid match or point history/,
  );
  assert.deepEqual([...storageValues.entries()], beforeInvalidImport);
});
