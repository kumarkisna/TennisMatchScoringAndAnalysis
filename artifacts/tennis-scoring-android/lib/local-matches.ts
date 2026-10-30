import AsyncStorage from '@react-native-async-storage/async-storage';

export type PlayerSide = 'tracked' | 'opponent';
export type PointCode = 'A' | 'F' | 'B' | 'V' | 'O' | 'P' | 'N' | 'L' | 'W' | 'D' | 'FE';
export type CourtSurface = 'Hard' | 'Clay' | 'Grass' | 'Carpet' | 'Other';
export type SetFormat = 'standard' | 'match_tiebreak';

export const STROKE_TYPE_OPTIONS = [
  { value: 'first_serve', label: '1st serve' },
  { value: 'second_serve', label: '2nd serve' },
  { value: 'forehand_drive', label: 'Forehand drive' },
  { value: 'forehand_slice_drop', label: 'Forehand slice/drop' },
  { value: 'backhand_drive', label: 'Backhand drive' },
  { value: 'backhand_slice_drop', label: 'Backhand slice/drop' },
  { value: 'forehand_volley', label: 'Forehand volley' },
  { value: 'backhand_volley', label: 'Backhand volley' },
  { value: 'overhead_smash', label: 'Overhead smash' },
  { value: 'return_of_serve', label: 'Return of serve' },
  { value: 'passing_shot', label: 'Passing shot' },
  { value: 'lob', label: 'Lob' },
] as const;

export type StrokeType = (typeof STROKE_TYPE_OPTIONS)[number]['value'];
export type StrokeResult = 'in_play' | 'error' | 'winner';

export interface NewLocalStroke {
  player: PlayerSide;
  strokeType: StrokeType;
  result: StrokeResult;
  note?: string;
}

export interface LocalStroke extends Omit<NewLocalStroke, 'note'> {
  id: string;
  note: string | null;
}

export interface LocalGameNote {
  gameNumber: number;
  note: string;
}

export interface LocalSetReview {
  strokeRatings: Partial<Record<StrokeType, number>>;
  strokeNotes: Partial<Record<StrokeType, string>>;
  footworkNote: string;
  tacticalNote: string;
  mentalNote: string;
}

export const EMPTY_LOCAL_SET_REVIEW: LocalSetReview = {
  strokeRatings: {},
  strokeNotes: {},
  footworkNote: '',
  tacticalNote: '',
  mentalNote: '',
};

export const LOCAL_MATCH_NOTE_PROMPTS = [
  { id: 'worked', label: 'What worked?', starter: 'What worked: ' },
  { id: 'changed', label: 'What changed?', starter: 'What changed: ' },
  { id: 'opponent', label: 'Opponent pattern', starter: 'Opponent pattern: ' },
  {
    id: 'next-match',
    label: 'Next-match adjustment',
    starter: 'Next-match adjustment: ',
  },
] as const;

export function appendLocalNotePrompt(
  note: string,
  starter: string,
  maxLength = Number.POSITIVE_INFINITY,
  separator = '\n',
): string {
  if (!starter) return note;
  const nextValue = note
    ? `${note}${note.endsWith(separator) ? '' : separator}${starter}`
    : starter;
  return nextValue.length <= maxLength ? nextValue : note;
}

export const SHOT_DIRECTION_OPTIONS = [
  { value: 'cross_court', label: 'Cross-court' },
  { value: 'down_the_line', label: 'Down the line' },
  { value: 'middle', label: 'Middle' },
] as const;

export type ShotDirection = (typeof SHOT_DIRECTION_OPTIONS)[number]['value'];

export const RALLY_LENGTH_OPTIONS = [
  { value: '1-3', label: '1–3 shots' },
  { value: '4-6', label: '4–6 shots' },
  { value: '7-9', label: '7–9 shots' },
  { value: '10+', label: '10+ shots' },
] as const;

export type RallyLength = (typeof RALLY_LENGTH_OPTIONS)[number]['value'];

export interface LocalSetRecord {
  setNumber: number;
  firstServer: PlayerSide;
  format: SetFormat;
  tiebreakTarget: number;
  score: ScoreState;
  points: LocalPoint[];
  gameNotes: LocalGameNote[];
  review: LocalSetReview;
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
  shotDirection?: ShotDirection | null;
  rallyLength?: RallyLength | null;
  strokes?: LocalStroke[];
  createdAt: string;
}

export type LocalMatchOutcomeReason = 'retirement' | 'walkover';

export interface LocalMatchOutcome {
  reason: LocalMatchOutcomeReason;
  winner: PlayerSide;
}

export interface LocalMatch {
  id: string;
  matchDate: string;
  event: string | null;
  round: string | null;
  setNumber: number;
  trackedPlayer: string;
  trackedPlayerId: string | null;
  opponent: string;
  opponentPlayerId: string | null;
  chairCoach: string | null;
  surface: CourtSurface;
  firstServer: PlayerSide;
  setFormat: SetFormat;
  tiebreakTarget: number;
  completedSets: LocalSetRecord[];
  matchStatus: 'in_progress' | 'complete';
  matchOutcome: LocalMatchOutcome | null;
  status: 'in_progress' | 'complete';
  score: ScoreState;
  points: LocalPoint[];
  gameNotes: LocalGameNote[];
  review: LocalSetReview;
  createdAt: string;
  updatedAt: string;
}

export type LocalMatchBackupRecord = LocalMatch;

export interface LocalMatchDetails {
  matchDate: string;
  event: string | null;
  round: string | null;
  trackedPlayer: string;
  opponent: string;
  chairCoach: string | null;
  surface: CourtSurface;
  firstServer: PlayerSide;
}

export interface LocalMatchDetailsUpdate extends LocalMatchDetails {
  trackedPlayerId?: string | null;
  opponentPlayerId?: string | null;
}

export interface NewLocalMatch extends LocalMatchDetails {
  setNumber: number;
  trackedPlayerId?: string | null;
  opponentPlayerId?: string | null;
}

export interface NewLocalPoint {
  winner: PlayerSide;
  endingCode?: PointCode | null;
  firstServeFault?: boolean;
  shotDirection?: ShotDirection | null;
  rallyLength?: RallyLength | null;
  strokes?: NewLocalStroke[];
}

const strokeTypes = STROKE_TYPE_OPTIONS.map(({ value }) => value);

function validateStrokes(strokes: readonly NewLocalStroke[] = []): void {
  if (strokes.length > 20) throw new Error('A point can include up to 20 recorded strokes.');
  for (const stroke of strokes) {
    if (
      (stroke.player !== 'tracked' && stroke.player !== 'opponent') ||
      !strokeTypes.includes(stroke.strokeType) ||
      !['in_play', 'error', 'winner'].includes(stroke.result)
    ) {
      throw new Error('Choose a valid player, stroke type, and stroke result.');
    }
    if ((stroke.note?.length ?? 0) > 200) {
      throw new Error('Stroke notes must be 200 characters or fewer.');
    }
  }
}

export interface LocalStrokeTally {
  strokeType: StrokeType;
  player: PlayerSide;
  inPlay: number;
  errors: number;
  winners: number;
  sampleCount: number;
}

export interface LocalContextInsight<T extends string> {
  value: T;
  count: number;
  trackedWon: number;
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
  matchOutcome: LocalMatchOutcome | null;
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

export function getLocalMatchSummaryResultLabel(
  summary: Pick<
    LocalMatchSummary,
    'status' | 'winner' | 'trackedPlayer' | 'opponent' | 'matchOutcome'
  >,
): string | null {
  if (summary.status !== 'complete') return null;
  if (summary.matchOutcome) {
    const winnerName =
      summary.matchOutcome.winner === 'tracked'
        ? summary.trackedPlayer
        : summary.opponent;
    return `Winner: ${winnerName} · ${summary.matchOutcome.reason}`;
  }
  if (summary.winner === null) return 'Complete · no set majority';
  const winnerName =
    summary.winner === 'tracked' ? summary.trackedPlayer : summary.opponent;
  return `Winner: ${winnerName}`;
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
  serveStats: Record<PlayerSide, ServeSideStats>;
  breakPoints: Record<PlayerSide, BreakPointStats>;
  serviceGames: Record<PlayerSide, ServiceGameStats>;
  shotDirections: LocalContextInsight<ShotDirection>[];
  rallyLengths: LocalContextInsight<RallyLength>[];
  sets: LocalSetInsights[];
  strokeTallies: LocalStrokeTally[];
  strokeNotes: {
    setNumber: number;
    gameNumber: number;
    sequenceNumber: number;
    player: PlayerSide;
    strokeType: StrokeType;
    result: StrokeResult;
    note: string;
  }[];
}

export interface LocalPlayerMatchInsight {
  match: Pick<
    LocalMatch,
    | 'id'
    | 'matchDate'
    | 'event'
    | 'round'
    | 'trackedPlayer'
    | 'opponent'
    | 'trackedPlayerId'
    | 'opponentPlayerId'
  >;
  playerSide: PlayerSide;
  insights: LocalInsights;
}

export interface ServeSideStats {
  servicePoints: number;
  servicePointsWon: number;
  firstServeFaults: number;
  firstServePoints: number;
  firstServePointsWon: number;
  secondServePoints: number;
  secondServePointsWon: number;
  aces: number;
  doubleFaults: number;
}

export interface BreakPointStats {
  opportunities: number;
  converted: number;
  faced: number;
  saved: number;
}

export interface ServiceGameStats {
  gamesPlayed: number;
  gamesWon: number;
}

export interface LocalSetInsights {
  setNumber: number;
  format: SetFormat;
  tiebreakTarget: number;
  isComplete: boolean;
  trackedGames: number;
  opponentGames: number;
  trackedTiebreakPoints: number;
  opponentTiebreakPoints: number;
  pointCount: number;
  trackedPointsWon: number;
  trackedServicePoints: number;
  servicePointsWon: number;
  trackedReturnPoints: number;
  returnPointsWon: number;
  serveStats: Record<PlayerSide, ServeSideStats>;
  codes: {
    code: PointCode;
    count: number;
    trackedWon: number;
    opponentWon: number;
  }[];
  tiebreakPointCount: number;
  trackedTiebreakPointsWon: number;
  breakPoints: Record<PlayerSide, BreakPointStats>;
  gameNotes: LocalGameNote[];
  review: LocalSetReview;
}

export const LOCAL_MATCH_LIST_KEY = ['device-matches'] as const;
export const localMatchKey = (id: string) => ['device-match', id] as const;
export const localInsightsKey = (id: string) => ['device-insights', id] as const;

const localSurfaces: CourtSurface[] = ['Hard', 'Clay', 'Grass', 'Carpet', 'Other'];

export function validateLocalMatchDetails(input: LocalMatchDetails): string | null {
  if (!input.trackedPlayer.trim() || !input.opponent.trim()) {
    return 'Add both player names before saving match details.';
  }
  if (input.trackedPlayer.trim().length > 80 || input.opponent.trim().length > 80) {
    return 'Player names must be 80 characters or fewer.';
  }
  const matchDate = input.matchDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
    return 'Enter the date as YYYY-MM-DD.';
  }
  const parsedDate = new Date(`${matchDate}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== matchDate
  ) {
    return 'Enter a valid calendar date.';
  }
  if (input.event?.trim().length && input.event.trim().length > 100) {
    return 'Tournament or event must be 100 characters or fewer.';
  }
  if (input.round?.trim().length && input.round.trim().length > 60) {
    return 'Round must be 60 characters or fewer.';
  }
  if (input.chairCoach?.trim().length && input.chairCoach.trim().length > 80) {
    return 'Chair or coach must be 80 characters or fewer.';
  }
  if (!localSurfaces.includes(input.surface)) {
    return 'Choose a valid court surface.';
  }
  if (input.firstServer !== 'tracked' && input.firstServer !== 'opponent') {
    return 'Choose who served first.';
  }
  return null;
}

function normalizeMatchDetails(input: LocalMatchDetails): LocalMatchDetails {
  const validationError = validateLocalMatchDetails(input);
  if (validationError) throw new Error(validationError);
  return {
    matchDate: input.matchDate.trim(),
    trackedPlayer: input.trackedPlayer.trim(),
    opponent: input.opponent.trim(),
    event: input.event?.trim() || null,
    round: input.round?.trim() || null,
    chairCoach: input.chairCoach?.trim() || null,
    surface: input.surface,
    firstServer: input.firstServer,
  };
}

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
  const storedMatch = value as Record<string, unknown>;
  const match = normalizeLocalMatch(storedMatch);
  if (hasLegacyLocalSyncState(storedMatch)) {
    await AsyncStorage.setItem(
      matchStorageKey(id),
      JSON.stringify(stripLegacyLocalSyncState(storedMatch)),
    );
  }
  return match;
}

function normalizeLocalMatchOutcome(value: unknown): LocalMatchOutcome | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    (candidate.reason !== 'retirement' && candidate.reason !== 'walkover') ||
    (candidate.winner !== 'tracked' && candidate.winner !== 'opponent')
  ) {
    return null;
  }
  return {
    reason: candidate.reason,
    winner: candidate.winner,
  };
}

const LEGACY_LOCAL_SYNC_FIELDS = [
  'ownerUserId',
  'syncStatus',
  'syncToken',
  'remoteMatchId',
  'pendingPointDeletes',
  'syncError',
] as const;

function hasLegacyLocalSyncState(value: Record<string, unknown>): boolean {
  const hasPointSyncStatus = (points: unknown) =>
    Array.isArray(points) &&
    points.some(
      (point) =>
        Boolean(point) &&
        typeof point === 'object' &&
        !Array.isArray(point) &&
        'syncStatus' in point,
    );
  const hasSetPointSyncStatus =
    Array.isArray(value.completedSets) &&
    value.completedSets.some(
      (set) =>
        Boolean(set) &&
        typeof set === 'object' &&
        !Array.isArray(set) &&
        'points' in set &&
        hasPointSyncStatus(set.points),
    );

  return (
    LEGACY_LOCAL_SYNC_FIELDS.some((field) => field in value) ||
    hasPointSyncStatus(value.points) ||
    hasSetPointSyncStatus
  );
}

function stripLegacyLocalSyncState(value: Record<string, unknown>) {
  const cleaned = { ...value };
  for (const field of LEGACY_LOCAL_SYNC_FIELDS) {
    delete cleaned[field];
  }
  const stripPointSyncStatus = (point: unknown) => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) return point;
    const cleanedPoint = { ...(point as Record<string, unknown>) };
    delete cleanedPoint.syncStatus;
    return cleanedPoint;
  };
  if (Array.isArray(value.points)) {
    cleaned.points = value.points.map(stripPointSyncStatus);
  }
  if (Array.isArray(value.completedSets)) {
    cleaned.completedSets = value.completedSets.map((set) => {
      if (!set || typeof set !== 'object' || Array.isArray(set)) return set;
      const cleanedSet = { ...(set as Record<string, unknown>) };
      if (Array.isArray(cleanedSet.points)) {
        cleanedSet.points = cleanedSet.points.map(stripPointSyncStatus);
      }
      return cleanedSet;
    });
  }
  return cleaned;
}

function normalizeLocalMatch(value: Record<string, unknown>): LocalMatch {
  const legacyStatus = value.status === 'complete' ? 'complete' : 'in_progress';
  const matchStatus =
    value.matchStatus === 'complete' || value.matchStatus === 'in_progress'
      ? value.matchStatus
      : legacyStatus;
  const normalizePoint = (point: LocalPoint): LocalPoint => {
    const normalizedPoint = { ...point } as LocalPoint & { syncStatus?: unknown };
    delete normalizedPoint.syncStatus;
    return {
      ...normalizedPoint,
      strokes: Array.isArray(point.strokes)
        ? point.strokes
            .filter(
              (stroke) =>
                stroke &&
                (stroke.player === 'tracked' || stroke.player === 'opponent') &&
                STROKE_TYPE_OPTIONS.some((option) => option.value === stroke.strokeType) &&
                (stroke.result === 'in_play' ||
                  stroke.result === 'error' ||
                  stroke.result === 'winner'),
            )
            .map((stroke) => ({
              id: typeof stroke.id === 'string' ? stroke.id : newId(),
              player: stroke.player,
              strokeType: stroke.strokeType,
              result: stroke.result,
              note: typeof stroke.note === 'string' ? stroke.note.slice(0, 200) : null,
            }))
        : [],
    };
  };
  const normalizeGameNotes = (notes: unknown): LocalGameNote[] =>
    Array.isArray(notes)
      ? notes
          .filter(
            (item): item is LocalGameNote =>
              Boolean(item) &&
              typeof item === 'object' &&
              Number.isInteger((item as LocalGameNote).gameNumber) &&
              (item as LocalGameNote).gameNumber >= 1 &&
              typeof (item as LocalGameNote).note === 'string',
          )
          .map((item) => ({
            gameNumber: item.gameNumber,
            note: item.note.slice(0, 500),
          }))
      : [];
  const normalizeReview = (review: unknown): LocalSetReview => {
    if (!review || typeof review !== 'object' || Array.isArray(review)) {
      return { ...EMPTY_LOCAL_SET_REVIEW };
    }
    const candidate = review as Partial<LocalSetReview>;
    const strokeRatings: LocalSetReview['strokeRatings'] = {};
    const strokeNotes: LocalSetReview['strokeNotes'] = {};
    for (const option of STROKE_TYPE_OPTIONS) {
      const rating = candidate.strokeRatings?.[option.value];
      const note = candidate.strokeNotes?.[option.value];
      if (Number.isInteger(rating) && rating! >= 1 && rating! <= 5) {
        strokeRatings[option.value] = rating;
      }
      if (typeof note === 'string' && note.trim()) {
        strokeNotes[option.value] = note.slice(0, 500);
      }
    }
    return {
      strokeRatings,
      strokeNotes,
      footworkNote:
        typeof candidate.footworkNote === 'string' ? candidate.footworkNote.slice(0, 1000) : '',
      tacticalNote:
        typeof candidate.tacticalNote === 'string' ? candidate.tacticalNote.slice(0, 1000) : '',
      mentalNote:
        typeof candidate.mentalNote === 'string' ? candidate.mentalNote.slice(0, 1000) : '',
    };
  };
  const normalizeSet = (set: LocalSetRecord): LocalSetRecord => ({
    ...set,
    points: Array.isArray(set.points) ? set.points.map(normalizePoint) : [],
    gameNotes: normalizeGameNotes(set.gameNotes),
    review: normalizeReview(set.review),
  });
  const matchFields = { ...value };
  for (const field of LEGACY_LOCAL_SYNC_FIELDS) {
    delete matchFields[field];
  }
  return {
    ...(matchFields as unknown as LocalMatch),
    trackedPlayerId:
      typeof value.trackedPlayerId === 'string' ? value.trackedPlayerId : null,
    opponentPlayerId:
      typeof value.opponentPlayerId === 'string' ? value.opponentPlayerId : null,
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
    gameNotes: normalizeGameNotes(value.gameNotes),
    review: normalizeReview(value.review),
    matchStatus,
    matchOutcome:
      matchStatus === 'complete'
        ? normalizeLocalMatchOutcome(value.matchOutcome)
        : null,
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

function emptyBreakPointStats(): Record<PlayerSide, BreakPointStats> {
  return {
    tracked: { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    opponent: { opportunities: 0, converted: 0, faced: 0, saved: 0 },
  };
}

export type BreakPointPointOutcome = 'converted' | 'saved';
export type LocalPointHistoryFilter = 'all' | 'break_points';

export interface BreakPointPointScore {
  trackedScore: string;
  opponentScore: string;
}

export interface LocalPointHistoryEntry<TPoint> {
  point: TPoint;
  breakPointOutcome: BreakPointPointOutcome | null;
  breakPointScoreBefore: BreakPointPointScore | null;
}

interface BreakPointPointDetails {
  outcome: BreakPointPointOutcome;
  scoreBefore: BreakPointPointScore;
}

function getBreakPointPointDetails(
  points: Pick<LocalPoint, 'isTiebreak' | 'server' | 'winner'>[],
  format: SetFormat,
): (BreakPointPointDetails | null)[] {
  const details: (BreakPointPointDetails | null)[] = points.map(() => null);
  if (format === 'match_tiebreak') return details;

  const gamePoints: Record<PlayerSide, number> = { tracked: 0, opponent: 0 };
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    if (point.isTiebreak) continue;

    const server = point.server;
    const returner = opposite(server);
    const isBreakPoint =
      gamePoints[returner] >= 3 && gamePoints[returner] > gamePoints[server];
    if (isBreakPoint) {
      details[index] = {
        outcome: point.winner === returner ? 'converted' : 'saved',
        scoreBefore: {
          trackedScore: pointLabel(
            gamePoints.tracked,
            gamePoints.opponent,
            'tracked',
          ),
          opponentScore: pointLabel(
            gamePoints.tracked,
            gamePoints.opponent,
            'opponent',
          ),
        },
      };
    }

    gamePoints[point.winner] += 1;
    if (
      Math.max(gamePoints.tracked, gamePoints.opponent) >= 4 &&
      Math.abs(gamePoints.tracked - gamePoints.opponent) >= 2
    ) {
      gamePoints.tracked = 0;
      gamePoints.opponent = 0;
    }
  }
  return details;
}

export function getBreakPointPointOutcomes(
  points: Pick<LocalPoint, 'isTiebreak' | 'server' | 'winner'>[],
  format: SetFormat,
): (BreakPointPointOutcome | null)[] {
  return getBreakPointPointDetails(points, format).map(
    (detail) => detail?.outcome ?? null,
  );
}

export function getLocalPointHistory<
  TPoint extends Pick<LocalPoint, 'isTiebreak' | 'server' | 'winner'>,
>(
  points: readonly TPoint[],
  format: SetFormat,
  filter: LocalPointHistoryFilter = 'all',
): LocalPointHistoryEntry<TPoint>[] {
  const details = getBreakPointPointDetails([...points], format);
  return points
    .map((point, index) => ({
      point,
      breakPointOutcome: details[index]?.outcome ?? null,
      breakPointScoreBefore: details[index]?.scoreBefore ?? null,
    }))
    .filter((entry) => filter === 'all' || entry.breakPointOutcome !== null)
    .reverse();
}

export function calculateBreakPointStats(
  points: Pick<LocalPoint, 'isTiebreak' | 'server' | 'winner'>[],
  format: SetFormat,
): Record<PlayerSide, BreakPointStats> {
  const stats = emptyBreakPointStats();
  const outcomes = getBreakPointPointOutcomes(points, format);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    if (!outcomes[index]) continue;
    const server = point.server;
    const returner = opposite(server);
    stats[returner].opportunities += 1;
    stats[server].faced += 1;
    if (outcomes[index] === 'converted') stats[returner].converted += 1;
    else stats[server].saved += 1;
  }
  return stats;
}

function sumBreakPointStats(
  sets: Pick<LocalSetInsights, 'breakPoints'>[],
): Record<PlayerSide, BreakPointStats> {
  const total = emptyBreakPointStats();
  for (const set of sets) {
    for (const side of ['tracked', 'opponent'] as const) {
      total[side].opportunities += set.breakPoints[side].opportunities;
      total[side].converted += set.breakPoints[side].converted;
      total[side].faced += set.breakPoints[side].faced;
      total[side].saved += set.breakPoints[side].saved;
    }
  }
  return total;
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

function rebuildLocalSetPoints(
  set: Pick<
    LocalSetRecord,
    'setNumber' | 'firstServer' | 'format' | 'tiebreakTarget'
  >,
  originalPoints: readonly LocalPoint[],
): { points: LocalPoint[]; score: ScoreState } {
  const scoringSet = {
    firstServer: set.firstServer,
    setFormat: set.format,
    tiebreakTarget: set.tiebreakTarget,
  };
  const points: LocalPoint[] = [];
  for (const [index, point] of originalPoints.entries()) {
    const scoreBefore = calculateLocalScore(scoringSet, points);
    if (scoreBefore.isComplete) {
      throw new Error(
        'This correction would finish the set before later recorded points. Undo those later points before changing this winner.',
      );
    }

    const gameNumber =
      set.format === 'match_tiebreak'
        ? 1
        : scoreBefore.trackedGames + scoreBefore.opponentGames + 1;
    const isTiebreak =
      set.format === 'match_tiebreak' ||
      (scoreBefore.trackedGames === 6 && scoreBefore.opponentGames === 6);
    const tiebreakPointCount = points.filter(
      (recordedPoint) => recordedPoint.isTiebreak,
    ).length;
    const server = isTiebreak
      ? tiebreakServer(set.firstServer, tiebreakPointCount)
      : gameServer(set.firstServer, gameNumber);

    points.push({
      ...point,
      sequenceNumber: index + 1,
      setNumber: set.setNumber,
      gameNumber,
      isTiebreak,
      server,
    });
  }

  return {
    points,
    score: calculateLocalScore(scoringSet, points),
  };
}

function summarize(match: LocalMatch): LocalMatchSummary {
  const setHistory = getLocalSetHistory(match);
  const trackedSetsWon = setHistory.filter((set) => set.score.winner === 'tracked').length;
  const opponentSetsWon = setHistory.filter((set) => set.score.winner === 'opponent').length;
  const allPoints = setHistory.flatMap((set) => set.points);
  const summarySetHistory =
    match.matchOutcome && match.points.length === 0 && !match.score.isComplete
      ? setHistory.filter((set) => !set.isCurrent)
      : setHistory;
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
    matchOutcome: match.matchStatus === 'complete' ? match.matchOutcome : null,
    trackedGames: match.score.trackedGames,
    opponentGames: match.score.opponentGames,
    setScores: summarySetHistory.map((set) => ({
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
      match.matchStatus !== 'complete'
        ? null
        : match.matchOutcome?.winner ??
          (trackedSetsWon !== opponentSetsWon
            ? trackedSetsWon > opponentSetsWon
              ? 'tracked'
              : 'opponent'
            : null),
    updatedAt: match.updatedAt,
  };
}

export async function listLocalMatches(): Promise<LocalMatchSummary[]> {
  return withWriteLock(async () => {
    const ids = await readIndex();
    const records = await AsyncStorage.multiGet(ids.map(matchStorageKey));
    const matches: LocalMatch[] = [];

    for (const [key, raw] of records) {
      if (raw === null) continue;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || !('id' in value)) {
        throw new Error(`A local match record could not be read (${key}).`);
      }
      const storedMatch = value as Record<string, unknown>;
      const match = normalizeLocalMatch(storedMatch);
      if (hasLegacyLocalSyncState(storedMatch)) {
        await AsyncStorage.setItem(
          key,
          JSON.stringify(stripLegacyLocalSyncState(storedMatch)),
        );
      }
      matches.push(match);
    }

    return matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summarize);
  });
}

export async function countLocalPlayerMatchRecords(
  playerId: string,
  players: readonly { id: string; name: string }[],
): Promise<number> {
  const uniquePlayersByName = new Map<string, string | null>();
  for (const player of players) {
    const key = normalizePlayerName(player.name);
    if (uniquePlayersByName.has(key)) {
      uniquePlayersByName.set(key, null);
    } else {
      uniquePlayersByName.set(key, player.id);
    }
  }

  return withWriteLock(async () => {
    const ids = await readIndex();
    const records = await AsyncStorage.multiGet(ids.map(matchStorageKey));
    let count = 0;

    for (const [key, raw] of records) {
      if (raw === null) continue;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || !('id' in value)) {
        throw new Error(`A local match record could not be read (${key}).`);
      }

      const match = normalizeLocalMatch(value as Record<string, unknown>);
      const trackedPlayerId =
        match.trackedPlayerId ??
        uniquePlayersByName.get(normalizePlayerName(match.trackedPlayer)) ??
        null;
      const opponentPlayerId =
        match.opponentPlayerId ??
        uniquePlayersByName.get(normalizePlayerName(match.opponent)) ??
        null;

      if (trackedPlayerId === playerId || opponentPlayerId === playerId) {
        count += 1;
      }
    }

    return count;
  });
}

export async function getLocalMatch(id: string): Promise<LocalMatch | null> {
  return withWriteLock(() => readMatch(id));
}

export async function deleteLocalMatch(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const key = matchStorageKey(id);
    const savedMatch = await AsyncStorage.getItem(key);
    const previousIndex = await AsyncStorage.getItem(INDEX_KEY);
    const matchIds = await readIndex();
    const remainingIds = matchIds.filter((matchId) => matchId !== id);

    if (savedMatch === null) {
      if (remainingIds.length !== matchIds.length) {
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(remainingIds));
      }
      return false;
    }

    try {
      await AsyncStorage.removeItem(key);
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(remainingIds));
    } catch (error) {
      try {
        await AsyncStorage.setItem(key, savedMatch);
        if (previousIndex === null) {
          await AsyncStorage.removeItem(INDEX_KEY);
        } else {
          await AsyncStorage.setItem(INDEX_KEY, previousIndex);
        }
      } catch {
        throw new Error(
          'The match could not be deleted cleanly. Export a backup before trying again.',
        );
      }
      throw error;
    }

    return true;
  });
}

export async function mergeLocalMatchesFromBackup(
  backupMatches: readonly LocalMatchBackupRecord[],
): Promise<{ added: number; skipped: number }> {
  const candidates = backupMatches.map((backupMatch) => {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(backupMatch.id)) {
      throw new Error('The backup contains an invalid match identifier.');
    }
    return normalizeLocalMatch(backupMatch as unknown as Record<string, unknown>);
  });

  return withWriteLock(async () => {
    const existingIds = await readIndex();
    const knownIds = new Set(existingIds);
    const newMatches: LocalMatch[] = [];
    let skipped = 0;

    for (const candidate of candidates) {
      if (knownIds.has(candidate.id)) {
        skipped += 1;
        continue;
      }
      knownIds.add(candidate.id);
      newMatches.push(candidate);
    }

    if (newMatches.length > 0) {
      const nextIds = [
        ...newMatches.map((match) => match.id),
        ...existingIds,
      ];
      await AsyncStorage.multiSet([
        ...newMatches.map(
          (match) => [matchStorageKey(match.id), JSON.stringify(match)] as [string, string],
        ),
        [INDEX_KEY, JSON.stringify(nextIds)],
      ]);
    }

    return { added: newMatches.length, skipped };
  });
}

export async function createLocalMatch(input: NewLocalMatch): Promise<LocalMatch> {
  return withWriteLock(async () => {
    if (!Number.isInteger(input.setNumber) || input.setNumber < 1) {
      throw new Error('Set number must be 1 or higher.');
    }
    const details = normalizeMatchDetails(input);
    const now = new Date().toISOString();
    const id = newId();
    const base = {
      id,
      ...details,
      trackedPlayerId:
        typeof input.trackedPlayerId === 'string' ? input.trackedPlayerId : null,
      opponentPlayerId:
        typeof input.opponentPlayerId === 'string' ? input.opponentPlayerId : null,
      setNumber: input.setNumber,
      setFormat: 'standard' as const,
      tiebreakTarget: 10,
      completedSets: [] as LocalSetRecord[],
      matchStatus: 'in_progress' as const,
      matchOutcome: null,
      points: [] as LocalPoint[],
      gameNotes: [] as LocalGameNote[],
      review: { ...EMPTY_LOCAL_SET_REVIEW },
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

export async function updateLocalMatchDetails(
  id: string,
  input: LocalMatchDetailsUpdate,
): Promise<LocalMatch> {
  const details = normalizeMatchDetails(input);
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');

    const sameName = (left: string, right: string) =>
      left.trim().replace(/\s+/g, ' ').toLocaleLowerCase() ===
      right.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const updatedDetails = {
      ...match,
      ...details,
      trackedPlayerId:
        input.trackedPlayerId !== undefined
          ? input.trackedPlayerId
          : sameName(match.trackedPlayer, details.trackedPlayer)
            ? match.trackedPlayerId
            : null,
      opponentPlayerId:
        input.opponentPlayerId !== undefined
          ? input.opponentPlayerId
          : sameName(match.opponent, details.opponent)
            ? match.opponentPlayerId
            : null,
    };
    const nextServer = calculateLocalScore(updatedDetails, match.points).nextServer;
    const updated: LocalMatch = {
      ...updatedDetails,
      score: { ...match.score, nextServer },
      updatedAt: new Date().toISOString(),
    };
    await writeMatch(updated);
    return updated;
  });
}

export async function recordLocalPoint(
  id: string,
  input: NewLocalPoint,
): Promise<LocalMatch> {
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    if (match.matchStatus === 'complete') {
      throw new Error('This match is final. Resume scoring before recording another point.');
    }

    const score = calculateLocalScore(match, match.points);
    if (score.isComplete) throw new Error('This set is already complete.');
    validateStrokes(input.strokes);

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
      shotDirection: input.shotDirection ?? null,
      rallyLength: input.rallyLength ?? null,
      strokes: (input.strokes ?? []).map((stroke) => ({
        ...stroke,
        id: newId(),
        note: stroke.note?.trim() || null,
      })),
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
    if (match.matchOutcome) {
      throw new Error('Resume scoring before changing points in this match.');
    }
    if (match.points.length === 0) throw new Error('There is no point to undo.');

    const removedPoint = match.points[match.points.length - 1]!;
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

export async function editLocalPointWinner(
  id: string,
  setNumber: number,
  pointId: string,
  winner: PlayerSide,
): Promise<LocalMatch> {
  if (!Number.isInteger(setNumber) || setNumber < 1) {
    throw new Error('Choose a valid set number.');
  }
  if (winner !== 'tracked' && winner !== 'opponent') {
    throw new Error('Choose one of the two players as the point winner.');
  }

  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    if (match.matchOutcome) {
      throw new Error('Clear the retirement or walkover result before editing points.');
    }

    const setHistory = getLocalSetHistory(match);
    const targetSet = setHistory.find((set) => set.setNumber === setNumber);
    const targetPoint = targetSet?.points.find((point) => point.id === pointId);
    if (!targetSet || !targetPoint) {
      throw new Error('That saved point could not be found in this match.');
    }
    if (targetPoint.winner === winner) return match;

    const rebuiltSets: LocalSetResult[] = [];
    let firstServer = setHistory[0]?.firstServer ?? match.firstServer;
    for (let index = 0; index < setHistory.length; index += 1) {
      const set = setHistory[index]!;
      const originalPoints = set.points.map((point) =>
        point.id === pointId ? { ...point, winner } : point,
      );
      const rebuilt = rebuildLocalSetPoints(
        { ...set, firstServer },
        originalPoints,
      );
      if (index < setHistory.length - 1 && !rebuilt.score.isComplete) {
        throw new Error(
          `This correction would leave Set ${set.setNumber} unfinished before later sets. The match was not changed.`,
        );
      }
      rebuiltSets.push({
        ...set,
        firstServer,
        points: rebuilt.points,
        score: rebuilt.score,
      });
      firstServer = rebuilt.score.nextServer;
    }

    const currentSet = rebuiltSets[rebuiltSets.length - 1];
    if (!currentSet) throw new Error('This match has no saved set to edit.');
    const completedSets = rebuiltSets
      .slice(0, -1)
      .map(({ isCurrent: _isCurrent, ...set }) => set);
    const updated: LocalMatch = {
      ...match,
      firstServer: currentSet.firstServer,
      completedSets,
      points: currentSet.points,
      score: currentSet.score,
      status: currentSet.score.isComplete ? 'complete' : 'in_progress',
      matchStatus:
        match.matchStatus === 'complete' && !currentSet.score.isComplete
          ? 'in_progress'
          : match.matchStatus,
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
      gameNotes: match.gameNotes,
      review: match.review,
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
    if (match.matchOutcome) {
      throw new Error('Clear the recorded match outcome before adding another set.');
    }
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
      gameNotes: match.gameNotes,
      review: match.review,
    };
    const next = {
      ...match,
      setNumber: match.setNumber + 1,
      firstServer: match.score.nextServer,
      setFormat: format,
      tiebreakTarget: format === 'match_tiebreak' ? tiebreakTarget : 10,
      completedSets: [...match.completedSets, completedSet],
      matchStatus: 'in_progress' as const,
      matchOutcome: null,
      points: [] as LocalPoint[],
      gameNotes: [] as LocalGameNote[],
      review: { ...EMPTY_LOCAL_SET_REVIEW },
      status: 'in_progress' as const,
      updatedAt: new Date().toISOString(),
    };
    const score = calculateLocalScore(next, next.points);
    const updated: LocalMatch = { ...next, score };
    await writeMatch(updated);
    return updated;
  });
}

export async function updateLocalGameNote(
  id: string,
  setNumber: number,
  gameNumber: number,
  note: string,
): Promise<LocalMatch> {
  const normalizedNote = note.trim();
  if (!Number.isInteger(setNumber) || setNumber < 1 || !Number.isInteger(gameNumber) || gameNumber < 1) {
    throw new Error('Choose a valid set and game number.');
  }
  if (normalizedNote.length > 500) throw new Error('Game notes must be 500 characters or fewer.');
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    const gameNotes = (notes: LocalGameNote[]) => {
      const next = notes.filter((item) => item.gameNumber !== gameNumber);
      if (normalizedNote) next.push({ gameNumber, note: normalizedNote });
      return next.sort((a, b) => a.gameNumber - b.gameNumber);
    };
    let updated: LocalMatch;
    if (match.setNumber === setNumber) {
      updated = { ...match, gameNotes: gameNotes(match.gameNotes) };
    } else {
      const setIndex = match.completedSets.findIndex((set) => set.setNumber === setNumber);
      if (setIndex < 0) throw new Error(`Set ${setNumber} is not part of this match.`);
      const completedSets = [...match.completedSets];
      const set = completedSets[setIndex]!;
      completedSets[setIndex] = { ...set, gameNotes: gameNotes(set.gameNotes) };
      updated = { ...match, completedSets };
    }
    updated = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    await writeMatch(updated);
    return updated;
  });
}

export async function updateLocalSetReview(
  id: string,
  setNumber: number,
  review: LocalSetReview,
): Promise<LocalMatch> {
  for (const [strokeType, rating] of Object.entries(review.strokeRatings)) {
    if (
      !strokeTypes.includes(strokeType as StrokeType) ||
      !Number.isInteger(rating) ||
      rating! < 1 ||
      rating! > 5
    ) {
      throw new Error('Stroke ratings must be whole numbers from 1 to 5.');
    }
  }
  for (const [strokeType, note] of Object.entries(review.strokeNotes)) {
    if (!strokeTypes.includes(strokeType as StrokeType) || typeof note !== 'string') {
      throw new Error('Choose a valid stroke type for each coaching note.');
    }
    if (note.length > 500) throw new Error('Stroke coaching notes must be 500 characters or fewer.');
  }
  for (const note of [review.footworkNote, review.tacticalNote, review.mentalNote]) {
    if (typeof note !== 'string' || note.length > 1000) {
      throw new Error('Set observation notes must be 1,000 characters or fewer.');
    }
  }
  const normalized = normalizeLocalMatch({
    id,
    status: 'in_progress',
    points: [],
    completedSets: [],
    review,
  }).review;
  if (!Number.isInteger(setNumber) || setNumber < 1) {
    throw new Error('Choose a valid set number.');
  }
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    let updated: LocalMatch;
    if (match.setNumber === setNumber) {
      updated = { ...match, review: normalized };
    } else {
      const setIndex = match.completedSets.findIndex((set) => set.setNumber === setNumber);
      if (setIndex < 0) throw new Error(`Set ${setNumber} is not part of this match.`);
      const completedSets = [...match.completedSets];
      completedSets[setIndex] = { ...completedSets[setIndex]!, review: normalized };
      updated = { ...match, completedSets };
    }
    updated = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    await writeMatch(updated);
    return updated;
  });
}

export async function finishLocalMatch(id: string): Promise<LocalMatch> {
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    if (match.matchOutcome) {
      throw new Error('Clear the retirement or walkover result before finishing normally.');
    }
    if (!match.score.isComplete) {
      throw new Error('Finish the current set before finishing the match.');
    }
    const updated: LocalMatch = {
      ...match,
      matchStatus: 'complete',
      matchOutcome: null,
      updatedAt: new Date().toISOString(),
    };
    await writeMatch(updated);
    return updated;
  });
}

export async function recordLocalMatchOutcome(
  id: string,
  outcome: LocalMatchOutcome,
): Promise<LocalMatch> {
  if (
    (outcome.reason !== 'retirement' && outcome.reason !== 'walkover') ||
    (outcome.winner !== 'tracked' && outcome.winner !== 'opponent')
  ) {
    throw new Error('Choose a valid match outcome and awarded winner.');
  }
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    const updated: LocalMatch = {
      ...match,
      matchStatus: 'complete',
      matchOutcome: { ...outcome },
      updatedAt: new Date().toISOString(),
    };
    await writeMatch(updated);
    return updated;
  });
}

export async function clearLocalMatchOutcome(id: string): Promise<LocalMatch> {
  return withWriteLock(async () => {
    const match = await readMatch(id);
    if (!match) throw new Error('This match is not saved on this device.');
    if (!match.matchOutcome) {
      throw new Error('This match has no retirement or walkover result to clear.');
    }
    const updated: LocalMatch = {
      ...match,
      matchStatus: 'in_progress',
      matchOutcome: null,
      updatedAt: new Date().toISOString(),
    };
    await writeMatch(updated);
    return updated;
  });
}
export function calculateLocalInsights(match: LocalMatch): LocalInsights {
  const setHistory = getLocalSetHistory(match);
  const codeCounts = new Map<
    PointCode,
    { count: number; trackedWon: number; opponentWon: number }
  >();
  const strokeTallyByKey = new Map<string, LocalStrokeTally>();
  const strokeNotes: LocalInsights['strokeNotes'] = [];
  for (const option of STROKE_TYPE_OPTIONS) {
    for (const player of ['tracked', 'opponent'] as const) {
      strokeTallyByKey.set(`${option.value}:${player}`, {
        strokeType: option.value,
        player,
        inPlay: 0,
        errors: 0,
        winners: 0,
        sampleCount: 0,
      });
    }
  }
  const shotDirectionCounts = new Map<
    ShotDirection,
    { count: number; trackedWon: number }
  >(
    SHOT_DIRECTION_OPTIONS.map(({ value }) => [
      value,
      { count: 0, trackedWon: 0 },
    ]),
  );
  const rallyLengthCounts = new Map<
    RallyLength,
    { count: number; trackedWon: number }
  >(
    RALLY_LENGTH_OPTIONS.map(({ value }) => [
      value,
      { count: 0, trackedWon: 0 },
    ]),
  );
  const serveStats: Record<PlayerSide, ServeSideStats> = {
    tracked: {
      servicePoints: 0,
      servicePointsWon: 0,
      firstServeFaults: 0,
      firstServePoints: 0,
      firstServePointsWon: 0,
      secondServePoints: 0,
      secondServePointsWon: 0,
      aces: 0,
      doubleFaults: 0,
    },
    opponent: {
      servicePoints: 0,
      servicePointsWon: 0,
      firstServeFaults: 0,
      firstServePoints: 0,
      firstServePointsWon: 0,
      secondServePoints: 0,
      secondServePointsWon: 0,
      aces: 0,
      doubleFaults: 0,
    },
  };
  const serviceGames: Record<PlayerSide, ServiceGameStats> = {
    tracked: { gamesPlayed: 0, gamesWon: 0 },
    opponent: { gamesPlayed: 0, gamesWon: 0 },
  };
  let trackedPointsWon = 0;
  let opponentPointsWon = 0;
  let firstServeFaults = 0;
  let trackedFirstServeFaults = 0;
  let trackedServicePoints = 0;
  let trackedReturnPoints = 0;
  let servicePointsWon = 0;
  let returnPointsWon = 0;

  const allPoints = setHistory.flatMap((set) => set.points);
  for (const point of allPoints) {
    for (const stroke of point.strokes ?? []) {
      const tally = strokeTallyByKey.get(`${stroke.strokeType}:${stroke.player}`);
      if (!tally) continue;
      tally.sampleCount += 1;
      if (stroke.result === 'in_play') tally.inPlay += 1;
      else if (stroke.result === 'error') tally.errors += 1;
      else tally.winners += 1;
      if (stroke.note?.trim()) {
        strokeNotes.push({
          setNumber: point.setNumber,
          gameNumber: point.gameNumber,
          sequenceNumber: point.sequenceNumber,
          player: stroke.player,
          strokeType: stroke.strokeType,
          result: stroke.result,
          note: stroke.note.trim(),
        });
      }
    }
    if (point.winner === 'tracked') trackedPointsWon += 1;
    else opponentPointsWon += 1;
    if (point.shotDirection) {
      const directionStats = shotDirectionCounts.get(point.shotDirection);
      if (directionStats) {
        directionStats.count += 1;
        if (point.winner === 'tracked') directionStats.trackedWon += 1;
      }
    }
    if (point.rallyLength) {
      const rallyStats = rallyLengthCounts.get(point.rallyLength);
      if (rallyStats) {
        rallyStats.count += 1;
        if (point.winner === 'tracked') rallyStats.trackedWon += 1;
      }
    }
    const secondServePoint = point.firstServeFault || point.endingCode === 'D';
    if (secondServePoint) firstServeFaults += 1;
    const servingPlayer = serveStats[point.server];
    servingPlayer.servicePoints += 1;
    if (point.winner === point.server) servingPlayer.servicePointsWon += 1;
    if (point.endingCode === 'A') servingPlayer.aces += 1;
    if (point.endingCode === 'D') servingPlayer.doubleFaults += 1;
    if (secondServePoint) {
      servingPlayer.firstServeFaults += 1;
      servingPlayer.secondServePoints += 1;
      if (point.winner === point.server) servingPlayer.secondServePointsWon += 1;
    } else {
      servingPlayer.firstServePoints += 1;
      if (point.winner === point.server) servingPlayer.firstServePointsWon += 1;
    }
    if (point.server === 'tracked') {
      trackedServicePoints += 1;
      if (secondServePoint) trackedFirstServeFaults += 1;
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

  for (const set of setHistory) {
    const games = new Map<
      number,
      { server: PlayerSide; trackedPoints: number; opponentPoints: number }
    >();
    for (const point of set.points) {
      if (point.isTiebreak) continue;
      const game = games.get(point.gameNumber) ?? {
        server: point.server,
        trackedPoints: 0,
        opponentPoints: 0,
      };
      if (point.winner === 'tracked') game.trackedPoints += 1;
      else game.opponentPoints += 1;
      games.set(point.gameNumber, game);
    }

    const gameNumbers = [...games.keys()].sort((a, b) => a - b);
    for (let index = 0; index < gameNumbers.length; index += 1) {
      const gameNumber = gameNumbers[index];
      if (gameNumber === undefined) continue;
      const game = games.get(gameNumber);
      if (!game) continue;
      const isLastGame = index === gameNumbers.length - 1;
      const currentGameHasNotStarted =
        set.score.trackedPoints === '0' && set.score.opponentPoints === '0';
      const isComplete =
        !isLastGame ||
        set.score.isComplete ||
        set.score.isTiebreak ||
        currentGameHasNotStarted;
      if (!isComplete) continue;

      const pointDifference = game.trackedPoints - game.opponentPoints;
      if (
        Math.max(game.trackedPoints, game.opponentPoints) < 4 ||
        Math.abs(pointDifference) < 2
      ) {
        continue;
      }
      const gameWinner: PlayerSide =
        pointDifference > 0 ? 'tracked' : 'opponent';
      const serverStats = serviceGames[game.server];
      serverStats.gamesPlayed += 1;
      if (gameWinner === game.server) serverStats.gamesWon += 1;
    }
  }

  const sets: LocalSetInsights[] = setHistory.map((set) => {
    let setTrackedPointsWon = 0;
    let setServicePoints = 0;
    let setServicePointsWon = 0;
    let setReturnPoints = 0;
    let setReturnPointsWon = 0;
    let tiebreakPointCount = 0;
    let trackedTiebreakPointsWon = 0;
    const setServeStats: Record<PlayerSide, ServeSideStats> = {
      tracked: {
        servicePoints: 0,
        servicePointsWon: 0,
        firstServeFaults: 0,
        firstServePoints: 0,
        firstServePointsWon: 0,
        secondServePoints: 0,
        secondServePointsWon: 0,
        aces: 0,
        doubleFaults: 0,
      },
      opponent: {
        servicePoints: 0,
        servicePointsWon: 0,
        firstServeFaults: 0,
        firstServePoints: 0,
        firstServePointsWon: 0,
        secondServePoints: 0,
        secondServePointsWon: 0,
        aces: 0,
        doubleFaults: 0,
      },
    };
    const setCodeCounts = new Map<
      PointCode,
      { count: number; trackedWon: number; opponentWon: number }
    >();

    for (const point of set.points) {
      if (point.winner === 'tracked') setTrackedPointsWon += 1;
      if (point.server === 'tracked') {
        setServicePoints += 1;
        if (point.winner === 'tracked') setServicePointsWon += 1;
      } else {
        setReturnPoints += 1;
        if (point.winner === 'tracked') setReturnPointsWon += 1;
      }
      if (point.isTiebreak) {
        tiebreakPointCount += 1;
        if (point.winner === 'tracked') trackedTiebreakPointsWon += 1;
      }

      const secondServePoint =
        point.firstServeFault || point.endingCode === 'D';
      const servingStats = setServeStats[point.server];
      servingStats.servicePoints += 1;
      if (point.winner === point.server) servingStats.servicePointsWon += 1;
      if (point.endingCode === 'A') servingStats.aces += 1;
      if (point.endingCode === 'D') servingStats.doubleFaults += 1;
      if (secondServePoint) {
        servingStats.firstServeFaults += 1;
        servingStats.secondServePoints += 1;
        if (point.winner === point.server) servingStats.secondServePointsWon += 1;
      } else {
        servingStats.firstServePoints += 1;
        if (point.winner === point.server) servingStats.firstServePointsWon += 1;
      }
      if (point.endingCode) {
        const stats = setCodeCounts.get(point.endingCode) ?? {
          count: 0,
          trackedWon: 0,
          opponentWon: 0,
        };
        stats.count += 1;
        if (point.winner === 'tracked') stats.trackedWon += 1;
        else stats.opponentWon += 1;
        setCodeCounts.set(point.endingCode, stats);
      }
    }

    return {
      setNumber: set.setNumber,
      format: set.format,
      tiebreakTarget: set.tiebreakTarget,
      isComplete: set.score.isComplete,
      trackedGames: set.score.trackedGames,
      opponentGames: set.score.opponentGames,
      trackedTiebreakPoints: set.score.trackedTiebreakPoints,
      opponentTiebreakPoints: set.score.opponentTiebreakPoints,
      pointCount: set.points.length,
      trackedPointsWon: setTrackedPointsWon,
      trackedServicePoints: setServicePoints,
      servicePointsWon: setServicePointsWon,
      trackedReturnPoints: setReturnPoints,
      returnPointsWon: setReturnPointsWon,
      serveStats: setServeStats,
      codes: [...setCodeCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, stats]) => ({ code, ...stats })),
      tiebreakPointCount,
      trackedTiebreakPointsWon,
      breakPoints: calculateBreakPointStats(set.points, set.format),
      gameNotes: set.gameNotes,
      review: set.review,
    };
  });

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
    serveStats,
    breakPoints: sumBreakPointStats(sets),
    serviceGames,
    shotDirections: [...shotDirectionCounts.entries()].map(([value, stats]) => ({
      value,
      ...stats,
    })),
    rallyLengths: [...rallyLengthCounts.entries()].map(([value, stats]) => ({
      value,
      ...stats,
    })),
    sets,
    strokeTallies: [...strokeTallyByKey.values()],
    strokeNotes,
  };
}

export async function getLocalInsights(
  id: string,
): Promise<LocalInsights | null> {
  const match = await withWriteLock(() => readMatch(id));
  return match ? calculateLocalInsights(match) : null;
}

function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export async function listLocalPlayerMatchInsights(
  playerId: string,
  players: readonly { id: string; name: string }[],
): Promise<LocalPlayerMatchInsight[]> {
  const uniquePlayersByName = new Map<string, string | null>();
  for (const player of players) {
    const key = normalizePlayerName(player.name);
    if (uniquePlayersByName.has(key)) {
      uniquePlayersByName.set(key, null);
    } else {
      uniquePlayersByName.set(key, player.id);
    }
  }

  const matches = await withWriteLock(async () => {
    const ids = await readIndex();
    const records = await AsyncStorage.multiGet(ids.map(matchStorageKey));
    const playerMatches: LocalMatch[] = [];
    for (const [key, raw] of records) {
      if (raw === null) continue;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || !('id' in value)) {
        throw new Error(`A local match record could not be read (${key}).`);
      }
      const storedMatch = value as Record<string, unknown>;
      const match = normalizeLocalMatch(storedMatch);
      const hasLegacySyncState = hasLegacyLocalSyncState(storedMatch);
      const trackedMatch =
        match.trackedPlayerId === null
          ? uniquePlayersByName.get(normalizePlayerName(match.trackedPlayer))
          : undefined;
      const opponentMatch =
        match.opponentPlayerId === null
          ? uniquePlayersByName.get(normalizePlayerName(match.opponent))
          : undefined;
      const trackedPlayerId = trackedMatch ?? match.trackedPlayerId;
      const opponentPlayerId = opponentMatch ?? match.opponentPlayerId;
      const linked =
        trackedPlayerId !== match.trackedPlayerId ||
        opponentPlayerId !== match.opponentPlayerId;
      const updated = linked
        ? { ...match, trackedPlayerId, opponentPlayerId }
        : match;
      if (linked || hasLegacySyncState) {
        await AsyncStorage.setItem(
          matchStorageKey(match.id),
          linked
            ? JSON.stringify(updated)
            : JSON.stringify(stripLegacyLocalSyncState(storedMatch)),
        );
      }
      if (
        updated.trackedPlayerId === playerId &&
        updated.opponentPlayerId !== playerId
      ) {
        playerMatches.push(updated);
      } else if (
        updated.opponentPlayerId === playerId &&
        updated.trackedPlayerId !== playerId
      ) {
        playerMatches.push(updated);
      }
    }
    return playerMatches;
  });

  return matches
    .filter((match) => getLocalSetHistory(match).some((set) => set.points.length > 0))
    .map((match) => ({
      match: {
        id: match.id,
        matchDate: match.matchDate,
        event: match.event,
        round: match.round,
        trackedPlayer: match.trackedPlayer,
        opponent: match.opponent,
        trackedPlayerId: match.trackedPlayerId,
        opponentPlayerId: match.opponentPlayerId,
      },
      playerSide:
        match.trackedPlayerId === playerId ? ('tracked' as const) : ('opponent' as const),
      insights: calculateLocalInsights(match),
    }))
    .sort((left, right) =>
      left.match.matchDate.localeCompare(right.match.matchDate) ||
      left.match.id.localeCompare(right.match.id),
    );
}
