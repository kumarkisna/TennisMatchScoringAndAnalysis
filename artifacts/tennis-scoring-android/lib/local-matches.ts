import AsyncStorage from '@react-native-async-storage/async-storage';

export type PlayerSide = 'tracked' | 'opponent';
export type PointCode = 'A' | 'F' | 'B' | 'V' | 'O' | 'P' | 'N' | 'L' | 'W' | 'D' | 'FE';
export type CourtSurface = 'Hard' | 'Clay' | 'Grass' | 'Carpet' | 'Other';
export type SetFormat = 'standard' | 'match_tiebreak';

export interface LocalSetRecord {
  setNumber: number;
  firstServer: PlayerSide;
  format: SetFormat;
  tiebreakTarget: number;
  score: ScoreState;
  points: LocalPoint[];
}

export interface LocalSetResult extends LocalSetRecord {
  isCurrent: boolean;
}

export interface ScoreState {
  trackedGames: number;
  opponentGames: number;
  trackedPoints: string;
  opponentPoints: string;
  trackedTiebreakPoints: number;
  opponentTiebreakPoints: number;
  nextServer: PlayerSide;
  isTiebreak: boolean;
  isComplete: boolean;
  winner: PlayerSide | null;
}

export interface LocalPoint {
  id: string;
  sequenceNumber: number;
  setNumber: number;
  gameNumber: number;
  server: PlayerSide;
  isTiebreak: boolean;
  winner: PlayerSide;
  endingCode: PointCode | null;
  firstServeFault: boolean;
  createdAt: string;
}

export interface LocalMatch {
  id: string;
  matchDate: string;
  event: string | null;
  round: string | null;
  setNumber: number;
  trackedPlayer: string;
  opponent: string;
  chairCoach: string | null;
  surface: CourtSurface;
  firstServer: PlayerSide;
  setFormat: SetFormat;
  tiebreakTarget: number;
  completedSets: LocalSetRecord[];
  matchStatus: 'in_progress' | 'complete';
  status: 'in_progress' | 'complete';
  score: ScoreState;
  points: LocalPoint[];
  createdAt: string;
  updatedAt: string;
}

export interface NewLocalMatch {
  matchDate: string;
  event: string | null;
  round: string | null;
  setNumber: number;
  trackedPlayer: string;
  opponent: string;
  chairCoach: string | null;
  surface: CourtSurface;
  firstServer: PlayerSide;
}

export interface NewLocalPoint {
  winner: PlayerSide;
  endingCode?: PointCode | null;
  firstServeFault?: boolean;
}

export interface LocalMatchSummary {
  id: string;
  matchDate: string;
  event: string | null;
  round: string | null;
  setNumber: number;
  trackedPlayer: string;
  opponent: string;
  surface: CourtSurface;
  status: 'in_progress' | 'complete';
  trackedGames: number;
  opponentGames: number;
  setScores: {
    setNumber: number;
    format: SetFormat;
    tiebreakTarget: number;
    trackedGames: number;
    opponentGames: number;
    trackedTiebreakPoints: number;
    opponentTiebreakPoints: number;
    isComplete: boolean;
  }[];
  pointCount: number;
  winner: PlayerSide | null;
  updatedAt: string;
}

export interface LocalInsights {
  pointCount: number;
  trackedPointsWon: number;
  opponentPointsWon: number;
  firstServeFaults: number;
  trackedFirstServeFaults: number;
  trackedServicePoints: number;
  trackedReturnPoints: number;
  codes: { code: PointCode; count: number; trackedWon: number; opponentWon: number }[];
  returnPointsWon: number;
  servicePointsWon: number;
}

export const LOCAL_MATCH_LIST_KEY = ['device-matches'] as const;
export const localMatchKey = (id: string) => ['device-match', id] as const;
export const localInsightsKey = (id: string) => ['device-insights', id] as const;

const INDEX_KEY = '@tennis-scoring/matches/index-v1';
const MATCH_PREFIX = '@tennis-scoring/matches/record-v1/';

let writeQueue = Promise.resolve();

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function matchStorageKey(id: string) {
  return `${MATCH_PREFIX}${id}`;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (raw === null) return [];

  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) {
    throw new Error('Saved match index is damaged. Your local match files were not changed.');
  }
  return value;
}

async function readMatch(id: string): Promise<LocalMatch | null> {
  const raw = await AsyncStorage.getItem(matchStorageKey(id));
  if (raw === null) return null;

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('id' in value) || value.id !== id) {
    throw new Error('A saved match could not be read. Its local data was not changed.');
  }
  return normalizeLocalMatch(value as Record<string, unknown>);
}

function normalizeLocalMatch(value: Record<string, unknown>): LocalMatch {
  const legacyStatus = value.status === 'complete' ? 'complete' : 'in_progress';
  const normalizePoint = (point: LocalPoint): LocalPoint => {
    const normalized = { ...point } as LocalPoint & { syncStatus?: unknown };
    delete normalized.syncStatus;
    return normalized;
  };
  const normalizeSet = (set: LocalSetRecord): LocalSetRecord => ({
    ...set,
    points: Array.isArray(set.points) ? set.points.map(normalizePoint) : [],
  });
  const localValue = { ...value };
  delete localValue.syncStatus;
  delete localValue.syncToken;
  delete localValue.remoteMatchId;
  delete localValue.pendingPointDeletes;
  delete localValue.syncError;
  return {
    ...(localValue as unknown as LocalMatch),
    setFormat: value.setFormat === 'match_tiebreak' ? 'match_tiebreak' : 'standard',
    tiebreakTarget:
      typeof value.tiebreakTarget === 'number' && value.tiebreakTarget >= 1
        ? value.tiebreakTarget
        : 10,
    completedSets: Array.isArray(value.completedSets)
      ? (value.completedSets as LocalSetRecord[]).map(normalizeSet)
      : [],
    points: Array.isArray(value.points)
      ? (value.points as LocalPoint[]).map(normalizePoint)
      : [],
    matchStatus:
      value.matchStatus === 'complete' || value.matchStatus === 'in_progress'
        ? value.matchStatus
        : legacyStatus,
  };
}

async function writeMatch(match: LocalMatch): Promise<void> {
  const ids = await readIndex();
  const nextIds = [match.id, ...ids.filter((id) => id !== match.id)];
  await AsyncStorage.multiSet([
    [matchStorageKey(match.id), JSON.stringify(match)],
    [INDEX_KEY, JSON.stringify(nextIds)],
  ]);
}

function opposite(side: PlayerSide): PlayerSide {
  return side === 'tracked' ? 'opponent' : 'tracked';
}

function pointLabel(
  trackedPoints: number,
  opponentPoints: number,
  side: PlayerSide,
): string {
  const own = side === 'tracked' ? trackedPoints : opponentPoints;
  const other = side === 'tracked' ? opponentPoints : trackedPoints;

  if (own >= 3 && other >= 3) {
    if (own === other) return '40';
    return own > other ? 'AD' : '40';
  }

  return ['0', '15', '30', '40'][own] ?? '40';
}

function gameServer(firstServer: PlayerSide, gameNumber: number): PlayerSide {
  return gameNumber % 2 === 1 ? firstServer : opposite(firstServer);
}

function tiebreakServer(
  firstServer: PlayerSide,
  tiebreakPointCount: number,
): PlayerSide {
  if (tiebreakPointCount === 0) return firstServer;
  const serviceBlock = Math.ceil(tiebreakPointCount / 2);
  return serviceBlock % 2 === 1 ? opposite(firstServer) : firstServer;
}

export function calculateLocalScore(
  match: Pick<LocalMatch, 'firstServer' | 'setFormat' | 'tiebreakTarget'>,
  points: Pick<LocalPoint, 'winner' | 'isTiebreak'>[],
): ScoreState {
  let trackedGames = 0;
  let opponentGames = 0;
  let trackedGamePoints = 0;
  let opponentGamePoints = 0;
  let trackedTiebreakPoints = 0;
  let opponentTiebreakPoints = 0;
  let winner: PlayerSide | null = null;

  for (const point of points) {
    if (point.isTiebreak) {
      if (point.winner === 'tracked') trackedTiebreakPoints += 1;
      else opponentTiebreakPoints += 1;

      const tiebreakTarget =
        match.setFormat === 'match_tiebreak' ? match.tiebreakTarget : 7;
      if (
        Math.max(trackedTiebreakPoints, opponentTiebreakPoints) >= tiebreakTarget &&
        Math.abs(trackedTiebreakPoints - opponentTiebreakPoints) >= 2
      ) {
        if (match.setFormat === 'standard') {
          if (trackedTiebreakPoints > opponentTiebreakPoints) {
            trackedGames = 7;
            opponentGames = 6;
            winner = 'tracked';
          } else {
            trackedGames = 6;
            opponentGames = 7;
            winner = 'opponent';
          }
        } else {
          winner = trackedTiebreakPoints > opponentTiebreakPoints ? 'tracked' : 'opponent';
        }
      }
      continue;
    }

    if (point.winner === 'tracked') trackedGamePoints += 1;
    else opponentGamePoints += 1;

    if (
      Math.max(trackedGamePoints, opponentGamePoints) >= 4 &&
      Math.abs(trackedGamePoints - opponentGamePoints) >= 2
    ) {
      if (trackedGamePoints > opponentGamePoints) trackedGames += 1;
      else opponentGames += 1;

      trackedGamePoints = 0;
      opponentGamePoints = 0;

      if (
        (trackedGames >= 6 && trackedGames - opponentGames >= 2) ||
        (opponentGames >= 6 && opponentGames - trackedGames >= 2)
      ) {
        winner = trackedGames > opponentGames ? 'tracked' : 'opponent';
      }
    }
  }

  const isComplete = winner !== null;
  const isMatchTiebreak = match.setFormat === 'match_tiebreak';
  const isTiebreak =
    isMatchTiebreak || (!isComplete && trackedGames === 6 && opponentGames === 6);
  const gameNumber = trackedGames + opponentGames + 1;
  const nextServer = isMatchTiebreak && isComplete
    ? opposite(match.firstServer)
    : isTiebreak
      ? tiebreakServer(
        match.firstServer,
        trackedTiebreakPoints + opponentTiebreakPoints,
      )
      : gameServer(match.firstServer, gameNumber);

  return {
    trackedGames,
    opponentGames,
    trackedPoints: isTiebreak
      ? String(trackedTiebreakPoints)
      : pointLabel(trackedGamePoints, opponentGamePoints, 'tracked'),
    opponentPoints: isTiebreak
      ? String(opponentTiebreakPoints)
      : pointLabel(trackedGamePoints, opponentGamePoints, 'opponent'),
    trackedTiebreakPoints,
    opponentTiebreakPoints,
    nextServer,
    isTiebreak,
    isComplete,
    winner,
  };
}

function summarize(match: LocalMatch): LocalMatchSummary {
  const setHistory = getLocalSetHistory(match);
  const trackedSetsWon = setHistory.filter((set) => set.score.winner === 'tracked').length;
  const opponentSetsWon = setHistory.filter((set) => set.score.winner === 'opponent').length;
  const allPoints = setHistory.flatMap((set) => set.points);
  return {
    id: match.id,
    matchDate: match.matchDate,
    event: match.event,
    round: match.round,
    setNumber: match.setNumber,
    trackedPlayer: match.trackedPlayer,
    opponent: match.opponent,
    surface: match.surface,
    status: match.matchStatus,
    trackedGames: match.score.trackedGames,
    opponentGames: match.score.opponentGames,
    setScores: setHistory.map((set) => ({
      setNumber: set.setNumber,
      format: set.format,
      tiebreakTarget: set.tiebreakTarget,
      trackedGames: set.score.trackedGames,
      opponentGames: set.score.opponentGames,
      trackedTiebreakPoints: set.score.trackedTiebreakPoints,
      opponentTiebreakPoints: set.score.opponentTiebreakPoints,
      isComplete: set.score.isComplete,
    })),
    pointCount: allPoints.length,
    winner:
      match.matchStatus === 'complete' && trackedSetsWon !== opponentSetsWon
        ? trackedSetsWon > opponentSetsWon
          ? 'tracked'
          : 'opponent'
        : null,
    updatedAt: match.updatedAt,
  };
}

export async function listLocalMatches(): Promise<LocalMatchSummary[]> {
  const ids = await readIndex();
  const records = await AsyncStorage.multiGet(ids.map(matchStorageKey));
  const matches: LocalMatch[] = [];

  for (const [key, raw] of records) {
    if (raw === null) continue;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('id' in value)) {
      throw new Error(`A local match record could not be read (${key}).`);
    }
    matches.push(normalizeLocalMatch(value as Record<string, unknown>));
  }

  return matches
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(summarize);
}

export function getLocalMatch(id: string): Promise<LocalMatch | null> {
  return readMatch(id);
}

export async function createLocalMatch(input: NewLocalMatch): Promise<LocalMatch> {
  return withWriteLock(async () => {
    const now = new Date().toISOString();
    const id = newId();
    const base = {
      id,
      ...input,
      setFormat: 'standard' as const,
      tiebreakTarget: 10,
      completedSets: [] as LocalSetRecord[],
      matchStatus: 'in_progress' as const,
      points: [] as LocalPoint[],
      createdAt: now,
      updatedAt: now,
    };
    const score = calculateLocalScore(base, base.points);
    const match: LocalMatch = {
      ...base,
      status: 'in_progress',
      score,
    };

    await writeMatch(match);
    return match;
  });
}

export async function recordLocalPoint(
  id: string,
  input: NewLocalPoint,
): Promise<LocalMatch> {
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');

    const score = calculateLocalScore(match, match.points);
    if (score.isComplete) throw new Error('This set is already complete.');

    const gameNumber =
      match.setFormat === 'match_tiebreak'
        ? 1
        : score.trackedGames + score.opponentGames + 1;
    const isTiebreak =
      match.setFormat === 'match_tiebreak' ||
      (!score.isComplete && score.trackedGames === 6 && score.opponentGames === 6);
    const tiebreakPointCount = match.points.filter((point) => point.isTiebreak).length;
    const point: LocalPoint = {
      id: newId(),
      sequenceNumber: match.points.length + 1,
      setNumber: match.setNumber,
      gameNumber,
      server: isTiebreak
        ? tiebreakServer(match.firstServer, tiebreakPointCount)
        : gameServer(match.firstServer, gameNumber),
      isTiebreak,
      winner: input.winner,
      endingCode: input.endingCode ?? null,
      firstServeFault: input.firstServeFault ?? false,
      createdAt: new Date().toISOString(),
    };
    const points = [...match.points, point];
    const nextScore = calculateLocalScore(match, points);
    const updated: LocalMatch = {
      ...match,
      points,
      score: nextScore,
      status: nextScore.isComplete ? 'complete' : 'in_progress',
      updatedAt: new Date().toISOString(),
    };

    await writeMatch(updated);
    return updated;
  });
}

export async function undoLocalPoint(id: string): Promise<LocalMatch> {
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    if (match.points.length === 0) throw new Error('There is no point to undo.');

    const points = match.points.slice(0, -1);
    const score = calculateLocalScore(match, points);
    const updated: LocalMatch = {
      ...match,
      points,
      score,
      status: score.isComplete ? 'complete' : 'in_progress',
      matchStatus: 'in_progress',
      updatedAt: new Date().toISOString(),
    };

    await writeMatch(updated);
    return updated;
  });
}

export function getLocalSetHistory(match: LocalMatch): LocalSetResult[] {
  return [
    ...match.completedSets.map((set) => ({ ...set, isCurrent: false })),
    {
      setNumber: match.setNumber,
      firstServer: match.firstServer,
      format: match.setFormat,
      tiebreakTarget: match.tiebreakTarget,
      score: match.score,
      points: match.points,
      isCurrent: true,
    },
  ];
}

export async function addLocalSet(
  id: string,
  format: SetFormat,
  tiebreakTarget = 10,
): Promise<LocalMatch> {
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    if (!match.score.isComplete) {
      throw new Error('Finish the current set before adding another set.');
    }
    if (
      format === 'match_tiebreak' &&
      (!Number.isInteger(tiebreakTarget) || tiebreakTarget < 1 || tiebreakTarget > 99)
    ) {
      throw new Error('A tiebreak target must be a whole number from 1 to 99.');
    }

    const completedSet: LocalSetRecord = {
      setNumber: match.setNumber,
      firstServer: match.firstServer,
      format: match.setFormat,
      tiebreakTarget: match.tiebreakTarget,
      score: match.score,
      points: match.points,
    };
    const next = {
      ...match,
      setNumber: match.setNumber + 1,
      firstServer: match.score.nextServer,
      setFormat: format,
      tiebreakTarget: format === 'match_tiebreak' ? tiebreakTarget : 10,
      completedSets: [...match.completedSets, completedSet],
      matchStatus: 'in_progress' as const,
      points: [] as LocalPoint[],
      status: 'in_progress' as const,
      updatedAt: new Date().toISOString(),
    };
    const score = calculateLocalScore(next, next.points);
    const updated: LocalMatch = { ...next, score };
    await writeMatch(updated);
    return updated;
  });
}

export async function finishLocalMatch(id: string): Promise<LocalMatch> {
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    if (!match.score.isComplete) {
      throw new Error('Finish the current set before finishing the match.');
    }
    const updated: LocalMatch = {
      ...match,
      matchStatus: 'complete',
      updatedAt: new Date().toISOString(),
    };
    await writeMatch(updated);
    return updated;
  });
}

export async function getLocalInsights(id: string): Promise<LocalInsights | null> {
  const match = await readMatch(id);
  if (!match) return null;

  const codeCounts = new Map<
    PointCode,
    { count: number; trackedWon: number; opponentWon: number }
  >();
  let trackedPointsWon = 0;
  let opponentPointsWon = 0;
  let firstServeFaults = 0;
  let trackedFirstServeFaults = 0;
  let trackedServicePoints = 0;
  let trackedReturnPoints = 0;
  let servicePointsWon = 0;
  let returnPointsWon = 0;

  const allPoints = getLocalSetHistory(match).flatMap((set) => set.points);
  for (const point of allPoints) {
    if (point.winner === 'tracked') trackedPointsWon += 1;
    else opponentPointsWon += 1;
    if (point.firstServeFault) firstServeFaults += 1;
    if (point.server === 'tracked') {
      trackedServicePoints += 1;
      if (point.firstServeFault) trackedFirstServeFaults += 1;
      if (point.winner === 'tracked') servicePointsWon += 1;
    } else {
      trackedReturnPoints += 1;
      if (point.winner === 'tracked') returnPointsWon += 1;
    }

    if (point.endingCode) {
      const stats = codeCounts.get(point.endingCode) ?? {
        count: 0,
        trackedWon: 0,
        opponentWon: 0,
      };
      stats.count += 1;
      if (point.winner === 'tracked') stats.trackedWon += 1;
      else stats.opponentWon += 1;
      codeCounts.set(point.endingCode, stats);
    }
  }

  return {
    pointCount: allPoints.length,
    trackedPointsWon,
    opponentPointsWon,
    firstServeFaults,
    trackedFirstServeFaults,
    trackedServicePoints,
    trackedReturnPoints,
    codes: [...codeCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, stats]) => ({ code, ...stats })),
    returnPointsWon,
    servicePointsWon,
  };
}
