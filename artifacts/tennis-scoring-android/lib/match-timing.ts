import type { LocalMatch, LocalPoint, PlayerSide } from '@/lib/local-matches';

export interface TimingIntervalSummary {
  count: number;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  q1Ms: number | null;
  q3Ms: number | null;
  interquartileRangeMs: number | null;
}

export interface MatchTimingSummary {
  firstToSecondServe: Record<PlayerSide, TimingIntervalSummary>;
  betweenPoints: {
    all: TimingIntervalSummary;
    sameGame: TimingIntervalSummary;
    gameChangeover: TimingIntervalSummary;
    afterTrackedWin: TimingIntervalSummary;
    afterTrackedLoss: TimingIntervalSummary;
    afterTrackedError: TimingIntervalSummary;
    afterOpponentWin: TimingIntervalSummary;
    afterOpponentLoss: TimingIntervalSummary;
    afterOpponentError: TimingIntervalSummary;
  };
}

export interface MatchTimingSamples {
  firstToSecondServe: Record<PlayerSide, number[]>;
  betweenPoints: {
    all: number[];
    sameGame: number[];
    gameChangeover: number[];
    afterTrackedWin: number[];
    afterTrackedLoss: number[];
    afterTrackedError: number[];
    afterOpponentWin: number[];
    afterOpponentLoss: number[];
    afterOpponentError: number[];
  };
}

export interface PlayerTimingMatch {
  playerSide: PlayerSide;
  points: readonly LocalPoint[];
}

function emptySamples(): MatchTimingSamples {
  return {
    firstToSecondServe: { tracked: [], opponent: [] },
    betweenPoints: {
      all: [],
      sameGame: [],
      gameChangeover: [],
      afterTrackedWin: [],
      afterTrackedLoss: [],
      afterTrackedError: [],
      afterOpponentWin: [],
      afterOpponentLoss: [],
      afterOpponentError: [],
    },
  };
}

function quantile(sorted: readonly number[], position: number): number {
  const index = (sorted.length - 1) * position;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const fraction = index - lowerIndex;
  return (
    sorted[lowerIndex] +
    (sorted[upperIndex] - sorted[lowerIndex]) * fraction
  );
}

function summarize(values: readonly number[]): TimingIntervalSummary {
  if (!values.length) {
    return {
      count: 0,
      medianMs: null,
      minMs: null,
      maxMs: null,
      q1Ms: null,
      q3Ms: null,
      interquartileRangeMs: null,
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const medianMs =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  const q1Ms = quantile(sorted, 0.25);
  const q3Ms = quantile(sorted, 0.75);

  return {
    count: sorted.length,
    medianMs,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    q1Ms,
    q3Ms,
    interquartileRangeMs: q3Ms - q1Ms,
  };
}

function addValidDuration(target: number[], durationMs: number) {
  if (Number.isFinite(durationMs) && durationMs >= 0) target.push(durationMs);
}

function mergeSamples(
  target: MatchTimingSamples,
  source: MatchTimingSamples,
): MatchTimingSamples {
  const betweenPointKeys = Object.keys(target.betweenPoints) as Array<
    keyof MatchTimingSamples['betweenPoints']
  >;

  return {
    firstToSecondServe: {
      tracked: [
        ...target.firstToSecondServe.tracked,
        ...source.firstToSecondServe.tracked,
      ],
      opponent: [
        ...target.firstToSecondServe.opponent,
        ...source.firstToSecondServe.opponent,
      ],
    },
    betweenPoints: Object.fromEntries(
      betweenPointKeys.map((key) => [
        key,
        [...target.betweenPoints[key], ...source.betweenPoints[key]],
      ]),
    ) as MatchTimingSamples['betweenPoints'],
  };
}

function flipSide(side: PlayerSide): PlayerSide {
  return side === 'tracked' ? 'opponent' : 'tracked';
}

export function getMatchTimingPoints(
  match: Pick<LocalMatch, 'completedSets' | 'points'>,
): LocalPoint[] {
  return Array.from(
    new Map(
      [
        ...(match.completedSets ?? []).flatMap((set) => set.points),
        ...(match.points ?? []),
      ].map((point) => [point.id, point] as const),
    ).values(),
  ).sort(
    (left, right) =>
      left.setNumber - right.setNumber ||
      left.sequenceNumber - right.sequenceNumber,
  );
}

export function collectMatchTimingSamples(
  points: readonly LocalPoint[],
): MatchTimingSamples {
  const ordered = [...points].sort(
    (left, right) =>
      left.setNumber - right.setNumber ||
      left.sequenceNumber - right.sequenceNumber,
  );
  const samples = emptySamples();

  for (const point of ordered) {
    if (
      point.firstServeFaultAtMs !== undefined &&
      point.secondServeAtMs !== undefined
    ) {
      addValidDuration(
        samples.firstToSecondServe[point.server],
        point.secondServeAtMs - point.firstServeFaultAtMs,
      );
    }
  }

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (
      previous.setNumber !== current.setNumber ||
      current.sequenceNumber !== previous.sequenceNumber + 1 ||
      current.pointStartedAtMs === undefined
    ) {
      continue;
    }

    const previousPointEndedAt = Date.parse(previous.createdAt);
    const intervalMs = current.pointStartedAtMs - previousPointEndedAt;
    if (!Number.isFinite(previousPointEndedAt) || intervalMs < 0) continue;

    addValidDuration(samples.betweenPoints.all, intervalMs);
    if (previous.gameNumber !== current.gameNumber) {
      addValidDuration(samples.betweenPoints.gameChangeover, intervalMs);
      continue;
    }

    addValidDuration(samples.betweenPoints.sameGame, intervalMs);
    addValidDuration(
      previous.winner === 'tracked'
        ? samples.betweenPoints.afterTrackedWin
        : samples.betweenPoints.afterTrackedLoss,
      intervalMs,
    );
    addValidDuration(
      previous.winner === 'opponent'
        ? samples.betweenPoints.afterOpponentWin
        : samples.betweenPoints.afterOpponentLoss,
      intervalMs,
    );
    const errorCodes = ['N', 'L', 'W', 'D'];
    if (
      previous.winner === 'opponent' &&
      errorCodes.includes(previous.endingCode ?? '')
    ) {
      addValidDuration(samples.betweenPoints.afterTrackedError, intervalMs);
    }
    if (
      previous.winner === 'tracked' &&
      errorCodes.includes(previous.endingCode ?? '')
    ) {
      addValidDuration(samples.betweenPoints.afterOpponentError, intervalMs);
    }
  }

  return samples;
}

export function summarizeMatchTimingSamples(
  samples: MatchTimingSamples,
): MatchTimingSummary {
  const intervals = samples.betweenPoints;
  return {
    firstToSecondServe: {
      tracked: summarize(samples.firstToSecondServe.tracked),
      opponent: summarize(samples.firstToSecondServe.opponent),
    },
    betweenPoints: {
      all: summarize(intervals.all),
      sameGame: summarize(intervals.sameGame),
      gameChangeover: summarize(intervals.gameChangeover),
      afterTrackedWin: summarize(intervals.afterTrackedWin),
      afterTrackedLoss: summarize(intervals.afterTrackedLoss),
      afterTrackedError: summarize(intervals.afterTrackedError),
      afterOpponentWin: summarize(intervals.afterOpponentWin),
      afterOpponentLoss: summarize(intervals.afterOpponentLoss),
      afterOpponentError: summarize(intervals.afterOpponentError),
    },
  };
}

export function summarizeMatchTiming(points: readonly LocalPoint[]): MatchTimingSummary {
  return summarizeMatchTimingSamples(collectMatchTimingSamples(points));
}

export function summarizeMatchTimingAcrossMatches(
  pointLogs: readonly (readonly LocalPoint[])[],
): MatchTimingSummary {
  const samples = pointLogs.reduce(
    (merged, points) =>
      mergeSamples(merged, collectMatchTimingSamples(points)),
    emptySamples(),
  );
  return summarizeMatchTimingSamples(samples);
}

export function summarizePlayerTimingAcrossMatches(
  matches: readonly PlayerTimingMatch[],
): MatchTimingSummary {
  const samples = matches.reduce((merged, match) => {
    const playerOrientedPoints =
      match.playerSide === 'tracked'
        ? match.points
        : match.points.map((point) => ({
            ...point,
            winner: flipSide(point.winner),
            server: flipSide(point.server),
          }));
    return mergeSamples(merged, collectMatchTimingSamples(playerOrientedPoints));
  }, emptySamples());
  return summarizeMatchTimingSamples(samples);
}

export function formatTimingDuration(durationMs: number): string {
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatTimingDetails(
  summary: TimingIntervalSummary,
): string {
  if (
    summary.count === 0 ||
    summary.medianMs === null ||
    summary.minMs === null ||
    summary.maxMs === null ||
    summary.q1Ms === null ||
    summary.q3Ms === null
  ) {
    return 'No marked samples';
  }
  const range =
    summary.minMs === summary.maxMs
      ? formatTimingDuration(summary.minMs)
      : `${formatTimingDuration(summary.minMs)}–${formatTimingDuration(summary.maxMs)}`;
  return `Median ${formatTimingDuration(summary.medianMs)} · range ${range} · middle 50% ${formatTimingDuration(summary.q1Ms)}–${formatTimingDuration(summary.q3Ms)} · n=${summary.count}`;
}
