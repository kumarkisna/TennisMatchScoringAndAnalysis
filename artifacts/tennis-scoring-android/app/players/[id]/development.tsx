import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { listLocalPlayerMatchInsights } from '@/lib/local-matches';
import { listLocalPlayers } from '@/lib/local-players';
import {
  buildPlayerPerformanceHistory,
  PLAYER_TREND_METRICS,
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
  return match.event?.trim() || `vs ${match.opponent}`;
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

export default function PlayerDevelopmentScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Array.isArray(id) ? id[0] : id;
  const [selectedMetric, setSelectedMetric] =
    useState<PlayerTrendMetricKey>('overall');
  const historyQuery = useQuery({
    queryKey: ['player-performance-history', playerId],
    enabled: Boolean(playerId),
    queryFn: async () => {
      const players = await listLocalPlayers();
      const player = players.find((item) => item.id === playerId);
      if (!player) return null;
      const records = await listLocalPlayerMatchInsights(player.id, players);
      return {
        player,
        matches: buildPlayerPerformanceHistory(records),
      };
    },
  });
  const player = historyQuery.data?.player;
  const matches = historyQuery.data?.matches ?? [];
  const chartHasEnoughHistory = matches.length >= 2;

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
          {player?.name ?? 'Performance trends'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Match-by-match percentages from points recorded on this device.
        </Text>

        {historyQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              Reading recorded match points…
            </Text>
          </View>
        ) : historyQuery.isError ? (
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
              onPress={() => void historyQuery.refetch()}
              style={[styles.retryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
            </Pressable>
          </View>
        ) : !player ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Saved player not found
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              This player may have been removed from this device.
            </Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name="stats-chart-outline" size={23} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No recorded match points yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Matches appear here after points are recorded. Matches without point samples are left out.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.metricHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Percentage over time
              </Text>
              <Text style={[styles.sampleCount, { color: colors.mutedForeground }]}>
                {matches.length} {matches.length === 1 ? 'match' : 'matches'}
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

            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {chartHasEnoughHistory ? (
                <PerformanceChart matches={matches} metric={selectedMetric} />
              ) : (
                <View style={styles.chartEmpty}>
                  <Ionicons name="analytics-outline" size={22} color={colors.primary} />
                  <Text style={[styles.chartEmptyTitle, { color: colors.foreground }]}>
                    Record another match to see a trend
                  </Text>
                  <Text style={[styles.chartEmptyText, { color: colors.mutedForeground }]}>
                    One match is available below. The graph needs at least two point-recorded matches.
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.sectionTitle, styles.matchListHeading, { color: colors.foreground }]}>
              Match details
            </Text>
            <Text style={[styles.countHint, { color: colors.mutedForeground }]}>
              Values show won attempts / total attempts. A zero denominator is unavailable, not 0%.
            </Text>
            {matches.map((match) => {
              const value = match.metrics[selectedMetric];
              const valueText =
                value.percent === null ? 'Unavailable' : `${value.percent}%`;
              const countText =
                value.total === 0
                  ? `No ${value.countLabel} recorded`
                  : `${value.won} of ${value.total} ${value.countLabel}`;
              return (
                <View
                  key={match.id}
                  testID={`player-trend-match-${match.id}`}
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
                    <Text style={[styles.matchCount, { color: colors.mutedForeground }]}>
                      {countText}
                    </Text>
                  </View>
                  <Text
                    accessibilityLabel={`${valueText}, ${countText}`}
                    style={[
                      styles.matchPercent,
                      { color: value.percent === null ? colors.mutedForeground : colors.primary },
                    ]}
                  >
                    {valueText}
                  </Text>
                </View>
              );
            })}
            <Text style={[styles.localNote, { color: colors.mutedForeground }]}>
              Names shown on old match sheets are unchanged. Player links and calculations stay on this device.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
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
  metricChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 },
  metricChip: { minHeight: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, justifyContent: 'center' },
  metricChipText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  chartCard: { borderWidth: 1, borderRadius: 13, paddingVertical: 9, paddingHorizontal: 6, minHeight: 164, justifyContent: 'center' },
  chartScrollContent: { paddingHorizontal: 2 },
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
