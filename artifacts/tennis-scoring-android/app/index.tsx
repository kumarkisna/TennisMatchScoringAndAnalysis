import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  deleteLocalMatch,
  localInsightsKey,
  localMatchKey,
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
  loadLocalBackupFromDevice,
  saveLocalBackupToDevice,
  shareLocalBackup,
} from '@/lib/local-backup';

function formatMatchDate(date: string) {
  const normalizedDate = date.slice(0, 10);
  const [year, month, day] = normalizedDate.split('-').map(Number);
  if (!year || !month || !day) return date;
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    undefined,
    { month: 'short', timeZone: 'UTC' },
  );
  return `${monthLabel} ${day}, ${year}`;
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showCompletedMatches, setShowCompletedMatches] = useState(true);
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
  const deleteMatch = useMutation({
    mutationFn: deleteLocalMatch,
    onSuccess: async (_deleted, matchId) => {
      queryClient.removeQueries({ queryKey: localMatchKey(matchId) });
      queryClient.removeQueries({ queryKey: localInsightsKey(matchId) });
      await queryClient.invalidateQueries({ queryKey: LOCAL_MATCH_LIST_KEY });
    },
    onError: (error) => Alert.alert('Could not delete match', error.message),
  });
  const saveBackup = useMutation({
    mutationFn: saveLocalBackupToDevice,
    onSuccess: (result) => {
      if (!result.cancelled) {
        Alert.alert('Backup saved', `${result.fileName} was saved to the folder you chose.`);
      }
    },
    onError: (error) => Alert.alert('Could not save backup', error.message),
  });
  const shareBackup = useMutation({
    mutationFn: shareLocalBackup,
    onError: (error) => Alert.alert('Could not share backup', error.message),
  });
  const loadBackup = useMutation({
    mutationFn: loadLocalBackupFromDevice,
    onSuccess: async (result) => {
      if (result.cancelled) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOCAL_MATCH_LIST_KEY }),
        queryClient.invalidateQueries({ queryKey: LOCAL_PLAYERS_KEY }),
        queryClient.invalidateQueries({ queryKey: ACTIVE_LOCAL_PLAYER_KEY }),
      ]);
      Alert.alert(
        'Backup loaded',
        `Added ${result.matchesAdded} matches and ${result.playersAdded} players. Existing records were left unchanged.`,
      );
    },
    onError: (error) => Alert.alert('Could not load backup', error.message),
  });
  const localMatches = matchesQuery.data ?? [];
  const matches: LocalMatchSummary[] = localMatches;
  const activePlayer = playersQuery.data?.find(
    (player) => player.id === activePlayerQuery.data,
  );
  const completedCount = matches.filter((match) => match.status === 'complete').length;
  const visibleMatches = showCompletedMatches
    ? matches
    : matches.filter((match) => match.status !== 'complete');

  function confirmDeleteMatch(match: LocalMatchSummary) {
    Alert.alert(
      'Delete this match?',
      `${match.trackedPlayer} vs ${match.opponent} and all recorded points will be permanently removed from this device. This cannot be undone.`,
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

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <FlatList
        data={visibleMatches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={matchesQuery.isRefetching}
            onRefresh={() => void matchesQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topLine}>
              <View style={styles.brandMark}>
                <Ionicons name="tennisball-outline" size={21} color={colors.primary} />
              </View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>
                Tennis<Text style={{ color: colors.primary }}>Scoring</Text>
              </Text>
              <View style={styles.courtBadge}>
                <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.courtBadgeText, { color: colors.mutedForeground }]}>
                  COURTSIDE
                </Text>
              </View>
            </View>

            <View style={styles.heading}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                PLAYER DEVELOPMENT
              </Text>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Every point{'\n'}has a story.
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Enter the players, then tap the point winner as the match is played.
              </Text>
            </View>

            <Pressable
              testID="button-start-match"
              accessibilityRole="button"
              onPress={() => router.push('/matches/new')}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="add" size={22} color={colors.primaryForeground} />
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                Start a match
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.primaryForeground}
                style={styles.buttonArrow}
              />
            </Pressable>

            <View style={[styles.activePlayerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.activePlayerIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="person-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.activePlayerInfo}>
                <Text style={[styles.activePlayerLabel, { color: colors.mutedForeground }]}>
                  MAIN TRACKED PLAYER
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.activePlayerName, { color: colors.foreground }]}
                >
                  {activePlayer?.name ?? (playersQuery.data?.length ? 'Choose a player' : 'Add a player')}
                </Text>
              </View>
              <View style={styles.playerActions}>
                <Pressable
                  testID="button-switch-main-player"
                  accessibilityRole="button"
                  accessibilityLabel={activePlayer ? 'Switch main tracked player' : 'Choose main tracked player'}
                  onPress={() => router.push('/players')}
                  style={({ pressed }) => [
                    styles.switchPlayerButton,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.switchPlayerText, { color: colors.primary }]}>
                    {activePlayer ? 'Switch' : 'Choose'}
                  </Text>
                </Pressable>
                <Pressable
                  testID="button-open-saved-players"
                  accessibilityRole="button"
                  accessibilityLabel={`Saved players, ${playersQuery.data?.length ?? 0} saved`}
                  accessibilityHint="Opens the saved player list"
                  onPress={() => router.push('/players')}
                  style={({ pressed }) => [
                    styles.inlinePlayersButton,
                    {
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="people-outline" size={14} color={colors.primary} />
                  <Text style={[styles.inlinePlayersText, { color: colors.primary }]}>
                    Saved players
                  </Text>
                  <Text style={[styles.inlinePlayersCount, { color: colors.mutedForeground }]}>
                    {playersQuery.data?.length ?? 0}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.backupActions}>
              <Pressable
                testID="button-save-local-backup"
                accessibilityRole="button"
                disabled={saveBackup.isPending || shareBackup.isPending || loadBackup.isPending}
                onPress={() => saveBackup.mutate()}
                style={({ pressed }) => [
                  styles.backupButton,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: saveBackup.isPending || shareBackup.isPending || loadBackup.isPending ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="download-outline" size={16} color={colors.primary} />
                <Text style={[styles.backupButtonText, { color: colors.foreground }]}>
                  {saveBackup.isPending ? 'Preparing…' : 'Save backup'}
                </Text>
              </Pressable>
              <Pressable
                testID="button-share-local-backup"
                accessibilityRole="button"
                disabled={saveBackup.isPending || shareBackup.isPending || loadBackup.isPending}
                onPress={() => shareBackup.mutate()}
                style={({ pressed }) => [
                  styles.backupButton,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: saveBackup.isPending || shareBackup.isPending || loadBackup.isPending ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="share-outline" size={16} color={colors.primary} />
                <Text style={[styles.backupButtonText, { color: colors.foreground }]}>
                  {shareBackup.isPending ? 'Preparing…' : 'Share backup'}
                </Text>
              </Pressable>
            </View>
            <Pressable
              testID="button-load-local-backup"
              accessibilityRole="button"
              disabled={saveBackup.isPending || shareBackup.isPending || loadBackup.isPending}
              onPress={() => loadBackup.mutate()}
              style={({ pressed }) => [
                styles.loadBackupButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: saveBackup.isPending || shareBackup.isPending || loadBackup.isPending ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="folder-open-outline" size={16} color={colors.primary} />
              <Text style={[styles.backupButtonText, { color: colors.foreground }]}>
                {loadBackup.isPending ? 'Loading…' : 'Load backup'}
              </Text>
            </Pressable>
            <Text style={[styles.backupNote, { color: colors.mutedForeground }]}>
              Backups include players and full point history. Loading adds missing records and never overwrites existing ones.
            </Text>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Match book
                </Text>
                <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
                  Saved on this device · no account or internet needed
                </Text>
              </View>
              <View style={styles.matchControls}>
                {completedCount > 0 ? (
                  <Pressable
                    testID="toggle-completed-matches"
                    accessibilityRole="button"
                    accessibilityState={{ selected: showCompletedMatches }}
                    onPress={() => setShowCompletedMatches((value) => !value)}
                    style={[
                      styles.completedToggle,
                      { borderColor: colors.border, backgroundColor: colors.card },
                    ]}
                  >
                    <Ionicons
                      name={showCompletedMatches ? 'eye-off-outline' : 'eye-outline'}
                      size={13}
                      color={colors.primary}
                    />
                    <Text style={[styles.completedToggleText, { color: colors.primary }]}>
                      {showCompletedMatches ? 'Hide completed' : 'Show completed'}
                    </Text>
                  </Pressable>
                ) : null}
                <View style={[styles.countPill, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.countText, { color: colors.secondaryForeground }]}>
                    {matches.length}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const finished = item.status === 'complete';
          return (
            <View
              testID={`match-card-${item.id}`}
              style={[
                styles.matchCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Pressable
                testID={`button-open-match-${item.id}`}
                accessibilityRole="button"
                onPress={() => router.push(`/matches/${item.id}`)}
                style={({ pressed }) => [
                  styles.matchCardBody,
                  { opacity: pressed ? 0.84 : 1 },
                ]}
              >
              <View style={styles.matchCardTop}>
                <View style={styles.matchMeta}>
                  <Text style={[styles.matchEvent, { color: colors.mutedForeground }]}>
                    {item.event?.trim() || 'MATCH SESSION'}
                  </Text>
                  <Text style={[styles.matchDate, { color: colors.mutedForeground }]}>
                    {formatMatchDate(item.matchDate)}
                    {item.round ? ` · ${item.round}` : ''}
                    {` · ${item.setScores.length} ${item.setScores.length === 1 ? 'SET' : 'SETS'}`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.matchStatus,
                    {
                      backgroundColor: finished ? colors.secondary : colors.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.matchStatusText,
                      {
                        color: finished
                          ? colors.secondaryForeground
                          : colors.accentForeground,
                      },
                    ]}
                  >
                    {finished ? 'FINAL' : 'LIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.matchScoreRow}>
                <View style={styles.matchNames}>
                  <Text style={[styles.matchPlayer, { color: colors.foreground }]}>
                    {item.trackedPlayer}
                  </Text>
                  <Text style={[styles.matchOpponent, { color: colors.mutedForeground }]}>
                    {item.opponent}
                  </Text>
                </View>
              </View>
              <View style={styles.matchSetScores}>
                {item.setScores.map((set) => {
                  const result =
                    set.format === 'match_tiebreak'
                      ? `${set.trackedTiebreakPoints}–${set.opponentTiebreakPoints} TB`
                      : `${set.trackedGames}–${set.opponentGames}`;
                  return (
                    <View
                      key={set.setNumber}
                      style={[styles.matchSetScore, { backgroundColor: colors.background }]}
                    >
                      <Text style={[styles.matchSetNumber, { color: colors.mutedForeground }]}>
                        S{set.setNumber}
                      </Text>
                      <Text style={[styles.matchSetResult, { color: colors.foreground }]}>
                        {result}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.matchCardBottom, { borderTopColor: colors.border }]}>
                <Text style={[styles.matchBottomText, { color: colors.mutedForeground }]}>
                  {item.surface.toUpperCase()} COURT
                </Text>
                <Text style={[styles.matchBottomText, { color: colors.mutedForeground }]}>
                  {`${item.pointCount} ${item.pointCount === 1 ? 'POINT' : 'POINTS'}`}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </View>
              </Pressable>
              <Pressable
                testID={`button-delete-match-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Delete match ${item.trackedPlayer} versus ${item.opponent}`}
                disabled={deleteMatch.isPending}
                onPress={() => confirmDeleteMatch(item)}
                style={({ pressed }) => [
                  styles.deleteMatchAction,
                  {
                    borderTopColor: colors.border,
                    opacity: deleteMatch.isPending ? 0.45 : pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={14} color={colors.destructive} />
                <Text style={[styles.deleteMatchText, { color: colors.destructive }]}>
                  Delete match
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          matchesQuery.isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
                Loading match book…
              </Text>
            </View>
          ) : matchesQuery.isError && localMatches.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="phone-portrait-outline" size={28} color={colors.accent} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Couldn’t load matches
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Your saved match book couldn’t be read from this device.
              </Text>
              <Pressable
                testID="button-retry-matches"
                accessibilityRole="button"
                onPress={() => void matchesQuery.refetch()}
                style={[styles.retryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
              </Pressable>
            </View>
          ) : matches.length > 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="eye-off-outline" size={25} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Completed matches are hidden
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Show completed matches to review their scores and point data.
              </Text>
              <Pressable
                testID="button-show-completed-matches"
                accessibilityRole="button"
                onPress={() => setShowCompletedMatches(true)}
                style={[styles.retryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>
                  Show completed matches
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="tennisball-outline" size={25} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No match notes yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Start a set to capture each point, serve fault, and winning shot.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Scores and player profiles stay on this device · no online storage
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 8 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#315e4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontFamily: 'Manrope_700Bold', fontSize: 17, letterSpacing: -0.7 },
  courtBadge: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  courtBadgeText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  signOutText: { marginLeft: 9, fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  heading: { marginTop: 40, marginBottom: 24 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.7 },
  title: {
    marginTop: 10,
    fontFamily: 'Manrope_700Bold',
    fontSize: 39,
    lineHeight: 42,
    letterSpacing: -1.8,
  },
  subtitle: {
    marginTop: 13,
    maxWidth: 340,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  buttonArrow: { marginLeft: 'auto' },
  activePlayerCard: { marginTop: 11, minHeight: 58, paddingHorizontal: 11, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  activePlayerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activePlayerInfo: { flex: 1, gap: 3 },
  activePlayerLabel: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  activePlayerName: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  playerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchPlayerButton: { minHeight: 32, borderWidth: 1, borderRadius: 7, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  switchPlayerText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  inlinePlayersButton: { minHeight: 32, borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  inlinePlayersText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  inlinePlayersCount: { fontFamily: 'DMSans_700Bold', fontSize: 9 },
  backupActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  backupButton: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  backupButtonText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  loadBackupButton: { marginTop: 7, minHeight: 40, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  backupNote: { marginTop: 5, fontFamily: 'DMSans_400Regular', fontSize: 10 },
  sectionHeader: {
    marginTop: 37,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontFamily: 'Manrope_700Bold', fontSize: 20, letterSpacing: -0.5 },
  sectionCaption: { marginTop: 3, fontFamily: 'DMSans_400Regular', fontSize: 12 },
  countPill: {
    minWidth: 30,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  countText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  matchControls: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  completedToggle: {
    minHeight: 30,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  completedToggleText: { fontFamily: 'DMSans_600SemiBold', fontSize: 9 },
  matchCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 11,
  },
  matchCardBody: {
    paddingHorizontal: 16,
    paddingTop: 15,
  },
  matchCardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  matchMeta: { flex: 1, gap: 5 },
  matchEvent: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.4 },
  matchDate: { fontFamily: 'DMSans_400Regular', fontSize: 11 },
  matchStatus: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  matchStatusText: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  matchScoreRow: {
    marginTop: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  matchNames: { flex: 1, gap: 7, paddingRight: 12 },
  matchPlayer: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  matchOpponent: { fontFamily: 'DMSans_400Regular', fontSize: 13 },
  matchSetScores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 13 },
  matchSetScore: { minHeight: 29, borderRadius: 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchSetNumber: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 0.5 },
  matchSetResult: { fontFamily: 'DMSans_700Bold', fontSize: 11, fontVariant: ['tabular-nums'] },
  matchScores: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 67 },
  scoreText: { fontFamily: 'DMSans_700Bold', fontSize: 21, fontVariant: ['tabular-nums'] },
  scoreDivider: { fontFamily: 'DMSans_400Regular', fontSize: 16 },
  matchCardBottom: {
    minHeight: 38,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  matchBottomText: { fontFamily: 'DMSans_600SemiBold', fontSize: 9, letterSpacing: 0.7 },
  deleteMatchAction: { minHeight: 38, marginHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  deleteMatchText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  stateBox: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { fontFamily: 'DMSans_400Regular', fontSize: 13 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 212,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  emptyTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  emptyText: {
    maxWidth: 260,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, marginTop: 7 },
  retryText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  footerText: { fontFamily: 'DMSans_400Regular', fontSize: 11 },
});
