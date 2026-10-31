import type { useColors } from '@/hooks/useColors';
import type { HeadToHeadSurfaceMatchOutcomes } from '@/lib/head-to-head';
import { StyleSheet, Text, View } from 'react-native';

type Theme = ReturnType<typeof useColors>;

export function HeadToHeadSurfaceMatchOutcomesCard({
  outcomes,
  trackedPlayer,
  colors,
}: {
  outcomes: readonly HeadToHeadSurfaceMatchOutcomes[];
  trackedPlayer: string;
  colors: Theme;
}) {
  return (
    <View
      testID="head-to-head-surface-match-outcomes"
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Match record by court surface
      </Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        W–L is {trackedPlayer}’s completed matches with a clear winner. Matches
        without a clear winner and in progress are counted separately.
      </Text>
      {outcomes.map(
        ({
          surface,
          matchCount,
          wins,
          losses,
          completedWithoutWinner,
          inProgress,
        }) => (
          <View
            key={surface}
            testID={`head-to-head-surface-match-outcome-${surface.toLowerCase()}`}
            style={[styles.row, { borderTopColor: colors.border }]}
          >
            <View style={styles.mainRow}>
              <View style={styles.surfaceDetails}>
                <Text style={[styles.surface, { color: colors.foreground }]}>
                  {surface}
                </Text>
                <Text style={[styles.matchCount, { color: colors.mutedForeground }]}>
                  {matchCount} {matchCount === 1 ? 'match' : 'matches'} recorded
                </Text>
              </View>
              <View style={styles.record}>
                <Text style={[styles.recordValue, { color: colors.primary }]}>
                  {wins}–{losses}
                </Text>
                <Text style={[styles.recordLabel, { color: colors.mutedForeground }]}>
                  Tracked W–L
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.status, { color: colors.mutedForeground }]}>
                {completedWithoutWinner} completed without a clear winner
              </Text>
              <Text style={[styles.status, { color: colors.mutedForeground }]}>
                {inProgress} in progress
              </Text>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
  },
  description: {
    marginTop: 5,
    fontFamily: 'DMSans_400Regular',
    fontSize: 9,
    lineHeight: 14,
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  surfaceDetails: {
    flex: 1,
    gap: 2,
  },
  surface: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
  },
  matchCount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 8,
  },
  record: {
    minWidth: 55,
    alignItems: 'flex-end',
    gap: 1,
  },
  recordValue: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  recordLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 7,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 3,
    marginTop: 4,
  },
  status: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 8,
    lineHeight: 11,
  },
});
