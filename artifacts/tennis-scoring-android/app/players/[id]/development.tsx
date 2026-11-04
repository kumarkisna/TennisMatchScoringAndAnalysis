import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  getLocalMatch,
  listLocalPlayerMatchInsights,
  PLAYER_PERFORMANCE_HISTORY_KEY,
  STROKE_TYPE_OPTIONS,
  type CourtSurface,
  type LocalPoint,
} from '@/lib/local-matches';
import { listLocalPlayers } from '@/lib/local-players';
import {
  buildPlayerPerformanceHistory,
  describePlayerTimingPeriodComparison,
  describePlayerTimingOutcomeComparison,
  formatPlayerMatchOutcomeSummary,
  filterPlayerTrendMatchesByDateRange,
  getPlayerTrendComparisonSampleNotice,
  isValidPlayerTrendDate,
  PLAYER_TREND_METRICS,
  PLAYER_TIMING_SURFACE_GROUPS,
  summarizePlayerMatchOutcomes,
  summarizePlayerStrokeRating,
  summarizePlayerTimingByMatch,
  summarizePlayerTrendMetric,
  type PlayerTrendMatch,
  type PlayerTrendMetricKey,
  summarizePlayerTiming,
  type PlayerTimingGrouping,
  type PlayerTimingGroupSummary,
  type PlayerTimingMatchTrend,
  type PlayerTimingOutcomeContext,
} from '@/lib/player-insights';
import {
  formatTimingDetails,
  getMatchTimingPoints,
  summarizePlayerTimingAcrossMatches,
  type PlayerTimingMatch,
  type TimingIntervalSummary,
} from '@/lib/match-timing';

const timingGroupingOptions: { key: PlayerTimingGrouping; label: string }[] = [
  { key: 'all', label: 'All matches' },
  { key: 'result', label: 'By result' },
  { key: 'surface', label: 'By surface' },
];

function formatDate(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type PlayerTimingHistoryMatch = Omit<PlayerTimingMatch, 'points'> & {
  matchId: string;
  surface: CourtSurface;
  points: LocalPoint[];
};

function trendLabel(match: PlayerTrendMatch) {
  return match.event?.trim() || 'Match';
}

function formatTimingDuration(durationMs: number) {
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function TimingIntervalCard({
  label,
  summary,
  matchesWithSamples,
}: {
  label: string;
  summary: PlayerTimingGroupSummary['firstToSecondServe'];
  matchesWithSamples: number;
}) {
  const colors = useColors();
  return (
    <View style={styles.timingMetric}>
      <Text style={[styles.timingMetricLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.timingMetricValue, { color: colors.foreground }]}>
        {summary.medianMs === null
          ? 'Not recorded'
          : `${formatTimingDuration(summary.medianMs)} median`}
      </Text>
      <Text style={[styles.timingMetricMeta, { color: colors.mutedForeground }]}>
        {summary.count} marked {summary.count === 1 ? 'interval' : 'intervals'} · {matchesWithSamples} {matchesWithSamples === 1 ? 'match' : 'matches'}
      </Text>
      {summary.minMs !== null && summary.maxMs !== null ? (
        <Text style={[styles.timingMetricMeta, { color: colors.mutedForeground }]}>
          Range {formatTimingDuration(summary.minMs)}–{formatTimingDuration(summary.maxMs)}
        </Text>
      ) : null}
    </View>
  );
}

function PlayerTimingTrendChart({
  playerName,
  matches,
}: {
  playerName: string;
  matches: PlayerTrendMatch[];
}) {
  const colors = useColors();
  const trends: PlayerTimingMatchTrend[] =
    summarizePlayerTimingByMatch(matches);
  if (trends.length === 0) {
    return (
      <View
        testID="player-timing-match-trend-empty"
        style={[
          styles.timingTrendEmpty,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.timingUnavailable, { color: colors.mutedForeground }]}>
          No matches fall within the selected date range.
        </Text>
      </View>
    );
  }

  const chartWidth = Math.max(320, trends.length * 76);
  const chartHeight = 212;
  const left = 45;
  const right = chartWidth - 12;
  const xFor = (index: number) =>
    trends.length === 1
      ? (left + right) / 2
      : left + (index * (right - left)) / (trends.length - 1);
  const panels = [
    {
      key: 'firstToSecondServe',
      label: 'First fault to second serve',
      color: colors.primary,
      top: 20,
      bottom: 69,
      countY: 84,
      dateY: null,
    },
    {
      key: 'betweenPoints',
      label: 'Between points',
      color: colors.accent,
      top: 106,
      bottom: 155,
      countY: 171,
      dateY: 202,
    },
  ] as const satisfies readonly {
    key: 'firstToSecondServe' | 'betweenPoints';
    label: string;
    color: string;
    top: number;
    bottom: number;
    countY: number;
    dateY: number | null;
  }[];
  const accessibilityLabel = trends
    .map((match) => {
      const serve = match.firstToSecondServe;
      const between = match.betweenPoints;
      const event = match.event ? `, ${match.event}` : '';
      return `${formatDate(match.date)}, ${match.opponent}${event}: first fault to second serve ${
        serve.medianMs === null
          ? 'unavailable'
          : `${formatTimingDuration(serve.medianMs)}, ${serve.count} samples`
      }; between points ${
        between.medianMs === null
          ? 'unavailable'
          : `${formatTimingDuration(between.medianMs)}, ${between.count} samples`
      }`;
    })
    .join('. ');

  return (
    <View
      testID="player-timing-match-trend"
      style={[
        styles.timingTrendCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.timingGroupTitle, { color: colors.foreground }]}>
        Timing by match · {playerName}
      </Text>
      <Text style={[styles.timingTrendNote, { color: colors.mutedForeground }]}>
        Each point is that match’s median. n = marked intervals; gaps mean none
        were recorded.
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScrollContent}
      >
        <Svg
          width={chartWidth}
          height={chartHeight}
          accessibilityLabel={accessibilityLabel}
        >
          {panels.map((panel) => {
            const values = trends
              .map((match) => match[panel.key].medianMs)
              .filter((value): value is number => value !== null);
            const hasSamples = values.length > 0;
            const minValue = hasSamples
              ? values.reduce((minimum, value) => Math.min(minimum, value), Infinity)
              : 0;
            const maxValue = hasSamples
              ? values.reduce((maximum, value) => Math.max(maximum, value), 0)
              : 1;
            const padding = hasSamples
              ? Math.max((maxValue - minValue) * 0.15, maxValue * 0.08, 1000)
              : 0;
            const min = Math.max(0, minValue - padding);
            const max = hasSamples
              ? Math.max(maxValue + padding, min + 1)
              : 1;
            const yFor = (value: number) =>
              panel.bottom -
              ((value - min) / (max - min)) * (panel.bottom - panel.top);
            let pathData = '';
            let isSegmentOpen = false;
            trends.forEach((match, index) => {
              const value = match[panel.key].medianMs;
              if (value === null) {
                isSegmentOpen = false;
                return;
              }
              pathData += `${isSegmentOpen ? 'L' : 'M'} ${xFor(index)} ${yFor(value)} `;
              isSegmentOpen = true;
            });

            return (
              <G key={panel.key}>
                <SvgText
                  x={left}
                  y={panel.top - 7}
                  fill={panel.color}
                  fontSize={9}
                  fontWeight="600"
                >
                  {panel.label}
                </SvgText>
                {[0, 1, 2].map((tickIndex) => {
                  const y =
                    panel.top +
                    (tickIndex / 2) * (panel.bottom - panel.top);
                  const tickValue = max - (tickIndex / 2) * (max - min);
                  return (
                    <G key={`${panel.key}-tick-${tickIndex}`}>
                      <Line
                        x1={left}
                        x2={right}
                        y1={y}
                        y2={y}
                        stroke={colors.border}
                        strokeWidth={1}
                      />
                      {hasSamples ? (
                        <SvgText
                          x={left - 5}
                          y={y + 3}
                          fill={colors.mutedForeground}
                          fontSize={7}
                          textAnchor="end"
                        >
                          {formatTimingDuration(tickValue)}
                        </SvgText>
                      ) : null}
                    </G>
                  );
                })}
                {hasSamples ? (
                  <Path
                    d={pathData}
                    fill="none"
                    stroke={panel.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <SvgText
                    x={(left + right) / 2}
                    y={(panel.top + panel.bottom) / 2 + 3}
                    fill={colors.mutedForeground}
                    fontSize={9}
                    textAnchor="middle"
                  >
                    No marked intervals
                  </SvgText>
                )}
                {trends.map((match, index) => {
                  const summary = match[panel.key];
                  const value = summary.medianMs;
                  const x = xFor(index);
                  const y = value === null ? null : yFor(value);
                  return (
                    <G key={`${panel.key}-${match.id}`}>
                      {value !== null && y !== null ? (
                        <>
                          <Circle
                            cx={x}
                            cy={y}
                            r={3.5}
                            fill={panel.color}
                            stroke={colors.card}
                            strokeWidth={1.5}
                          />
                          <SvgText
                            x={x}
                            y={y <= panel.top + 10 ? y + 12 : y - 7}
                            fill={panel.color}
                            fontSize={8}
                            fontWeight="600"
                            textAnchor="middle"
                          >
                            {formatTimingDuration(value)}
                          </SvgText>
                        </>
                      ) : null}
                      <SvgText
                        x={x}
                        y={panel.countY}
                        fill={colors.mutedForeground}
                        fontSize={8}
                        textAnchor="middle"
                      >
                        {`n=${summary.count}`}
                      </SvgText>
                      {panel.dateY !== null ? (
                        <SvgText
                          x={x}
                          y={panel.dateY}
                          fill={colors.mutedForeground}
                          fontSize={8}
                          textAnchor="middle"
                        >
                          {formatDate(match.date)}
                        </SvgText>
                      ) : null}
                    </G>
                  );
                })}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

function PlayerTimingHistory({
  playerName,
  matches,
  grouping,
  onGroupingChange,
}: {
  playerName: string;
  matches: PlayerTrendMatch[];
  grouping: PlayerTimingGrouping;
  onGroupingChange: (grouping: PlayerTimingGrouping) => void;
}) {
  const colors = useColors();
  const groups = summarizePlayerTiming(matches, grouping);
  const hasTimingSamples = matches.some(
    (match) =>
      match.timing.firstToSecondServeMs.length > 0 ||
      match.timing.betweenPointsMs.length > 0,
  );

  return (
    <View testID="player-timing-history">
      <Text style={[styles.sectionTitle, styles.matchListHeading, { color: colors.foreground }]}>
        Serve and reset timing
      </Text>
      <Text style={[styles.countHint, { color: colors.mutedForeground }]}>
        Manual markers only; longer times are not automatically better or worse. Date filters above apply.
      </Text>
      <PlayerTimingTrendChart playerName={playerName} matches={matches} />
      <View style={styles.timingGroupingChoices}>
        {timingGroupingOptions.map((option) => {
          const selected = grouping === option.key;
          return (
            <Pressable
              key={option.key}
              testID={`button-player-timing-group-${option.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onGroupingChange(option.key)}
              style={[
                styles.metricChip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.metricChipText,
                  { color: selected ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {groups.map((group) => (
        <View
          key={group.key}
          testID={`player-timing-group-${group.key}`}
          style={[
            styles.timingGroupCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.timingGroupTitle, { color: colors.foreground }]}>
            {group.label}
          </Text>
          {!hasTimingSamples && grouping === 'all' ? (
            <Text style={[styles.timingUnavailable, { color: colors.mutedForeground }]}>
              No timing markers were recorded in these matches.
            </Text>
          ) : (
            <View style={styles.timingMetrics}>
              <TimingIntervalCard
                label="First fault to second serve"
                summary={group.firstToSecondServe}
                matchesWithSamples={group.matchesWithServeSamples}
              />
              <TimingIntervalCard
                label="Between points"
                summary={group.betweenPoints}
                matchesWithSamples={group.matchesWithBetweenPointSamples}
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function PerformanceChart({
  matches,
  metric,
}: {
  matches: PlayerTrendMatch[];
  metric: PlayerTrendMetricKey;
}) {
  const colors = useColors();
  const chartWidth = Math.max(300, matches.length * 66);
  const left = 32;
  const right = chartWidth - 12;
  const top = 15;
  const bottom = 132;
  const xFor = (index: number) =>
    matches.length === 1
      ? (left + right) / 2
      : left + (index * (right - left)) / (matches.length - 1);
  const yFor = (value: number) =>
    bottom - (value / 100) * (bottom - top);
  let pathData = '';
  let isSegmentOpen = false;

  matches.forEach((match, index) => {
    const value = match.metrics[metric].percent;
    if (value === null) {
      isSegmentOpen = false;
      return;
    }
    const command = isSegmentOpen ? 'L' : 'M';
    pathData += `${command} ${xFor(index)} ${yFor(value)} `;
    isSegmentOpen = true;
  });

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chartScrollContent}
    >
      <Svg
        width={chartWidth}
        height={171}
        accessibilityLabel={`${PLAYER_TREND_METRICS.find((item) => item.key === metric)?.label ?? 'Performance'} across ${matches.length} recorded matches`}
      >
        {[0, 50, 100].map((tick) => {
          const y = yFor(tick);
          return (
            <G key={tick}>
              <Line
                x1={left}
                x2={right}
                y1={y}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
              />
              <SvgText
                x={left - 7}
                y={y + 4}
                fill={colors.mutedForeground}
                fontSize={9}
                textAnchor="end"
              >
                {tick}%
              </SvgText>
            </G>
          );
        })}
        <Path
          d={pathData}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {matches.map((match, index) => {
          const value = match.metrics[metric].percent;
          const x = xFor(index);
          return (
            <G key={match.id}>
              {value !== null ? (
                <Circle
                  cx={x}
                  cy={yFor(value)}
                  r={4}
                  fill={colors.primary}
                  stroke={colors.card}
                  strokeWidth={2}
                />
              ) : (
                <Circle
                  cx={x}
                  cy={bottom + 8}
                  r={3}
                  fill={colors.mutedForeground}
                />
              )}
              <SvgText
                x={x}
                y={bottom + 29}
                fill={colors.mutedForeground}
                fontSize={9}
                textAnchor="middle"
              >
                {formatDate(match.date).replace(/, \d{4}$/, '')}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

function PlayerSelectionCard({
  label,
  playerName,
  onPress,
  testID,
}: {
  label: string;
  playerName: string;
  onPress: () => void;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${playerName}. Choose a saved player.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.playerSelectionCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.playerSelectionLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.playerSelectionValue}>
        <Text
          numberOfLines={1}
          style={[styles.playerSelectionName, { color: colors.foreground }]}
        >
          {playerName}
        </Text>
        <Ionicons name="chevron-down" size={15} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

function PlayerPickerModal({
  visible,
  target,
  players,
  excludePlayerId,
  selectedPlayerId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  target: 'primary' | 'comparison' | null;
  players: { id: string; name: string }[];
  excludePlayerId: string;
  selectedPlayerId: string;
  onSelect: (playerId: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const availablePlayers = players.filter(
    (player) => player.id !== excludePlayerId,
  );
  const targetLabel =
    target === 'primary' ? 'Player 1' : 'Player 2';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close saved player selection"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.modalHeading}>
            <View style={styles.modalHeadingCopy}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Choose {targetLabel}
              </Text>
              <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>
                Select a saved player on this device.
              </Text>
            </View>
            <Pressable
              testID="button-close-trend-player-picker"
              accessibilityRole="button"
              accessibilityLabel="Close player selection"
              onPress={onClose}
              hitSlop={8}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={19} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.playerOptions}
            contentContainerStyle={styles.playerOptionsContent}
            showsVerticalScrollIndicator={false}
          >
            {availablePlayers.length === 0 ? (
              <Text style={[styles.modalEmpty, { color: colors.mutedForeground }]}>
                Save another player on this device to compare match histories.
              </Text>
            ) : (
              availablePlayers.map((player) => {
                const selected = player.id === selectedPlayerId;
                return (
                  <Pressable
                    key={player.id}
                    testID={`option-trend-player-${player.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${player.name}${selected ? ', selected' : ''}`}
                    onPress={() => onSelect(player.id)}
                    style={[
                      styles.playerOption,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.secondary : colors.card,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.playerOptionName, { color: colors.foreground }]}
                    >
                      {player.name}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={17}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ComparisonPerformanceChart({
  primaryName,
  primaryMatches,
  comparisonName,
  comparisonMatches,
  metric,
  primaryColor,
  comparisonColor,
}: {
  primaryName: string;
  primaryMatches: PlayerTrendMatch[];
  comparisonName: string;
  comparisonMatches: PlayerTrendMatch[];
  metric: PlayerTrendMetricKey;
  primaryColor: string;
  comparisonColor: string;
}) {
  const colors = useColors();
  const dates = [
    ...new Set(
      [...primaryMatches, ...comparisonMatches].map((match) =>
        match.date.slice(0, 10),
      ),
    ),
  ].sort();
  const chartWidth = Math.max(300, dates.length * 66);
  const left = 32;
  const right = chartWidth - 12;
  const top = 15;
  const bottom = 132;
  const xFor = (date: string) =>
    dates.length === 1
      ? (left + right) / 2
      : left + (dates.indexOf(date.slice(0, 10)) * (right - left)) / (dates.length - 1);
  const yFor = (value: number) =>
    bottom - (value / 100) * (bottom - top);
  const series = [
    { id: 'primary', matches: primaryMatches, color: primaryColor },
    { id: 'comparison', matches: comparisonMatches, color: comparisonColor },
  ];
  const pathFor = (matches: PlayerTrendMatch[]) => {
    let path = '';
    let segmentOpen = false;
    for (const match of matches) {
      const value = match.metrics[metric].percent;
      if (value === null) {
        segmentOpen = false;
        continue;
      }
      path += `${segmentOpen ? 'L' : 'M'} ${xFor(match.date)} ${yFor(value)} `;
      segmentOpen = true;
    }
    return path;
  };

  return (
    <>
      <View style={styles.chartLegend}>
        {[
          { id: 'primary', name: primaryName, color: primaryColor },
          { id: 'comparison', name: comparisonName, color: comparisonColor },
        ].map((item) => (
          <View key={item.id} style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: item.color }]} />
            <Text
              numberOfLines={1}
              style={[styles.legendText, { color: colors.foreground }]}
            >
              {item.name}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScrollContent}
      >
        <Svg
          width={chartWidth}
          height={171}
          accessibilityLabel={`${primaryName} and ${comparisonName} ${PLAYER_TREND_METRICS.find((item) => item.key === metric)?.label ?? 'performance'} by match date`}
        >
          {[0, 50, 100].map((tick) => {
            const y = yFor(tick);
            return (
              <G key={tick}>
                <Line
                  x1={left}
                  x2={right}
                  y1={y}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                />
                <SvgText
                  x={left - 7}
                  y={y + 4}
                  fill={colors.mutedForeground}
                  fontSize={9}
                  textAnchor="end"
                >
                  {tick}%
                </SvgText>
              </G>
            );
          })}
          {series.map((item) => {
            const path = pathFor(item.matches);
            return path ? (
              <Path
                key={`${item.id}-path`}
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null;
          })}
          {series.flatMap((item) =>
            item.matches.map((match) => {
              const value = match.metrics[metric].percent;
              return (
                <Circle
                  key={`${item.id}-${match.id}`}
                  cx={xFor(match.date)}
                  cy={value === null ? bottom + 8 : yFor(value)}
                  r={value === null ? 3 : 4}
                  fill={value === null ? colors.mutedForeground : item.color}
                  stroke={value === null ? 'none' : colors.card}
                  strokeWidth={2}
                />
              );
            }),
          )}
          {dates.map((date) => (
            <SvgText
              key={date}
              x={xFor(date)}
              y={bottom + 29}
              fill={colors.mutedForeground}
              fontSize={9}
              textAnchor="middle"
            >
              {formatDate(date).replace(/, \d{4}$/, '')}
            </SvgText>
          ))}
        </Svg>
      </ScrollView>
    </>
  );
}

function TrendSummaryCard({
  playerName,
  matches,
  metric,
  color,
}: {
  playerName: string;
  matches: PlayerTrendMatch[];
  metric: PlayerTrendMetricKey;
  color: string;
}) {
  const colors = useColors();
  const summary = summarizePlayerTrendMetric(matches, metric);
  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.summaryNameRow}>
        <View style={[styles.playerDot, { backgroundColor: color }]} />
        <Text
          numberOfLines={1}
          style={[styles.summaryName, { color: colors.foreground }]}
        >
          {playerName}
        </Text>
      </View>
      <Text style={[styles.summaryPercent, { color }]}>
        {summary.percent === null ? 'Unavailable' : `${summary.percent}%`}
      </Text>
      <Text style={[styles.summaryMeta, { color: colors.mutedForeground }]}>
        {summary.total === 0
          ? `0 recorded ${summary.countLabel}`
          : `${summary.won} of ${summary.total} ${summary.countLabel}`}
      </Text>
      <Text style={[styles.summaryMeta, { color: colors.mutedForeground }]}>
        {summary.sampledMatchCount} of {summary.matchCount} matches sampled
      </Text>
    </View>
  );
}

function matchOutcomeLabel(match: PlayerTrendMatch): string {
  if (match.status !== 'complete') return 'In progress';
  if (match.outcomeType === 'retirement') {
    return match.result === 'win' ? 'Won by retirement' : 'Lost by retirement';
  }
  if (match.outcomeType === 'walkover') {
    return match.result === 'win' ? 'Won by walkover' : 'Lost by walkover';
  }
  if (match.result === 'no_winner') return 'Ordinary · no clear winner';
  return match.result === 'win' ? 'Ordinary · win' : 'Ordinary · loss';
}

function MatchOutcomeSummaryCard({
  playerName,
  matches,
  testID,
}: {
  playerName: string;
  matches: PlayerTrendMatch[];
  testID: string;
}) {
  const colors = useColors();
  if (matches.length === 0) return null;
  const summary = summarizePlayerMatchOutcomes(matches);
  return (
    <View
      testID={testID}
      style={[
        styles.summaryCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text numberOfLines={1} style={[styles.summaryName, { color: colors.foreground }]}>
        Match results · {playerName}
      </Text>
      <Text style={[styles.summaryMeta, { color: colors.mutedForeground }]}>
        {formatPlayerMatchOutcomeSummary(summary)}
      </Text>
      <Text style={[styles.summaryMeta, { color: colors.mutedForeground }]}>
        In progress: {summary.inProgress}
      </Text>
    </View>
  );
}

function StrokeRatingHistory({
  playerName,
  matches,
  testIDPrefix,
}: {
  playerName: string;
  matches: PlayerTrendMatch[];
  testIDPrefix: string;
}) {
  const colors = useColors();
  return (
    <View testID={`${testIDPrefix}-stroke-rating-trends`} style={styles.strokeRatingSection}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Stroke self-ratings · {playerName}
      </Text>
      <Text style={[styles.countHint, { color: colors.mutedForeground }]}>
        These are the player’s own 1–10 ratings, not calculated performance scores. Differences are observations, not proof of improvement. Unrated sets are omitted rather than treated as zero.
      </Text>
      {STROKE_TYPE_OPTIONS.map((stroke) => {
        const summary = summarizePlayerStrokeRating(matches, stroke.value);
        const ratedMatches = matches.filter(
          (match) => match.strokeRatings[stroke.value]?.samples.length,
        );
        return (
          <View
            key={stroke.value}
            testID={`${testIDPrefix}-stroke-rating-${stroke.value}`}
            style={[
              styles.strokeRatingCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.strokeRatingHeading}>
              <Text style={[styles.strokeRatingName, { color: colors.foreground }]}>
                {stroke.label}
              </Text>
              <Text style={[styles.strokeRatingAverage, { color: colors.primary }]}>
                {summary.average === null ? 'Unavailable' : `${summary.average}/10`}
              </Text>
            </View>
            <Text style={[styles.strokeRatingMeta, { color: colors.mutedForeground }]}>
              {summary.sampleCount === 0
                ? `No ratings in ${summary.matchCount} selected matches`
                : `${summary.sampleCount} rated ${summary.sampleCount === 1 ? 'set' : 'sets'} across ${summary.sampledMatchCount} ${summary.sampledMatchCount === 1 ? 'match' : 'matches'} · average of recorded set ratings`}
            </Text>
            {ratedMatches.map((match) => {
              const samples = match.strokeRatings[stroke.value]?.samples ?? [];
              return (
                <View
                  key={match.id}
                  style={[
                    styles.strokeRatingMatch,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <Text style={[styles.strokeRatingMatchMeta, { color: colors.mutedForeground }]}>
                    {`${match.event?.trim() || 'Match'} · vs ${match.opponent} · ${formatDate(match.date)}`}
                  </Text>
                  <Text style={[styles.strokeRatingSamples, { color: colors.foreground }]}>
                    {samples
                      .map((sample) => `Set ${sample.setNumber}: ${sample.rating}/10`)
                      .join(' · ')}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function PlayerTimingAverageCard({
  playerName,
  periodLabel,
  selectedMatches,
  outsideMatches,
  selectedMatchCount,
  dateRangeActive,
  outsidePeriodAvailable,
  testID,
}: {
  playerName: string;
  periodLabel: string;
  selectedMatches: PlayerTimingHistoryMatch[];
  outsideMatches: PlayerTimingHistoryMatch[];
  selectedMatchCount: number;
  dateRangeActive: boolean;
  outsidePeriodAvailable: boolean;
  testID: string;
}) {
  const colors = useColors();
  const selected = summarizePlayerTimingAcrossMatches(selectedMatches);
  const outside = summarizePlayerTimingAcrossMatches(outsideMatches);
  const selectedMarkedMatches = selectedMatches.filter((match) =>
    match.points.some(
      (point) =>
        point.pointStartedAtMs !== undefined ||
        point.firstServeFaultAtMs !== undefined ||
        point.secondServeAtMs !== undefined,
    ),
  ).length;
  const rows: {
    label: string;
    selected: TimingIntervalSummary;
    outside: TimingIntervalSummary;
  }[] = [
    {
      label: 'First fault to second serve',
      selected: selected.firstToSecondServe.tracked,
      outside: outside.firstToSecondServe.tracked,
    },
    {
      label: 'Between all recorded points',
      selected: selected.betweenPoints.all,
      outside: outside.betweenPoints.all,
    },
    {
      label: 'Between points · same game',
      selected: selected.betweenPoints.sameGame,
      outside: outside.betweenPoints.sameGame,
    },
    {
      label: 'After own point win',
      selected: selected.betweenPoints.afterTrackedWin,
      outside: outside.betweenPoints.afterTrackedWin,
    },
    {
      label: 'After own point loss',
      selected: selected.betweenPoints.afterTrackedLoss,
      outside: outside.betweenPoints.afterTrackedLoss,
    },
    {
      label: 'After own tagged error or double fault',
      selected: selected.betweenPoints.afterTrackedError,
      outside: outside.betweenPoints.afterTrackedError,
    },
    {
      label: 'Between-game changeovers',
      selected: selected.betweenPoints.gameChangeover,
      outside: outside.betweenPoints.gameChangeover,
    },
  ];
  const outcomeComparisons: {
    context: PlayerTimingOutcomeContext;
    testID: string;
    label: string;
  }[] = [
    {
      context: 'afterTrackedWin',
      testID: 'player-timing-after-wins-comparison',
      label: `After point wins by ${playerName}`,
    },
    {
      context: 'afterTrackedLoss',
      testID: 'player-timing-after-losses-comparison',
      label: `After point losses by ${playerName}`,
    },
  ];
  const surfaceComparisons = PLAYER_TIMING_SURFACE_GROUPS.flatMap(
    ({ key, label }) => {
      const selectedSurfaceMatches = selectedMatches.filter(
        (match) => match.surface === key,
      );
      const outsideSurfaceMatches = outsideMatches.filter(
        (match) => match.surface === key,
      );
      if (
        selectedSurfaceMatches.length === 0 &&
        outsideSurfaceMatches.length === 0
      ) {
        return [];
      }
      return [
        {
          key,
          label: key === 'Other' ? 'Other surfaces' : `${label} court`,
          selected: summarizePlayerTimingAcrossMatches(selectedSurfaceMatches),
          baseline: summarizePlayerTimingAcrossMatches(outsideSurfaceMatches),
          baselineLabel:
            key === 'Other'
              ? 'other saved matches on other surfaces'
              : `other saved ${label.toLowerCase()}-court matches`,
          surfaceLabel:
            key === 'Other'
              ? 'other surfaces'
              : `${label.toLowerCase()} courts`,
        },
      ];
    },
  );

  return (
    <View
      testID={testID}
      style={[
        styles.timingAverageCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.timingAverageHeading}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Timing and reset patterns · {playerName}
        </Text>
        <Text style={[styles.sampleCount, { color: colors.mutedForeground }]}>
          {selectedMatchCount} matches
        </Text>
      </View>
      <Text style={[styles.dateRangeHint, { color: colors.mutedForeground }]}>
        {periodLabel}: {selectedMarkedMatches} of {selectedMatchCount} matches
        have at least one timing marker. Unmarked points are not counted as zero.
      </Text>
      {rows.map((row) => (
        <View
          key={row.label}
          style={[styles.timingAverageRow, { borderTopColor: colors.border }]}
        >
          <Text style={[styles.timingAverageLabel, { color: colors.foreground }]}>
            {row.label}
          </Text>
          <Text style={[styles.timingAverageValue, { color: colors.primary }]}>
            {formatTimingDetails(row.selected)}
          </Text>
          {outsidePeriodAvailable ? (
            <Text
              style={[
                styles.timingAverageBaseline,
                { color: colors.mutedForeground },
              ]}
            >
              Outside selected dates: {formatTimingDetails(row.outside)}
            </Text>
          ) : null}
        </View>
      ))}
      {outsidePeriodAvailable ? (
        <>
          <Text style={[styles.timingAverageInsight, { color: colors.foreground }]}>
            {describePlayerTimingPeriodComparison(selected, outside)}
          </Text>
          <View style={styles.timingOutcomeComparisons}>
            {outcomeComparisons.map((comparison) => (
              <View
                key={comparison.context}
                testID={comparison.testID}
                style={[
                  styles.timingOutcomeComparison,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.timingAverageLabel,
                    { color: colors.foreground },
                  ]}
                >
                  {comparison.label}
                </Text>
                <Text
                  style={[
                    styles.timingAverageBaseline,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {describePlayerTimingOutcomeComparison(
                    selected,
                    outside,
                    comparison.context,
                    playerName,
                  )}
                </Text>
              </View>
            ))}
          </View>
          {surfaceComparisons.length > 0 ? (
            <View
              testID="player-timing-surface-comparisons"
              style={styles.timingSurfaceComparisons}
            >
              <Text
                style={[styles.timingAverageLabel, { color: colors.foreground }]}
              >
                Reset pace by court surface
              </Text>
              {surfaceComparisons.map((comparison) => (
                <View
                  key={comparison.key}
                  style={[
                    styles.timingSurfaceComparison,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.timingAverageLabel,
                      { color: colors.foreground },
                    ]}
                  >
                    {comparison.label}
                  </Text>
                  <Text
                    style={[
                      styles.timingAverageBaseline,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {describePlayerTimingPeriodComparison(
                      comparison.selected,
                      comparison.baseline,
                      comparison.baselineLabel,
                      comparison.surfaceLabel,
                    )}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : dateRangeActive ? (
        <Text style={[styles.dateRangeHint, { color: colors.mutedForeground }]}>
          No saved matches fall outside this date range, so there is no personal
          baseline to compare.
        </Text>
      ) : (
        <Text style={[styles.dateRangeHint, { color: colors.mutedForeground }]}>
          Choose a date range to compare this period with your other saved matches.
          Shorter pauses suggest quicker resets, not faster rally speed. The event
          markers are manual tap estimates.
        </Text>
      )}
    </View>
  );
}

function PlayerTrendHistory({
  playerName,
  matches,
  metric,
  color,
  testIDPrefix,
}: {
  playerName: string;
  matches: PlayerTrendMatch[];
  metric: PlayerTrendMetricKey;
  color: string;
  testIDPrefix: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.historySection}>
      <View style={styles.historyHeading}>
        <View style={[styles.playerDot, { backgroundColor: color }]} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {playerName}
        </Text>
        <Text style={[styles.sampleCount, { color: colors.mutedForeground }]}>
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </Text>
      </View>
      {matches.length === 0 ? (
        <View
          style={[
            styles.emptyHistory,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.matchMeta, { color: colors.mutedForeground }]}>
            No saved matches in this date range.
          </Text>
        </View>
      ) : (
        matches.map((match) => {
          const value = match.metrics[metric];
          const valueText =
            value.percent === null ? 'Unavailable' : `${value.percent}%`;
          const countText =
            value.total === 0
              ? `No ${value.countLabel} recorded`
              : `${value.won} of ${value.total} ${value.countLabel}`;
          return (
            <View
              key={match.id}
              testID={`${testIDPrefix}-match-${match.id}`}
              style={[
                styles.matchRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.matchCopy}>
                <Text style={[styles.matchName, { color: colors.foreground }]}>
                  {trendLabel(match)}
                </Text>
                <Text style={[styles.matchMeta, { color: colors.mutedForeground }]}>
                  {`vs ${match.opponent} · ${formatDate(match.date)}`}
                  {match.round ? ` · ${match.round}` : ''}
                </Text>
                <Text style={[styles.matchMeta, { color: colors.mutedForeground }]}>
                  {matchOutcomeLabel(match)}
                </Text>
                <Text style={[styles.matchCount, { color: colors.mutedForeground }]}>
                  {countText}
                </Text>
              </View>
              <Text
                accessibilityLabel={`${valueText}, ${countText}`}
                style={[styles.matchPercent, { color: value.percent === null ? colors.mutedForeground : color }]}
              >
                {valueText}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function TrendDateRangeFilter({
  startDate,
  endDate,
  error,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: {
  startDate: string;
  endDate: string;
  error: string | null;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClear: () => void;
}) {
  const colors = useColors();
  const hasDate = Boolean(startDate || endDate);
  return (
    <View
      style={[
        styles.dateRangeCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.dateRangeHeader}>
        <Text style={[styles.dateRangeTitle, { color: colors.foreground }]}>
          Filter by match date
        </Text>
        {hasDate ? (
          <Pressable
            testID="button-clear-trend-date-range"
            accessibilityRole="button"
            onPress={onClear}
            style={styles.dateRangeClear}
          >
            <Text style={[styles.dateRangeClearText, { color: colors.primary }]}>
              Clear
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.dateRangeHint, { color: colors.mutedForeground }]}>
        Dates use YYYY-MM-DD. Leave either date blank for an open-ended range.
      </Text>
      <View style={styles.dateRangeFields}>
        <View style={styles.dateRangeField}>
          <Text style={[styles.dateRangeLabel, { color: colors.mutedForeground }]}>
            From
          </Text>
          <TextInput
            testID="input-trend-date-start"
            accessibilityLabel="Start date, YYYY-MM-DD"
            value={startDate}
            onChangeText={onStartDateChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            returnKeyType="done"
            style={[
              styles.dateRangeInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
          />
        </View>
        <View style={styles.dateRangeField}>
          <Text style={[styles.dateRangeLabel, { color: colors.mutedForeground }]}>
            To
          </Text>
          <TextInput
            testID="input-trend-date-end"
            accessibilityLabel="End date, YYYY-MM-DD"
            value={endDate}
            onChangeText={onEndDateChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            returnKeyType="done"
            style={[
              styles.dateRangeInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
          />
        </View>
      </View>
      <Text
        testID={error ? 'trend-date-range-error' : 'trend-date-range-hint'}
        accessibilityRole={error ? 'alert' : undefined}
        style={[
          styles.dateRangeHint,
          { color: error ? colors.destructive : colors.mutedForeground },
        ]}
      >
        {error
          ? `${error} All matches remain visible until corrected.`
          : 'The selected start and end dates are both included.'}
      </Text>
    </View>
  );
}

async function loadPlayerTrendHistory(playerId: string) {
  const players = await listLocalPlayers();
  const player = players.find((item) => item.id === playerId);
  if (!player) return null;
  const records = await listLocalPlayerMatchInsights(player.id, players);
  const timingMatches = (
    await Promise.all(
      records.map(async ({ match, playerSide }) => {
        const localMatch = await getLocalMatch(match.id);
        return localMatch
          ? {
              matchId: match.id,
              playerSide,
              surface: match.surface,
              points: getMatchTimingPoints(localMatch),
            }
          : null;
      }),
    )
  ).filter(
    (match): match is PlayerTimingHistoryMatch => match !== null,
  );
  return {
    player,
    matches: buildPlayerPerformanceHistory(records),
    timingMatches,
  };
}

export default function PlayerDevelopmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const routePlayerId = Array.isArray(id) ? id[0] ?? '' : id ?? '';
  const [primaryPlayerId, setPrimaryPlayerId] = useState(routePlayerId);
  const [comparisonPlayerId, setComparisonPlayerId] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<
    'primary' | 'comparison' | null
  >(null);
  const [selectedMetric, setSelectedMetric] =
    useState<PlayerTrendMetricKey>('overall');
  const [timingGrouping, setTimingGrouping] =
    useState<PlayerTimingGrouping>('all');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const playersQuery = useQuery({
    queryKey: ['player-development-saved-players'],
    queryFn: listLocalPlayers,
  });
  const players = playersQuery.data ?? [];
  const historyQuery = useQuery({
    queryKey: [...PLAYER_PERFORMANCE_HISTORY_KEY, primaryPlayerId],
    enabled: Boolean(primaryPlayerId),
    queryFn: () => loadPlayerTrendHistory(primaryPlayerId),
  });
  const comparisonQuery = useQuery({
    queryKey: [...PLAYER_PERFORMANCE_HISTORY_KEY, comparisonPlayerId],
    enabled: Boolean(comparisonPlayerId && comparisonPlayerId !== primaryPlayerId),
    queryFn: () => loadPlayerTrendHistory(comparisonPlayerId ?? ''),
  });
  useEffect(() => {
    setPrimaryPlayerId(routePlayerId);
  }, [routePlayerId]);
  useEffect(() => {
    if (comparisonPlayerId && comparisonPlayerId === primaryPlayerId) {
      setComparisonPlayerId(null);
    }
  }, [comparisonPlayerId, primaryPlayerId]);

  const player =
    players.find((item) => item.id === primaryPlayerId) ??
    historyQuery.data?.player;
  const comparisonPlayer =
    players.find((item) => item.id === comparisonPlayerId) ??
    comparisonQuery.data?.player;
  const allMatches = historyQuery.data?.matches ?? [];
  const allComparisonMatches = comparisonQuery.data?.matches ?? [];
  const startDate = startDateInput.trim();
  const endDate = endDateInput.trim();
  const dateRangeError =
    (startDate && !isValidPlayerTrendDate(startDate)
      ? 'Enter a valid start date in YYYY-MM-DD format.'
      : null) ??
    (endDate && !isValidPlayerTrendDate(endDate)
      ? 'Enter a valid end date in YYYY-MM-DD format.'
      : null) ??
    (startDate && endDate && startDate > endDate
      ? 'Start date must be on or before end date.'
      : null);
  const matches = filterPlayerTrendMatchesByDateRange(
    allMatches,
    dateRangeError ? null : startDate || null,
    dateRangeError ? null : endDate || null,
  );
  const comparisonMatches = filterPlayerTrendMatchesByDateRange(
    allComparisonMatches,
    dateRangeError ? null : startDate || null,
    dateRangeError ? null : endDate || null,
  );
  const hasValidTimingDateRange =
    Boolean(startDate || endDate) && !dateRangeError;
  const selectedPrimaryMatchIds = new Set(matches.map((match) => match.id));
  const primaryTimingHistory = historyQuery.data?.timingMatches ?? [];
  const selectedPrimaryTimingMatches = primaryTimingHistory.filter((match) =>
    selectedPrimaryMatchIds.has(match.matchId),
  );
  const outsidePrimaryTimingMatches = hasValidTimingDateRange
    ? primaryTimingHistory.filter(
        (match) => !selectedPrimaryMatchIds.has(match.matchId),
      )
    : [];
  const selectedComparisonMatchIds = new Set(
    comparisonMatches.map((match) => match.id),
  );
  const comparisonTimingHistory = comparisonQuery.data?.timingMatches ?? [];
  const selectedComparisonTimingMatches = comparisonTimingHistory.filter(
    (match) => selectedComparisonMatchIds.has(match.matchId),
  );
  const outsideComparisonTimingMatches = hasValidTimingDateRange
    ? comparisonTimingHistory.filter(
        (match) => !selectedComparisonMatchIds.has(match.matchId),
      )
    : [];
  const pointSampledMatches = matches.filter(
    (match) => match.metrics.overall.total > 0,
  );
  const allPointSampledMatches = allMatches.filter(
    (match) => match.metrics.overall.total > 0,
  );
  const comparisonPointSampledMatches = comparisonMatches.filter(
    (match) => match.metrics.overall.total > 0,
  );
  const allComparisonPointSampledMatches = allComparisonMatches.filter(
    (match) => match.metrics.overall.total > 0,
  );
  const comparisonRangePointSampleCount =
    pointSampledMatches.length + comparisonPointSampledMatches.length;
  const comparisonAllPointSampleCount =
    allPointSampledMatches.length + allComparisonPointSampledMatches.length;
  const chartHasEnoughHistory = pointSampledMatches.length >= 2;
  const comparisonHasEnoughHistory = comparisonRangePointSampleCount >= 2;
  const comparisonSampleNotice =
    player && comparisonPlayer
      ? getPlayerTrendComparisonSampleNotice(
          player.name,
          summarizePlayerTrendMetric(matches, selectedMetric),
          comparisonPlayer.name,
          summarizePlayerTrendMetric(comparisonMatches, selectedMetric),
        )
      : null;

  function selectPlayer(playerId: string) {
    if (pickerTarget === 'primary') {
      setPrimaryPlayerId(playerId);
      if (comparisonPlayerId === playerId) setComparisonPlayerId(null);
    } else if (pickerTarget === 'comparison') {
      setComparisonPlayerId(playerId);
    }
    setPickerTarget(null);
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 26 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          testID="button-back-from-player-development"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Ionicons name="arrow-back" size={19} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Saved players</Text>
        </Pressable>

        <Text style={[styles.eyebrow, { color: colors.accent }]}>PLAYER DEVELOPMENT</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {comparisonPlayerId ? 'Performance comparison' : player?.name ?? 'Performance trends'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Match-by-match percentages from points recorded on this device.
        </Text>

        {playersQuery.isSuccess ? (
          <>
            <View style={styles.playerPairChoices}>
              <PlayerSelectionCard
                testID="button-select-trend-player-primary"
                label="Player 1"
                playerName={player?.name ?? 'Choose saved player'}
                onPress={() => setPickerTarget('primary')}
              />
              <PlayerSelectionCard
                testID="button-select-trend-player-comparison"
                label="Player 2"
                playerName={comparisonPlayer?.name ?? 'Choose player'}
                onPress={() => setPickerTarget('comparison')}
              />
            </View>
            {comparisonPlayerId ? (
              <Pressable
                testID="button-clear-trend-comparison"
                accessibilityRole="button"
                onPress={() => setComparisonPlayerId(null)}
                style={styles.clearComparison}
              >
                <Text style={[styles.clearComparisonText, { color: colors.primary }]}>
                  Clear comparison
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {playersQuery.isLoading || (Boolean(primaryPlayerId) && historyQuery.isLoading) ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              Reading recorded match points…
            </Text>
          </View>
        ) : playersQuery.isError || historyQuery.isError ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="alert-circle-outline" size={25} color={colors.destructive} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Couldn’t load performance history
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Your saved matches were not changed. Try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void playersQuery.refetch();
                void historyQuery.refetch();
              }}
              style={[styles.retryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
            </Pressable>
          </View>
        ) : !player ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Choose a saved player
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Select Player 1 above to view a point-recorded history.
            </Text>
          </View>
        ) : allMatches.length === 0 && !comparisonPlayerId ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name="stats-chart-outline" size={23} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No recorded match points yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Match outcomes are counted separately. Point percentages use only points recorded on this device.
            </Text>
          </View>
        ) : (
          <>
            <TrendDateRangeFilter
              startDate={startDateInput}
              endDate={endDateInput}
              error={dateRangeError}
              onStartDateChange={setStartDateInput}
              onEndDateChange={setEndDateInput}
              onClear={() => {
                setStartDateInput('');
                setEndDateInput('');
              }}
            />
            <View style={styles.outcomeSummaryCards}>
              <MatchOutcomeSummaryCard
                testID="player-match-outcomes-primary"
                playerName={player.name}
                matches={matches}
              />
              {comparisonPlayerId && comparisonPlayer ? (
                <MatchOutcomeSummaryCard
                  testID="player-match-outcomes-comparison"
                  playerName={comparisonPlayer.name}
                  matches={comparisonMatches}
                />
              ) : null}
            </View>
            <PlayerTimingAverageCard
              testID="player-timing-average-primary"
              playerName={player.name}
              periodLabel={
                hasValidTimingDateRange ? 'Selected period' : 'All saved matches'
              }
              selectedMatches={selectedPrimaryTimingMatches}
              outsideMatches={outsidePrimaryTimingMatches}
              selectedMatchCount={matches.length}
              dateRangeActive={hasValidTimingDateRange}
              outsidePeriodAvailable={
                hasValidTimingDateRange &&
                outsidePrimaryTimingMatches.length > 0
              }
            />
            {comparisonPlayerId && comparisonPlayer && comparisonQuery.isSuccess ? (
              <PlayerTimingAverageCard
                testID="player-timing-average-comparison"
                playerName={comparisonPlayer.name}
                periodLabel={
                  hasValidTimingDateRange ? 'Selected period' : 'All saved matches'
                }
                selectedMatches={selectedComparisonTimingMatches}
                outsideMatches={outsideComparisonTimingMatches}
                selectedMatchCount={comparisonMatches.length}
                dateRangeActive={hasValidTimingDateRange}
                outsidePeriodAvailable={
                  hasValidTimingDateRange &&
                  outsideComparisonTimingMatches.length > 0
                }
              />
            ) : null}
            <View style={styles.metricHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Percentage over time
              </Text>
              <Text style={[styles.sampleCount, { color: colors.mutedForeground }]}>
                {comparisonPlayerId
                  ? comparisonQuery.isSuccess
                    ? `${matches.length} (${pointSampledMatches.length} with points) vs ${comparisonMatches.length} (${comparisonPointSampledMatches.length} with points)`
                    : 'Comparing players'
                  : `${matches.length} matches · ${pointSampledMatches.length} with points`}
              </Text>
            </View>
            <View style={styles.metricChoices}>
              {PLAYER_TREND_METRICS.map((metric) => {
                const selected = selectedMetric === metric.key;
                return (
                  <Pressable
                    key={metric.key}
                    testID={`button-trend-metric-${metric.key}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedMetric(metric.key)}
                    style={[
                      styles.metricChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.metricChipText,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {metric.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {comparisonPlayerId ? (
              comparisonQuery.isLoading ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
                    Reading the second player’s match points…
                  </Text>
                </View>
              ) : comparisonQuery.isError ? (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={25}
                    color={colors.destructive}
                  />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    Couldn’t load the comparison
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No saved match data was changed. Try loading the player again.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void comparisonQuery.refetch()}
                    style={[styles.retryButton, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.retryText, { color: colors.primary }]}>
                      Try again
                    </Text>
                  </Pressable>
                </View>
              ) : !comparisonPlayer ? (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    Saved player not found
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Choose another player to compare.
                  </Text>
                </View>
              ) : (
                <>
                  {comparisonSampleNotice ? (
                    <View
                      testID="player-trend-sample-balance-notice"
                      accessible
                      accessibilityLabel={comparisonSampleNotice}
                      style={[
                        styles.sampleBalanceNotice,
                        {
                          backgroundColor: colors.secondary,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={17}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.sampleBalanceText,
                          { color: colors.foreground },
                        ]}
                      >
                        {comparisonSampleNotice}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    testID="player-trend-comparison-chart"
                    style={[
                      styles.chartCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    {comparisonHasEnoughHistory ? (
                      <ComparisonPerformanceChart
                        primaryName={player.name}
                        primaryMatches={pointSampledMatches}
                        comparisonName={comparisonPlayer.name}
                        comparisonMatches={comparisonPointSampledMatches}
                        metric={selectedMetric}
                        primaryColor={colors.primary}
                        comparisonColor={colors.accent}
                      />
                    ) : (
                      <View style={styles.chartEmpty}>
                        <Ionicons
                          name="analytics-outline"
                          size={22}
                          color={colors.primary}
                        />
                        <Text
                          style={[
                            styles.chartEmptyTitle,
                            { color: colors.foreground },
                          ]}
                        >
                          {comparisonRangePointSampleCount === 0 &&
                          comparisonAllPointSampleCount > 0
                            ? 'No point-recorded matches in this date range'
                            : comparisonRangePointSampleCount < 2 &&
                                comparisonAllPointSampleCount >
                                  comparisonRangePointSampleCount
                              ? 'Not enough point-recorded matches in this date range'
                              : 'Record another match to compare trends'}
                        </Text>
                        <Text
                          style={[
                            styles.chartEmptyText,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {comparisonRangePointSampleCount < 2 &&
                          comparisonAllPointSampleCount >
                            comparisonRangePointSampleCount
                            ? 'Expand or clear the date range to include more point-recorded matches.'
                            : 'Outcome totals remain visible above. The graph needs at least two point-recorded matches between the selected players.'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.summaryCards}>
                    <TrendSummaryCard
                      playerName={player.name}
                      matches={matches}
                      metric={selectedMetric}
                      color={colors.primary}
                    />
                    <TrendSummaryCard
                      playerName={comparisonPlayer.name}
                      matches={comparisonMatches}
                      metric={selectedMetric}
                      color={colors.accent}
                    />
                  </View>
                  <Text
                    style={[
                      styles.sectionTitle,
                      styles.matchListHeading,
                      { color: colors.foreground },
                    ]}
                  >
                    Match history by player
                  </Text>
                  <Text style={[styles.countHint, { color: colors.mutedForeground }]}>
                    Each history is ordered by match date. Values show won attempts / total attempts; unavailable denominators are not 0%.
                  </Text>
                  <PlayerTrendHistory
                    playerName={player.name}
                    matches={matches}
                    metric={selectedMetric}
                    color={colors.primary}
                    testIDPrefix="player-trend-primary"
                  />
                  <PlayerTrendHistory
                    playerName={comparisonPlayer.name}
                    matches={comparisonMatches}
                    metric={selectedMetric}
                    color={colors.accent}
                    testIDPrefix="player-trend-comparison"
                  />
                  <Text style={[styles.sectionTitle, styles.matchListHeading, { color: colors.foreground }]}>
                    Stroke rating history
                  </Text>
                  <StrokeRatingHistory
                    playerName={player.name}
                    matches={matches}
                    testIDPrefix="player-trend-primary"
                  />
                  <StrokeRatingHistory
                    playerName={comparisonPlayer.name}
                    matches={comparisonMatches}
                    testIDPrefix="player-trend-comparison"
                  />
                </>
              )
            ) : (
              <>
                <View
                  style={[
                    styles.chartCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  {chartHasEnoughHistory ? (
                    <PerformanceChart
                      matches={pointSampledMatches}
                      metric={selectedMetric}
                    />
                  ) : (
                    <View style={styles.chartEmpty}>
                      <Ionicons
                        name="analytics-outline"
                        size={22}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.chartEmptyTitle,
                          { color: colors.foreground },
                        ]}
                      >
                        {pointSampledMatches.length === 0 &&
                        allPointSampledMatches.length > 0
                          ? 'No point-recorded matches in this date range'
                          : pointSampledMatches.length === 1 &&
                              allPointSampledMatches.length > 1
                            ? 'One point-recorded match in this date range'
                            : 'Record another match to see a trend'}
                      </Text>
                      <Text
                        style={[
                          styles.chartEmptyText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {pointSampledMatches.length < 2 &&
                        allPointSampledMatches.length >
                          pointSampledMatches.length
                          ? 'Expand or clear the date range to include more point-recorded matches.'
                          : 'Outcome totals remain visible above. The graph uses only recorded points and needs at least two point-recorded matches.'}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    styles.sectionTitle,
                    styles.matchListHeading,
                    { color: colors.foreground },
                  ]}
                >
                  Match details
                </Text>
                <Text style={[styles.countHint, { color: colors.mutedForeground }]}>
                  Values show won attempts / total attempts. A zero denominator is unavailable, not 0%.
                </Text>
                <PlayerTrendHistory
                  playerName={player.name}
                  matches={matches}
                  metric={selectedMetric}
                  color={colors.primary}
                  testIDPrefix="player-trend"
                />
                <Text style={[styles.sectionTitle, styles.matchListHeading, { color: colors.foreground }]}>
                  Stroke rating history
                </Text>
                <StrokeRatingHistory
                  playerName={player.name}
                  matches={matches}
                  testIDPrefix="player-trend"
                />
              </>
            )}
            <PlayerTimingHistory
              playerName={player.name}
              matches={matches}
              grouping={timingGrouping}
              onGroupingChange={setTimingGrouping}
            />
            <Text style={[styles.localNote, { color: colors.mutedForeground }]}>
              Names shown on old match sheets are unchanged. Player links and calculations stay on this device.
            </Text>
          </>
        )}
      </ScrollView>
      <PlayerPickerModal
        visible={pickerTarget !== null}
        target={pickerTarget}
        players={players}
        excludePlayerId={
          pickerTarget === 'primary'
            ? comparisonPlayerId ?? ''
            : primaryPlayerId
        }
        selectedPlayerId={
          pickerTarget === 'primary'
            ? primaryPlayerId
            : comparisonPlayerId ?? ''
        }
        onSelect={selectPlayer}
        onClose={() => setPickerTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  playerPairChoices: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  playerSelectionCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 5,
  },
  playerSelectionLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  playerSelectionValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  playerSelectionName: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  clearComparison: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 3 },
  clearComparisonText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, marginBottom: 22 },
  backText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.6 },
  title: { marginTop: 8, fontFamily: 'Manrope_700Bold', fontSize: 29, letterSpacing: -1 },
  subtitle: { marginTop: 6, marginBottom: 21, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { fontFamily: 'DMSans_400Regular', fontSize: 13 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  sampleCount: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  dateRangeCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 9, marginBottom: 14 },
  dateRangeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateRangeTitle: { fontFamily: 'Manrope_700Bold', fontSize: 14 },
  dateRangeClear: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 5 },
  dateRangeClearText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  dateRangeHint: { fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15 },
  dateRangeFields: { flexDirection: 'row', gap: 8 },
  dateRangeField: { flex: 1, minWidth: 0, gap: 5 },
  dateRangeLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 0.4, textTransform: 'uppercase' },
  dateRangeInput: { minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  metricChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 },
  metricChip: { minHeight: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, justifyContent: 'center' },
  metricChipText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  chartCard: { borderWidth: 1, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 6, minHeight: 164, justifyContent: 'center' },
  chartScrollContent: { paddingHorizontal: 2 },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 7, paddingBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: '45%' },
  legendLine: { width: 13, height: 3, borderRadius: 2 },
  legendText: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 9 },
  summaryCards: { flexDirection: 'row', gap: 8, marginTop: 9 },
  outcomeSummaryCards: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 11, padding: 10, gap: 4 },
  sampleBalanceNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderWidth: 1, borderRadius: 10, marginBottom: 10 },
  sampleBalanceText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 11, lineHeight: 16 },
  summaryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  playerDot: { width: 8, height: 8, borderRadius: 4 },
  summaryName: { flex: 1, fontFamily: 'DMSans_700Bold', fontSize: 10 },
  summaryPercent: { fontFamily: 'Manrope_700Bold', fontSize: 20, fontVariant: ['tabular-nums'] },
  summaryMeta: { fontFamily: 'DMSans_500Medium', fontSize: 9 },
  historySection: { gap: 7, marginBottom: 11 },
  strokeRatingSection: { gap: 8, marginBottom: 10 },
  timingAverageCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  timingAverageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timingAverageRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 3,
  },
  timingAverageLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
  },
  timingAverageValue: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    lineHeight: 15,
  },
  timingAverageBaseline: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 9,
    lineHeight: 14,
  },
  timingAverageInsight: {
    borderRadius: 8,
    padding: 9,
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    lineHeight: 15,
  },
  timingOutcomeComparisons: { gap: 6 },
  timingOutcomeComparison: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
    gap: 3,
  },
  timingSurfaceComparisons: { gap: 6, marginTop: 4 },
  timingSurfaceComparison: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
    gap: 3,
  },
  strokeRatingCard: { borderWidth: 1, borderRadius: 10, padding: 11, gap: 5 },
  strokeRatingHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  strokeRatingName: { flex: 1, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  strokeRatingAverage: { fontFamily: 'Manrope_700Bold', fontSize: 14, fontVariant: ['tabular-nums'] },
  strokeRatingMeta: { fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15 },
  strokeRatingMatch: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, gap: 2 },
  strokeRatingMatchMeta: { fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 14 },
  strokeRatingSamples: { fontFamily: 'DMSans_600SemiBold', fontSize: 10, lineHeight: 15 },
  timingGroupingChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  timingGroupCard: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 8, gap: 9 },
  timingTrendCard: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 11, gap: 5 },
  timingTrendEmpty: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 11 },
  timingTrendNote: { fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 14 },
  timingGroupTitle: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  timingMetrics: { flexDirection: 'row', gap: 9 },
  timingMetric: { flex: 1, minWidth: 0, gap: 3 },
  timingMetricLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 9, lineHeight: 13 },
  timingMetricValue: { fontFamily: 'Manrope_700Bold', fontSize: 14, fontVariant: ['tabular-nums'] },
  timingMetricMeta: { fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 13 },
  timingUnavailable: { fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  emptyHistory: { borderWidth: 1, borderRadius: 10, padding: 12 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(12, 25, 19, 0.48)' },
  modalCard: { maxHeight: '75%', borderWidth: 1, borderRadius: 16, padding: 15, gap: 12 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalHeadingCopy: { flex: 1, gap: 3 },
  modalTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  modalHint: { fontFamily: 'DMSans_400Regular', fontSize: 11 },
  modalClose: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  playerOptions: { flexGrow: 0, maxHeight: 440 },
  playerOptionsContent: { gap: 7 },
  playerOption: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  playerOptionName: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  modalEmpty: { paddingVertical: 18, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  chartEmpty: { minHeight: 142, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 },
  chartEmptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13, textAlign: 'center' },
  chartEmptyText: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  matchListHeading: { marginTop: 25, marginBottom: 5 },
  countHint: { marginBottom: 11, fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15 },
  matchRow: { minHeight: 75, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchCopy: { flex: 1, gap: 3 },
  matchName: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  matchMeta: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  matchCount: { fontFamily: 'DMSans_500Medium', fontSize: 10 },
  matchPercent: { fontFamily: 'Manrope_700Bold', fontSize: 18, fontVariant: ['tabular-nums'] },
  localNote: { marginTop: 12, textAlign: 'center', fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15 },
  emptyCard: { borderWidth: 1, borderRadius: 14, minHeight: 205, paddingHorizontal: 23, alignItems: 'center', justifyContent: 'center', gap: 9 },
  emptyIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Manrope_700Bold', fontSize: 16, textAlign: 'center' },
  emptyText: { maxWidth: 280, textAlign: 'center', fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18 },
  retryButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, marginTop: 4 },
  retryText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
});
