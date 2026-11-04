import type { LocalPoint, PlayerSide } from '@/lib/local-matches';

export interface TimingIntervalSummary {
  count: number;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
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
  };
}

function summarize(values: readonly number[]): TimingIntervalSummary {
  if (!values.length) {
    return { count: 0, medianMs: null, minMs: null, maxMs: null };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const medianMs =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  return {
    count: sorted.length,
    medianMs,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
  };
}

function addValidDuration(target: number[], durationMs: number) {
  if (Number.isFinite(durationMs) && durationMs >= 0) target.push(durationMs);
}

export function summarizeMatchTiming(
  points: readonly LocalPoint[],
): MatchTimingSummary {
  const ordered = [...points].sort(
    (left, right) =>
      left.setNumber - right.setNumber ||
      left.sequenceNumber - right.sequenceNumber,
  );
  const serveIntervals: Record<PlayerSide, number[]> = {
    tracked: [],
    opponent: [],
  };
  const pointIntervals = {
    all: [] as number[],
    sameGame: [] as number[],
    gameChangeover: [] as number[],
    afterTrackedWin: [] as number[],
    afterTrackedLoss: [] as number[],
    afterTrackedError: [] as number[],
  };

  for (const point of ordered) {
    if (
      point.firstServeFaultAtMs !== undefined &&
      point.secondServeAtMs !== undefined
    ) {
      addValidDuration(
        serveIntervals[point.server],
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

    addValidDuration(pointIntervals.all, intervalMs);
    if (previous.gameNumber !== current.gameNumber) {
      addValidDuration(pointIntervals.gameChangeover, intervalMs);
      continue;
    }

    addValidDuration(pointIntervals.sameGame, intervalMs);
    addValidDuration(
      previous.winner === 'tracked'
        ? pointIntervals.afterTrackedWin
        : pointIntervals.afterTrackedLoss,
      intervalMs,
    );
    if (
      previous.winner === 'opponent' &&
      ['N', 'L', 'W', 'D'].includes(previous.endingCode ?? '')
    ) {
      addValidDuration(pointIntervals.afterTrackedError, intervalMs);
    }
  }

  return {
    firstToSecondServe: {
      tracked: summarize(serveIntervals.tracked),
      opponent: summarize(serveIntervals.opponent),
    },
    betweenPoints: {
      all: summarize(pointIntervals.all),
      sameGame: summarize(pointIntervals.sameGame),
      gameChangeover: summarize(pointIntervals.gameChangeover),
      afterTrackedWin: summarize(pointIntervals.afterTrackedWin),
      afterTrackedLoss: summarize(pointIntervals.afterTrackedLoss),
      afterTrackedError: summarize(pointIntervals.afterTrackedError),
    },
  };
}
