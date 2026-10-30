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
  STROKE_TYPE_OPTIONS,
  type LocalMatch,
  type LocalMatchBackupRecord,
} from '@/lib/local-matches';
import {
  addLocalPlayer,
  getActiveLocalPlayerId,
  listLocalPlayers,
  setActiveLocalPlayerId,
  validateLocalPlayerDetails,
  type LocalPlayer,
  type LocalPlayerDetailsInput,
} from '@/lib/local-players';
import {
  getLocalReportNameLabels,
  getLocalReportNameLabelsError,
  saveLocalReportNameLabels,
  type LocalReportNameLabels,
} from '@/lib/local-report-labels';

const CURRENT_LOCAL_BACKUP_VERSION = 1 as const;

interface LocalBackup {
  format: 'tennis-scoring-local-backup';
  version: typeof CURRENT_LOCAL_BACKUP_VERSION;
  exportedAt: string;
  activePlayerId: string | null;
  reportNameLabels?: LocalReportNameLabels;
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
    trackedPlayerId: match.trackedPlayerId,
    opponent: match.opponent,
    opponentPlayerId: match.opponentPlayerId,
    chairCoach: match.chairCoach,
    surface: match.surface,
    firstServer: match.firstServer,
    setFormat: match.setFormat,
    tiebreakTarget: match.tiebreakTarget,
    completedSets: match.completedSets,
    matchStatus: match.matchStatus,
    matchOutcome: match.matchOutcome,
    status: match.status,
    score: match.score,
    points: match.points,
    gameNotes: match.gameNotes,
    review: match.review,
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

function isBackupMatchOutcome(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.reason === 'retirement' || value.reason === 'walkover') &&
    sides.includes(value.winner as (typeof sides)[number])
  );
}

function isNullableNumber(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isBackupPlayer(value: unknown): value is LocalPlayer {
  if (!isRecord(value)) return false;
  const hasValidShape =
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    value.id.length <= 100 &&
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
    (value.phoneNumbers === undefined ||
      (Array.isArray(value.phoneNumbers) &&
        value.phoneNumbers.every((phone) => typeof phone === 'string'))) &&
    Array.isArray(value.profileUrls) &&
    value.profileUrls.every((url) => typeof url === 'string') &&
    (value.profileUrlLabels === undefined ||
      (Array.isArray(value.profileUrlLabels) &&
        value.profileUrlLabels.every((label) => typeof label === 'string'))) &&
    isTimestamp(value.createdAt);
  if (!hasValidShape) return false;

  const details: LocalPlayerDetailsInput = {
    dateOfBirth: value.dateOfBirth as string | null,
    atpPlayerId: value.atpPlayerId as string | null,
    itfPlayerId: value.itfPlayerId as string | null,
    atpRanking: value.atpRanking as number | null,
    itfRanking: value.itfRanking as number | null,
    nationality: value.nationality as string | null,
    playingHand: value.playingHand as LocalPlayerDetailsInput['playingHand'],
    heightCm: value.heightCm as number | null,
    weightKg: value.weightKg as number | null,
    phoneNumbers: (value.phoneNumbers ?? []) as string[],
    profileUrls: value.profileUrls as string[],
    profileUrlLabels: (value.profileUrlLabels ?? []) as string[],
  };
  return validateLocalPlayerDetails(details) === null;
}

function isBackupReportNameLabels(
  value: unknown,
): value is LocalReportNameLabels {
  return (
    isRecord(value) &&
    typeof value.trackedPlayer === 'string' &&
    typeof value.opponent === 'string' &&
    getLocalReportNameLabelsError({
      trackedPlayer: value.trackedPlayer,
      opponent: value.opponent,
    }) === null
  );
}

function isScore(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasValidPointLabels = value.isTiebreak
    ? value.trackedPoints === String(value.trackedTiebreakPoints) &&
      value.opponentPoints === String(value.opponentTiebreakPoints)
    : ['0', '15', '30', '40', 'AD'].includes(String(value.trackedPoints)) &&
      ['0', '15', '30', '40', 'AD'].includes(String(value.opponentPoints));
  return (
    isNonnegativeInteger(value.trackedGames) &&
    isNonnegativeInteger(value.opponentGames) &&
    typeof value.trackedPoints === 'string' &&
    typeof value.opponentPoints === 'string' &&
    hasValidPointLabels &&
    isNonnegativeInteger(value.trackedTiebreakPoints) &&
    isNonnegativeInteger(value.opponentTiebreakPoints) &&
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
    value.id.length > 0 &&
    isNonnegativeInteger(value.sequenceNumber) &&
    value.sequenceNumber >= 1 &&
    isNonnegativeInteger(value.setNumber) &&
    value.setNumber >= 1 &&
    isNonnegativeInteger(value.gameNumber) &&
    value.gameNumber >= 1 &&
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
    (value.strokes === undefined ||
      (Array.isArray(value.strokes) &&
        value.strokes.length <= 20 &&
        value.strokes.every((stroke) => {
          if (!isRecord(stroke)) return false;
          return (
            typeof stroke.id === 'string' &&
            stroke.id.length > 0 &&
            sides.includes(stroke.player as (typeof sides)[number]) &&
            STROKE_TYPE_OPTIONS.some((option) => option.value === stroke.strokeType) &&
            ['in_play', 'error', 'winner'].includes(String(stroke.result)) &&
            isNullableString(stroke.note) &&
            (stroke.note === null || stroke.note.length <= 200)
          );
        }))) &&
    isTimestamp(value.createdAt)
  );
}

function isBackupSet(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonnegativeInteger(value.setNumber) &&
    value.setNumber >= 1 &&
    sides.includes(value.firstServer as (typeof sides)[number]) &&
    (value.format === 'standard' || value.format === 'match_tiebreak') &&
    isNonnegativeInteger(value.tiebreakTarget) &&
    value.tiebreakTarget >= 1 &&
    value.tiebreakTarget <= 99 &&
    isScore(value.score) &&
    Array.isArray(value.points) &&
    value.points.every(isBackupPoint) &&
    (value.gameNotes === undefined || isBackupGameNotes(value.gameNotes)) &&
    (value.review === undefined || isBackupSetReview(value.review))
  );
}

function isBackupGameNotes(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= 1000 &&
    value.every(
      (item) =>
        isRecord(item) &&
        isNonnegativeInteger(item.gameNumber) &&
        item.gameNumber >= 1 &&
        typeof item.note === 'string' &&
        item.note.length <= 500,
    )
  );
}

function isBackupSetReview(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const validRatings =
    value.strokeRatings === undefined ||
    (isRecord(value.strokeRatings) &&
      Object.entries(value.strokeRatings).every(
        ([type, rating]) =>
          STROKE_TYPE_OPTIONS.some((option) => option.value === type) &&
          typeof rating === 'number' &&
          Number.isInteger(rating) &&
          rating >= 1 &&
          rating <= 5,
      ));
  const validNotes =
    value.strokeNotes === undefined ||
    (isRecord(value.strokeNotes) &&
      Object.entries(value.strokeNotes).every(
        ([type, note]) =>
          STROKE_TYPE_OPTIONS.some((option) => option.value === type) &&
          typeof note === 'string' &&
          note.length <= 500,
      ));
  return (
    validRatings &&
    validNotes &&
    ['footworkNote', 'tacticalNote', 'mentalNote'].every(
      (field) =>
        value[field] === undefined ||
        (typeof value[field] === 'string' && value[field].length <= 1000),
    )
  );
}

function isBackupMatch(value: unknown): value is LocalMatchBackupRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(value.id) &&
    isCalendarDate(value.matchDate) &&
    isNullableString(value.event) &&
    (value.event === null || value.event.length <= 100) &&
    isNullableString(value.round) &&
    (value.round === null || value.round.length <= 60) &&
    isNonnegativeInteger(value.setNumber) &&
    value.setNumber >= 1 &&
    typeof value.trackedPlayer === 'string' &&
    value.trackedPlayer.trim().length > 0 &&
    value.trackedPlayer.length <= 80 &&
    (value.trackedPlayerId === undefined || isNullableString(value.trackedPlayerId)) &&
    typeof value.opponent === 'string' &&
    value.opponent.trim().length > 0 &&
    value.opponent.length <= 80 &&
    (value.opponentPlayerId === undefined || isNullableString(value.opponentPlayerId)) &&
    isNullableString(value.chairCoach) &&
    (value.chairCoach === null || value.chairCoach.length <= 80) &&
    surfaces.includes(value.surface as (typeof surfaces)[number]) &&
    sides.includes(value.firstServer as (typeof sides)[number]) &&
    (value.setFormat === 'standard' || value.setFormat === 'match_tiebreak') &&
    isNonnegativeInteger(value.tiebreakTarget) &&
    value.tiebreakTarget >= 1 &&
    value.tiebreakTarget <= 99 &&
    Array.isArray(value.completedSets) &&
    value.completedSets.every(isBackupSet) &&
    (value.matchStatus === 'in_progress' || value.matchStatus === 'complete') &&
    (value.matchOutcome === undefined ||
      value.matchOutcome === null ||
      isBackupMatchOutcome(value.matchOutcome)) &&
    (value.status === 'in_progress' || value.status === 'complete') &&
    isScore(value.score) &&
    Array.isArray(value.points) &&
    value.points.every(isBackupPoint) &&
    (value.gameNotes === undefined || isBackupGameNotes(value.gameNotes)) &&
    (value.review === undefined || isBackupSetReview(value.review)) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

function parseLocalBackup(contents: string): LocalBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isRecord(parsed) || parsed.format !== 'tennis-scoring-local-backup') {
    throw new Error('This is not a supported TennisScoring backup.');
  }
  if (parsed.version !== CURRENT_LOCAL_BACKUP_VERSION) {
    throw new Error(
      `Backup version ${String(parsed.version)} is not supported. No data was imported.`,
    );
  }
  if (
    !isTimestamp(parsed.exportedAt) ||
    !(parsed.activePlayerId === null ||
      (typeof parsed.activePlayerId === 'string' && parsed.activePlayerId.length > 0)) ||
    !Array.isArray(parsed.players) ||
    !Array.isArray(parsed.matches)
  ) {
    throw new Error('The backup file is incomplete or damaged. No data was imported.');
  }
  if (
    parsed.reportNameLabels !== undefined &&
    !isBackupReportNameLabels(parsed.reportNameLabels)
  ) {
    throw new Error('The backup contains invalid report labels. No data was imported.');
  }
  if (!parsed.players.every(isBackupPlayer)) {
    throw new Error('The backup contains invalid player details. No data was imported.');
  }
  if (!parsed.matches.every(isBackupMatch)) {
    throw new Error('The backup contains invalid match or point history. No data was imported.');
  }
  const players = (parsed.players as LocalPlayer[]).map((player) => ({
    ...player,
    phoneNumbers: player.phoneNumbers ?? [],
  }));
  const playerIds = players.map((player) => player.id);
  const matchIds = parsed.matches.map((match) => match.id);
  if (
    new Set(playerIds).size !== playerIds.length ||
    new Set(matchIds).size !== matchIds.length ||
    (parsed.activePlayerId !== null && !playerIds.includes(parsed.activePlayerId))
  ) {
    throw new Error('The backup has duplicate or invalid record references.');
  }
  return { ...parsed, players } as unknown as LocalBackup;
}

export async function createLocalBackupJson(): Promise<string> {
  const [players, summaries, activePlayerId, reportNameLabels] = await Promise.all([
    listLocalPlayers(),
    listLocalMatches(),
    getActiveLocalPlayerId(),
    getLocalReportNameLabels(),
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
    version: CURRENT_LOCAL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    activePlayerId,
    reportNameLabels,
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
  const selectedAsset = selection.assets[0];
  if (!selectedAsset?.uri) {
    throw new Error('No backup file was selected. Choose a valid JSON backup and try again.');
  }

  const contents = await readAsStringAsync(selectedAsset.uri, {
    encoding: EncodingType.UTF8,
  });
  const backup = parseLocalBackup(contents);
  const activePlayerBeforeLoad = await getActiveLocalPlayerId();
  const existingPlayers = await listLocalPlayers();
  const existingByName = new Map(
    existingPlayers.map((player) => [
      player.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
      player,
    ]),
  );
  const playerIdMap = new Map<string, string>();
  let playersAdded = 0;
  let playersSkipped = 0;

  for (const player of backup.players) {
    const normalizedName = player.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const existing = existingByName.get(normalizedName);
    if (existing) {
      playerIdMap.set(player.id, existing.id);
      playersSkipped += 1;
      continue;
    }
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
      phoneNumbers: player.phoneNumbers,
      profileUrls: player.profileUrls,
      profileUrlLabels: player.profileUrlLabels,
    });
    playerIdMap.set(player.id, saved.id);
    playersAdded += 1;
    existingByName.set(normalizedName, saved);
  }

  if (activePlayerBeforeLoad === null && backup.activePlayerId) {
    const importedActivePlayerId = playerIdMap.get(backup.activePlayerId);
    if (importedActivePlayerId) {
      await setActiveLocalPlayerId(importedActivePlayerId);
    }
  }

  const matchesWithMappedPlayers = backup.matches.map((match) => ({
    ...match,
    trackedPlayerId: match.trackedPlayerId
      ? playerIdMap.get(match.trackedPlayerId) ?? null
      : null,
    opponentPlayerId: match.opponentPlayerId
      ? playerIdMap.get(match.opponentPlayerId) ?? null
      : null,
  }));
  const matchResult = await mergeLocalMatchesFromBackup(matchesWithMappedPlayers);
  if (backup.reportNameLabels) {
    await saveLocalReportNameLabels(backup.reportNameLabels);
  }
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
  const fileName = backupFileName();
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
  return { cancelled: false, fileName };
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
