import {
  RALLY_LENGTH_OPTIONS,
  SHOT_DIRECTION_OPTIONS,
  STROKE_TYPE_OPTIONS,
  type BreakPointStats,
  type CourtSurface,
  type LocalContextInsight,
  type LocalInsights,
  type LocalMatchSummary,
  type PointCode,
  type PlayerSide,
  type RallyLength,
  type ServiceGameStats,
  type ServeSideStats,
  type ShotDirection,
} from '@/lib/local-matches';
import {
  summarizePlayerMatchOutcomes,
  summarizePlayerPerformance,
  type PlayerMatchOutcomeRecord,
  type PlayerMatchOutcomeSummary,
  type PlayerPerformanceSummary,
} from '@/lib/player-insights';

export interface HeadToHeadMeeting {
  summary: LocalMatchSummary;
  insights: LocalInsights;
}

export type PersonalAverageCourtSurface = Exclude<CourtSurface, 'Other'>;

export interface SurfaceBreakPointBaseline {
  surface: PersonalAverageCourtSurface;
  matchCount: number;
  breakPoints: BreakPointStats;
}

export const PERSONAL_AVERAGE_COURT_SURFACES = [
  'Hard',
  'Clay',
  'Grass',
  'Carpet',
] as const satisfies readonly PersonalAverageCourtSurface[];

export interface HeadToHeadReport {
  trackedPlayer: string;
  opponent: string;
  meetings: HeadToHeadMeeting[];
  matchesRecorded: number;
  completedMatches: number;
  matchesWon: number;
  matchesLost: number;
  completedMatchesWithoutWinner: number;
  matchesInProgress: number;
  matchOutcomeTotals: PlayerMatchOutcomeSummary;
  setsRecorded: number;
  completedSets: number;
  setsWon: number;
  setsLost: number;
  completedSetsWithoutWinner: number;
  insights: LocalInsights;
  performance: PlayerPerformanceSummary;
  personalAverageInsights: LocalInsights;
  personalAveragePerformance: PlayerPerformanceSummary;
  personalAverageMatches: number;
  personalAverageBreakPointsBySurface: SurfaceBreakPointBaseline[];
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function uniqueNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    const key = normalizeName(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function getTrackedPlayerOptions(
  savedPlayerNames: readonly string[],
  matches: readonly LocalMatchSummary[],
  preferredName?: string | null,
): string[] {
  const names = uniqueNames([
    ...savedPlayerNames,
    ...matches.map((match) => match.trackedPlayer),
  ]);
  if (!preferredName) return names;
  const preferred = names.find(
    (name) => normalizeName(name) === normalizeName(preferredName),
  );
  return preferred
    ? [preferred, ...names.filter((name) => normalizeName(name) !== normalizeName(preferred))]
    : names;
}

export function getHeadToHeadOpponentOptions(
  trackedPlayer: string,
  matches: readonly LocalMatchSummary[],
): string[] {
  if (!normalizeName(trackedPlayer)) return [];
  return uniqueNames(
    matches
      .filter(
        (match) => normalizeName(match.trackedPlayer) === normalizeName(trackedPlayer),
      )
      .map((match) => match.opponent),
  ).sort((a, b) => a.localeCompare(b));
}

function emptyBreakPointStats(): Record<PlayerSide, BreakPointStats> {
  return {
    tracked: { opportunities: 0, converted: 0, faced: 0, saved: 0 },
    opponent: { opportunities: 0, converted: 0, faced: 0, saved: 0 },
  };
}

function emptyServeStats(): Record<PlayerSide, ServeSideStats> {
  const emptySide = (): ServeSideStats => ({
    servicePoints: 0,
    servicePointsWon: 0,
    firstServeFaults: 0,
    firstServePoints: 0,
    firstServePointsWon: 0,
    secondServePoints: 0,
    secondServePointsWon: 0,
    aces: 0,
    doubleFaults: 0,
  });
  return { tracked: emptySide(), opponent: emptySide() };
}

function emptyServiceGames(): Record<PlayerSide, ServiceGameStats> {
  return {
    tracked: { gamesPlayed: 0, gamesWon: 0 },
    opponent: { gamesPlayed: 0, gamesWon: 0 },
  };
}

function emptyContext<T extends string>(
  options: readonly { value: T }[],
): LocalContextInsight<T>[] {
  return options.map(({ value }) => ({ value, count: 0, trackedWon: 0 }));
}

function emptyInsights(): LocalInsights {
  return {
    pointCount: 0,
    trackedPointsWon: 0,
    opponentPointsWon: 0,
    firstServeFaults: 0,
    trackedFirstServeFaults: 0,
    trackedServicePoints: 0,
    trackedReturnPoints: 0,
    codes: [],
    returnPointsWon: 0,
    servicePointsWon: 0,
    serveStats: emptyServeStats(),
    breakPoints: emptyBreakPointStats(),
    serviceGames: emptyServiceGames(),
    shotDirections: emptyContext(SHOT_DIRECTION_OPTIONS),
    rallyLengths: emptyContext(RALLY_LENGTH_OPTIONS),
    sets: [],
    strokeTallies: STROKE_TYPE_OPTIONS.flatMap(({ value }) =>
      (['tracked', 'opponent'] as const).map((player) => ({
        strokeType: value,
        player,
        inPlay: 0,
        errors: 0,
        winners: 0,
        sampleCount: 0,
      })),
    ),
    strokeNotes: [],
  };
}

function mergeContext<T extends string>(
  target: LocalContextInsight<T>[],
  source: readonly LocalContextInsight<T>[],
): void {
  for (const item of source) {
    const match = target.find((candidate) => candidate.value === item.value);
    if (!match) continue;
    match.count += item.count;
    match.trackedWon += item.trackedWon;
  }
}

export function aggregateLocalInsights(
  records: readonly LocalInsights[],
): LocalInsights {
  const total = emptyInsights();
  const codeTotals = new Map<
    PointCode,
    { count: number; trackedWon: number; opponentWon: number }
  >();

  for (const item of records) {
    total.pointCount += item.pointCount;
    total.trackedPointsWon += item.trackedPointsWon;
    total.opponentPointsWon += item.opponentPointsWon;
    total.firstServeFaults += item.firstServeFaults;
    total.trackedFirstServeFaults += item.trackedFirstServeFaults;
    total.trackedServicePoints += item.trackedServicePoints;
    total.trackedReturnPoints += item.trackedReturnPoints;
    total.returnPointsWon += item.returnPointsWon;
    total.servicePointsWon += item.servicePointsWon;

    for (const side of ['tracked', 'opponent'] as const) {
      for (const key of Object.keys(total.serveStats[side]) as (keyof ServeSideStats)[]) {
        total.serveStats[side][key] += item.serveStats[side][key];
      }
      total.breakPoints[side].opportunities += item.breakPoints[side].opportunities;
      total.breakPoints[side].converted += item.breakPoints[side].converted;
      total.breakPoints[side].faced += item.breakPoints[side].faced;
      total.breakPoints[side].saved += item.breakPoints[side].saved;
      total.serviceGames[side].gamesPlayed += item.serviceGames[side].gamesPlayed;
      total.serviceGames[side].gamesWon += item.serviceGames[side].gamesWon;
    }

    for (const code of item.codes) {
      const codeTotal = codeTotals.get(code.code) ?? {
        count: 0,
        trackedWon: 0,
        opponentWon: 0,
      };
      codeTotal.count += code.count;
      codeTotal.trackedWon += code.trackedWon;
      codeTotal.opponentWon += code.opponentWon;
      codeTotals.set(code.code, codeTotal);
    }

    mergeContext(total.shotDirections, item.shotDirections);
    mergeContext(total.rallyLengths, item.rallyLengths);
    for (const tally of item.strokeTallies) {
      const target = total.strokeTallies.find(
        (candidate) =>
          candidate.strokeType === tally.strokeType &&
          candidate.player === tally.player,
      );
      if (!target) continue;
      target.inPlay += tally.inPlay;
      target.errors += tally.errors;
      target.winners += tally.winners;
      target.sampleCount += tally.sampleCount;
    }
    total.strokeNotes.push(...item.strokeNotes);
    total.sets.push(...item.sets);
  }

  total.codes = [...codeTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, stats]) => ({ code, ...stats }));
  return total;
}

export function getSetWinner(
  set: LocalMatchSummary['setScores'][number],
): PlayerSide | null {
  if (!set.isComplete) return null;
  const trackedScore =
    set.format === 'match_tiebreak'
      ? set.trackedTiebreakPoints
      : set.trackedGames;
  const opponentScore =
    set.format === 'match_tiebreak'
      ? set.opponentTiebreakPoints
      : set.opponentGames;
  if (trackedScore === opponentScore) return null;
  return trackedScore > opponentScore ? 'tracked' : 'opponent';
}

export function buildHeadToHeadReport(
  trackedPlayer: string,
  opponent: string,
  candidateMeetings: readonly HeadToHeadMeeting[],
  personalAverageMeetings: readonly HeadToHeadMeeting[] = candidateMeetings,
): HeadToHeadReport {
  const trackedKey = normalizeName(trackedPlayer);
  const opponentKey = normalizeName(opponent);
  const meetings = candidateMeetings
    .filter(
      ({ summary }) =>
        normalizeName(summary.trackedPlayer) === trackedKey &&
        normalizeName(summary.opponent) === opponentKey,
    )
    .sort(
      (a, b) =>
        b.summary.matchDate.localeCompare(a.summary.matchDate) ||
        b.summary.updatedAt.localeCompare(a.summary.updatedAt),
    );
  const insights = aggregateLocalInsights(meetings.map((meeting) => meeting.insights));
  const personalMeetings = personalAverageMeetings.filter(
    ({ summary }) =>
      normalizeName(summary.trackedPlayer) === trackedKey,
  );
  const pointSampledMeetings = meetings.filter(
    (meeting) => meeting.insights.pointCount > 0,
  );
  const pointSampledPersonalMeetings = personalMeetings.filter(
    (meeting) => meeting.insights.pointCount > 0,
  );
  const personalAverageInsights = aggregateLocalInsights(
    personalMeetings.map((meeting) => meeting.insights),
  );
  const personalAverageBreakPointsBySurface =
    PERSONAL_AVERAGE_COURT_SURFACES.map((surface) => {
      const surfaceMeetings = pointSampledPersonalMeetings.filter(
        ({ summary }) => summary.surface === surface,
      );
      const surfaceInsights = aggregateLocalInsights(
        surfaceMeetings.map((meeting) => meeting.insights),
      );
      return {
        surface,
        matchCount: surfaceMeetings.length,
        breakPoints: surfaceInsights.breakPoints.tracked,
      };
    });
  const completeMeetings = meetings.filter(
    (meeting) => meeting.summary.status === 'complete',
  );
  const completedSets = meetings.flatMap((meeting) =>
    meeting.summary.setScores.filter((set) => set.isComplete),
  );
  const setWinners = completedSets.map(getSetWinner);
  const matchOutcomeRecords: PlayerMatchOutcomeRecord[] = meetings.map(
    ({ summary }) => ({
      status: summary.status,
      result:
        summary.status !== 'complete'
          ? null
          : summary.winner === null
            ? 'no_winner'
            : summary.winner === 'tracked'
              ? 'win'
              : 'loss',
      outcomeType:
        summary.status !== 'complete'
          ? null
          : summary.matchOutcome?.reason ?? 'ordinary',
    }),
  );

  return {
    trackedPlayer: trackedPlayer.trim(),
    opponent: opponent.trim(),
    meetings,
    matchesRecorded: meetings.length,
    completedMatches: completeMeetings.length,
    matchesWon: completeMeetings.filter(
      (meeting) => meeting.summary.winner === 'tracked',
    ).length,
    matchesLost: completeMeetings.filter(
      (meeting) => meeting.summary.winner === 'opponent',
    ).length,
    completedMatchesWithoutWinner: completeMeetings.filter(
      (meeting) => meeting.summary.winner === null,
    ).length,
    matchesInProgress: meetings.filter(
      (meeting) => meeting.summary.status !== 'complete',
    ).length,
    matchOutcomeTotals: summarizePlayerMatchOutcomes(matchOutcomeRecords),
    setsRecorded: meetings.reduce(
      (count, meeting) => count + meeting.summary.setScores.length,
      0,
    ),
    completedSets: completedSets.length,
    setsWon: setWinners.filter((winner) => winner === 'tracked').length,
    setsLost: setWinners.filter((winner) => winner === 'opponent').length,
    completedSetsWithoutWinner: setWinners.filter((winner) => winner === null).length,
    insights,
    performance: summarizePlayerPerformance(insights, pointSampledMeetings.length),
    personalAverageInsights,
    personalAveragePerformance: summarizePlayerPerformance(
      personalAverageInsights,
      pointSampledPersonalMeetings.length,
    ),
    personalAverageMatches: pointSampledPersonalMeetings.length,
    personalAverageBreakPointsBySurface,
  };
}
