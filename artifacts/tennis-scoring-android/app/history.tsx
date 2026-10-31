import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBar } from '@/components/BottomTabBar';
import { MatchBookCard } from '@/components/MatchBookCard';
import { useColors } from '@/hooks/useColors';
import {
  deleteLocalMatch,
  localInsightsKey,
  localMatchKey,
  listLocalMatches,
  LOCAL_MATCH_LIST_KEY,
  PLAYER_PERFORMANCE_HISTORY_KEY,
  type LocalMatchSummary,
} from '@/lib/local-matches';
import {
  DEFAULT_HOME_SCREEN_PREFERENCES,
  filterMatchBookSummaries,
  getHomeScreenPreferences,
  HOME_SCREEN_PREFERENCES_KEY,
  saveHomeScreenPreferences,
  splitHomeMatches,
  type MatchBookResultFilter,
  type HomeScreenPreferences,
} from '@/lib/home-screen-state';

const RESULT_FILTER_OPTIONS: {
  value: MatchBookResultFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'tracked_win', label: 'Tracked player won' },
  { value: 'opponent_win', label: 'Opponent won' },
  { value: 'no_set_majority', label: 'No set majority' },
  { value: 'in_progress', label: 'In progress' },
];

export default function HistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const matchesQuery = useQuery({
    queryKey: LOCAL_MATCH_LIST_KEY,
    queryFn: listLocalMatches,
  });
  const preferencesQuery = useQuery({
    queryKey: [HOME_SCREEN_PREFERENCES_KEY],
    queryFn: getHomeScreenPreferences,
  });
  const preferences = preferencesQuery.data ?? DEFAULT_HOME_SCREEN_PREFERENCES;
  const matchSections = splitHomeMatches(matchesQuery.data ?? []);
  const allHistoryMatches = matchSections.history;
  const [opponentQuery, setOpponentQuery] = useState<string>('');
  const [resultFilter, setResultFilter] =
    useState<MatchBookResultFilter>('all');
  const visibleHistoryMatches = filterMatchBookSummaries(allHistoryMatches, {
    opponentQuery,
    result: resultFilter,
    showCompletedMatches: preferences.showCompletedMatches,
  });
  const matchingHistoryWithCompleted = filterMatchBookSummaries(
    allHistoryMatches,
    {
      opponentQuery,
      result: resultFilter,
      showCompletedMatches: true,
    },
  );
  const hasActiveFilters = Boolean(opponentQuery.trim()) || resultFilter !== 'all';
  const completedMatchesHiddenForFilter =
    !preferences.showCompletedMatches &&
    resultFilter !== 'in_progress' &&
    visibleHistoryMatches.length === 0 &&
    matchingHistoryWithCompleted.length > 0;
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);

  function updatePreferences(
    update: (current: HomeScreenPreferences) => HomeScreenPreferences,
  ) {
    const current =
      queryClient.getQueryData<HomeScreenPreferences>([
        HOME_SCREEN_PREFERENCES_KEY,
      ]) ?? DEFAULT_HOME_SCREEN_PREFERENCES;
    const next = update(current);
    queryClient.setQueryData([HOME_SCREEN_PREFERENCES_KEY], next);
    void saveHomeScreenPreferences(next).catch((error: unknown) => {
      Alert.alert(
        'Could not save history setting',
        error instanceof Error ? error.message : 'Try again.',
      );
    });
  }

  const deleteMatch = useMutation({
    mutationFn: deleteLocalMatch,
    onMutate: (matchId) => setDeletingMatchId(matchId),
    onSuccess: async (_deleted, matchId) => {
      queryClient.removeQueries({ queryKey: localMatchKey(matchId) });
      queryClient.removeQueries({ queryKey: localInsightsKey(matchId) });
      updatePreferences((current) => ({
        ...current,
        expandedMatchIds: current.expandedMatchIds.filter((id) => id !== matchId),
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOCAL_MATCH_LIST_KEY }),
        queryClient.invalidateQueries({
          queryKey: PLAYER_PERFORMANCE_HISTORY_KEY,
        }),
      ]);
    },
    onError: (error) => Alert.alert('Could not delete match', error.message),
    onSettled: () => setDeletingMatchId(null),
  });

  function toggleMatchDetails(matchId: string) {
    updatePreferences((current) => ({
      ...current,
      expandedMatchIds: current.expandedMatchIds.includes(matchId)
        ? current.expandedMatchIds.filter((id) => id !== matchId)
        : [...current.expandedMatchIds, matchId],
    }));
  }

  function clearFilters() {
    setOpponentQuery('');
    setResultFilter('all');
  }

  function confirmDeleteMatch(match: LocalMatchSummary) {
    Alert.alert(
      'Delete this match?',
      `Deleting ${match.trackedPlayer} vs ${match.opponent} removes the match, all sets, and point history from this device. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete match',
          style: 'destructive',
          onPress: () => deleteMatch.mutate(match.id),
        },
      ],
    );
  }

  const completedCount = allHistoryMatches.filter(
    (match) => match.status === 'complete',
  ).length;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <FlatList
        testID="history-match-list"
        data={visibleHistoryMatches}
        keyExtractor={(match) => match.id}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={matchesQuery.isRefetching}
            onRefresh={() => void matchesQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.eyebrowRow}>
              <Ionicons name="archive-outline" size={15} color={colors.accent} />
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                YOUR MATCH ARCHIVE
              </Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Match history
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Older matches, with the most recent listed first. Your two newest matches stay on Home.
            </Text>
            <View style={styles.toolbar}>
              <View style={[styles.countPill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.countText, { color: colors.secondaryForeground }]}>
                  {allHistoryMatches.length}
                </Text>
              </View>
              {completedCount > 0 ? (
                <Pressable
                  testID="history-toggle-completed-matches"
                  accessibilityRole="button"
                  accessibilityState={{ selected: preferences.showCompletedMatches }}
                  disabled={preferencesQuery.isLoading}
                  onPress={() =>
                    updatePreferences((current) => ({
                      ...current,
                      showCompletedMatches: !current.showCompletedMatches,
                    }))
                  }
                  style={[
                    styles.completedToggle,
                    { borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                >
                  <Ionicons
                    name={preferences.showCompletedMatches ? 'eye-off-outline' : 'eye-outline'}
                    size={13}
                    color={colors.primary}
                  />
                  <Text style={[styles.completedToggleText, { color: colors.primary }]}>
                    {preferences.showCompletedMatches ? 'Hide completed' : 'Show completed'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {allHistoryMatches.length > 0 ? (
              <View
                testID="history-match-filters"
                style={[
                  styles.filterPanel,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.opponentSearch, { borderColor: colors.border }]}>
                  <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
                  <TextInput
                    testID="history-opponent-filter"
                    accessibilityLabel="Filter by opponent"
                    value={opponentQuery}
                    onChangeText={setOpponentQuery}
                    placeholder="Search opponent"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="search"
                    autoCapitalize="none"
                    style={[styles.opponentInput, { color: colors.foreground }]}
                  />
                  {opponentQuery.length > 0 ? (
                    <Pressable
                      testID="history-clear-opponent-filter"
                      accessibilityRole="button"
                      accessibilityLabel="Clear opponent search"
                      onPress={() => setOpponentQuery('')}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={17} color={colors.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.resultFilterList}
                  accessibilityLabel="Filter matches by result"
                >
                  {RESULT_FILTER_OPTIONS.map((option) => {
                    const selected = resultFilter === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        testID={`history-result-filter-${option.value}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setResultFilter(option.value)}
                        style={[
                          styles.resultFilterChip,
                          {
                            backgroundColor: selected ? colors.primary : colors.background,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.resultFilterText,
                            {
                              color: selected
                                ? colors.primaryForeground
                                : colors.foreground,
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {hasActiveFilters ? (
                  <View style={styles.filterSummary}>
                    <Text style={[styles.filterSummaryText, { color: colors.mutedForeground }]}>
                      Showing {visibleHistoryMatches.length} of {allHistoryMatches.length} matches
                    </Text>
                    <Pressable
                      testID="history-clear-filters"
                      accessibilityRole="button"
                      onPress={clearFilters}
                      hitSlop={8}
                    >
                      <Text style={[styles.clearFiltersText, { color: colors.primary }]}>
                        Clear filters
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <MatchBookCard
            match={item}
            expanded={preferences.expandedMatchIds.includes(item.id)}
            preferencesLoading={preferencesQuery.isLoading}
            deletePending={deleteMatch.isPending && deletingMatchId === item.id}
            onToggle={() => toggleMatchDetails(item.id)}
            onOpen={() => router.push(`/matches/${item.id}`)}
            onDelete={() => confirmDeleteMatch(item)}
          />
        )}
        ListEmptyComponent={
          matchesQuery.isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
                Loading match history…
              </Text>
            </View>
          ) : matchesQuery.isError && (matchesQuery.data ?? []).length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="phone-portrait-outline" size={27} color={colors.accent} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Couldn’t load matches
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Your match archive couldn’t be read from this device.
              </Text>
              <Pressable
                testID="button-retry-history"
                accessibilityRole="button"
                onPress={() => void matchesQuery.refetch()}
                style={[styles.retryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
              </Pressable>
            </View>
          ) : allHistoryMatches.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="time-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No older matches yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Home keeps your two newest matches. This archive will show older matches here.
              </Text>
            </View>
          ) : completedMatchesHiddenForFilter ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="eye-off-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Matching completed matches are hidden
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Show completed matches to see records matching these filters.
              </Text>
              <Pressable
                testID="history-show-completed-matches"
                accessibilityRole="button"
                onPress={() =>
                  updatePreferences((current) => ({
                    ...current,
                    showCompletedMatches: true,
                  }))
                }
                style={[styles.retryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>
                  Show completed matches
                </Text>
              </Pressable>
            </View>
          ) : hasActiveFilters ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="search-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No matches found
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Try another opponent or result, or clear the filters.
              </Text>
              <Pressable
                testID="history-empty-clear-filters"
                accessibilityRole="button"
                onPress={clearFilters}
                style={[styles.retryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>
                  Clear filters
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="eye-off-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Completed matches are hidden
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Show completed matches to review saved scores and point details.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  updatePreferences((current) => ({
                    ...current,
                    showCompletedMatches: true,
                  }))
                }
                style={[styles.retryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>
                  Show completed matches
                </Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Match records remain stored on this device.
            </Text>
          </View>
        }
      />
      <BottomTabBar activeTab="history" historyCount={allHistoryMatches.length} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 20 },
  header: { marginBottom: 15 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.3 },
  title: { marginTop: 8, fontFamily: 'Manrope_700Bold', fontSize: 30, letterSpacing: -0.8 },
  subtitle: { marginTop: 7, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18 },
  toolbar: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countPill: { minWidth: 30, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  countText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  completedToggle: { minHeight: 30, paddingHorizontal: 8, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  completedToggleText: { fontFamily: 'DMSans_600SemiBold', fontSize: 9 },
  filterPanel: { marginTop: 12, padding: 10, borderWidth: 1, borderRadius: 12, gap: 10 },
  opponentSearch: { minHeight: 38, paddingHorizontal: 10, borderWidth: 1, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  opponentInput: { flex: 1, minHeight: 38, paddingVertical: 0, fontFamily: 'DMSans_400Regular', fontSize: 12 },
  resultFilterList: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  resultFilterChip: { minHeight: 31, paddingHorizontal: 10, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resultFilterText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  filterSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSummaryText: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  clearFiltersText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  stateBox: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { fontFamily: 'DMSans_400Regular', fontSize: 13 },
  emptyCard: { borderWidth: 1, borderRadius: 14, minHeight: 212, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 9 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  emptyText: { maxWidth: 275, textAlign: 'center', fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19 },
  retryButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, marginTop: 7 },
  retryText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  footerText: { fontFamily: 'DMSans_400Regular', fontSize: 11 },
});
