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
  listLocalPlayerMatchInsights,
  PLAYER_PERFORMANCE_HISTORY_KEY,
} from '@/lib/local-matches';
import { listLocalPlayers } from '@/lib/local-players';
import {
  buildPlayerPerformanceHistory,
  formatPlayerMatchOutcomeSummary,
  filterPlayerTrendMatchesByDateRange,
  isValidPlayerTrendDate,
  PLAYER_TREND_METRICS,
  summarizePlayerMatchOutcomes,
  summarizePlayerTrendMetric,
  type PlayerTrendMatch,
  type PlayerTrendMetricKey,
} from '@/lib/player-insights';

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

function trendLabel(match: PlayerTrendMatch) {
  return match.event?.trim() || 'Match';
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
        {summary.won} of {summary.total} {summary.countLabel}
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
  return {
    player,
    matches: buildPlayerPerformanceHistory(records),
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
              </>
            )}
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
  summaryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  playerDot: { width: 8, height: 8, borderRadius: 4 },
  summaryName: { flex: 1, fontFamily: 'DMSans_700Bold', fontSize: 10 },
  summaryPercent: { fontFamily: 'Manrope_700Bold', fontSize: 20, fontVariant: ['tabular-nums'] },
  summaryMeta: { fontFamily: 'DMSans_500Medium', fontSize: 9 },
  historySection: { gap: 7, marginBottom: 11 },
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
