import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Match, MatchInsights } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { MatchSharing } from '@/components/MatchSharing';

interface RemoteMatchViewProps {
  match: Match;
  insights?: MatchInsights;
  insightsLoading: boolean;
  insightsError: boolean;
  onBack: () => void;
}

function formatMatchDate(value: string) {
  const normalizedDate = value.slice(0, 10);
  const [year, month, day] = normalizedDate.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function RemoteMatchView({
  match,
  insights,
  insightsLoading,
  insightsError,
  onBack,
}: RemoteMatchViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to match book"
            testID="button-match-back"
            onPress={onBack}
            style={[styles.back, { borderColor: colors.border }]}
          >
            <Ionicons name="arrow-back" size={19} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              {match.surface.toUpperCase()} · SET {match.setNumber}
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {match.event?.trim() || 'Match record'}
              {match.round ? ` · ${match.round}` : ''}
            </Text>
          </View>
        </View>

        {!match.isOwner ? (
          <View style={[styles.accessNotice, { backgroundColor: colors.secondary }]}>
            <Ionicons name="people-outline" size={17} color={colors.primary} />
            <Text style={[styles.accessText, { color: colors.foreground }]}>
              Shared with you · view-only access
            </Text>
          </View>
        ) : null}

        <View style={[styles.scoreCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.eyebrow, { color: colors.primaryForeground, opacity: 0.75 }]}>
            {match.score.isComplete ? 'SET COMPLETE' : 'CURRENT SCORE'}
          </Text>
          <View style={styles.scoreRow}>
            <View style={styles.names}>
              <Text style={[styles.player, { color: colors.primaryForeground }]}>
                {match.trackedPlayer}
              </Text>
              <Text style={[styles.opponent, { color: colors.primaryForeground, opacity: 0.75 }]}>
                {match.opponent}
              </Text>
            </View>
            <Text style={[styles.score, { color: colors.primaryForeground }]}>
              {match.score.trackedGames}–{match.score.opponentGames}
            </Text>
          </View>
          <View style={styles.scoreBottom}>
            <Text style={[styles.scoreMeta, { color: colors.primaryForeground, opacity: 0.75 }]}>
              {formatMatchDate(match.matchDate)} · {match.points.length} points
            </Text>
            {match.score.isComplete ? (
              <Text style={[styles.scoreMeta, { color: colors.primaryForeground }]}>
                {match.score.winner === 'tracked' ? match.trackedPlayer : match.opponent} won
              </Text>
            ) : null}
          </View>
        </View>

        {match.isOwner ? (
          <MatchSharing
            matchId={match.id}
            canManage
          />
        ) : null}

        <View style={[styles.sectionHeading, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Insights</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            All recorded points
          </Text>
        </View>
        {insightsLoading ? (
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            Loading match insights…
          </Text>
        ) : insightsError ? (
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            Insights are unavailable right now.
          </Text>
        ) : insights ? (
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.insightRow}>
              <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>POINTS WON</Text>
              <Text style={[styles.insightValue, { color: colors.foreground }]}>
                {insights.trackedPointsWon}–{insights.opponentPointsWon}
              </Text>
            </View>
            <View style={styles.insightRow}>
              <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>SERVICE POINTS WON</Text>
              <Text style={[styles.insightValue, { color: colors.foreground }]}>
                {insights.servicePointsWon}
              </Text>
            </View>
            <View style={styles.insightRow}>
              <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>FIRST-SERVE FAULTS</Text>
              <Text style={[styles.insightValue, { color: colors.foreground }]}>
                {insights.firstServeFaults}
              </Text>
            </View>
            {insights.codes.map((code) => (
              <View key={code.code} style={styles.insightRow}>
                <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>
                  {code.code} · {code.count} TAGGED
                </Text>
                <Text style={[styles.insightValue, { color: colors.foreground }]}>
                  {code.trackedWon}–{code.opponentWon}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.sectionHeading, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Point-by-point</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            {match.points.length} {match.points.length === 1 ? 'point' : 'points'}
          </Text>
        </View>
        {match.points.length ? (
          match.points.map((point) => (
            <View
              key={point.id}
              style={[styles.pointRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.pointMarker, {
                backgroundColor: point.winner === 'tracked' ? colors.primary : colors.accent,
              }]}>
                <Text style={[styles.pointMarkerText, { color: colors.primaryForeground }]}>
                  {point.winner === 'tracked' ? 'T' : 'O'}
                </Text>
              </View>
              <View style={styles.pointCopy}>
                <Text style={[styles.pointTitle, { color: colors.foreground }]}>
                  {point.winner === 'tracked' ? match.trackedPlayer : match.opponent} won
                  {point.endingCode ? ` · ${point.endingCode}` : ''}
                </Text>
                <Text style={[styles.pointDetail, { color: colors.mutedForeground }]}>
                  Set {point.setNumber} · Game {point.gameNumber}
                  {point.isTiebreak ? ' · Tiebreak' : ''}
                  {point.firstServeFault ? ' · First-serve fault' : ''}
                </Text>
              </View>
              <Text style={[styles.pointSequence, { color: colors.mutedForeground }]}>
                {point.sequenceNumber}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            No points have been recorded.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18 },
  back: { width: 38, height: 38, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.2 },
  headerSub: { marginTop: 4, fontFamily: 'DMSans_400Regular', fontSize: 12 },
  accessNotice: { minHeight: 38, borderRadius: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  accessText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  scoreCard: { borderRadius: 14, padding: 16, gap: 15 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  names: { flex: 1, gap: 6 },
  player: { fontFamily: 'DMSans_700Bold', fontSize: 17 },
  opponent: { fontFamily: 'DMSans_500Medium', fontSize: 14 },
  score: { fontFamily: 'Manrope_700Bold', fontSize: 30, fontVariant: ['tabular-nums'] },
  scoreBottom: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,.25)', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  scoreMeta: { fontFamily: 'DMSans_500Medium', fontSize: 10 },
  sectionHeading: { marginTop: 24, marginBottom: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Manrope_700Bold', fontSize: 18 },
  sectionHint: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  insightCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  insightRow: { minHeight: 36, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  insightLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 9, letterSpacing: 0.5 },
  insightValue: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  pointRow: { minHeight: 58, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointMarker: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pointMarkerText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  pointCopy: { flex: 1, gap: 4 },
  pointTitle: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  pointDetail: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  pointSequence: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  message: { paddingVertical: 12, fontFamily: 'DMSans_400Regular', fontSize: 12 },
});
