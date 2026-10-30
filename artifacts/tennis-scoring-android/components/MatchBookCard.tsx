import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  getLocalMatchSummaryResultLabel,
  type LocalMatchSummary,
} from '@/lib/local-matches';

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

export function MatchBookCard({
  match,
  expanded,
  preferencesLoading = false,
  deletePending = false,
  onToggle,
  onOpen,
  onDelete,
}: {
  match: LocalMatchSummary;
  expanded: boolean;
  preferencesLoading?: boolean;
  deletePending?: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const finished = match.status === 'complete';
  const resultLabel = getLocalMatchSummaryResultLabel(match);

  return (
    <View
      testID={`match-card-${match.id}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Pressable
        testID={`button-toggle-match-details-${match.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} match details for ${match.trackedPlayer} versus ${match.opponent}`}
        accessibilityState={{
          expanded,
          disabled: preferencesLoading,
        }}
        disabled={preferencesLoading}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.cardBody,
          { opacity: pressed ? 0.84 : 1 },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.meta}>
            <Text style={[styles.event, { color: colors.mutedForeground }]}>
              {match.event?.trim() || 'MATCH SESSION'}
            </Text>
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {formatMatchDate(match.matchDate)}
              {match.round ? ` · ${match.round}` : ''}
              {` · ${match.setScores.length} ${match.setScores.length === 1 ? 'SET' : 'SETS'}`}
            </Text>
          </View>
          <View style={styles.topActions}>
            <View
              style={[
                styles.status,
                { backgroundColor: finished ? colors.secondary : colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
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
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={17}
              color={colors.mutedForeground}
            />
          </View>
        </View>
        <View style={styles.scoreRow}>
          <View style={styles.names}>
            <Text style={[styles.player, { color: colors.foreground }]}>
              {match.trackedPlayer}
            </Text>
            <Text style={[styles.opponent, { color: colors.mutedForeground }]}>
              {match.opponent}
            </Text>
            {resultLabel ? (
              <Text
                testID={`match-result-${match.id}`}
                accessibilityLabel={resultLabel}
                style={[
                  styles.result,
                  {
                    color: match.winner ? colors.primary : colors.mutedForeground,
                  },
                ]}
              >
                {resultLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.expandedDetails}>
          <View style={styles.setScores}>
            {match.setScores.map((set) => {
              const score =
                set.format === 'match_tiebreak'
                  ? `${set.trackedTiebreakPoints}–${set.opponentTiebreakPoints} TB`
                  : `${set.trackedGames}–${set.opponentGames}`;
              return (
                <View
                  key={set.setNumber}
                  style={[styles.setScore, { backgroundColor: colors.background }]}
                >
                  <Text style={[styles.setNumber, { color: colors.mutedForeground }]}>
                    S{set.setNumber}
                  </Text>
                  <Text style={[styles.setResult, { color: colors.foreground }]}>
                    {score}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
            <Text style={[styles.bottomText, { color: colors.mutedForeground }]}>
              {match.surface.toUpperCase()} COURT
            </Text>
            <Text style={[styles.bottomText, { color: colors.mutedForeground }]}>
              {`${match.pointCount} ${match.pointCount === 1 ? 'POINT' : 'POINTS'}`}
            </Text>
          </View>
          <View style={styles.cardActions}>
            <Pressable
              testID={`button-open-match-${match.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Open match ${match.trackedPlayer} versus ${match.opponent}`}
              onPress={onOpen}
              style={({ pressed }) => [
                styles.openAction,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Text style={[styles.openActionText, { color: colors.primaryForeground }]}>
                Open match
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primaryForeground} />
            </Pressable>
            <Pressable
              testID={`button-delete-match-${match.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Delete match ${match.trackedPlayer} versus ${match.opponent}`}
              disabled={deletePending}
              onPress={onDelete}
              style={({ pressed }) => [
                styles.deleteAction,
                {
                  borderColor: colors.border,
                  opacity: deletePending ? 0.45 : pressed ? 0.65 : 1,
                },
              ]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.destructive} />
              <Text style={[styles.deleteText, { color: colors.destructive }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden', marginBottom: 11 },
  cardBody: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flex: 1, gap: 5 },
  event: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.4 },
  date: { fontFamily: 'DMSans_400Regular', fontSize: 11 },
  status: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  scoreRow: { marginTop: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  names: { flex: 1, gap: 7, paddingRight: 12 },
  player: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  opponent: { fontFamily: 'DMSans_400Regular', fontSize: 13 },
  result: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  expandedDetails: { paddingHorizontal: 16 },
  setScores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 13 },
  setScore: { minHeight: 29, borderRadius: 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  setNumber: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 0.5 },
  setResult: { fontFamily: 'DMSans_700Bold', fontSize: 11, fontVariant: ['tabular-nums'] },
  cardBottom: { minHeight: 34, marginTop: 2, marginBottom: 9, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottomText: { fontFamily: 'DMSans_600SemiBold', fontSize: 9, letterSpacing: 0.7 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  openAction: { flex: 1, minHeight: 36, borderRadius: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openActionText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  deleteAction: { minHeight: 36, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  deleteText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
});
