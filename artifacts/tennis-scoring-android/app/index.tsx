import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
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
import { listLocalMatches, LOCAL_MATCH_LIST_KEY } from '@/lib/local-matches';

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
  const matchesQuery = useQuery({
    queryKey: LOCAL_MATCH_LIST_KEY,
    queryFn: listLocalMatches,
  });
  const matches = matchesQuery.data ?? [];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={matches.length > 0}
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

            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Match book
                </Text>
                <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
                  Saved on this device · no cloud sync
                </Text>
              </View>
              <View style={[styles.countPill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.countText, { color: colors.secondaryForeground }]}>
                  {matches.length}
                </Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const finished = item.status === 'complete';
          return (
            <Pressable
              testID={`match-card-${item.id}`}
              accessibilityRole="button"
              onPress={() => router.push(`/matches/${item.id}`)}
              style={({ pressed }) => [
                styles.matchCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.84 : 1,
                },
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
                  {item.pointCount} {item.pointCount === 1 ? 'POINT' : 'POINTS'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </View>
            </Pressable>
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
          ) : matchesQuery.isError ? (
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
          matches.length > 0 ? (
            <View style={styles.footerNote}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                Scores remain on this device
              </Text>
            </View>
          ) : undefined
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
  matchCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 15,
    marginBottom: 11,
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
