import {
  cacheDirectory,
  EncodingType,
  readAsStringAsync,
  StorageAccessFramework,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
  getLocalMatch,
  listLocalMatches,
  mergeLocalMatchesFromBackup,
  type LocalMatch,
  type LocalMatchBackupRecord,
} from '@/lib/local-matches';
import {
  addLocalPlayer,
  getActiveLocalPlayerId,
  listLocalPlayers,
  setActiveLocalPlayerId,
  type LocalPlayer,
} from '@/lib/local-players';

interface LocalBackup {
  format: 'tennis-scoring-local-backup';
  version: 1;
  exportedAt: string;
  activePlayerId: string | null;
  players: LocalPlayer[];
  matches: LocalMatchBackupRecord[];
}

function backupFileName(extension = true) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `tennis-scoring-backup-${stamp}${extension ? '.json' : ''}`;
}

function portableMatch(match: LocalMatch): LocalMatchBackupRecord {
  return {
    id: match.id,
    matchDate: match.matchDate,
    event: match.event,
    round: match.round,
    setNumber: match.setNumber,
    trackedPlayer: match.trackedPlayer,
    opponent: match.opponent,
    chairCoach: match.chairCoach,
    surface: match.surface,
    firstServer: match.firstServer,
    setFormat: match.setFormat,
    tiebreakTarget: match.tiebreakTarget,
    completedSets: match.completedSets,
    matchStatus: match.matchStatus,
    status: match.status,
    score: match.score,
    points: match.points,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  };
}

const sides = ['tracked', 'opponent'] as const;
const surfaces = ['Hard', 'Clay', 'Grass', 'Carpet', 'Other'] as const;
const pointCodes = ['A', 'F', 'B', 'V', 'O', 'P', 'N', 'L', 'W', 'D', 'FE'] as const;
const shotDirections = ['cross_court', 'down_the_line', 'middle'] as const;
const rallyLengths = ['1-3', '4-6', '7-9', '10+'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown) {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isBackupPlayer(value: unknown): value is LocalPlayer {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    value.name.length <= 80 &&
    isNullableString(value.dateOfBirth) &&
    isNullableString(value.atpPlayerId) &&
    isNullableString(value.itfPlayerId) &&
    isNullableNumber(value.atpRanking) &&
    isNullableNumber(value.itfRanking) &&
    isNullableString(value.nationality) &&
    (value.playingHand === null ||
      value.playingHand === 'right' ||
      value.playingHand === 'left' ||
      value.playingHand === 'ambidextrous') &&
    isNullableNumber(value.heightCm) &&
    isNullableNumber(value.weightKg) &&
    Array.isArray(value.profileUrls) &&
    value.profileUrls.every((url) => typeof url === 'string') &&
    typeof value.createdAt === 'string'
  );
}

function isScore(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.trackedGames) &&
    Number.isInteger(value.opponentGames) &&
    typeof value.trackedPoints === 'string' &&
    typeof value.opponentPoints === 'string' &&
    Number.isInteger(value.trackedTiebreakPoints) &&
    Number.isInteger(value.opponentTiebreakPoints) &&
    sides.includes(value.nextServer as (typeof sides)[number]) &&
    typeof value.isTiebreak === 'boolean' &&
    typeof value.isComplete === 'boolean' &&
    (value.winner === null || sides.includes(value.winner as (typeof sides)[number]))
  );
}

function isBackupPoint(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    Number.isInteger(value.sequenceNumber) &&
    Number.isInteger(value.setNumber) &&
    Number.isInteger(value.gameNumber) &&
    sides.includes(value.server as (typeof sides)[number]) &&
    typeof value.isTiebreak === 'boolean' &&
    sides.includes(value.winner as (typeof sides)[number]) &&
    (value.endingCode === null ||
      pointCodes.includes(value.endingCode as (typeof pointCodes)[number])) &&
    typeof value.firstServeFault === 'boolean' &&
    (value.shotDirection === undefined ||
      value.shotDirection === null ||
      shotDirections.includes(value.shotDirection as (typeof shotDirections)[number])) &&
    (value.rallyLength === undefined ||
      value.rallyLength === null ||
      rallyLengths.includes(value.rallyLength as (typeof rallyLengths)[number])) &&
    (value.syncStatus === 'pending' || value.syncStatus === 'synced') &&
    typeof value.createdAt === 'string'
  );
}

function isBackupSet(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.setNumber) &&
    sides.includes(value.firstServer as (typeof sides)[number]) &&
    (value.format === 'standard' || value.format === 'match_tiebreak') &&
    Number.isInteger(value.tiebreakTarget) &&
    isScore(value.score) &&
    Array.isArray(value.points) &&
    value.points.every(isBackupPoint)
  );
}

function isBackupMatch(value: unknown): value is LocalMatchBackupRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(value.id) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.matchDate)) &&
    isNullableString(value.event) &&
    isNullableString(value.round) &&
    Number.isInteger(value.setNumber) &&
    typeof value.trackedPlayer === 'string' &&
    typeof value.opponent === 'string' &&
    isNullableString(value.chairCoach) &&
    surfaces.includes(value.surface as (typeof surfaces)[number]) &&
    sides.includes(value.firstServer as (typeof sides)[number]) &&
    (value.setFormat === 'standard' || value.setFormat === 'match_tiebreak') &&
    Number.isInteger(value.tiebreakTarget) &&
    Array.isArray(value.completedSets) &&
    value.completedSets.every(isBackupSet) &&
    (value.matchStatus === 'in_progress' || value.matchStatus === 'complete') &&
    (value.status === 'in_progress' || value.status === 'complete') &&
    isScore(value.score) &&
    Array.isArray(value.points) &&
    value.points.every(isBackupPoint) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function parseLocalBackup(contents: string): LocalBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (
    !isRecord(parsed) ||
    parsed.format !== 'tennis-scoring-local-backup' ||
    parsed.version !== 1 ||
    typeof parsed.exportedAt !== 'string' ||
    !(parsed.activePlayerId === null || typeof parsed.activePlayerId === 'string') ||
    !Array.isArray(parsed.players) ||
    !parsed.players.every(isBackupPlayer) ||
    !Array.isArray(parsed.matches) ||
    !parsed.matches.every(isBackupMatch)
  ) {
    throw new Error('This is not a supported TennisScoring backup.');
  }
  const playerIds = parsed.players.map((player) => player.id);
  const matchIds = parsed.matches.map((match) => match.id);
  if (
    new Set(playerIds).size !== playerIds.length ||
    new Set(matchIds).size !== matchIds.length ||
    (parsed.activePlayerId !== null && !playerIds.includes(parsed.activePlayerId))
  ) {
    throw new Error('The backup has duplicate or invalid record references.');
  }
  return parsed as unknown as LocalBackup;
}

export async function createLocalBackupJson(): Promise<string> {
  const [players, summaries, activePlayerId] = await Promise.all([
    listLocalPlayers(),
    listLocalMatches(),
    getActiveLocalPlayerId(),
  ]);
  const matches = await Promise.all(
    summaries.map(async (summary) => {
      const match = await getLocalMatch(summary.id);
      if (!match) {
        throw new Error(`Could not read match ${summary.id}; no backup was created.`);
      }
      return portableMatch(match);
    }),
  );
  const backup: LocalBackup = {
    format: 'tennis-scoring-local-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    activePlayerId,
    players,
    matches,
  };
  return JSON.stringify(backup, null, 2);
}

export async function loadLocalBackupFromDevice(): Promise<
  | { cancelled: true }
  | {
      cancelled: false;
      playersAdded: number;
      playersSkipped: number;
      matchesAdded: number;
      matchesSkipped: number;
    }
> {
  const selection = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (selection.canceled) return { cancelled: true };

  const contents = await readAsStringAsync(selection.assets[0].uri, {
    encoding: EncodingType.UTF8,
  });
  const backup = parseLocalBackup(contents);
  const activePlayerBeforeLoad = await getActiveLocalPlayerId();
  const existingPlayers = await listLocalPlayers();
  const knownNames = new Set(
    existingPlayers.map((player) => player.name.trim().toLocaleLowerCase()),
  );
  const playerIdMap = new Map<string, string>();
  let playersAdded = 0;
  let playersSkipped = 0;

  for (const player of backup.players) {
    const normalizedName = player.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const alreadySaved = knownNames.has(normalizedName);
    const saved = await addLocalPlayer(player.name, {
      dateOfBirth: player.dateOfBirth,
      atpPlayerId: player.atpPlayerId,
      itfPlayerId: player.itfPlayerId,
      atpRanking: player.atpRanking,
      itfRanking: player.itfRanking,
      nationality: player.nationality,
      playingHand: player.playingHand,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      profileUrls: player.profileUrls,
    });
    playerIdMap.set(player.id, saved.id);
    if (alreadySaved) {
      playersSkipped += 1;
    } else {
      playersAdded += 1;
      knownNames.add(normalizedName);
    }
  }

  if (activePlayerBeforeLoad === null && backup.activePlayerId) {
    const importedActivePlayerId = playerIdMap.get(backup.activePlayerId);
    if (importedActivePlayerId) {
      await setActiveLocalPlayerId(importedActivePlayerId);
    }
  }

  const matchResult = await mergeLocalMatchesFromBackup(backup.matches);
  return {
    cancelled: false,
    playersAdded,
    playersSkipped,
    matchesAdded: matchResult.added,
    matchesSkipped: matchResult.skipped,
  };
}

export async function saveLocalBackupToDevice(): Promise<
  { cancelled: true } | { cancelled: false; fileName: string }
> {
  if (Platform.OS !== 'android') {
    throw new Error('Choose “Share backup” to save the file on this device.');
  }

  const contents = await createLocalBackupJson();
  const fileName = backupFileName(false);
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return { cancelled: true };

  const uri = await StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    fileName,
    'application/json',
  );
  await StorageAccessFramework.writeAsStringAsync(uri, contents, {
    encoding: EncodingType.UTF8,
  });
  return { cancelled: false, fileName: `${fileName}.json` };
}

export async function shareLocalBackup(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  if (!cacheDirectory) {
    throw new Error('The device could not prepare a temporary backup file.');
  }

  const contents = await createLocalBackupJson();
  const fileName = backupFileName();
  const uri = `${cacheDirectory}${fileName}`;
  await writeAsStringAsync(uri, contents, { encoding: EncodingType.UTF8 });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Share your local tennis data backup',
    UTI: 'public.json',
  });
}
