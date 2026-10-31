import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLocalReportNameLabels } from '@/hooks/useLocalReportNameLabels';
import { useLocalReportNameVisibility } from '@/hooks/useLocalReportNameVisibility';
import { ReportAnonymityToggle } from '@/components/ReportAnonymityToggle';
import { ReportSectionPicker } from '@/components/ReportSectionPicker';
import {
  type BreakPointStats,
  getLocalMatch,
  getLocalInsights,
  listLocalMatches,
  LOCAL_MATCH_LIST_KEY,
  type LocalMatchSummary,
} from '@/lib/local-matches';
import {
  ACTIVE_LOCAL_PLAYER_KEY,
  getActiveLocalPlayerId,
  listLocalPlayers,
  LOCAL_PLAYERS_KEY,
} from '@/lib/local-players';
import {
  buildHeadToHeadReport,
  getHeadToHeadOpponentOptions,
  getSetWinner,
  getTrackedPlayerOptions,
  type HeadToHeadMeeting,
  type HeadToHeadReport,
} from '@/lib/head-to-head';
import {
  buildHeadToHeadReportHtml,
  buildHeadToHeadReportReviewVersion,
} from '@/lib/head-to-head-report-html';
import {
  getReportNameVisibilityVersion,
  isReportReviewCurrent,
} from '@/lib/report-review';
import {
  createAndPreviewLocalPdf,
  shareReviewedLocalPdf,
} from '@/lib/report-pdf';
import { POINT_CODE_LABELS } from '@/lib/player-report-html';
import {
  formatPlayerMatchOutcomeSummary,
  type ContextPerformanceInsight,
} from '@/lib/player-insights';
import {
  getLocalReportBenchmarkSettings,
  LOCAL_REPORT_BENCHMARKS_KEY,
} from '@/lib/local-benchmarks';
import {
  allHeadToHeadReportSections,
  HEAD_TO_HEAD_REPORT_SECTIONS,
  HEAD_TO_HEAD_REPORT_SECTION_PRESETS,
  type HeadToHeadReportSection,
} from '@/lib/report-sections';

type Theme = ReturnType<typeof useColors>;

interface RateValue {
  value: string;
  sample: string;
}

interface StatRow {
  label: string;
  tracked: RateValue;
  opponent: RateValue;
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function canonicalOption(options: readonly string[], preferred: string): string {
  return (
    options.find((option) => normalizedName(option) === normalizedName(preferred)) ??
    options[0] ??
    ''
  );
}

function rateValue(wins: number, attempts: number): RateValue {
  return attempts > 0
    ? {
        value: `${((wins / attempts) * 100).toFixed(1)}%`,
        sample: `${wins}/${attempts}`,
      }
    : { value: '—', sample: 'No attempts recorded' };
}

function breakPointRateRows(
  stats: BreakPointStats,
): { label: string; value: RateValue }[] {
  return [
    {
      label: 'Break points converted',
      value: rateValue(stats.converted, stats.opportunities),
    },
    {
      label: 'Break points missed',
      value: rateValue(
        stats.opportunities - stats.converted,
        stats.opportunities,
      ),
    },
    {
      label: 'Break points saved',
      value: rateValue(stats.saved, stats.faced),
    },
    {
      label: 'Break points lost while serving',
      value: rateValue(stats.faced - stats.saved, stats.faced),
    },
  ];
}

function unavailableValue(sample: string): RateValue {
  return { value: '—', sample };
}

function countValue(count: number, sample: number, sampleLabel: string): RateValue {
  return {
    value: String(count),
    sample: `${sample} ${sampleLabel}`,
  };
}

function averageValue(count: number, sample: number, unit: string): RateValue {
  return sample > 0
    ? {
        value: (count / sample).toFixed(2),
        sample: `${count} aces / ${sample} ${unit}`,
      }
    : { value: '—', sample: `No ${unit} recorded` };
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  const monthName = new Date(Date.UTC(year, month - 1, day)).toLocaleString(
    undefined,
    { month: 'short', timeZone: 'UTC' },
  );
  return `${monthName} ${day}, ${year}`;
}

function formatSetScore(set: LocalMatchSummary['setScores'][number]): string {
  if (set.format === 'match_tiebreak') {
    return `${set.trackedTiebreakPoints}–${set.opponentTiebreakPoints} MT`;
  }
  const games = `${set.trackedGames}–${set.opponentGames}`;
  return set.trackedTiebreakPoints > 0 || set.opponentTiebreakPoints > 0
    ? `${games} · TB ${set.trackedTiebreakPoints}–${set.opponentTiebreakPoints}`
    : games;
}

function matchResult(summary: LocalMatchSummary, report: HeadToHeadReport): string {
  if (summary.status !== 'complete') return 'In progress';
  if (summary.matchOutcome) {
    const awardedWinner =
      summary.matchOutcome.winner === 'tracked' ? report.trackedPlayer : report.opponent;
    return `Winner by ${summary.matchOutcome.reason}: ${awardedWinner}`;
  }
  if (!summary.winner) return 'Result not determined';
  return summary.winner === 'tracked'
    ? `${report.trackedPlayer} won`
    : `${report.opponent} won`;
}

function setResult(
  set: LocalMatchSummary['setScores'][number],
  report: HeadToHeadReport,
): string {
  if (!set.isComplete) return 'In progress';
  const winner = getSetWinner(set);
  if (!winner) return 'Not determined';
  return winner === 'tracked' ? report.trackedPlayer : report.opponent;
}

function SelectorRow({
  label,
  options,
  selected,
  onSelect,
  prefix,
  colors,
  emptyMessage,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  prefix: string;
  colors: Theme;
  emptyMessage: string;
}) {
  return (
    <View style={styles.selectorGroup}>
      <Text style={[styles.selectorLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      {options.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choiceList}
        >
          {options.map((option, index) => {
            const selectedOption =
              normalizedName(option) === normalizedName(selected);
            return (
              <Pressable
                key={`${prefix}-${option}`}
                testID={`${prefix}-option-${index}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedOption }}
                onPress={() => onSelect(option)}
                style={[
                  styles.choiceChip,
                  {
                    backgroundColor: selectedOption
                      ? colors.primary
                      : colors.background,
                    borderColor: selectedOption ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.choiceText,
                    {
                      color: selectedOption
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[styles.emptyChoice, { color: colors.mutedForeground }]}>
          {emptyMessage}
        </Text>
      )}
    </View>
  );
}

function StatTable({
  title,
  rows,
  trackedName,
  opponentName,
  colors,
  testID,
}: {
  title: string;
  rows: StatRow[];
  trackedName: string;
  opponentName: string;
  colors: Theme;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.sectionCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <View style={styles.statHeader}>
        <Text style={[styles.statHeaderLabel, { color: colors.mutedForeground }]}>
          STATISTIC
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.statHeaderName, { color: colors.mutedForeground }]}
        >
          {trackedName}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.statHeaderName, { color: colors.mutedForeground }]}
        >
          {opponentName}
        </Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={[styles.statRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.foreground }]}>
            {row.label}
          </Text>
          <View style={styles.statValueColumn}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {row.tracked.value}
            </Text>
            <Text style={[styles.statSample, { color: colors.mutedForeground }]}>
              {row.tracked.sample}
            </Text>
          </View>
          <View style={styles.statValueColumn}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {row.opponent.value}
            </Text>
            <Text style={[styles.statSample, { color: colors.mutedForeground }]}>
              {row.opponent.sample}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function HeadToHeadScreen() {
  const colors = useColors();
  const reportNameLabels = useLocalReportNameLabels();
  const reportNameVisibility = useLocalReportNameVisibility();
  const hidePlayerNames = reportNameVisibility.hidePlayerNames;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trackedOverride, setTrackedOverride] = useState('');
  const [opponentOverride, setOpponentOverride] = useState('');
  const [showSurfaceBreakPoints, setShowSurfaceBreakPoints] = useState(false);
  const [reportAction, setReportAction] = useState<'review' | 'share' | null>(null);
  const [reviewedReport, setReviewedReport] = useState<{
    version: string;
    uri: string | null;
  } | null>(null);
  const [reportError, setReportError] = useState('');
  const [selectedReportSections, setSelectedReportSections] =
    useState<HeadToHeadReportSection[]>(allHeadToHeadReportSections);

  const matchesQuery = useQuery({
    queryKey: LOCAL_MATCH_LIST_KEY,
    queryFn: listLocalMatches,
  });
  const playersQuery = useQuery({
    queryKey: LOCAL_PLAYERS_KEY,
    queryFn: listLocalPlayers,
  });
  const activePlayerQuery = useQuery({
    queryKey: ACTIVE_LOCAL_PLAYER_KEY,
    queryFn: getActiveLocalPlayerId,
  });
  const reportBenchmarksQuery = useQuery({
    queryKey: LOCAL_REPORT_BENCHMARKS_KEY,
    queryFn: getLocalReportBenchmarkSettings,
  });

  const matches = matchesQuery.data ?? [];
  const selectedReportBenchmarks = reportBenchmarksQuery.data
    ? reportBenchmarksQuery.data.selectedPresetIds.flatMap((id) => {
        const preset = reportBenchmarksQuery.data?.presets.find(
          (item) => item.id === id,
        );
        return preset ? [preset] : [];
      })
    : [];
  const activePlayer = playersQuery.data?.find(
    (player) => player.id === activePlayerQuery.data,
  );
  const trackedPlayerOptions = useMemo(
    () =>
      getTrackedPlayerOptions(
        playersQuery.data?.map((player) => player.name) ?? [],
        matches,
        activePlayer?.name,
      ),
    [activePlayer?.name, matches, playersQuery.data],
  );
  const selectedTrackedPlayer = canonicalOption(
    trackedPlayerOptions,
    trackedOverride || activePlayer?.name || trackedPlayerOptions[0] || '',
  );
  const opponentOptions = useMemo(
    () => getHeadToHeadOpponentOptions(selectedTrackedPlayer, matches),
    [matches, selectedTrackedPlayer],
  );
  const selectedOpponent = canonicalOption(
    opponentOptions,
    opponentOverride || opponentOptions[0] || '',
  );
  const matchVersion = matches
    .map((match) => `${match.id}:${match.updatedAt}`)
    .sort()
    .join('|');
  const reportQuery = useQuery({
    queryKey: [
      'device-head-to-head',
      selectedTrackedPlayer,
      selectedOpponent,
      matchVersion,
    ],
    enabled:
      Boolean(selectedTrackedPlayer) &&
      Boolean(selectedOpponent) &&
      matchesQuery.isSuccess,
    queryFn: async () => {
      const trackedPlayerMatches = matches.filter(
        (match) =>
          normalizedName(match.trackedPlayer) ===
          normalizedName(selectedTrackedPlayer),
      );
      const allTrackedMeetings = (
        await Promise.all(
          trackedPlayerMatches.map(async (summary): Promise<HeadToHeadMeeting | null> => {
            const insights = await getLocalInsights(summary.id);
            return insights ? { summary, insights } : null;
          }),
        )
      ).filter((meeting): meeting is HeadToHeadMeeting => meeting !== null);
      const meetings = allTrackedMeetings.filter(
        ({ summary }) =>
          normalizedName(summary.opponent) === normalizedName(selectedOpponent),
      );
      const meetingsWithPointData = await Promise.all(
        meetings.map(async (meeting) => {
          const match = await getLocalMatch(meeting.summary.id);
          return match ? { ...meeting, match } : meeting;
        }),
      );
      return buildHeadToHeadReport(
        selectedTrackedPlayer,
        selectedOpponent,
        meetingsWithPointData,
        allTrackedMeetings,
      );
    },
  });

  const report = reportQuery.data;
  const reportVersion =
    report?.meetings
      .map(({ summary }) => `${summary.id}:${summary.updatedAt}`)
      .join('|') ?? '';
  const reportLabelVersion = getReportNameVisibilityVersion(
    hidePlayerNames,
    reportNameLabels.labels,
  );
  const reportReviewVersion = buildHeadToHeadReportReviewVersion(
    reportVersion,
    selectedReportSections,
    selectedReportBenchmarks,
    reportLabelVersion,
  );
  const reportBenchmarksReady =
    Boolean(reportBenchmarksQuery.data) &&
    !reportBenchmarksQuery.isFetching &&
    !reportBenchmarksQuery.isError;
  const hasReviewedReport =
    Boolean(reportReviewVersion) &&
    reportBenchmarksReady &&
    isReportReviewCurrent(reviewedReport?.version, reportReviewVersion) &&
    (Platform.OS === 'web' || Boolean(reviewedReport?.uri));
  const reportHtml = report && reportBenchmarksQuery.data
    ? buildHeadToHeadReportHtml(report, selectedReportSections, {
        hidePlayerNames,
        labels: reportNameLabels.labels,
        benchmarks: selectedReportBenchmarks,
      })
    : null;
  const isReportBusy = reportAction !== null;
  const reportLabelsReady =
    reportNameVisibility.isReady &&
    !reportNameVisibility.isSaving &&
    (!hidePlayerNames ||
      (reportNameLabels.isReady && reportNameLabels.isValid));

  const trackedServe = report?.insights.serveStats.tracked;
  const opponentServe = report?.insights.serveStats.opponent;
  const recordedSetCount =
    report?.insights.sets.filter((set) => set.pointCount > 0).length ?? 0;
  const serveRows: StatRow[] = report && trackedServe && opponentServe
    ? [
        {
          label: 'First serve in',
          tracked: rateValue(trackedServe.firstServePoints, trackedServe.servicePoints),
          opponent: rateValue(opponentServe.firstServePoints, opponentServe.servicePoints),
        },
        {
          label: 'Second serve in',
          tracked: rateValue(
            report.performance.secondServeInCount,
            report.performance.secondServeAttemptCount,
          ),
          opponent: rateValue(
            Math.max(0, opponentServe.secondServePoints - opponentServe.doubleFaults),
            opponentServe.secondServePoints,
          ),
        },
        {
          label: 'First-serve points won',
          tracked: rateValue(
            trackedServe.firstServePointsWon,
            trackedServe.firstServePoints,
          ),
          opponent: rateValue(
            opponentServe.firstServePointsWon,
            opponentServe.firstServePoints,
          ),
        },
        {
          label: 'Second-serve points won',
          tracked: rateValue(
            trackedServe.secondServePointsWon,
            trackedServe.secondServePoints,
          ),
          opponent: rateValue(
            opponentServe.secondServePointsWon,
            opponentServe.secondServePoints,
          ),
        },
        {
          label: 'Service points won',
          tracked: rateValue(trackedServe.servicePointsWon, trackedServe.servicePoints),
          opponent: rateValue(opponentServe.servicePointsWon, opponentServe.servicePoints),
        },
        {
          label: 'Service games won',
          tracked: rateValue(
            report.insights.serviceGames.tracked.gamesWon,
            report.insights.serviceGames.tracked.gamesPlayed,
          ),
          opponent: rateValue(
            report.insights.serviceGames.opponent.gamesWon,
            report.insights.serviceGames.opponent.gamesPlayed,
          ),
        },
        {
          label: 'Aces tagged',
          tracked: countValue(
            trackedServe.aces,
            trackedServe.servicePoints,
            'service points',
          ),
          opponent: countValue(
            opponentServe.aces,
            opponentServe.servicePoints,
            'service points',
          ),
        },
        {
          label: 'Double faults tagged',
          tracked: countValue(
            trackedServe.doubleFaults,
            trackedServe.servicePoints,
            'service points',
          ),
          opponent: countValue(
            opponentServe.doubleFaults,
            opponentServe.servicePoints,
            'service points',
          ),
        },
        {
          label: 'Aces / service game',
          tracked: averageValue(
            trackedServe.aces,
            report.insights.serviceGames.tracked.gamesPlayed,
            'service games',
          ),
          opponent: averageValue(
            opponentServe.aces,
            report.insights.serviceGames.opponent.gamesPlayed,
            'service games',
          ),
        },
        {
          label: 'Aces / set',
          tracked: averageValue(trackedServe.aces, recordedSetCount, 'sets'),
          opponent: averageValue(opponentServe.aces, recordedSetCount, 'sets'),
        },
        {
          label: 'Aces / match',
          tracked: averageValue(
            trackedServe.aces,
            report.performance.matchesInSample,
            'matches',
          ),
          opponent: averageValue(
            opponentServe.aces,
            report.performance.matchesInSample,
            'matches',
          ),
        },
      ]
    : [];

  const returnRows: StatRow[] = report && trackedServe && opponentServe
    ? [
        {
          label: 'Return points won',
          tracked: rateValue(
            report.insights.returnPointsWon,
            report.insights.trackedReturnPoints,
          ),
          opponent: rateValue(
            trackedServe.servicePoints - trackedServe.servicePointsWon,
            trackedServe.servicePoints,
          ),
        },
        {
          label: 'First-serve return points won',
          tracked: rateValue(
            opponentServe.firstServePoints - opponentServe.firstServePointsWon,
            opponentServe.firstServePoints,
          ),
          opponent: rateValue(
            trackedServe.firstServePoints - trackedServe.firstServePointsWon,
            trackedServe.firstServePoints,
          ),
        },
        {
          label: 'Second-serve return points won',
          tracked: rateValue(
            opponentServe.secondServePoints - opponentServe.secondServePointsWon,
            opponentServe.secondServePoints,
          ),
          opponent: rateValue(
            trackedServe.secondServePoints - trackedServe.secondServePointsWon,
            trackedServe.secondServePoints,
          ),
        },
        {
          label: 'Return games won',
          tracked: rateValue(
            report.insights.serviceGames.opponent.gamesPlayed -
              report.insights.serviceGames.opponent.gamesWon,
            report.insights.serviceGames.opponent.gamesPlayed,
          ),
          opponent: rateValue(
            report.insights.serviceGames.tracked.gamesPlayed -
              report.insights.serviceGames.tracked.gamesWon,
            report.insights.serviceGames.tracked.gamesPlayed,
          ),
        },
        {
          label: 'Total points won',
          tracked: rateValue(
            report.insights.trackedPointsWon,
            report.insights.pointCount,
          ),
          opponent: rateValue(
            report.insights.opponentPointsWon,
            report.insights.pointCount,
          ),
        },
        {
          label: 'Rally-shot winners',
          tracked:
            report.performance.rallyWinnerTagCount > 0
              ? rateValue(
                  report.performance.rallyWinnerCount,
                  report.insights.pointCount,
                )
              : unavailableValue('No rally-shot tags recorded'),
          opponent:
            report.performance.rallyWinnerTagCount > 0
              ? rateValue(
                  report.performance.opponentRallyWinnerCount,
                  report.insights.pointCount,
                )
              : unavailableValue('No rally-shot tags recorded'),
        },
        {
          label: 'Unforced errors',
          tracked:
            report.performance.unforcedErrorTagCount > 0
              ? countValue(
                  report.performance.trackedUnforcedErrors,
                  report.insights.pointCount,
                  'recorded points',
                )
              : unavailableValue('No unforced-error tags recorded'),
          opponent:
            report.performance.unforcedErrorTagCount > 0
              ? countValue(
                  report.performance.opponentUnforcedErrors,
                  report.insights.pointCount,
                  'recorded points',
                )
              : unavailableValue('No unforced-error tags recorded'),
        },
      ]
    : [];

  const breakPointRows: StatRow[] = report
    ? [
        {
          label: 'Break points converted',
          tracked: rateValue(
            report.insights.breakPoints.tracked.converted,
            report.insights.breakPoints.tracked.opportunities,
          ),
          opponent: rateValue(
            report.insights.breakPoints.opponent.converted,
            report.insights.breakPoints.opponent.opportunities,
          ),
        },
        {
          label: 'Break points missed',
          tracked: rateValue(
            report.insights.breakPoints.tracked.opportunities -
              report.insights.breakPoints.tracked.converted,
            report.insights.breakPoints.tracked.opportunities,
          ),
          opponent: rateValue(
            report.insights.breakPoints.opponent.opportunities -
              report.insights.breakPoints.opponent.converted,
            report.insights.breakPoints.opponent.opportunities,
          ),
        },
        {
          label: 'Break points saved',
          tracked: rateValue(
            report.insights.breakPoints.tracked.saved,
            report.insights.breakPoints.tracked.faced,
          ),
          opponent: rateValue(
            report.insights.breakPoints.opponent.saved,
            report.insights.breakPoints.opponent.faced,
          ),
        },
        {
          label: 'Break points lost while serving',
          tracked: rateValue(
            report.insights.breakPoints.tracked.faced -
              report.insights.breakPoints.tracked.saved,
            report.insights.breakPoints.tracked.faced,
          ),
          opponent: rateValue(
            report.insights.breakPoints.opponent.faced -
              report.insights.breakPoints.opponent.saved,
            report.insights.breakPoints.opponent.faced,
          ),
        },
      ]
    : [];
  const personalBreakPointStats =
    report?.personalAverageInsights.breakPoints.tracked;
  const personalBreakPointRows = personalBreakPointStats
    ? breakPointRateRows(personalBreakPointStats)
    : [];
  const personalSurfaceBreakPointRows =
    report?.personalAverageBreakPointsBySurface.map((surfaceBaseline) => ({
      ...surfaceBaseline,
      rows: breakPointRateRows(surfaceBaseline.breakPoints),
    })) ?? [];

  async function previewReport() {
    const html = reportHtml;
    const reviewVersion = reportReviewVersion;
    if (
      !html ||
      !reviewVersion ||
      !reportBenchmarksReady ||
      !reportLabelsReady ||
      isReportBusy
    ) {
      return;
    }
    setReportAction('review');
    setReportError('');
    try {
      const Print = await import('expo-print');
      const uri = await createAndPreviewLocalPdf(html, Platform.OS, Print);
      setReviewedReport({ version: reviewVersion, uri });
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : 'Could not open the report preview.',
      );
    } finally {
      setReportAction(null);
    }
  }

  async function shareReport() {
    const fileUri = reviewedReport?.uri;
    if (
      !fileUri ||
      !hasReviewedReport ||
      !reportBenchmarksReady ||
      isReportBusy ||
      Platform.OS === 'web'
    ) {
      return;
    }
    setReportAction('share');
    setReportError('');
    try {
      const Sharing = await import('expo-sharing');
      await shareReviewedLocalPdf(
        fileUri,
        'Share head-to-head report',
        Sharing,
      );
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : 'Could not prepare the PDF report.',
      );
    } finally {
      setReportAction(null);
    }
  }

  function toggleReportSection(section: string) {
    if (!HEAD_TO_HEAD_REPORT_SECTIONS.some((item) => item.id === section)) return;
    const selectedSection = section as HeadToHeadReportSection;
    setSelectedReportSections((current) =>
      current.includes(selectedSection)
        ? current.filter((item) => item !== selectedSection)
        : [...current, selectedSection],
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            testID="button-back-from-head-to-head"
            accessibilityRole="button"
            accessibilityLabel="Back to match book"
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              MATCHUP INSIGHTS
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Head-to-head
            </Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Compare saved meetings from the tracked player’s point of view. Everything is calculated on this device.
        </Text>

        <View
          style={[
            styles.selectorCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <SelectorRow
            label="TRACKED PLAYER"
            options={trackedPlayerOptions}
            selected={selectedTrackedPlayer}
            onSelect={(name) => {
              setTrackedOverride(name);
              setOpponentOverride('');
              setReviewedReport(null);
              setReportError('');
            }}
            prefix="tracked-player"
            colors={colors}
            emptyMessage="Save a player or record a match to choose a tracked player."
          />
          <SelectorRow
            label="OPPONENT · SAVED MATCHES"
            options={opponentOptions}
            selected={selectedOpponent}
            onSelect={(name) => {
              setOpponentOverride(name);
              setReviewedReport(null);
              setReportError('');
            }}
            prefix="opponent"
            colors={colors}
            emptyMessage={
              selectedTrackedPlayer
                ? `No opponent history is recorded with ${selectedTrackedPlayer} as the tracked player.`
                : 'Choose a tracked player first.'
            }
          />
        </View>

        {matchesQuery.isLoading || playersQuery.isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.mutedCopy, { color: colors.mutedForeground }]}>
              Reading this device’s match book…
            </Text>
          </View>
        ) : matchesQuery.isError ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color={colors.destructive}
            />
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>
              Could not read local matches
            </Text>
            <Text style={[styles.mutedCopy, { color: colors.mutedForeground }]}>
              Your match book remains on this device. Return to the home screen and try again.
            </Text>
          </View>
        ) : !opponentOptions.length ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.stateIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name="git-compare-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>
              No head-to-head meetings yet
            </Text>
            <Text style={[styles.mutedCopy, { color: colors.mutedForeground }]}>
              Record a match with {selectedTrackedPlayer || 'your tracked player'} selected as the tracked player. That opponent will appear here.
            </Text>
          </View>
        ) : reportQuery.isError ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color={colors.destructive}
            />
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>
              Could not calculate this pairing
            </Text>
            <Text style={[styles.mutedCopy, { color: colors.mutedForeground }]}>
              Try again after returning to the match book.
            </Text>
          </View>
        ) : reportQuery.isLoading || !report ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.mutedCopy, { color: colors.mutedForeground }]}>
              Calculating recorded meetings…
            </Text>
          </View>
        ) : report.matchesRecorded === 0 ? (
          <View
            style={[
              styles.stateCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>
              No saved meetings found
            </Text>
            <Text style={[styles.mutedCopy, { color: colors.mutedForeground }]}>
              Only matches recorded with {report.trackedPlayer} as the tracked player are included. Matches recorded from the opposite perspective stay separate.
            </Text>
          </View>
        ) : (
          <>
            <ReportSectionPicker
              testID="head-to-head-report-sections"
              reportType="head-to-head"
              sections={HEAD_TO_HEAD_REPORT_SECTIONS}
              selected={selectedReportSections}
              onToggle={toggleReportSection}
              onSelectAll={() =>
                setSelectedReportSections(allHeadToHeadReportSections())
              }
              onClear={() => setSelectedReportSections([])}
              presets={HEAD_TO_HEAD_REPORT_SECTION_PRESETS}
              onApplyPreset={(sections) => setSelectedReportSections([...sections])}
            />
            <ReportAnonymityToggle
              testID="head-to-head-report-hide-names"
              hidePlayerNames={hidePlayerNames}
              disabled={
                isReportBusy ||
                !reportNameVisibility.isReady ||
                reportNameVisibility.isSaving
              }
              onToggle={reportNameVisibility.toggle}
              labels={reportNameLabels.labels}
              labelsReady={reportNameLabels.isReady}
              labelsDirty={reportNameLabels.isDirty}
              labelsSaving={reportNameLabels.isSaving}
              labelsError={reportNameLabels.errorMessage}
              visibilityError={reportNameVisibility.errorMessage}
              onLabelsChange={reportNameLabels.onChange}
              onSaveLabels={reportNameLabels.save}
            />

            <View
              testID="head-to-head-summary"
              style={[
                styles.summaryCard,
                {
                  backgroundColor: colors.primary,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[styles.summaryEyebrow, { color: colors.primaryForeground }]}>
                {report.trackedPlayer} VS {report.opponent}
              </Text>
              <View style={styles.summaryGrid}>
                <SummaryMetric
                  label="MATCH RECORD"
                  value={`${report.matchesWon}–${report.matchesLost}`}
                  note={`${report.completedMatches} complete · ${report.matchesRecorded} recorded`}
                  colors={colors}
                />
                <SummaryMetric
                  label="SET RECORD"
                  value={`${report.setsWon}–${report.setsLost}`}
                  note={`${report.completedSets} complete · ${report.setsRecorded} recorded`}
                  colors={colors}
                />
                <SummaryMetric
                  label="POINTS WON"
                  value={rateValue(
                    report.insights.trackedPointsWon,
                    report.insights.pointCount,
                  ).value}
                  note={`${report.insights.trackedPointsWon}/${report.insights.pointCount} points`}
                  colors={colors}
                />
                <SummaryMetric
                  label="POINT TAGS"
                  value={String(report.performance.taggedPointCount)}
                  note={`of ${report.insights.pointCount} points`}
                  colors={colors}
                />
              </View>
              <Text
                testID="head-to-head-match-outcome-totals"
                style={[styles.summaryFootnote, { color: colors.primaryForeground }]}
              >
                {formatPlayerMatchOutcomeSummary(report.matchOutcomeTotals)}
              </Text>
              <Text style={[styles.summaryFootnote, { color: colors.primaryForeground }]}>
                Only records captured with this tracked-player orientation are included. Results with tied set counts are not assigned a winner.
              </Text>
            </View>

            <StatTable
              testID="head-to-head-serve-stats"
              title="Serve"
              rows={serveRows}
              trackedName={report.trackedPlayer}
              opponentName={report.opponent}
              colors={colors}
            />
            <StatTable
              testID="head-to-head-return-stats"
              title="Return and points"
              rows={returnRows}
              trackedName={report.trackedPlayer}
              opponentName={report.opponent}
              colors={colors}
            />
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
              Rally-shot winner points use recorded forehand, backhand, volley, overhead, and drop-shot tags; aces are excluded. Unforced errors count tagged net, long, or wide errors that awarded the point to the opponent; forced errors and double faults are separate.
            </Text>
            <StatTable
              testID="head-to-head-break-points"
              title="Break points"
              rows={breakPointRows}
              trackedName={report.trackedPlayer}
              opponentName={report.opponent}
              colors={colors}
            />
            <View
              testID="head-to-head-personal-break-point-average"
              style={[
                styles.sectionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Tracked-player personal average
              </Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                Pooled break-point chances across {report.personalAverageMatches} saved {report.personalAverageMatches === 1 ? 'match' : 'matches'} with {report.trackedPlayer} as the tracked player, including this pairing when present.
              </Text>
              {personalBreakPointRows.map(({ label, value }) => (
                <View
                  key={label}
                  style={[styles.personalAverageRow, { borderTopColor: colors.border }]}
                >
                  <Text style={[styles.personalAverageLabel, { color: colors.foreground }]}>
                    {label}
                  </Text>
                  <View style={styles.statValueColumn}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>
                      {value.value}
                    </Text>
                    <Text style={[styles.statSample, { color: colors.mutedForeground }]}>
                      {value.sample}
                    </Text>
                  </View>
                </View>
              ))}
              <Pressable
                testID="toggle-head-to-head-surface-break-points"
                accessibilityRole="button"
                accessibilityLabel={
                  showSurfaceBreakPoints
                    ? 'Hide surface break-point comparison'
                    : 'Show surface break-point comparison'
                }
                accessibilityState={{ expanded: showSurfaceBreakPoints }}
                onPress={() =>
                  setShowSurfaceBreakPoints((current) => !current)
                }
                style={[
                  styles.surfaceComparisonToggle,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={styles.surfaceComparisonCopy}>
                  <Text
                    style={[
                      styles.surfaceComparisonTitle,
                      { color: colors.foreground },
                    ]}
                  >
                    Compare by court surface
                  </Text>
                  <Text
                    style={[
                      styles.surfaceComparisonSubtitle,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Hard · Clay · Grass · Carpet · Other
                  </Text>
                </View>
                <Ionicons
                  name={showSurfaceBreakPoints ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {showSurfaceBreakPoints ? (
                <View
                  testID="head-to-head-surface-break-point-averages"
                  style={styles.surfaceComparisonList}
                >
                  <Text
                    style={[
                      styles.sectionHint,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Rates pool recorded chances. Match counts include point-recorded matches on each surface, including Other.
                  </Text>
                  {personalSurfaceBreakPointRows.map(
                    ({ surface, matchCount, rows }) => (
                      <View
                        key={surface}
                        style={[
                          styles.surfaceComparisonCard,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.surfaceComparisonHeader}>
                          <Text
                            style={[
                              styles.surfaceComparisonName,
                              { color: colors.foreground },
                            ]}
                          >
                            {surface}
                          </Text>
                          <Text
                            style={[
                              styles.surfaceComparisonMatchCount,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                          </Text>
                        </View>
                        {rows.map(({ label, value }) => (
                          <View
                            key={label}
                            style={[
                              styles.surfaceRateRow,
                              { borderTopColor: colors.border },
                            ]}
                          >
                            <Text
                              style={[
                                styles.surfaceRateLabel,
                                { color: colors.foreground },
                              ]}
                            >
                              {label}
                            </Text>
                            <View style={styles.surfaceRateValue}>
                              <Text
                                style={[
                                  styles.surfaceRateText,
                                  { color: colors.primary },
                                ]}
                              >
                                {value.value}
                              </Text>
                              <Text
                                style={[
                                  styles.surfaceRateSample,
                                  { color: colors.mutedForeground },
                                ]}
                              >
                                {value.sample}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ),
                  )}
                </View>
              ) : null}
            </View>
            <View
              testID="head-to-head-shot-tags"
              style={[
                styles.sectionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Recorded point-ending tags
                </Text>
                <Text style={[styles.countPill, { color: colors.primary }]}>
                  {report.performance.taggedPointCount}/{report.insights.pointCount}
                </Text>
              </View>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                Each rate shows how often the tracked player won points carrying that tag. No tag means it was not recorded, not that it did not happen.
              </Text>
              {report.performance.codeInsights.length ? (
                report.performance.codeInsights.map((item) => (
                  <View
                    key={item.code}
                    style={[styles.tagRow, { borderTopColor: colors.border }]}
                  >
                    <View style={styles.tagIdentity}>
                      <Text style={[styles.tagCode, { color: colors.primary }]}>
                        {item.code}
                      </Text>
                      <Text style={[styles.tagLabel, { color: colors.foreground }]}>
                        {POINT_CODE_LABELS[item.code]}
                      </Text>
                    </View>
                    <View style={styles.tagRate}>
                      <Text style={[styles.statValue, { color: colors.primary }]}>
                        {item.count} tags
                      </Text>
                      <Text style={[styles.statSample, { color: colors.mutedForeground }]}>
                        tracked wins {item.trackedWon}/{item.count} · {item.trackedWinPercent}%
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                  No point-ending tags have been entered for these meetings.
                </Text>
              )}
              {report.performance.shotDirectionTaggedCount > 0 ? (
                <ContextRows
                  title="Shot direction"
                  rows={report.performance.shotDirections}
                  colors={colors}
                />
              ) : null}
              {report.performance.rallyLengthTaggedCount > 0 ? (
                <ContextRows
                  title="Rally length"
                  rows={report.performance.rallyLengths}
                  colors={colors}
                />
              ) : null}
            </View>

            <View
              testID="head-to-head-coaching-notes"
              style={[
                styles.sectionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Coaching observations
                </Text>
                <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              </View>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                These notes use only the recorded outcomes and tags above. Treat small samples as directional.
              </Text>
              {report.performance.feedback.map((note, index) => (
                <View key={`${index}-${note}`} style={styles.feedbackRow}>
                  <View style={[styles.feedbackDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.feedbackText, { color: colors.foreground }]}>
                    {note}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.meetingsHeading}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Recorded meetings
                </Text>
                <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                  Match date, result, and set scores
                </Text>
              </View>
              <Text style={[styles.countPill, { color: colors.primary }]}>
                {report.matchesRecorded}
              </Text>
            </View>
            {report.meetings.map(({ summary, insights }) => (
              <View
                key={summary.id}
                testID={`head-to-head-meeting-${summary.id}`}
                style={[
                  styles.meetingCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.meetingHeader}>
                  <View style={styles.meetingMeta}>
                    <Text style={[styles.meetingDate, { color: colors.foreground }]}>
                      {formatDate(summary.matchDate)}
                    </Text>
                    <Text style={[styles.meetingEvent, { color: colors.mutedForeground }]}>
                      {summary.event?.trim() || 'Match session'}
                      {summary.round?.trim() ? ` · ${summary.round.trim()}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.resultPill,
                      {
                        backgroundColor:
                          summary.status === 'complete'
                            ? colors.secondary
                            : colors.accent,
                        color:
                          summary.status === 'complete'
                            ? colors.secondaryForeground
                            : colors.accentForeground,
                      },
                    ]}
                  >
                    {summary.status === 'complete' ? 'FINAL' : 'LIVE'}
                  </Text>
                </View>
                <Text style={[styles.meetingResult, { color: colors.primary }]}>
                  {matchResult(summary, report)}
                </Text>
                <View style={styles.setList}>
                  {summary.setScores.length ? (
                    summary.setScores.map((set) => (
                      <View
                        key={`${summary.id}-${set.setNumber}`}
                        style={[
                          styles.setScoreRow,
                          { borderTopColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.setNumber, { color: colors.mutedForeground }]}>
                          SET {set.setNumber}
                        </Text>
                        <Text style={[styles.setScore, { color: colors.foreground }]}>
                          {formatSetScore(set)}
                        </Text>
                        <Text style={[styles.setWinner, { color: colors.mutedForeground }]}>
                          {setResult(set, report)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                      No set score recorded.
                    </Text>
                  )}
                </View>
                <View style={[styles.meetingFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.meetingFooterText, { color: colors.mutedForeground }]}>
                    {insights.pointCount} recorded points
                  </Text>
                  <Text style={[styles.meetingFooterText, { color: colors.mutedForeground }]}>
                    {summary.surface} court
                  </Text>
                </View>
              </View>
            ))}

            {reportError ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.errorBanner,
                  { borderColor: colors.destructive },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.destructive}
                />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {reportError}
                </Text>
              </View>
            ) : null}
            {reportBenchmarksQuery.isError ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.errorBanner,
                  { borderColor: colors.destructive },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.destructive}
                />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  Could not read the saved report benchmarks from this device.
                </Text>
                <Pressable
                  testID="button-retry-head-to-head-benchmarks"
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading saved report benchmarks"
                  onPress={() => void reportBenchmarksQuery.refetch()}
                >
                  <Text style={[styles.errorText, { color: colors.primary }]}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {Platform.OS === 'web' ? (
              <Text style={[styles.pdfUnavailable, { color: colors.mutedForeground }]}>
                PDF review and export are available in the Android app.
              </Text>
            ) : (
              <View style={styles.reportActions}>
                <Pressable
                  testID="button-review-head-to-head-pdf"
                  accessibilityRole="button"
                  accessibilityLabel="Review and save head-to-head report as PDF"
                  disabled={
                    isReportBusy ||
                    !reportHtml ||
                    !reportLabelsReady ||
                    !reportBenchmarksReady
                  }
                  onPress={() => void previewReport()}
                  style={[
                    styles.reviewButton,
                    {
                      backgroundColor: colors.secondary,
                      borderRadius: colors.radius,
                      opacity:
                        isReportBusy ||
                        !reportHtml ||
                        !reportLabelsReady ||
                        !reportBenchmarksReady
                          ? 0.5
                          : 1,
                    },
                  ]}
                >
                  {reportAction === 'review' ? (
                    <ActivityIndicator size="small" color={colors.secondaryForeground} />
                  ) : (
                    <Ionicons
                      name="print-outline"
                      size={17}
                      color={colors.secondaryForeground}
                    />
                  )}
                  <Text style={[styles.reviewButtonText, { color: colors.secondaryForeground }]}>
                    {reportAction === 'review' ? 'Opening…' : 'Review / save PDF'}
                  </Text>
                </Pressable>
                {hasReviewedReport ? (
                  <Pressable
                    testID="button-share-head-to-head-pdf"
                    accessibilityRole="button"
                    accessibilityLabel="Share reviewed head-to-head report as PDF"
                    disabled={isReportBusy || !reviewedReport?.uri}
                    onPress={() => void shareReport()}
                    style={[
                      styles.shareButton,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                        opacity: isReportBusy || !reviewedReport?.uri ? 0.5 : 1,
                      },
                    ]}
                  >
                    {reportAction === 'share' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="share-outline" size={18} color={colors.primary} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryMetric({
  label,
  value,
  note,
  colors,
}: {
  label: string;
  value: string;
  note: string;
  colors: Theme;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={[styles.summaryMetricLabel, { color: colors.primaryForeground }]}>
        {label}
      </Text>
      <Text style={[styles.summaryMetricValue, { color: colors.primaryForeground }]}>
        {value}
      </Text>
      <Text style={[styles.summaryMetricNote, { color: colors.primaryForeground }]}>
        {note}
      </Text>
    </View>
  );
}

function ContextRows<T extends string>({
  title,
  rows,
  colors,
}: {
  title: string;
  rows: ContextPerformanceInsight<T>[];
  colors: Theme;
}) {
  return (
      <View style={[styles.contextGroup, { borderTopColor: colors.border }]}>
      <Text style={[styles.contextTitle, { color: colors.foreground }]}>{title}</Text>
      {rows
        .filter((row) => row.count > 0)
        .map((row) => (
          <View key={row.value} style={styles.contextRow}>
            <Text style={[styles.contextLabel, { color: colors.mutedForeground }]}>
              {row.label}
            </Text>
            <Text style={[styles.contextValue, { color: colors.foreground }]}>
              {row.count} tags · tracked wins {row.trackedWon}/{row.count}
              {row.trackedWinPercent === null ? ' · need 3 tags' : ` · ${row.trackedWinPercent}%`}
            </Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 7, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 1 },
  backButton: { width: 38, height: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.4 },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 27, letterSpacing: -0.7 },
  subtitle: { marginBottom: 2, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18 },
  selectorCard: { borderWidth: 1, padding: 12, gap: 12 },
  selectorGroup: { gap: 7 },
  selectorLabel: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  choiceList: { flexDirection: 'row', gap: 7, paddingRight: 4 },
  choiceChip: { maxWidth: 210, minHeight: 35, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  emptyChoice: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16 },
  loadingCard: { minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 8 },
  stateCard: { borderWidth: 1, borderRadius: 14, minHeight: 170, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 9 },
  stateIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontFamily: 'Manrope_700Bold', fontSize: 16, textAlign: 'center' },
  mutedCopy: { maxWidth: 290, fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  summaryCard: { padding: 14, gap: 12 },
  summaryEyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryMetric: { width: '48%', minWidth: 135, flexGrow: 1, gap: 4 },
  summaryMetricLabel: { opacity: 0.78, fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 0.8 },
  summaryMetricValue: { fontFamily: 'Manrope_700Bold', fontSize: 21, fontVariant: ['tabular-nums'] },
  summaryMetricNote: { opacity: 0.82, fontFamily: 'DMSans_400Regular', fontSize: 9 },
  summaryFootnote: { opacity: 0.82, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 14 },
  sectionCard: { borderWidth: 1, borderRadius: 13, padding: 12 },
  sectionTitle: { fontFamily: 'Manrope_700Bold', fontSize: 15 },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, paddingBottom: 7 },
  statHeaderLabel: { width: '38%', fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.6 },
  statHeaderName: { flex: 1, textAlign: 'center', fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.4 },
  statRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { width: '38%', paddingRight: 3, fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 14 },
  statValueColumn: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: 'DMSans_700Bold', fontSize: 11, fontVariant: ['tabular-nums'] },
  statSample: { textAlign: 'center', fontFamily: 'DMSans_400Regular', fontSize: 8, lineHeight: 11 },
  personalAverageRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  surfaceComparisonToggle: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  surfaceComparisonCopy: { flex: 1, gap: 3 },
  surfaceComparisonTitle: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  surfaceComparisonSubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 8 },
  surfaceComparisonList: { gap: 8, marginTop: 8 },
  surfaceComparisonCard: { borderWidth: 1, borderRadius: 10, padding: 10 },
  surfaceComparisonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 },
  surfaceComparisonName: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  surfaceComparisonMatchCount: { fontFamily: 'DMSans_500Medium', fontSize: 8 },
  surfaceRateRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  surfaceRateLabel: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 9, lineHeight: 13 },
  surfaceRateValue: { alignItems: 'flex-end', gap: 1 },
  surfaceRateText: { fontFamily: 'DMSans_700Bold', fontSize: 10, fontVariant: ['tabular-nums'] },
  surfaceRateSample: { fontFamily: 'DMSans_400Regular', fontSize: 7, lineHeight: 10, textAlign: 'right' },
  personalAverageLabel: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  countPill: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  sectionHint: { marginTop: 5, fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 14 },
  tagRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  tagCode: { minWidth: 23, fontFamily: 'DMSans_700Bold', fontSize: 10 },
  tagLabel: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 9 },
  tagRate: { alignItems: 'flex-end', gap: 2 },
  contextGroup: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 8, gap: 6 },
  contextTitle: { fontFamily: 'DMSans_700Bold', fontSize: 9 },
  contextRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  contextLabel: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  contextValue: { flexShrink: 1, textAlign: 'right', fontFamily: 'DMSans_500Medium', fontSize: 8 },
  feedbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 9 },
  feedbackDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  feedbackText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 15 },
  meetingsHeading: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meetingCard: { borderWidth: 1, borderRadius: 13, padding: 12, marginTop: -4 },
  meetingHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  meetingMeta: { flex: 1, gap: 3 },
  meetingDate: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  meetingEvent: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  resultPill: { overflow: 'hidden', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4, fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.5 },
  meetingResult: { marginTop: 8, fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  setList: { marginTop: 7 },
  setScoreRow: { minHeight: 32, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 7 },
  setNumber: { width: 40, fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 0.4 },
  setScore: { flex: 1, fontFamily: 'DMSans_700Bold', fontSize: 11, fontVariant: ['tabular-nums'] },
  setWinner: { maxWidth: '45%', textAlign: 'right', fontFamily: 'DMSans_400Regular', fontSize: 8 },
  meetingFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 5, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meetingFooterText: { fontFamily: 'DMSans_400Regular', fontSize: 8 },
  errorBanner: { minHeight: 40, borderWidth: 1, borderRadius: 8, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  errorText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 10 },
  pdfUnavailable: { textAlign: 'center', fontFamily: 'DMSans_400Regular', fontSize: 10 },
  reportActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  reviewButton: { flex: 1, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reviewButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  shareButton: { width: 44, height: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
