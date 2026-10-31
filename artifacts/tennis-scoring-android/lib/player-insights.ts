import {
  RALLY_LENGTH_OPTIONS,
  SHOT_DIRECTION_OPTIONS,
  STROKE_TYPE_OPTIONS,
  type LocalContextInsight,
  type LocalSetInsights,
  type PointCode,
  type PlayerSide,
  type LocalMatchOutcome,
  type RallyLength,
  type ServiceGameStats,
  type ServeSideStats,
  type LocalInsights,
  type LocalStrokeTally,
  type ShotDirection,
  type StrokeType,
  BreakPointStats,
  type LocalPlayerMatchInsight,
} from '@/lib/local-matches';

const shotCodes = ['A', 'F', 'B', 'V', 'O', 'P'] as const satisfies readonly PointCode[];
type ShotCode = (typeof shotCodes)[number];

function isShotCode(code: PointCode): code is ShotCode {
  return (shotCodes as readonly PointCode[]).includes(code);
}

function isShotInsight(
  insight: PlayerCodeInsight,
): insight is PlayerCodeInsight & { code: ShotCode } {
  return isShotCode(insight.code);
}

const shotLabels: Record<ShotCode, string> = {
  A: 'aces',
  F: 'forehand winners',
  B: 'backhand winners',
  V: 'net volleys',
  O: 'overheads',
  P: 'drop shots',
};

export interface PlayerCodeInsight {
  code: PointCode;
  count: number;
  trackedWon: number;
  trackedWinPercent: number;
  sharePercent: number;
}

export interface SetPerformanceMetric {
  count: number | null;
  total: number;
  percent: number | null;
}

export interface PlayerSetPerformance {
  setNumber: number;
  isComplete: boolean;
  pointCount: number;
  firstServeIn: SetPerformanceMetric;
  secondServeIn: SetPerformanceMetric;
  rallyWinners: SetPerformanceMetric;
  aces: number | null;
  trackedServicePoints: number;
  unforcedErrors: SetPerformanceMetric;
}

export interface PlayerPerformanceSummary {
  overallWinPercent: number | null;
  serviceWinPercent: number | null;
  returnWinPercent: number | null;
  firstServeFaultPercent: number | null;
  firstServeInPercent: number | null;
  secondServeInPercent: number | null;
  secondServeInCount: number;
  secondServeAttemptCount: number;
  firstServePointsWonPercent: number | null;
  secondServePointsWonPercent: number | null;
  rallyWinnerCount: number;
  rallyWinnerPercent: number | null;
  opponentRallyWinnerCount: number;
  opponentRallyWinnerPercent: number | null;
  rallyWinnerTagCount: number;
  trackedUnforcedErrors: number;
  opponentUnforcedErrors: number;
  unforcedErrorTagCount: number;
  acesPerServiceGame: number | null;
  acesPerSet: number | null;
  acesPerMatch: number | null;
  setsWithRecordedPoints: number;
  setBreakdown: PlayerSetPerformance[];
  matchesInSample: number;
  shotTagCount: number;
  taggedPointCount: number;
  codeInsights: PlayerCodeInsight[];
  shotDirectionTaggedCount: number;
  rallyLengthTaggedCount: number;
  shotDirections: ContextPerformanceInsight<ShotDirection>[];
  rallyLengths: ContextPerformanceInsight<RallyLength>[];
  feedback: string[];
}

export interface ContextPerformanceInsight<T extends string> {
  value: T;
  label: string;
  count: number;
  trackedWon: number;
  trackedWinPercent: number | null;
}

export interface PlayerReportInsights {
  pointCount: number;
  trackedPointsWon: number;
  servicePointsWon: number;
  trackedServicePoints: number;
  returnPointsWon: number;
  trackedReturnPoints: number;
  trackedFirstServeFaults: number;
  codes: {
    code: string;
    count: number;
    trackedWon: number;
    opponentWon: number;
  }[];
  serveStats: Record<'tracked' | 'opponent', ServeSideStats>;
  breakPoints: Record<'tracked' | 'opponent', BreakPointStats>;
  serviceGames: Record<'tracked' | 'opponent', ServiceGameStats>;
  shotDirections: LocalContextInsight<ShotDirection>[];
  rallyLengths: LocalContextInsight<RallyLength>[];
  sets: LocalSetInsights[];
  strokeTallies: LocalStrokeTally[];
  strokeNotes: LocalInsights['strokeNotes'];
}

export const PLAYER_TREND_METRICS = [
  { key: 'overall', label: 'Points won' },
  { key: 'service', label: 'Service points won' },
  { key: 'return', label: 'Return points won' },
  { key: 'firstServe', label: '1st-serve points won' },
  { key: 'secondServe', label: '2nd-serve points won' },
] as const;

export type PlayerTrendMetricKey = (typeof PLAYER_TREND_METRICS)[number]['key'];

export interface PlayerTrendMetricValue {
  percent: number | null;
  won: number;
  total: number;
  countLabel: string;
}

export interface PlayerTrendMetricSummary extends PlayerTrendMetricValue {
  matchCount: number;
  sampledMatchCount: number;
}

export interface PlayerTrendMatch {
  id: string;
  date: string;
  event: string | null;
  round: string | null;
  trackedPlayer: string;
  opponent: string;
  status: 'in_progress' | 'complete';
  result: 'win' | 'loss' | 'no_winner' | null;
  outcomeType: 'ordinary' | 'retirement' | 'walkover' | null;
  metrics: Record<PlayerTrendMetricKey, PlayerTrendMetricValue>;
}

export interface PlayerMatchOutcomeRecord {
  status: 'in_progress' | 'complete';
  result: 'win' | 'loss' | 'no_winner' | null;
  outcomeType: 'ordinary' | 'retirement' | 'walkover' | null;
}

export interface PlayerMatchOutcomeCategory {
  count: number;
  wins: number;
  losses: number;
  noWinner: number;
}

export interface PlayerMatchOutcomeSummary {
  ordinary: PlayerMatchOutcomeCategory;
  retirements: PlayerMatchOutcomeCategory;
  walkovers: PlayerMatchOutcomeCategory;
  inProgress: number;
}

function summarizeOutcomeCategory(
  records: readonly PlayerMatchOutcomeRecord[],
  outcomeType: 'ordinary' | 'retirement' | 'walkover',
): PlayerMatchOutcomeCategory {
  const matches = records.filter(
    (record) =>
      record.status === 'complete' &&
      (record.outcomeType ?? 'ordinary') === outcomeType,
  );
  return {
    count: matches.length,
    wins: matches.filter((match) => match.result === 'win').length,
    losses: matches.filter((match) => match.result === 'loss').length,
    noWinner: matches.filter((match) => match.result === 'no_winner').length,
  };
}

export function summarizePlayerMatchOutcomes(
  records: readonly PlayerMatchOutcomeRecord[],
): PlayerMatchOutcomeSummary {
  return {
    ordinary: summarizeOutcomeCategory(records, 'ordinary'),
    retirements: summarizeOutcomeCategory(records, 'retirement'),
    walkovers: summarizeOutcomeCategory(records, 'walkover'),
    inProgress: records.filter((record) => record.status === 'in_progress').length,
  };
}

export function formatPlayerMatchOutcomeSummary(
  summary: PlayerMatchOutcomeSummary,
): string {
  const formatCategory = (label: string, category: PlayerMatchOutcomeCategory) =>
    `${label} ${category.count} (${category.wins}–${category.losses})${
      category.noWinner > 0 ? ` · ${category.noWinner} without a clear winner` : ''
    }`;
  return [
    formatCategory('Ordinary', summary.ordinary),
    formatCategory('Retirements', summary.retirements),
    formatCategory('Walkovers', summary.walkovers),
  ].join(' · ');
}

export function isValidPlayerTrendDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function filterPlayerTrendMatchesByDateRange(
  matches: readonly PlayerTrendMatch[],
  startDate?: string | null,
  endDate?: string | null,
): PlayerTrendMatch[] {
  const start = startDate?.trim() ?? '';
  const end = endDate?.trim() ?? '';
  if (
    (start && !isValidPlayerTrendDate(start)) ||
    (end && !isValidPlayerTrendDate(end)) ||
    (start && end && start > end)
  ) {
    return [];
  }
  if (!start && !end) return [...matches];

  return matches.filter((match) => {
    const date = match.date.slice(0, 10);
    if (!isValidPlayerTrendDate(date)) return false;
    return (!start || date >= start) && (!end || date <= end);
  });
}

export function buildPlayerPerformanceHistory(
  records: readonly LocalPlayerMatchInsight[],
): PlayerTrendMatch[] {
  return records.map(({ match, playerSide, insights }) => {
    const playerWon =
      playerSide === 'tracked'
        ? insights.trackedPointsWon
        : insights.opponentPointsWon;
    const serve = insights.serveStats[playerSide];
    const returnPoints = Math.max(0, insights.pointCount - serve.servicePoints);
    const returnPointsWon = Math.max(0, playerWon - serve.servicePointsWon);

    const values: Record<
      PlayerTrendMetricKey,
      { won: number; total: number; countLabel: string }
    > = {
      overall: {
        won: playerWon,
        total: insights.pointCount,
        countLabel: 'points',
      },
      service: {
        won: serve.servicePointsWon,
        total: serve.servicePoints,
        countLabel: 'service points',
      },
      return: {
        won: returnPointsWon,
        total: returnPoints,
        countLabel: 'return points',
      },
      firstServe: {
        won: serve.firstServePointsWon,
        total: serve.firstServePoints,
        countLabel: 'first-serve points',
      },
      secondServe: {
        won: serve.secondServePointsWon,
        total: serve.secondServePoints,
        countLabel: 'second-serve points',
      },
    };

    const metrics = Object.fromEntries(
      PLAYER_TREND_METRICS.map(({ key }) => {
        const value = values[key];
        return [
          key,
          {
            ...value,
            percent: percent(value.won, value.total),
          },
        ];
      }),
    ) as Record<PlayerTrendMetricKey, PlayerTrendMetricValue>;
    const result: PlayerTrendMatch['result'] =
      match.matchStatus !== 'complete'
        ? null
        : match.winner === null
          ? 'no_winner'
          : match.winner === playerSide
            ? 'win'
            : 'loss';
    const outcomeType: PlayerTrendMatch['outcomeType'] =
      match.matchStatus !== 'complete'
        ? null
        : match.matchOutcome?.reason ?? 'ordinary';

    return {
      id: match.id,
      date: match.matchDate,
      event: match.event,
      round: match.round,
      trackedPlayer:
        playerSide === 'tracked' ? match.trackedPlayer : match.opponent,
      opponent:
        playerSide === 'tracked' ? match.opponent : match.trackedPlayer,
      status: match.matchStatus,
      result,
      outcomeType,
      metrics,
    };
  }).sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
}

export function summarizePlayerTrendMetric(
  matches: readonly PlayerTrendMatch[],
  metric: PlayerTrendMetricKey,
): PlayerTrendMetricSummary {
  const countLabels: Record<PlayerTrendMetricKey, string> = {
    overall: 'points',
    service: 'service points',
    return: 'return points',
    firstServe: 'first-serve points',
    secondServe: 'second-serve points',
  };
  const values = matches.map((match) => match.metrics[metric]);
  const won = values.reduce((total, value) => total + value.won, 0);
  const total = values.reduce((sum, value) => sum + value.total, 0);
  return {
    percent: percent(won, total),
    won,
    total,
    countLabel: values[0]?.countLabel ?? countLabels[metric],
    matchCount: matches.length,
    sampledMatchCount: values.filter((value) => value.total > 0).length,
  };
}

const unevenSampleRatio = 2;
const unevenSampleMinimumDifference = 10;

export function getPlayerTrendComparisonSampleNotice(
  primaryName: string,
  primary: PlayerTrendMetricSummary,
  comparisonName: string,
  comparison: PlayerTrendMetricSummary,
): string | null {
  if (primary.total === 0 && comparison.total === 0) {
    return `No ${primary.countLabel} were recorded for either player (0 attempts each); both percentages are unavailable.`;
  }
  if (primary.total === 0) {
    return `No ${primary.countLabel} were recorded for ${primaryName} (0 attempts), so that percentage is unavailable. ${comparisonName} has ${comparison.total} recorded ${comparison.countLabel}.`;
  }
  if (comparison.total === 0) {
    return `No ${comparison.countLabel} were recorded for ${comparisonName} (0 attempts), so that percentage is unavailable. ${primaryName} has ${primary.total} recorded ${primary.countLabel}.`;
  }

  const largerSample = Math.max(primary.total, comparison.total);
  const smallerSample = Math.min(primary.total, comparison.total);
  if (
    largerSample / smallerSample < unevenSampleRatio ||
    largerSample - smallerSample < unevenSampleMinimumDifference
  ) {
    return null;
  }

  return `Uneven sample sizes for ${primary.countLabel}: ${primaryName} has ${primary.total} attempts and ${comparisonName} has ${comparison.total}. These percentages use different numbers of recorded attempts.`;
}

const allPointCodes: PointCode[] = [...shotCodes, 'N', 'L', 'W', 'D', 'FE'];
export const BREAK_POINT_DIRECTIONAL_SAMPLE_THRESHOLD = 5;

function isPointCode(value: string): value is PointCode {
  return allPointCodes.includes(value as PointCode);
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function breakPointFeedback(
  kind: 'conversion' | 'saving',
  successful: number,
  total: number,
): string | null {
  const successPercent = percent(successful, total);
  if (successPercent === null) return null;

  const detail =
    kind === 'conversion'
      ? `converted ${successful} of ${total} break-point chances`
      : `saved ${successful} of ${total} break points faced`;
  if (total < BREAK_POINT_DIRECTIONAL_SAMPLE_THRESHOLD) {
    return `Directional only, not conclusive: the tracked player ${detail} (${successPercent}%).`;
  }

  if (kind === 'conversion') {
    if (successPercent >= 50) {
      return `Break-point conversion was a strength in this sample: the tracked player ${detail} (${successPercent}%).`;
    }
    if (successPercent <= 35) {
      return `Break-point conversion is an area to work on: the tracked player ${detail} (${successPercent}%).`;
    }
    return `Break-point conversion was mixed in this sample: the tracked player ${detail} (${successPercent}%).`;
  }

  if (successPercent >= 60) {
    return `Break-point defense was a strength in this sample: the tracked player ${detail} (${successPercent}%).`;
  }
  if (successPercent <= 40) {
    return `Break-point defense is an area to work on: the tracked player ${detail} (${successPercent}%).`;
  }
  return `Break-point defense was mixed in this sample: the tracked player ${detail} (${successPercent}%).`;
}

function opponentBreakPointFeedback(
  opportunities: number,
  converted: number,
  faced: number,
  saved: number,
): string | null {
  const details: string[] = [];
  const sampleSizes: number[] = [];
  const conversionPercent = percent(converted, opportunities);
  const savedPercent = percent(saved, faced);

  if (conversionPercent !== null) {
    details.push(
      `converted ${converted} of ${opportunities} break-point chances (${conversionPercent}%)`,
    );
    sampleSizes.push(opportunities);
  }
  if (savedPercent !== null) {
    details.push(
      `saved ${saved} of ${faced} break points faced (${savedPercent}%)`,
    );
    sampleSizes.push(faced);
  }
  if (details.length === 0) return null;

  const pattern = `the opponent ${details.join(' and ')}`;
  if (
    sampleSizes.some(
      (sampleSize) => sampleSize < BREAK_POINT_DIRECTIONAL_SAMPLE_THRESHOLD,
    )
  ) {
    return `Directional only, not conclusive: ${pattern}.`;
  }
  return `Opponent break-point pattern: ${pattern}.`;
}

function summarizeContext<T extends string>(
  options: readonly { value: T; label: string }[],
  records: readonly LocalContextInsight<T>[],
): ContextPerformanceInsight<T>[] {
  const byValue = new Map(records.map((record) => [record.value, record]));
  return options.map((option) => {
    const record = byValue.get(option.value);
    const count = record?.count ?? 0;
    const trackedWon = record?.trackedWon ?? 0;
    return {
      ...option,
      count,
      trackedWon,
      trackedWinPercent: count >= 3 ? percent(trackedWon, count) : null,
    };
  });
}

export function summarizePlayerPerformance(
  insights: PlayerReportInsights,
  matchesInSample = 1,
): PlayerPerformanceSummary {
  const overallWinPercent = percent(
    insights.trackedPointsWon,
    insights.pointCount,
  );
  const serviceWinPercent = percent(
    insights.servicePointsWon,
    insights.trackedServicePoints,
  );
  const returnWinPercent = percent(
    insights.returnPointsWon,
    insights.trackedReturnPoints,
  );
  const firstServeFaultPercent = percent(
    insights.trackedFirstServeFaults,
    insights.trackedServicePoints,
  );
  const trackedServeStats = insights.serveStats.tracked;
  const firstServeInPercent = percent(
    trackedServeStats.firstServePoints,
    trackedServeStats.servicePoints,
  );
  const secondServeInCount = Math.max(
    0,
    trackedServeStats.secondServePoints - trackedServeStats.doubleFaults,
  );
  const secondServeInPercent = percent(
    secondServeInCount,
    trackedServeStats.secondServePoints,
  );
  const firstServePointsWonPercent = percent(
    trackedServeStats.firstServePointsWon,
    trackedServeStats.firstServePoints,
  );
  const secondServePointsWonPercent = percent(
    trackedServeStats.secondServePointsWon,
    trackedServeStats.secondServePoints,
  );

  const validCodes = insights.codes
    .filter((item) => isPointCode(item.code))
    .map((item) => ({ ...item, code: item.code as PointCode }));
  const taggedPointCount = validCodes.reduce(
    (total, item) => total + item.count,
    0,
  );
  const shotTagCount = validCodes.reduce(
    (total, item) => total + (isShotCode(item.code) ? item.count : 0),
    0,
  );
  const codeInsights = validCodes
    .map((item) => ({
      code: item.code,
      count: item.count,
      trackedWon: item.trackedWon,
      trackedWinPercent: percent(item.trackedWon, item.count) ?? 0,
      sharePercent: percent(item.count, taggedPointCount) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.code.localeCompare(b.code),
    );
  const rallyWinnerCodes: readonly PointCode[] = ['F', 'B', 'V', 'O', 'P'];
  const rallyWinnerTagCount = validCodes.reduce(
    (total, item) =>
      total + (rallyWinnerCodes.includes(item.code) ? item.count : 0),
    0,
  );
  const rallyWinnerCount = validCodes.reduce(
    (total, item) =>
      total + (rallyWinnerCodes.includes(item.code) ? item.trackedWon : 0),
    0,
  );
  const opponentRallyWinnerCount = validCodes.reduce(
    (total, item) =>
      total + (rallyWinnerCodes.includes(item.code) ? item.opponentWon : 0),
    0,
  );
  const unforcedErrorCodes: readonly PointCode[] = ['N', 'L', 'W'];
  const unforcedErrorTagCount = validCodes.reduce(
    (total, item) =>
      total + (unforcedErrorCodes.includes(item.code) ? item.count : 0),
    0,
  );
  const trackedUnforcedErrors = validCodes.reduce(
    (total, item) =>
      total + (unforcedErrorCodes.includes(item.code) ? item.opponentWon : 0),
    0,
  );
  const opponentUnforcedErrors = validCodes.reduce(
    (total, item) =>
      total + (unforcedErrorCodes.includes(item.code) ? item.trackedWon : 0),
    0,
  );
  const setsWithRecordedPoints = insights.sets.filter(
    (set) => set.pointCount > 0,
  ).length;
  const setBreakdown = insights.sets.map((set) => {
    const trackedSetServeStats = set.serveStats?.tracked;
    const setCodes = (set.codes ?? []).filter((item) => isPointCode(item.code));
    const rallyWinnerCodes: readonly PointCode[] = ['F', 'B', 'V', 'O', 'P'];
    const rallyWinnerTagCount = setCodes.reduce(
      (total, item) =>
        total + (rallyWinnerCodes.includes(item.code) ? item.count : 0),
      0,
    );
    const trackedRallyWinnerCount = setCodes.reduce(
      (total, item) =>
        total +
        (rallyWinnerCodes.includes(item.code) ? item.trackedWon : 0),
      0,
    );
    const unforcedErrorCodes: readonly PointCode[] = ['N', 'L', 'W'];
    const unforcedErrorTagCount = setCodes.reduce(
      (total, item) =>
        total + (unforcedErrorCodes.includes(item.code) ? item.count : 0),
      0,
    );
    const trackedUnforcedErrorCount = setCodes.reduce(
      (total, item) =>
        total +
        (unforcedErrorCodes.includes(item.code) ? item.opponentWon : 0),
      0,
    );
    const servicePointCount = trackedSetServeStats?.servicePoints ?? 0;
    const secondServeAttemptCount =
      trackedSetServeStats?.secondServePoints ?? 0;
    const secondServeInCount = Math.max(
      0,
      secondServeAttemptCount - (trackedSetServeStats?.doubleFaults ?? 0),
    );

    return {
      setNumber: set.setNumber,
      isComplete: set.isComplete,
      pointCount: set.pointCount,
      firstServeIn: {
        count:
          servicePointCount > 0
            ? (trackedSetServeStats?.firstServePoints ?? 0)
            : null,
        total: servicePointCount,
        percent: percent(
          trackedSetServeStats?.firstServePoints ?? 0,
          servicePointCount,
        ),
      },
      secondServeIn: {
        count: secondServeAttemptCount > 0 ? secondServeInCount : null,
        total: secondServeAttemptCount,
        percent: percent(secondServeInCount, secondServeAttemptCount),
      },
      rallyWinners: {
        count: rallyWinnerTagCount > 0 ? trackedRallyWinnerCount : null,
        total: rallyWinnerTagCount,
        percent: percent(trackedRallyWinnerCount, rallyWinnerTagCount),
      },
      aces:
        servicePointCount > 0
          ? (trackedSetServeStats?.aces ?? 0)
          : null,
      trackedServicePoints:
        trackedSetServeStats?.servicePoints ?? set.trackedServicePoints,
      unforcedErrors: {
        count:
          unforcedErrorTagCount > 0 ? trackedUnforcedErrorCount : null,
        total: unforcedErrorTagCount,
        percent: percent(
          trackedUnforcedErrorCount,
          unforcedErrorTagCount,
        ),
      },
    };
  });
  const aces = trackedServeStats.aces;
  const acesPerServiceGame =
    insights.serviceGames.tracked.gamesPlayed > 0
      ? aces / insights.serviceGames.tracked.gamesPlayed
      : null;
  const acesPerSet =
    setsWithRecordedPoints > 0 ? aces / setsWithRecordedPoints : null;
  const acesPerMatch =
    matchesInSample > 0 && insights.pointCount > 0
      ? aces / matchesInSample
      : null;

  const shotDirections = summarizeContext(
    SHOT_DIRECTION_OPTIONS,
    insights.shotDirections ?? [],
  );
  const rallyLengths = summarizeContext(
    RALLY_LENGTH_OPTIONS,
    insights.rallyLengths ?? [],
  );
  const shotDirectionTaggedCount = shotDirections.reduce(
    (total, item) => total + item.count,
    0,
  );
  const rallyLengthTaggedCount = rallyLengths.reduce(
    (total, item) => total + item.count,
    0,
  );

  const breakPointFeedbackItems = [
    breakPointFeedback(
      'conversion',
      insights.breakPoints.tracked.converted,
      insights.breakPoints.tracked.opportunities,
    ),
    breakPointFeedback(
      'saving',
      insights.breakPoints.tracked.saved,
      insights.breakPoints.tracked.faced,
    ),
    opponentBreakPointFeedback(
      insights.breakPoints.opponent.opportunities,
      insights.breakPoints.opponent.converted,
      insights.breakPoints.opponent.faced,
      insights.breakPoints.opponent.saved,
    ),
  ].filter((item): item is string => item !== null);
  const feedback: string[] = [];
  const shotFeedback: string[] = [];

  if (insights.pointCount === 0) {
    feedback.push('Record points to build a player performance report.');
  } else if (insights.pointCount < 8) {
    feedback.push(
      `Early read: only ${insights.pointCount} points are recorded. Treat these percentages as directional.`,
    );
  } else if (overallWinPercent !== null) {
    if (overallWinPercent >= 55) {
      feedback.push(
        `Point control is a positive signal: the tracked player won ${overallWinPercent}% of recorded points.`,
      );
    } else if (overallWinPercent <= 45) {
      feedback.push(
        `Point conversion is an opportunity: the tracked player won ${overallWinPercent}% of recorded points.`,
      );
    } else {
      feedback.push(
        `Point results are close at ${overallWinPercent}% won. Small serve or return gains could shift the balance.`,
      );
    }
  }

  if (insights.trackedServicePoints >= 5 && serviceWinPercent !== null) {
    if (serviceWinPercent < 45) {
      feedback.push(
        `On serve, ${serviceWinPercent}% of tracked-player service points were won; review the first ball and serve patterns.`,
      );
    } else if (serviceWinPercent >= 60) {
      feedback.push(
        `Serve performance is a strength in this sample: ${serviceWinPercent}% of service points won.`,
      );
    }
  }

  if (insights.trackedReturnPoints >= 5 && returnWinPercent !== null) {
    if (returnWinPercent < 35) {
      feedback.push(
        `On return, ${returnWinPercent}% of tracked-player return points were won; focus practice on starting rallies from the return.`,
      );
    } else if (returnWinPercent >= 55) {
      feedback.push(
        `Return performance is positive in this sample: ${returnWinPercent}% of return points won.`,
      );
    }
  }

  if (
    insights.trackedServicePoints >= 5 &&
    firstServeFaultPercent !== null &&
    firstServeFaultPercent >= 25
  ) {
    feedback.push(
      `${firstServeFaultPercent}% of tracked-player service points were marked with a first-serve fault; work on a repeatable first-serve routine.`,
    );
  }

  if (
    trackedServeStats.firstServePoints >= 5 &&
    trackedServeStats.secondServePoints >= 5 &&
    firstServePointsWonPercent !== null &&
    secondServePointsWonPercent !== null &&
    firstServePointsWonPercent - secondServePointsWonPercent >= 15
  ) {
    feedback.push(
      `The tracked player won ${firstServePointsWonPercent}% of first-serve points and ${secondServePointsWonPercent}% of second-serve points; the second-serve gap is worth reviewing in practice.`,
    );
  }

  const shotInsights = codeInsights.filter(isShotInsight);
  const reliableShotSamples = shotInsights.filter((item) => item.count >= 3);
  if (reliableShotSamples.length > 0) {
    const strongest = [...reliableShotSamples].sort(
      (a, b) =>
        b.trackedWinPercent - a.trackedWinPercent || b.count - a.count,
    )[0];
    shotFeedback.push(
      `Among winning-shot tags with at least 3 records, ${shotLabels[strongest.code]} had the highest tracked-player point-win rate at ${strongest.trackedWinPercent}% (${strongest.trackedWon}/${strongest.count}).`,
    );
  } else if (shotTagCount > 0) {
    shotFeedback.push(
      `Only ${shotTagCount} shot tags are recorded so far. Add more tags for useful shot-by-shot feedback.`,
    );
  } else {
    shotFeedback.push(
      'Shot feedback is not available yet. Add a winning-shot tag when recording points.',
    );
  }

  return {
    overallWinPercent,
    serviceWinPercent,
    returnWinPercent,
    firstServeFaultPercent,
    firstServeInPercent,
    secondServeInPercent,
    secondServeInCount,
    secondServeAttemptCount: trackedServeStats.secondServePoints,
    firstServePointsWonPercent,
    secondServePointsWonPercent,
    rallyWinnerCount,
    rallyWinnerPercent:
      rallyWinnerTagCount > 0
        ? percent(rallyWinnerCount, insights.pointCount)
        : null,
    opponentRallyWinnerCount,
    opponentRallyWinnerPercent:
      rallyWinnerTagCount > 0
        ? percent(opponentRallyWinnerCount, insights.pointCount)
        : null,
    rallyWinnerTagCount,
    trackedUnforcedErrors,
    opponentUnforcedErrors,
    unforcedErrorTagCount,
    acesPerServiceGame,
    acesPerSet,
    acesPerMatch,
    setsWithRecordedPoints,
    setBreakdown,
    matchesInSample,
    shotTagCount,
    taggedPointCount,
    codeInsights,
    shotDirectionTaggedCount,
    rallyLengthTaggedCount,
    shotDirections,
    rallyLengths,
    feedback: [
      ...breakPointFeedbackItems,
      ...feedback.slice(0, 2),
      ...shotFeedback,
    ].slice(0, 6),
  };
}

export type MatchNoteThemeId =
  | 'serve-return'
  | 'movement'
  | 'mental'
  | 'tactics'
  | 'stroke'
  | 'general';

export interface MatchNoteObservation {
  context: string;
  text: string;
}

export interface MatchNoteThemeSummary {
  id: MatchNoteThemeId;
  label: string;
  observationCount: number;
  observations: MatchNoteObservation[];
  relatedStats: string[];
  reviewQuestion: string;
}

interface IndexedMatchNote extends MatchNoteObservation {
  themeId: MatchNoteThemeId;
  setNumber: number;
  gameNumber: number;
  pointNumber: number;
  order: number;
  strokeType?: StrokeType;
  player?: 'tracked' | 'opponent';
}

const matchNoteThemeDefinitions: Record<
  MatchNoteThemeId,
  { label: string; reviewQuestion: string }
> = {
  'serve-return': {
    label: 'Serve and return',
    reviewQuestion:
      'Compare these notes with the recorded serve and return outcomes. Those rates show results, not why they happened.',
  },
  movement: {
    label: 'Movement and court coverage',
    reviewQuestion:
      'Compare these notes with rally-length and point outcomes; movement itself was not directly measured.',
  },
  mental: {
    label: 'Focus and composure',
    reviewQuestion:
      'Review these notes beside any break-point results; the statistics do not measure confidence or focus.',
  },
  tactics: {
    label: 'Tactics and patterns',
    reviewQuestion:
      'Compare these notes with shot-direction and rally-length results; these match-wide samples do not prove a tactic caused an outcome.',
  },
  stroke: {
    label: 'Stroke execution',
    reviewQuestion:
      'Compare these notes with recorded stroke or point-ending counts; the counts do not explain the cause.',
  },
  general: {
    label: 'Other observations',
    reviewQuestion:
      'Use these notes as prompts for video or coach review; the score log alone cannot establish why an event occurred.',
  },
};

function classifyMatchNote(text: string): MatchNoteThemeId {
  const value = text.toLocaleLowerCase();
  if (/\b(serve|serving|return|ace|double fault)\b/.test(value)) {
    return 'serve-return';
  }
  if (
    /\b(footwork|movement|moved|move|recover|recovery|split step|balance|court coverage|positioning)\b/.test(
      value,
    )
  ) {
    return 'movement';
  }
  if (
    /\b(focus|pressure|confidence|confident|calm|composure|composed|nerves|nervous|frustration|patient|patience|mental|body language|routine)\b/.test(
      value,
    )
  ) {
    return 'mental';
  }
  if (
    /\b(tactic|tactics|strategy|pattern|target|depth|rally|attack|defend|construction|cross.court|down the line|middle)\b/.test(
      value,
    )
  ) {
    return 'tactics';
  }
  if (
    /\b(forehand|backhand|volley|overhead|smash|drop shot|slice|drive|stroke|swing|contact|topspin|lob|passing shot)\b/.test(
      value,
    )
  ) {
    return 'stroke';
  }
  return 'general';
}

function formatMatchEvidenceRate(
  label: string,
  successful: number,
  total: number,
): string | null {
  if (total <= 0) return null;
  return `${label}: ${successful}/${total} (${Math.round((successful / total) * 100)}%).`;
}

function matchNoteRelatedStats(
  themeId: MatchNoteThemeId,
  observations: readonly IndexedMatchNote[],
  insights: PlayerReportInsights,
): string[] {
  const evidence: string[] = [];
  const trackedServe = insights.serveStats.tracked;
  const addRate = (
    label: string,
    successful: number,
    total: number,
  ) => {
    const value = formatMatchEvidenceRate(label, successful, total);
    if (value) evidence.push(value);
  };

  if (themeId === 'serve-return') {
    addRate(
      'Tracked-player first serves in',
      trackedServe.firstServePoints,
      trackedServe.servicePoints,
    );
    addRate(
      'Tracked-player first-serve points won',
      trackedServe.firstServePointsWon,
      trackedServe.firstServePoints,
    );
    addRate(
      'Tracked-player second-serve points won',
      trackedServe.secondServePointsWon,
      trackedServe.secondServePoints,
    );
    addRate(
      'Tracked-player return points won',
      insights.returnPointsWon,
      insights.trackedReturnPoints,
    );
  } else if (themeId === 'movement') {
    for (const option of RALLY_LENGTH_OPTIONS) {
      const sample = insights.rallyLengths.find(
        (item) => item.value === option.value,
      );
      if (!sample?.count) continue;
      addRate(
        `Tracked-player points won in ${option.label} rallies`,
        sample.trackedWon,
        sample.count,
      );
    }
  } else if (themeId === 'mental') {
    const breakPoints = insights.breakPoints.tracked;
    addRate(
      'Tracked-player break points converted',
      breakPoints.converted,
      breakPoints.opportunities,
    );
    addRate(
      'Tracked-player break points saved',
      breakPoints.saved,
      breakPoints.faced,
    );
  } else if (themeId === 'tactics') {
    for (const option of SHOT_DIRECTION_OPTIONS) {
      const sample = insights.shotDirections.find(
        (item) => item.value === option.value,
      );
      if (!sample?.count) continue;
      addRate(
        `Tracked-player points won after ${option.label.toLocaleLowerCase()} tags`,
        sample.trackedWon,
        sample.count,
      );
    }
    for (const option of RALLY_LENGTH_OPTIONS) {
      const sample = insights.rallyLengths.find(
        (item) => item.value === option.value,
      );
      if (!sample?.count) continue;
      addRate(
        `Tracked-player points won in ${option.label} rallies`,
        sample.trackedWon,
        sample.count,
      );
    }
  } else if (themeId === 'stroke') {
    const strokeSubjects = new Map<StrokeType, Set<'tracked' | 'opponent'>>();
    for (const observation of observations) {
      if (!observation.strokeType) continue;
      const subjects = strokeSubjects.get(observation.strokeType) ?? new Set();
      subjects.add(observation.player ?? 'tracked');
      strokeSubjects.set(observation.strokeType, subjects);
    }
    for (const [strokeType, subjects] of strokeSubjects) {
      const label =
        STROKE_TYPE_OPTIONS.find((option) => option.value === strokeType)?.label ??
        strokeType;
      for (const player of subjects) {
        const tally = insights.strokeTallies.find(
          (item) => item.strokeType === strokeType && item.player === player,
        );
        if (!tally?.sampleCount) continue;
        const playerLabel = player === 'tracked' ? 'Tracked player' : 'Opponent';
        evidence.push(
          `${playerLabel} ${label.toLocaleLowerCase()} strokes: ${tally.sampleCount} recorded (${tally.winners} winners, ${tally.errors} errors, ${tally.inPlay} in play).`,
        );
      }
    }
  }

  if (
    !evidence.length &&
    themeId === 'general' &&
    insights.pointCount > 0
  ) {
    addRate(
      'Tracked-player points won in the match',
      insights.trackedPointsWon,
      insights.pointCount,
    );
  }
  return evidence.length
    ? evidence.slice(0, 4)
    : ['No directly related match statistic was recorded.'];
}

export function summarizeMatchNotes(
  insights: PlayerReportInsights,
): MatchNoteThemeSummary[] {
  const observations: IndexedMatchNote[] = [];
  let order = 0;
  const add = (
    setNumber: number,
    gameNumber: number,
    pointNumber: number,
    context: string,
    text: string,
    options: {
      themeId?: MatchNoteThemeId;
      strokeType?: StrokeType;
      player?: 'tracked' | 'opponent';
    } = {},
  ) => {
    const normalizedText = text.trim();
    if (!normalizedText) return;
    const classifierText = options.strokeType
      ? `${options.strokeType.replace(/_/g, ' ')} ${normalizedText}`
      : normalizedText;
    observations.push({
      themeId: options.themeId ?? classifyMatchNote(classifierText),
      setNumber,
      gameNumber,
      pointNumber,
      order,
      context,
      text: normalizedText,
      strokeType: options.strokeType,
      player: options.player,
    });
    order += 1;
  };

  for (const note of insights.strokeNotes) {
    const strokeLabel =
      STROKE_TYPE_OPTIONS.find((option) => option.value === note.strokeType)
        ?.label ?? note.strokeType;
    add(
      note.setNumber,
      note.gameNumber,
      note.sequenceNumber,
      `Set ${note.setNumber} · Game ${note.gameNumber} · Point ${note.sequenceNumber} · ${note.player === 'tracked' ? 'Tracked player' : 'Opponent'} · ${strokeLabel}`,
      note.note,
      { strokeType: note.strokeType, player: note.player },
    );
  }

  for (const set of insights.sets) {
    for (const note of set.gameNotes) {
      add(
        set.setNumber,
        note.gameNumber,
        0,
        `Set ${set.setNumber} · Game ${note.gameNumber}`,
        note.note,
      );
    }

    const review = set.review;
    for (const [strokeType, rating] of Object.entries(review.strokeRatings)) {
      const typedStroke = strokeType as StrokeType;
      const strokeLabel =
        STROKE_TYPE_OPTIONS.find((option) => option.value === typedStroke)
          ?.label ?? strokeType;
      const note = review.strokeNotes[typedStroke]?.trim();
      add(
        set.setNumber,
        0,
        0,
        `Set ${set.setNumber} · Stroke rating · ${strokeLabel}`,
        `Self-rating ${rating}/5${note ? ` · ${note}` : ''}`,
        { themeId: 'stroke', strokeType: typedStroke, player: 'tracked' },
      );
    }
    for (const [strokeType, note] of Object.entries(review.strokeNotes)) {
      if (review.strokeRatings[strokeType as StrokeType]) continue;
      const typedStroke = strokeType as StrokeType;
      const strokeLabel =
        STROKE_TYPE_OPTIONS.find((option) => option.value === typedStroke)
          ?.label ?? strokeType;
      add(
        set.setNumber,
        0,
        0,
        `Set ${set.setNumber} · Stroke note · ${strokeLabel}`,
        note,
        { themeId: 'stroke', strokeType: typedStroke, player: 'tracked' },
      );
    }
    add(
      set.setNumber,
      0,
      0,
      `Set ${set.setNumber} · Footwork and court coverage`,
      review.footworkNote,
      { themeId: 'movement' },
    );
    add(
      set.setNumber,
      0,
      0,
      `Set ${set.setNumber} · Tactical adjustments`,
      review.tacticalNote,
      { themeId: 'tactics' },
    );
    add(
      set.setNumber,
      0,
      0,
      `Set ${set.setNumber} · Mental review`,
      review.mentalNote,
      { themeId: 'mental' },
    );
  }

  const grouped = new Map<MatchNoteThemeId, IndexedMatchNote[]>();
  for (const observation of observations) {
    const group = grouped.get(observation.themeId) ?? [];
    group.push(observation);
    grouped.set(observation.themeId, group);
  }

  const themeOrder: MatchNoteThemeId[] = [
    'serve-return',
    'movement',
    'mental',
    'tactics',
    'stroke',
    'general',
  ];
  return themeOrder.flatMap((id) => {
    const group = grouped.get(id);
    if (!group?.length) return [];
    const ordered = [...group].sort(
      (left, right) =>
        left.setNumber - right.setNumber ||
        left.gameNumber - right.gameNumber ||
        left.pointNumber - right.pointNumber ||
        left.order - right.order,
    );
    return [
      {
        id,
        label: matchNoteThemeDefinitions[id].label,
        observationCount: ordered.length,
        observations: ordered.map(({ context, text }) => ({ context, text })),
        relatedStats: matchNoteRelatedStats(id, ordered, insights),
        reviewQuestion: matchNoteThemeDefinitions[id].reviewQuestion,
      },
    ];
  });
}
