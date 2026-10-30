import {
  RALLY_LENGTH_OPTIONS,
  SHOT_DIRECTION_OPTIONS,
  type LocalContextInsight,
  type LocalSetInsights,
  type PointCode,
  type RallyLength,
  type ServiceGameStats,
  type ServeSideStats,
  type LocalInsights,
  type LocalStrokeTally,
  type ShotDirection,
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

export interface PlayerTrendMatch {
  id: string;
  date: string;
  event: string | null;
  round: string | null;
  trackedPlayer: string;
  opponent: string;
  metrics: Record<PlayerTrendMetricKey, PlayerTrendMetricValue>;
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

    return {
      id: match.id,
      date: match.matchDate,
      event: match.event,
      round: match.round,
      trackedPlayer: match.trackedPlayer,
      opponent: match.opponent,
      metrics,
    };
  });
}

const allPointCodes: PointCode[] = [...shotCodes, 'N', 'L', 'W', 'D', 'FE'];

function isPointCode(value: string): value is PointCode {
  return allPointCodes.includes(value as PointCode);
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
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
    matchesInSample,
    shotTagCount,
    taggedPointCount,
    codeInsights,
    shotDirectionTaggedCount,
    rallyLengthTaggedCount,
    shotDirections,
    rallyLengths,
    feedback: [...feedback.slice(0, 3), ...shotFeedback].slice(0, 4),
  };
}
