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
const localReportBenchmarksPath = path.join(__dirname, '../lib/local-benchmarks.ts');
const localReportNameLabelsPath = path.join(__dirname, '../lib/local-report-labels.ts');
const playerInsightsPath = path.join(__dirname, '../lib/player-insights.ts');

function loadStorageModulesAfterRestart() {
  delete require.cache[require.resolve(localMatchesPath)];
  delete require.cache[require.resolve(localPlayersPath)];
  delete require.cache[require.resolve(localReportBenchmarksPath)];
  delete require.cache[require.resolve(localReportNameLabelsPath)];

  return {
    localMatches: require(localMatchesPath),
    localPlayers: require(localPlayersPath),
    localReportBenchmarks: require(localReportBenchmarksPath),
    localReportNameLabels: require(localReportNameLabelsPath),
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
    profileUrls: [
      'https://example.org/players/sana-iyer',
      'https://club.example.org/players/sana-iyer',
    ],
    profileUrlLabels: ['ATP profile', 'Club page'],
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
    'https://club.example.org/players/sana-iyer',
  ]);
  assert.deepEqual(restoredPlayer.profileUrlLabels, ['ATP profile', 'Club page']);
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
    profileUrlLabels: restoredPlayer.profileUrlLabels,
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
    'https://club.example.org/players/sana-iyer',
  ]);
  assert.deepEqual(editedPlayer.profileUrlLabels, ['ATP profile', 'Club page']);
  assert.equal(networkRequestCount, 0);
});

test('older saved players without profile labels stay readable', async () => {
  storageValues.clear();
  storageValues.set(
    '@tennis-scoring/players/record-v1',
    JSON.stringify([
      {
        id: 'legacy-player',
        name: 'Legacy Player',
        dateOfBirth: null,
        atpPlayerId: null,
        itfPlayerId: null,
        atpRanking: null,
        itfRanking: null,
        nationality: null,
        playingHand: null,
        heightCm: null,
        weightKg: null,
        phoneNumbers: [],
        profileUrls: ['https://example.org/legacy-player'],
        createdAt: '2026-10-30T00:00:00.000Z',
      },
    ]),
  );

  const { localPlayers } = loadStorageModulesAfterRestart();
  const [player] = await localPlayers.listLocalPlayers();

  assert.equal(player.id, 'legacy-player');
  assert.deepEqual(player.profileUrls, ['https://example.org/legacy-player']);
  assert.deepEqual(player.profileUrlLabels, ['']);
});

test('profile links accept HTTP(S), normalize bare domains, and ignore blank rows', async () => {
  storageValues.clear();
  const { localPlayers } = loadStorageModulesAfterRestart();
  const player = await localPlayers.addLocalPlayer('Link validation player', {
    profileUrls: [
      '',
      'https://atp.example.org/player/one',
      'http://itf.example.org/player/one',
      'club.example.org/player/one',
      '   ',
    ],
    profileUrlLabels: ['', '', '', 'Club page', ''],
  });

  assert.deepEqual(player.profileUrls, [
    'https://atp.example.org/player/one',
    'http://itf.example.org/player/one',
    'https://club.example.org/player/one',
  ]);
  assert.deepEqual(player.profileUrlLabels, ['', '', 'Club page']);
  assert.equal(
    localPlayers.validateLocalPlayerDetails({
      profileUrls: ['', '   '],
    }),
    null,
  );
});

test('profile link edits and removals keep each label with its URL', async () => {
  storageValues.clear();
  const { localPlayers } = loadStorageModulesAfterRestart();
  const links = localPlayers.pairLocalPlayerProfileLinks(
    [
      'https://atp.example.org/player/one',
      'https://club.example.org/players/one',
      'https://itf.example.org/player/one',
    ],
    ['ATP profile', 'Club profile', 'ITF profile'],
  );

  const remainingByRemovedIndex = [
    [
      { url: 'https://club.example.org/players/one', label: 'Club profile' },
      { url: 'https://itf.example.org/player/one', label: 'ITF profile' },
    ],
    [
      { url: 'https://atp.example.org/player/one', label: 'ATP profile' },
      { url: 'https://itf.example.org/player/one', label: 'ITF profile' },
    ],
    [
      { url: 'https://atp.example.org/player/one', label: 'ATP profile' },
      { url: 'https://club.example.org/players/one', label: 'Club profile' },
    ],
  ];
  for (let removedIndex = 0; removedIndex < links.length; removedIndex += 1) {
    const remaining = remainingByRemovedIndex[removedIndex];
    const removedLinks = localPlayers.removeLocalPlayerProfileLink(
      links,
      removedIndex,
    );
    assert.deepEqual(
      removedLinks,
      remaining,
    );
    assert.deepEqual(
      localPlayers.serializeLocalPlayerProfileLinks(removedLinks),
      {
        profileUrls: remaining.map((link) => link.url),
        profileUrlLabels: remaining.map((link) => link.label),
      },
    );
  }

  const edited = localPlayers.updateLocalPlayerProfileLink(links, 1, {
    url: 'https://academy.example.net/players/one',
  });
  assert.deepEqual(edited, [
    { url: 'https://atp.example.org/player/one', label: 'ATP profile' },
    { url: 'https://academy.example.net/players/one', label: 'Club profile' },
    { url: 'https://itf.example.org/player/one', label: 'ITF profile' },
  ]);

  const saved = await localPlayers.addLocalPlayer(
    'Profile link alignment player',
    localPlayers.serializeLocalPlayerProfileLinks(links),
  );
  await localPlayers.updateLocalPlayer(
    saved.id,
    'Renamed profile link alignment player',
    localPlayers.serializeLocalPlayerProfileLinks(edited),
  );
  const afterRestart = loadStorageModulesAfterRestart();
  const restored = (await afterRestart.localPlayers.listLocalPlayers()).find(
    (player) => player.id === saved.id,
  );
  assert.ok(restored);
  assert.deepEqual(
    afterRestart.localPlayers.pairLocalPlayerProfileLinks(
      restored.profileUrls,
      restored.profileUrlLabels,
    ),
    edited,
  );

  const presentation =
    afterRestart.localPlayers.getLocalPlayerProfileLinkPresentation(
      edited[1],
      1,
    );
  assert.deepEqual(presentation, {
    url: 'https://academy.example.net/players/one',
    host: 'academy.example.net',
    displayLabel: 'Club profile',
    displayText: 'Club profile · academy.example.net',
  });

  const playersScreen = fs.readFileSync(
    path.join(__dirname, '../app/players.tsx'),
    'utf8',
  );
  assert.match(
    playersScreen,
    /pairLocalPlayerProfileLinks\(\s*player\.profileUrls,\s*player\.profileUrlLabels,\s*\)\.map\(\(link, linkIndex\) =>/,
  );
  assert.match(
    playersScreen,
    /onPress=\{\(\) => void openProfileLink\(presentation\.url\)\}/,
  );
  assert.match(playersScreen, /\{presentation\.displayText\}/);
  assert.match(
    playersScreen,
    /updateLocalPlayerProfileLink\(links, index, \{ url: value \}\)/,
  );
  assert.match(
    playersScreen,
    /updateLocalPlayerProfileLink\(links, index, \{ label: value \}\)/,
  );
  assert.match(
    playersScreen,
    /serializeLocalPlayerProfileLinks\(profileLinks\)/,
  );
  assert.match(
    playersScreen,
    /removeLocalPlayerProfileLink\(links, index\)/,
  );
});

test('moving profile links preserves pairs and saves the selected order', async () => {
  storageValues.clear();
  const { localPlayers } = loadStorageModulesAfterRestart();
  const links = localPlayers.pairLocalPlayerProfileLinks(
    [
      'https://atp.example.org/player/one',
      'https://club.example.org/players/one',
      'https://itf.example.org/player/one',
    ],
    ['ATP profile', 'Club profile', 'ITF profile'],
  );

  const movedUp = localPlayers.moveLocalPlayerProfileLink(links, 1, 'up');
  assert.deepEqual(movedUp, [
    { url: 'https://club.example.org/players/one', label: 'Club profile' },
    { url: 'https://atp.example.org/player/one', label: 'ATP profile' },
    { url: 'https://itf.example.org/player/one', label: 'ITF profile' },
  ]);
  assert.deepEqual(
    localPlayers.moveLocalPlayerProfileLink(movedUp, 0, 'down'),
    links,
  );
  assert.deepEqual(
    localPlayers.moveLocalPlayerProfileLink(links, 0, 'up'),
    links,
  );
  assert.deepEqual(
    localPlayers.moveLocalPlayerProfileLink(links, 2, 'down'),
    links,
  );

  const player = await localPlayers.addLocalPlayer(
    'Reordered profile links player',
    localPlayers.serializeLocalPlayerProfileLinks(links),
  );
  await localPlayers.updateLocalPlayer(
    player.id,
    player.name,
    localPlayers.serializeLocalPlayerProfileLinks(movedUp),
  );
  const afterRestart = loadStorageModulesAfterRestart();
  const restored = (await afterRestart.localPlayers.listLocalPlayers()).find(
    (item) => item.id === player.id,
  );
  assert.ok(restored);
  assert.deepEqual(
    afterRestart.localPlayers.pairLocalPlayerProfileLinks(
      restored.profileUrls,
      restored.profileUrlLabels,
    ),
    movedUp,
  );

  const playersScreen = fs.readFileSync(
    path.join(__dirname, '../app/players.tsx'),
    'utf8',
  );
  assert.match(playersScreen, /button-move-player-profile-link-\$\{index\}-up/);
  assert.match(playersScreen, /button-move-player-profile-link-\$\{index\}-down/);
  assert.match(
    playersScreen,
    /moveLocalPlayerProfileLink\(links, index, 'up'\)/,
  );
  assert.match(
    playersScreen,
    /moveLocalPlayerProfileLink\(links, index, 'down'\)/,
  );
  assert.match(playersScreen, /disabled=\{index === 0\}/);
  assert.match(playersScreen, /disabled=\{index === profileLinks\.length - 1\}/);
  assert.match(
    playersScreen,
    /accessibilityLabel=\{`Move profile link \$\{index \+ 1\} up`\}/,
  );
  assert.match(
    playersScreen,
    /accessibilityLabel=\{`Move profile link \$\{index \+ 1\} down`\}/,
  );
});

test('profile links reject unsupported, malformed, credentialed, spaced, and duplicate URLs', async () => {
  storageValues.clear();
  const { localPlayers } = loadStorageModulesAfterRestart();
  const invalidLinks = [
    ['unsupported protocol', 'ftp://example.org/player', /must use http:\/\/ or https:\/\//],
    ['embedded credentials', 'https://player:secret@example.org/profile', /must use http:\/\/ or https:\/\//],
    ['malformed address', 'https://[broken', /valid http:\/\/ or https:\/\//],
    ['whitespace', 'https://example.org/player name', /valid http:\/\/ or https:\/\//],
  ];

  for (const [caseName, url, expectedError] of invalidLinks) {
    await assert.rejects(
      localPlayers.addLocalPlayer(`Invalid ${caseName}`, { profileUrls: [url] }),
      expectedError,
    );
  }
  await assert.rejects(
    localPlayers.addLocalPlayer('Duplicate profile links', {
      profileUrls: [
        'https://example.org/player',
        'example.org/player',
      ],
    }),
    /must be unique/,
  );
  assert.deepEqual(await localPlayers.listLocalPlayers(), []);

  const savedPlayer = await localPlayers.addLocalPlayer(
    'Player with a valid profile link',
    { profileUrls: ['https://example.org/player'] },
  );
  await assert.rejects(
    localPlayers.updateLocalPlayer(savedPlayer.id, savedPlayer.name, {
      profileUrls: ['https://bad address.example/player'],
    }),
    /valid http:\/\/ or https:\/\//,
  );
  assert.deepEqual(await localPlayers.listLocalPlayers(), [savedPlayer]);
});

test('profile link validation errors stay with each field and clear after correction or removal', async () => {
  const { localPlayers } = loadStorageModulesAfterRestart();
  const invalidLinks = [
    { url: 'https://bad address.example/player', label: 'ATP' },
    { url: 'example.org/player', label: 'Club' },
    { url: 'ftp://itf.example.org/player', label: 'ITF' },
  ];
  assert.deepEqual(
    localPlayers.getLocalPlayerProfileLinkValidationErrors(invalidLinks),
    [
      'Enter a valid http:// or https:// profile link.',
      null,
      'Profile links must use http:// or https:// and include a web address.',
    ],
  );

  const correctedLinks = localPlayers.updateLocalPlayerProfileLink(
    invalidLinks,
    0,
    { url: 'https://atp.example.org/player' },
  );
  assert.deepEqual(
    localPlayers.getLocalPlayerProfileLinkValidationErrors(correctedLinks),
    [
      null,
      null,
      'Profile links must use http:// or https:// and include a web address.',
    ],
  );
  const removedInvalidLink = localPlayers.removeLocalPlayerProfileLink(
    correctedLinks,
    2,
  );
  assert.deepEqual(
    localPlayers.getLocalPlayerProfileLinkValidationErrors(removedInvalidLink),
    [null, null],
  );
  assert.deepEqual(
    localPlayers.getLocalPlayerProfileLinkValidationErrors([
      { url: '', label: '' },
      { url: '', label: 'Missing URL' },
    ]),
    [null, 'Add a profile link before adding its label.'],
  );
  assert.deepEqual(
    localPlayers.getLocalPlayerProfileLinkValidationErrors([
      { url: 'https://example.org/player', label: 'First' },
      { url: 'example.org/player', label: 'Duplicate' },
    ]),
    [null, 'Each profile link must be unique.'],
  );

  const playersScreen = fs.readFileSync(
    path.join(__dirname, '../app/players.tsx'),
    'utf8',
  );
  assert.match(
    playersScreen,
    /getLocalPlayerProfileLinkValidationErrors\(profileLinks\)/,
  );
  assert.match(
    playersScreen,
    /testID=\{`error-player-profile-link-\$\{index\}`\}/,
  );
  assert.match(playersScreen, /profileLinkValidationErrors\[index\]/);
  assert.match(playersScreen, /if \(dateOfBirthError \|\| hasProfileLinkErrors\) return/);
});

test('older saved player records without profile URL fields remain readable', async () => {
  storageValues.clear();
  storageValues.set(
    '@tennis-scoring/players/record-v1',
    JSON.stringify([
      {
        id: 'legacy-player-no-links',
        name: 'Legacy Player Without Links',
        createdAt: '2026-10-30T00:00:00.000Z',
      },
    ]),
  );

  const { localPlayers } = loadStorageModulesAfterRestart();
  const [player] = await localPlayers.listLocalPlayers();

  assert.equal(player.id, 'legacy-player-no-links');
  assert.deepEqual(player.profileUrls, []);
  assert.deepEqual(player.profileUrlLabels, []);
});

test('undoing and replacing a converted break point recomputes saved match stats', async () => {
  storageValues.clear();
  const { localMatches } = loadStorageModulesAfterRestart();
  const match = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'City Open',
    round: 'Final',
    trackedPlayer: 'Sana Iyer',
    opponent: 'Maya Rao',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'opponent',
    setNumber: 1,
  });
  const recordedWinners = [
    'tracked',
    'tracked',
    'tracked',
    'opponent',
    'opponent',
    'opponent',
    'tracked',
    'tracked',
  ];
  let current = match;
  for (const winner of recordedWinners) {
    current = await localMatches.recordLocalPoint(match.id, { winner });
  }

  const percentage = (value, total) =>
    total === 0 ? null : Number(((value / total) * 100).toFixed(1));
  const assertBreakPointRates = (insights, expectedConversion, expectedSave) => {
    assert.equal(
      percentage(
        insights.breakPoints.tracked.converted,
        insights.breakPoints.tracked.opportunities,
      ),
      expectedConversion,
    );
    assert.equal(
      percentage(
        insights.breakPoints.opponent.saved,
        insights.breakPoints.opponent.faced,
      ),
      expectedSave,
    );
  };

  const convertedInsights = localMatches.calculateLocalInsights(current);
  assert.deepEqual(convertedInsights.breakPoints, {
    tracked: { opportunities: 4, converted: 1, faced: 0, saved: 0 },
    opponent: { opportunities: 0, converted: 0, faced: 4, saved: 3 },
  });
  assertBreakPointRates(convertedInsights, 25, 75);

  const undone = await localMatches.undoLocalPoint(match.id);
  assert.equal(undone.points.length, 7);
  const savedAfterUndo = await localMatches.getLocalMatch(match.id);
  assert.ok(savedAfterUndo);
  assert.deepEqual(
    savedAfterUndo.points.map((point) => point.winner),
    recordedWinners.slice(0, -1),
  );
  const undoneInsights = localMatches.calculateLocalInsights(savedAfterUndo);
  assert.deepEqual(undoneInsights.breakPoints, {
    tracked: { opportunities: 3, converted: 0, faced: 0, saved: 0 },
    opponent: { opportunities: 0, converted: 0, faced: 3, saved: 3 },
  });
  assertBreakPointRates(undoneInsights, 0, 100);

  const replacement = await localMatches.recordLocalPoint(match.id, {
    winner: 'opponent',
  });
  assert.equal(replacement.points.length, 8);
  assert.equal(replacement.points.at(-1).winner, 'opponent');
  const replacementInsights =
    localMatches.calculateLocalInsights(replacement);
  assert.deepEqual(replacementInsights.breakPoints, {
    tracked: { opportunities: 4, converted: 0, faced: 0, saved: 0 },
    opponent: { opportunities: 0, converted: 0, faced: 4, saved: 4 },
  });
  assertBreakPointRates(replacementInsights, 0, 100);
});

test('point history filter keeps all points and lists saved or converted chances newest first', () => {
  const { localMatches } = loadStorageModulesAfterRestart();
  const winners = [
    'tracked',
    'tracked',
    'tracked',
    'opponent',
    'opponent',
    'opponent',
    'tracked',
    'tracked',
    'tracked',
    'opponent',
  ];
  const points = winners.map((winner, index) => ({
    sequenceNumber: index + 1,
    isTiebreak: index >= 8,
    server: 'opponent',
    winner,
  }));

  const allHistory = localMatches.getLocalPointHistory(points, 'standard', 'all');
  assert.deepEqual(
    allHistory.map(({ point }) => point.sequenceNumber),
    [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  );

  const breakPointHistory = localMatches.getLocalPointHistory(
    points,
    'standard',
    'break_points',
  );
  assert.deepEqual(
    breakPointHistory.map(({ point, breakPointOutcome }) => [
      point.sequenceNumber,
      breakPointOutcome,
    ]),
    [
      [8, 'converted'],
      [6, 'saved'],
      [5, 'saved'],
      [4, 'saved'],
    ],
  );

  assert.deepEqual(
    localMatches
      .getLocalPointHistory(points, 'match_tiebreak', 'break_points')
      .map(({ point }) => point.sequenceNumber),
    [],
  );
});

test('match details expose accessible controls for all points and break-point moments', () => {
  const matchScreen = fs.readFileSync(
    path.join(__dirname, '../app/matches/[id].tsx'),
    'utf8',
  );

  assert.match(matchScreen, /button-point-history-filter-\$\{filter\}/);
  assert.match(matchScreen, /Show all recorded points/);
  assert.match(matchScreen, /Show saved and converted break points/);
  assert.match(matchScreen, /setPointHistoryFilter\(filter\)/);
  assert.match(
    matchScreen,
    /getLocalPointHistory\([\s\S]*?viewedSet\.format,\s*pointHistoryFilter/,
  );
});

test('break-point markers show pre-point scores for both named players', () => {
  const matchScreen = fs.readFileSync(
    path.join(__dirname, '../app/matches/[id].tsx'),
    'utf8',
  );

  assert.match(matchScreen, /point-log-break-point-score-/);
  assert.match(
    matchScreen,
    /Before point · \{trackedName\} \{breakPointScoreBefore\.trackedScore\}/,
  );
  assert.match(
    matchScreen,
    /\{opponentName\} \{breakPointScoreBefore\.opponentScore\}/,
  );
});

test('match detail edits preserve multi-set point history, score totals, and analytics', async () => {
  storageValues.clear();
  const { localMatches } = loadStorageModulesAfterRestart();
  const match = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'City Open',
    round: 'Final',
    trackedPlayer: 'Sana Iyer',
    opponent: 'Maya Rao',
    chairCoach: 'Coach Lee',
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });

  await localMatches.recordLocalPoint(match.id, {
    winner: 'tracked',
    endingCode: 'A',
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
    await localMatches.recordLocalPoint(match.id, { winner: 'tracked' });
  }
  await localMatches.addLocalSet(match.id, 'match_tiebreak', 7);
  await localMatches.recordLocalPoint(match.id, { winner: 'tracked' });
  await localMatches.recordLocalPoint(match.id, { winner: 'opponent' });

  const before = await localMatches.getLocalMatch(match.id);
  assert.ok(before);
  assert.equal(before.completedSets.length, 1);
  assert.equal(before.completedSets[0].points.length, 24);
  assert.equal(before.setFormat, 'match_tiebreak');
  assert.equal(before.tiebreakTarget, 7);
  assert.deepEqual(
    before.points.map((point) => point.server),
    ['tracked', 'opponent'],
  );
  assert.equal(before.score.nextServer, 'opponent');
  const beforeInsights = localMatches.calculateLocalInsights(before);
  const beforeScoreTotals = { ...before.score };
  delete beforeScoreTotals.nextServer;

  const edited = await localMatches.updateLocalMatchDetails(match.id, {
    matchDate: '2026-11-02',
    trackedPlayer: 'Sana Iyer Updated',
    opponent: 'Maya Rao Updated',
    event: 'Winter Championships',
    round: 'Semi-final',
    chairCoach: 'Coach Patel',
    surface: 'Clay',
    firstServer: 'opponent',
  });

  assert.equal(edited.matchDate, '2026-11-02');
  assert.equal(edited.trackedPlayer, 'Sana Iyer Updated');
  assert.equal(edited.opponent, 'Maya Rao Updated');
  assert.equal(edited.event, 'Winter Championships');
  assert.equal(edited.round, 'Semi-final');
  assert.equal(edited.chairCoach, 'Coach Patel');
  assert.equal(edited.surface, 'Clay');
  assert.equal(edited.firstServer, 'opponent');
  assert.deepEqual(edited.completedSets, before.completedSets);
  assert.deepEqual(edited.points, before.points);
  assert.equal(edited.setFormat, 'match_tiebreak');
  assert.equal(edited.tiebreakTarget, 7);
  assert.deepEqual(
    edited.points.map((point) => point.server),
    ['tracked', 'opponent'],
  );
  assert.equal(edited.score.nextServer, 'tracked');
  const editedScoreTotals = { ...edited.score };
  delete editedScoreTotals.nextServer;
  assert.deepEqual(editedScoreTotals, beforeScoreTotals);
  assert.deepEqual(
    localMatches.calculateLocalInsights(edited),
    beforeInsights,
  );

  const standardMatch = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: null,
    round: null,
    trackedPlayer: 'Sana Iyer',
    opponent: 'Maya Rao',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await localMatches.recordLocalPoint(standardMatch.id, { winner: 'tracked' });
  await localMatches.recordLocalPoint(standardMatch.id, { winner: 'opponent' });
  const standardBefore = await localMatches.getLocalMatch(standardMatch.id);
  assert.ok(standardBefore);
  assert.equal(standardBefore.score.nextServer, 'tracked');
  const standardInsights = localMatches.calculateLocalInsights(standardBefore);

  const standardEdited = await localMatches.updateLocalMatchDetails(
    standardMatch.id,
    {
      matchDate: standardBefore.matchDate,
      event: standardBefore.event,
      round: standardBefore.round,
      trackedPlayer: standardBefore.trackedPlayer,
      opponent: standardBefore.opponent,
      chairCoach: standardBefore.chairCoach,
      surface: standardBefore.surface,
      firstServer: 'opponent',
    },
  );
  assert.deepEqual(standardEdited.points, standardBefore.points);
  assert.deepEqual(
    standardEdited.points.map((point) => point.server),
    ['tracked', 'tracked'],
  );
  assert.equal(standardEdited.score.nextServer, 'opponent');
  assert.deepEqual(localMatches.calculateLocalInsights(standardEdited), standardInsights);
});

test('completed match-tiebreak result survives player-label and metadata edits', async () => {
  storageValues.clear();
  const { localMatches } = loadStorageModulesAfterRestart();
  const match = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'City Open',
    round: 'Final',
    trackedPlayer: 'Sana Iyer',
    opponent: 'Maya Rao',
    chairCoach: 'Coach Lee',
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });

  for (let point = 0; point < 24; point += 1) {
    await localMatches.recordLocalPoint(match.id, { winner: 'tracked' });
  }
  await localMatches.addLocalSet(match.id, 'match_tiebreak', 7);
  for (let point = 0; point < 7; point += 1) {
    await localMatches.recordLocalPoint(match.id, { winner: 'tracked' });
  }
  await localMatches.finishLocalMatch(match.id);

  const before = await localMatches.getLocalMatch(match.id);
  assert.ok(before);
  assert.equal(before.matchStatus, 'complete');
  assert.equal(before.score.isComplete, true);
  assert.equal(before.score.winner, 'tracked');
  assert.equal(before.completedSets.length, 1);
  assert.equal(before.setFormat, 'match_tiebreak');
  assert.equal(before.tiebreakTarget, 7);
  const beforeSummary = (await localMatches.listLocalMatches()).find(
    (summary) => summary.id === match.id,
  );
  assert.ok(beforeSummary);
  assert.equal(beforeSummary.status, 'complete');
  assert.equal(beforeSummary.winner, 'tracked');
  assert.equal(beforeSummary.setScores.length, 2);
  assert.deepEqual(
    beforeSummary.setScores.map((set) => [
      set.setNumber,
      set.format,
      set.trackedGames,
      set.opponentGames,
      set.trackedTiebreakPoints,
      set.opponentTiebreakPoints,
      set.isComplete,
    ]),
    [
      [1, 'standard', 6, 0, 0, 0, true],
      [2, 'match_tiebreak', 0, 0, 7, 0, true],
    ],
  );
  const beforeInsights = localMatches.calculateLocalInsights(before);
  const beforeScore = { ...before.score };
  delete beforeScore.nextServer;
  const beforePointHistory = localMatches
    .getLocalSetHistory(before)
    .map((set) => ({
      setNumber: set.setNumber,
      format: set.format,
      tiebreakTarget: set.tiebreakTarget,
      points: set.points,
    }));

  await localMatches.updateLocalMatchDetails(match.id, {
    matchDate: '2026-11-02',
    trackedPlayer: 'Sana Iyer Updated',
    opponent: 'Maya Rao Updated',
    event: 'Winter Championships',
    round: 'Semi-final',
    chairCoach: 'Coach Patel',
    surface: 'Clay',
    firstServer: 'opponent',
  });

  const afterRestart = loadStorageModulesAfterRestart();
  const after = await afterRestart.localMatches.getLocalMatch(match.id);
  assert.ok(after);
  const afterSummary = (await afterRestart.localMatches.listLocalMatches()).find(
    (summary) => summary.id === match.id,
  );
  assert.ok(afterSummary);
  assert.equal(after.matchDate, '2026-11-02');
  assert.equal(after.trackedPlayer, 'Sana Iyer Updated');
  assert.equal(after.opponent, 'Maya Rao Updated');
  assert.equal(after.event, 'Winter Championships');
  assert.equal(after.round, 'Semi-final');
  assert.equal(after.chairCoach, 'Coach Patel');
  assert.equal(after.surface, 'Clay');
  assert.equal(after.firstServer, 'opponent');
  assert.equal(after.matchStatus, 'complete');
  assert.equal(after.status, 'complete');
  assert.equal(after.score.isComplete, true);
  assert.equal(after.score.winner, 'tracked');
  assert.deepEqual(afterSummary.setScores, beforeSummary.setScores);
  assert.equal(afterSummary.status, beforeSummary.status);
  assert.equal(afterSummary.winner, beforeSummary.winner);

  const afterScore = { ...after.score };
  delete afterScore.nextServer;
  assert.deepEqual(afterScore, beforeScore);
  assert.deepEqual(after.completedSets, before.completedSets);
  assert.deepEqual(after.points, before.points);
  assert.deepEqual(
    afterRestart.localMatches
      .getLocalSetHistory(after)
      .map((set) => ({
        setNumber: set.setNumber,
        format: set.format,
        tiebreakTarget: set.tiebreakTarget,
        points: set.points,
      })),
    beforePointHistory,
  );
  assert.deepEqual(
    afterRestart.localMatches.calculateLocalInsights(after),
    beforeInsights,
  );
});

test('saved player choices relink both match sides without changing recorded points', async (t) => {
  storageValues.clear();
  const originalFetch = global.fetch;
  let networkRequestCount = 0;
  global.fetch = async () => {
    networkRequestCount += 1;
    throw new Error('Saved player choices must remain on-device.');
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const { localMatches, localPlayers } = loadStorageModulesAfterRestart();
  const oldTracked = await localPlayers.addLocalPlayer('Tracked Before');
  const oldOpponent = await localPlayers.addLocalPlayer('Opponent Before');
  const selectedTracked = await localPlayers.addLocalPlayer('Tracked From Roster');
  const selectedOpponent = await localPlayers.addLocalPlayer('Opponent From Roster');
  const match = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'City Open',
    round: 'Final',
    trackedPlayer: oldTracked.name,
    trackedPlayerId: oldTracked.id,
    opponent: oldOpponent.name,
    opponentPlayerId: oldOpponent.id,
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await localMatches.recordLocalPoint(match.id, {
    winner: 'tracked',
    endingCode: 'A',
  });
  const before = await localMatches.getLocalMatch(match.id);
  assert.ok(before);

  const edited = await localMatches.updateLocalMatchDetails(match.id, {
    matchDate: before.matchDate,
    event: before.event,
    round: before.round,
    trackedPlayer: selectedTracked.name,
    trackedPlayerId: selectedTracked.id,
    opponent: selectedOpponent.name,
    opponentPlayerId: selectedOpponent.id,
    chairCoach: before.chairCoach,
    surface: before.surface,
    firstServer: before.firstServer,
  });

  assert.equal(edited.trackedPlayer, selectedTracked.name);
  assert.equal(edited.trackedPlayerId, selectedTracked.id);
  assert.equal(edited.opponent, selectedOpponent.name);
  assert.equal(edited.opponentPlayerId, selectedOpponent.id);
  assert.deepEqual(edited.points, before.points);
  assert.deepEqual(edited.completedSets, before.completedSets);
  assert.deepEqual(edited.score, before.score);
  const roster = await localPlayers.listLocalPlayers();
  const trackedHistory = await localMatches.listLocalPlayerMatchInsights(
    selectedTracked.id,
    roster,
  );
  const opponentHistory = await localMatches.listLocalPlayerMatchInsights(
    selectedOpponent.id,
    roster,
  );
  assert.equal(trackedHistory.length, 1);
  assert.equal(trackedHistory[0].match.id, match.id);
  assert.equal(trackedHistory[0].playerSide, 'tracked');
  assert.equal(opponentHistory.length, 1);
  assert.equal(opponentHistory[0].match.id, match.id);
  assert.equal(opponentHistory[0].playerSide, 'opponent');
  assert.equal(networkRequestCount, 0);
});

test('renaming a saved player keeps trend history after restart and preserves match data', async () => {
  storageValues.clear();
  const { localMatches, localPlayers } = loadStorageModulesAfterRestart();
  const trackedPlayer = await localPlayers.addLocalPlayer('Sana Iyer');
  const opponentPlayer = await localPlayers.addLocalPlayer('Maya Rao');

  const trackedMatch = await localMatches.createLocalMatch({
    matchDate: '2026-10-25',
    event: 'Fall Invitational',
    round: 'Semifinal',
    trackedPlayer: trackedPlayer.name,
    trackedPlayerId: trackedPlayer.id,
    opponent: opponentPlayer.name,
    opponentPlayerId: opponentPlayer.id,
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await localMatches.recordLocalPoint(trackedMatch.id, {
    winner: 'tracked',
    endingCode: 'A',
  });

  const opponentMatch = await localMatches.createLocalMatch({
    matchDate: '2026-10-27',
    event: 'Fall Invitational',
    round: 'Final',
    trackedPlayer: opponentPlayer.name,
    trackedPlayerId: opponentPlayer.id,
    opponent: trackedPlayer.name,
    opponentPlayerId: trackedPlayer.id,
    chairCoach: null,
    surface: 'Clay',
    firstServer: 'opponent',
    setNumber: 1,
  });
  await localMatches.recordLocalPoint(opponentMatch.id, {
    winner: 'opponent',
    endingCode: 'F',
  });

  const rosterBefore = await localPlayers.listLocalPlayers();
  const historyBefore = await localMatches.listLocalPlayerMatchInsights(
    trackedPlayer.id,
    rosterBefore,
  );
  const insights = loadPlayerInsights();
  const trendsBefore = insights.buildPlayerPerformanceHistory(historyBefore);
  const matchesBefore = await Promise.all(
    [trackedMatch.id, opponentMatch.id].map((id) =>
      localMatches.getLocalMatch(id),
    ),
  );
  assert.ok(matchesBefore.every(Boolean));
  assert.deepEqual(
    historyBefore.map((record) => record.playerSide),
    ['tracked', 'opponent'],
  );
  assert.deepEqual(
    trendsBefore.map((trend) => [trend.trackedPlayer, trend.opponent]),
    [
      ['Sana Iyer', 'Maya Rao'],
      ['Sana Iyer', 'Maya Rao'],
    ],
  );

  const renamedPlayer = await localPlayers.updateLocalPlayer(
    trackedPlayer.id,
    'Sana Iyer Renamed',
    {
      dateOfBirth: trackedPlayer.dateOfBirth,
      atpPlayerId: trackedPlayer.atpPlayerId,
      itfPlayerId: trackedPlayer.itfPlayerId,
      atpRanking: trackedPlayer.atpRanking,
      itfRanking: trackedPlayer.itfRanking,
      nationality: trackedPlayer.nationality,
      playingHand: trackedPlayer.playingHand,
      heightCm: trackedPlayer.heightCm,
      weightKg: trackedPlayer.weightKg,
      phoneNumbers: trackedPlayer.phoneNumbers,
      profileUrls: trackedPlayer.profileUrls,
      profileUrlLabels: trackedPlayer.profileUrlLabels,
    },
  );

  const afterRestart = loadStorageModulesAfterRestart();
  const rosterAfter = await afterRestart.localPlayers.listLocalPlayers();
  const historyAfter = await afterRestart.localMatches.listLocalPlayerMatchInsights(
    renamedPlayer.id,
    rosterAfter,
  );
  const trendsAfter = insights.buildPlayerPerformanceHistory(historyAfter);
  const matchesAfter = await Promise.all(
    [trackedMatch.id, opponentMatch.id].map((id) =>
      afterRestart.localMatches.getLocalMatch(id),
    ),
  );

  assert.equal(renamedPlayer.id, trackedPlayer.id);
  assert.equal(renamedPlayer.name, 'Sana Iyer Renamed');
  assert.equal(
    rosterAfter.find((player) => player.id === trackedPlayer.id)?.name,
    'Sana Iyer Renamed',
  );
  assert.equal(
    await afterRestart.localPlayers.getActiveLocalPlayerId(),
    trackedPlayer.id,
  );
  assert.deepEqual(historyAfter, historyBefore);
  assert.deepEqual(trendsAfter, trendsBefore);
  assert.deepEqual(matchesAfter, matchesBefore);
  assert.deepEqual(
    matchesAfter.map((match) => [
      match.trackedPlayer,
      match.opponent,
      match.points,
    ]),
    [
      ['Sana Iyer', 'Maya Rao', matchesBefore[0].points],
      ['Maya Rao', 'Sana Iyer', matchesBefore[1].points],
    ],
  );
});

test('game notes stay with their set and game after restart and can be edited', async () => {
  storageValues.clear();
  const { localMatches } = loadStorageModulesAfterRestart();
  const match = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: 'Autumn Open',
    round: 'Final',
    trackedPlayer: 'A',
    opponent: 'B',
    chairCoach: null,
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });

  for (let point = 0; point < 4; point += 1) {
    await localMatches.recordLocalPoint(match.id, { winner: 'tracked' });
  }
  await localMatches.updateLocalGameNote(
    match.id,
    1,
    1,
    'Set one game one: aggressive return',
  );
  for (let point = 0; point < 20; point += 1) {
    await localMatches.recordLocalPoint(match.id, { winner: 'tracked' });
  }

  const secondSet = await localMatches.addLocalSet(match.id, 'standard');
  assert.equal(secondSet.setNumber, 2);
  for (let point = 0; point < 4; point += 1) {
    await localMatches.recordLocalPoint(match.id, { winner: 'opponent' });
  }
  await localMatches.updateLocalGameNote(
    match.id,
    2,
    1,
    'Set two game one: serve placement',
  );

  const afterRestart = loadStorageModulesAfterRestart();
  const reopenedMatch = await afterRestart.localMatches.getLocalMatch(match.id);
  assert.ok(reopenedMatch);
  const reopenedSets = afterRestart.localMatches.getLocalSetHistory(reopenedMatch);
  assert.deepEqual(
    reopenedSets.map((set) => ({
      setNumber: set.setNumber,
      isCurrent: set.isCurrent,
      gameNotes: set.gameNotes,
    })),
    [
      {
        setNumber: 1,
        isCurrent: false,
        gameNotes: [
          { gameNumber: 1, note: 'Set one game one: aggressive return' },
        ],
      },
      {
        setNumber: 2,
        isCurrent: true,
        gameNotes: [
          { gameNumber: 1, note: 'Set two game one: serve placement' },
        ],
      },
    ],
  );

  await afterRestart.localMatches.updateLocalGameNote(
    match.id,
    1,
    1,
    'Edited set one note',
  );
  await afterRestart.localMatches.updateLocalGameNote(
    match.id,
    2,
    1,
    'Edited set two note',
  );

  const afterEditRestart = loadStorageModulesAfterRestart();
  const editedMatch = await afterEditRestart.localMatches.getLocalMatch(match.id);
  assert.ok(editedMatch);
  assert.deepEqual(
    afterEditRestart.localMatches
      .getLocalSetHistory(editedMatch)
      .map((set) => ({ setNumber: set.setNumber, gameNotes: set.gameNotes })),
    [
      {
        setNumber: 1,
        gameNotes: [{ gameNumber: 1, note: 'Edited set one note' }],
      },
      {
        setNumber: 2,
        gameNotes: [{ gameNumber: 1, note: 'Edited set two note' }],
      },
    ],
  );
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
  assert.deepEqual(
    loadPlayerInsights()
      .buildPlayerPerformanceHistory([...history].reverse())
      .map((trend) => trend.date),
    ['2026-10-29', '2026-10-31'],
  );
  assert.equal(trends[0].metrics.overall.percent, 50);
  assert.equal(trends[0].metrics.service.percent, 50);
  assert.equal(trends[0].metrics.return.percent, 50);
  assert.equal(trends[0].metrics.firstServe.percent, 100);
  assert.equal(trends[0].metrics.secondServe.percent, 0);
  assert.deepEqual(
    [trends[0].metrics.overall.won, trends[0].metrics.overall.total],
    [2, 4],
  );
  const overallSummary = loadPlayerInsights().summarizePlayerTrendMetric(
    trends,
    'overall',
  );
  assert.deepEqual(
    {
      percent: overallSummary.percent,
      won: overallSummary.won,
      total: overallSummary.total,
      matchCount: overallSummary.matchCount,
      sampledMatchCount: overallSummary.sampledMatchCount,
    },
    {
      percent: 60,
      won: 3,
      total: 5,
      matchCount: 2,
      sampledMatchCount: 2,
    },
  );

  const opponentHistory = await localMatches.listLocalPlayerMatchInsights(
    opponentPlayer.id,
    players,
  );
  const opponentTrend = loadPlayerInsights().buildPlayerPerformanceHistory(
    opponentHistory,
  )[0];
  assert.equal(opponentTrend.trackedPlayer, 'Maya Rao');
  assert.equal(opponentTrend.opponent, 'Sana Iyer');
  assert.equal(opponentTrend.metrics.secondServe.percent, null);
  assert.equal(opponentTrend.metrics.secondServe.total, 0);
  const noSecondServeSummary = loadPlayerInsights().summarizePlayerTrendMetric(
    [opponentTrend],
    'secondServe',
  );
  assert.equal(noSecondServeSummary.percent, null);
  assert.equal(noSecondServeSummary.matchCount, 1);
  assert.equal(noSecondServeSummary.sampledMatchCount, 0);
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

test('match book results use completed-set majorities and keep ties and live matches neutral', async () => {
  storageValues.clear();
  const { localMatches } = loadStorageModulesAfterRestart();

  async function createMatch(setWinners, completeMatch) {
    const match = await localMatches.createLocalMatch({
      matchDate: '2026-10-30',
      event: 'Match book result test',
      round: 'Final',
      trackedPlayer: 'Tracked Player',
      opponent: 'Opponent Player',
      surface: 'Hard',
      firstServer: 'tracked',
      setNumber: 1,
    });
    for (const [setIndex, setWinner] of setWinners.entries()) {
      if (setIndex > 0) await localMatches.addLocalSet(match.id, 'standard');
      for (let point = 0; point < 24; point += 1) {
        await localMatches.recordLocalPoint(match.id, { winner: setWinner });
      }
    }
    if (completeMatch) await localMatches.finishLocalMatch(match.id);
    return match.id;
  }

  const trackedWinId = await createMatch(['tracked'], true);
  const opponentWinId = await createMatch(['opponent'], true);
  const tiedId = await createMatch(['tracked', 'opponent'], true);
  const liveId = await createMatch(['tracked'], false);
  const summaries = new Map(
    (await localMatches.listLocalMatches()).map((summary) => [summary.id, summary]),
  );
  const trackedWin = summaries.get(trackedWinId);
  const opponentWin = summaries.get(opponentWinId);
  const tied = summaries.get(tiedId);
  const live = summaries.get(liveId);

  assert.equal(trackedWin.winner, 'tracked');
  assert.equal(
    localMatches.getLocalMatchSummaryResultLabel(trackedWin),
    'Winner: Tracked Player',
  );
  assert.equal(opponentWin.winner, 'opponent');
  assert.equal(
    localMatches.getLocalMatchSummaryResultLabel(opponentWin),
    'Winner: Opponent Player',
  );
  assert.equal(tied.status, 'complete');
  assert.equal(tied.winner, null);
  assert.equal(
    localMatches.getLocalMatchSummaryResultLabel(tied),
    'Complete · no set majority',
  );
  assert.equal(live.status, 'in_progress');
  assert.equal(live.winner, null);
  assert.equal(localMatches.getLocalMatchSummaryResultLabel(live), null);
  assert.equal(
    localMatches.getLocalMatchSummaryResultLabel({ ...live, winner: 'tracked' }),
    null,
  );

  const homeScreen = fs.readFileSync(
    path.join(__dirname, '../app/index.tsx'),
    'utf8',
  );
  assert.match(homeScreen, /getLocalMatchSummaryResultLabel\(item\)/);
  assert.match(homeScreen, /testID=\{`match-result-\$\{item\.id\}`\}/);
});

test('retirement and walkover outcomes stay separate from local set scores', async () => {
  storageValues.clear();
  const { localMatches } = loadStorageModulesAfterRestart();
  const retiredMatch = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: null,
    round: null,
    trackedPlayer: 'Tracked Player',
    opponent: 'Opponent Player',
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  await localMatches.recordLocalPoint(retiredMatch.id, { winner: 'tracked' });
  await localMatches.recordLocalPoint(retiredMatch.id, { winner: 'opponent' });
  const pointsBeforeOutcome = (await localMatches.getLocalMatch(retiredMatch.id)).points;
  const retired = await localMatches.recordLocalMatchOutcome(retiredMatch.id, {
    reason: 'retirement',
    winner: 'opponent',
  });

  assert.equal(retired.matchStatus, 'complete');
  assert.equal(retired.status, 'in_progress');
  assert.deepEqual(retired.points, pointsBeforeOutcome);
  assert.equal(retired.score.isComplete, false);
  await assert.rejects(
    localMatches.recordLocalPoint(retiredMatch.id, { winner: 'tracked' }),
    /match is final/i,
  );
  const retiredSummary = (await localMatches.listLocalMatches()).find(
    (summary) => summary.id === retiredMatch.id,
  );
  assert.equal(retiredSummary.winner, 'opponent');
  assert.equal(retiredSummary.matchOutcome.reason, 'retirement');
  assert.equal(retiredSummary.setScores[0].isComplete, false);
  assert.equal(
    localMatches.getLocalMatchSummaryResultLabel(retiredSummary),
    'Winner: Opponent Player · retirement',
  );

  const resumed = await localMatches.clearLocalMatchOutcome(retiredMatch.id);
  assert.equal(resumed.matchStatus, 'in_progress');
  assert.equal(resumed.matchOutcome, null);
  assert.deepEqual(resumed.points, pointsBeforeOutcome);

  const walkoverMatch = await localMatches.createLocalMatch({
    matchDate: '2026-10-30',
    event: null,
    round: null,
    trackedPlayer: 'Tracked Player',
    opponent: 'Opponent Player',
    surface: 'Hard',
    firstServer: 'tracked',
    setNumber: 1,
  });
  const walkover = await localMatches.recordLocalMatchOutcome(walkoverMatch.id, {
    reason: 'walkover',
    winner: 'tracked',
  });
  const walkoverSummary = (await localMatches.listLocalMatches()).find(
    (summary) => summary.id === walkoverMatch.id,
  );
  assert.equal(walkover.matchStatus, 'complete');
  assert.equal(walkoverSummary.winner, 'tracked');
  assert.equal(walkoverSummary.setScores.length, 0);
  assert.equal(
    localMatches.getLocalMatchSummaryResultLabel(walkoverSummary),
    'Winner: Tracked Player · walkover',
  );
});

test('report benchmark presets can be managed offline and survive app restart', async (t) => {
  storageValues.clear();
  const originalFetch = global.fetch;
  let networkRequestCount = 0;
  global.fetch = async () => {
    networkRequestCount += 1;
    throw new Error('Report benchmarks must stay on this device.');
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const beforeRestart = loadStorageModulesAfterRestart().localReportBenchmarks;
  const initial = await beforeRestart.getLocalReportBenchmarkSettings();
  assert.equal(initial.presets.length, 2);
  assert.deepEqual(initial.selectedPresetIds, [
    'reference-season-2026',
    'reference-cincinnati-2026',
  ]);
  assert.deepEqual(
    initial.presets.map((preset) => [
      preset.firstServePointsWon,
      preset.secondServePointsWon,
      preset.serviceGamesWon,
    ]),
    [
      [75.1, 56.4, 86.8],
      [79.2, 61.7, 94.3],
    ],
  );

  const created = await beforeRestart.saveLocalReportBenchmarkPreset({
    name: 'My season goal',
    firstServePointsWon: 73.5,
    secondServePointsWon: 55,
    serviceGamesWon: null,
  });
  const customPreset = created.presets.find((preset) => preset.name === 'My season goal');
  assert.ok(customPreset);
  assert.equal(created.selectedPresetIds.length, 2);
  await assert.rejects(
    beforeRestart.setSelectedLocalReportBenchmarkPresets([
      ...created.selectedPresetIds,
      customPreset.id,
    ]),
    /Choose up to 2/,
  );

  await beforeRestart.setSelectedLocalReportBenchmarkPresets([customPreset.id]);
  await beforeRestart.saveLocalReportBenchmarkPreset(
    {
      name: 'My season goal',
      firstServePointsWon: 77,
      secondServePointsWon: null,
      serviceGamesWon: 89.4,
    },
    customPreset.id,
  );

  const afterRestart = loadStorageModulesAfterRestart().localReportBenchmarks;
  const restored = await afterRestart.getLocalReportBenchmarkSettings();
  assert.deepEqual(restored.selectedPresetIds, [customPreset.id]);
  const restoredCustomPreset = restored.presets.find(
    (preset) => preset.id === customPreset.id,
  );
  assert.ok(restoredCustomPreset);
  assert.equal(restoredCustomPreset.name, 'My season goal');
  assert.equal(restoredCustomPreset.firstServePointsWon, 77);
  assert.equal(restoredCustomPreset.secondServePointsWon, null);
  assert.equal(restoredCustomPreset.serviceGamesWon, 89.4);
  assert.match(restoredCustomPreset.updatedAt, /^\d{4}-\d\d-\d\dT/);

  const removed = await afterRestart.removeLocalReportBenchmarkPreset(customPreset.id);
  assert.equal(removed.presets.some((preset) => preset.id === customPreset.id), false);
  assert.deepEqual(removed.selectedPresetIds, []);
  await assert.rejects(
    afterRestart.saveLocalReportBenchmarkPreset({
      name: 'Empty preset',
      firstServePointsWon: null,
      secondServePointsWon: null,
      serviceGamesWon: null,
    }),
    /at least one reference percentage/,
  );
  await assert.rejects(
    afterRestart.saveLocalReportBenchmarkPreset({
      name: 'Invalid preset',
      firstServePointsWon: 100.1,
      secondServePointsWon: null,
      serviceGamesWon: null,
    }),
    /percentages from 0 to 100/,
  );
  assert.equal(networkRequestCount, 0);
});

test('custom neutral report labels stay local and survive app restart', async (t) => {
  storageValues.clear();
  const originalFetch = global.fetch;
  let networkRequestCount = 0;
  global.fetch = async () => {
    networkRequestCount += 1;
    throw new Error('Neutral report labels must stay on this device.');
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const beforeRestart = loadStorageModulesAfterRestart().localReportNameLabels;
  assert.deepEqual(await beforeRestart.getLocalReportNameLabels(), {
    trackedPlayer: 'Player A',
    opponent: 'Player B',
  });
  const saved = await beforeRestart.saveLocalReportNameLabels({
    trackedPlayer: '  Main   athlete ',
    opponent: ' Practice partner  ',
  });
  assert.deepEqual(saved, {
    trackedPlayer: 'Main athlete',
    opponent: 'Practice partner',
  });
  assert.deepEqual([...storageValues.keys()], [
    '@tennis-scoring/report-name-labels/record-v1',
  ]);

  const afterRestart = loadStorageModulesAfterRestart().localReportNameLabels;
  assert.deepEqual(await afterRestart.getLocalReportNameLabels(), saved);
  await assert.rejects(
    afterRestart.saveLocalReportNameLabels({
      trackedPlayer: 'Same label',
      opponent: ' same   label ',
    }),
    /different label/,
  );
  await assert.rejects(
    afterRestart.saveLocalReportNameLabels({
      trackedPlayer: '',
      opponent: 'Practice partner',
    }),
    /label for both players/,
  );
  assert.equal(networkRequestCount, 0);
});
