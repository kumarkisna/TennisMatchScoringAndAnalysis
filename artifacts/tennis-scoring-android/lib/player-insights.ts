import type { PointCode } from '@/lib/local-matches';

const shotCodes: PointCode[] = ['A', 'F', 'B', 'V', 'O', 'P'];

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
  shotTagCount: number;
  taggedPointCount: number;
  codeInsights: PlayerCodeInsight[];
  feedback: string[];
}

export interface PlayerReportInsights {
  pointCount: number;
  trackedPointsWon: number;
  servicePointsWon: number;
  trackedServicePoints: number;
  returnPointsWon: number;
  trackedReturnPoints: number;
  trackedFirstServeFaults: number;
  codes: { code: string; count: number; trackedWon: number }[];
}

const allPointCodes: PointCode[] = [...shotCodes, 'N', 'L', 'W', 'D', 'FE'];

function isPointCode(value: string): value is PointCode {
  return allPointCodes.includes(value as PointCode);
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function summarizePlayerPerformance(
  insights: PlayerReportInsights,
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

  const validCodes = insights.codes
    .filter((item) => isPointCode(item.code))
    .map((item) => ({ ...item, code: item.code as PointCode }));
  const taggedPointCount = validCodes.reduce(
    (total, item) => total + item.count,
    0,
  );
  const shotTagCount = validCodes.reduce(
    (total, item) => total + (shotCodes.includes(item.code) ? item.count : 0),
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

  const shotInsights = codeInsights.filter((item) =>
    shotCodes.includes(item.code),
  );
  const reliableShotSamples = shotInsights.filter((item) => item.count >= 3);
  if (reliableShotSamples.length > 0) {
    const strongest = [...reliableShotSamples].sort(
      (a, b) =>
        b.trackedWinPercent - a.trackedWinPercent || b.count - a.count,
    )[0];
    shotFeedback.push(
      `Among shot tags with at least 3 records, ${strongest.code} has the highest tracked-player win rate at ${strongest.trackedWinPercent}%.`,
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
    shotTagCount,
    taggedPointCount,
    codeInsights,
    feedback: [...feedback.slice(0, 3), ...shotFeedback].slice(0, 4),
  };
}
