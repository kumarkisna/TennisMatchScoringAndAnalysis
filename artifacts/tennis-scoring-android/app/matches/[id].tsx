import {
  getGetMatchInsightsQueryKey,
  getGetMatchQueryKey,
  getListMatchesQueryKey,
  useGetMatch,
  useGetMatchInsights,
  useRecordPoint,
  useUndoLatestPoint,
} from '@workspace/api-client-react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';

type Side = 'tracked' | 'opponent';
type PointCode = 'A' | 'F' | 'B' | 'V' | 'O' | 'P' | 'N' | 'L' | 'W' | 'D' | 'FE';

const winnerCodes: { code: PointCode; label: string }[] = [
  { code: 'A', label: 'Ace' },
  { code: 'F', label: 'Forehand' },
  { code: 'B', label: 'Backhand' },
  { code: 'V', label: 'Net volley' },
  { code: 'O', label: 'Overhead' },
  { code: 'P', label: 'Drop shot' },
];

const errorCodes: { code: PointCode; label: string }[] = [
  { code: 'N', label: 'Into net' },
  { code: 'L', label: 'Long' },
  { code: 'W', label: 'Wide' },
  { code: 'D', label: 'Double fault' },
  { code: 'FE', label: 'Forced error' },
];

const scoreColumns = ['15', '30', '40', 'AD', 'AD', 'AD', 'AD', 'WIN'];

function otherSide(side: Side): Side {
  return side === 'tracked' ? 'opponent' : 'tracked';
}

function serverForGame(firstServer: Side, gameNumber: number): Side {
  return gameNumber % 2 === 1 ? firstServer : otherSide(firstServer);
}

function formatDate(value: string) {
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

function CodeCell({
  point,
  colors,
}: {
  point?: {
    id: string;
    winner: Side;
    endingCode?: string | null;
    firstServeFault: boolean;
  };
  colors: ReturnType<typeof useColors>;
}) {
  if (!point) {
    return (
      <View
        style={[
          styles.matrixCell,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.emptyCellText, { color: colors.mutedForeground }]}>·</Text>
      </View>
    );
  }

  const pointColor =
    point.winner === 'tracked' ? colors.primary : colors.accent;

  return (
    <View
      testID={`point-cell-${point.id}`}
      style={[
        styles.matrixCell,
        { backgroundColor: pointColor, borderColor: pointColor },
      ]}
    >
      <Text style={[styles.matrixCode, { color: colors.primaryForeground }]}>
        {point.endingCode || (point.winner === 'tracked' ? 'T' : 'O')}
      </Text>
      {point.firstServeFault ? (
        <View style={[styles.faultDot, { backgroundColor: colors.primaryForeground }]} />
      ) : null}
    </View>
  );
}

export default function MatchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const matchId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const [endingCode, setEndingCode] = useState<PointCode | null>(null);
  const [firstServeFault, setFirstServeFault] = useState(false);

  const matchQuery = useGetMatch(matchId, {
    query: {
      enabled: Boolean(matchId),
      queryKey: getGetMatchQueryKey(matchId),
      refetchInterval: 7000,
    },
  });
  const insightsQuery = useGetMatchInsights(matchId, {
    query: {
      enabled: Boolean(matchId),
      queryKey: getGetMatchInsightsQueryKey(matchId),
      refetchInterval: 15000,
    },
  });

  const onUpdated = async (updatedMatch: NonNullable<typeof matchQuery.data>) => {
    queryClient.setQueryData(getGetMatchQueryKey(matchId), updatedMatch);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getGetMatchInsightsQueryKey(matchId),
      }),
    ]);
  };

  const recordPoint = useRecordPoint({
    mutation: {
      onSuccess: async (updatedMatch) => {
        setEndingCode(null);
        setFirstServeFault(false);
        await onUpdated(updatedMatch);
      },
    },
  });
  const undoPoint = useUndoLatestPoint({
    mutation: {
      onSuccess: onUpdated,
    },
  });

  const match = matchQuery.data;
  const isBusy = recordPoint.isPending || undoPoint.isPending;
  const maxGameNumber = useMemo(
    () => Math.min(13, Math.max(1, ...((match?.points ?? []).map((point) => point.gameNumber)))),
    [match?.points],
  );

  function addPoint(winner: Side) {
    if (!match || match.score.isComplete || isBusy) return;
    recordPoint.mutate({
      id: matchId,
      data: {
        winner,
        endingCode,
        firstServeFault,
      },
    });
  }

  function confirmUndo() {
    if (!match || match.points.length === 0 || isBusy) return;
    Alert.alert(
      'Undo last point?',
      'This removes the latest point from the set and recalculates the score.',
      [
        { text: 'Keep point', style: 'cancel' },
        {
          text: 'Undo point',
          style: 'destructive',
          onPress: () => undoPoint.mutate({ id: matchId }),
        },
      ],
    );
  }

  if (matchQuery.isLoading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, styles.centered, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Opening score sheet…
        </Text>
      </SafeAreaView>
    );
  }

  if (matchQuery.isError || !match) {
    return (
      <SafeAreaView
        style={[styles.safeArea, styles.centered, { backgroundColor: colors.background }]}
      >
        <Ionicons name="cloud-offline-outline" size={28} color={colors.accent} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          {matchQuery.isError ? 'Couldn’t open this set' : 'Match not found'}
        </Text>
        <Pressable
          testID="button-retry-match"
          accessibilityRole="button"
          onPress={() => void matchQuery.refetch()}
          style={[styles.retryButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
        </Pressable>
        <Pressable
          testID="button-match-book-error"
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={styles.errorBack}
        >
          <Text style={[styles.errorBackText, { color: colors.mutedForeground }]}>
            Back to match book
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const trackedName = match.trackedPlayer;
  const opponentName = match.opponent;
  const pointGroups = new Map<number, typeof match.points>();
  for (const point of match.points) {
    if (point.isTiebreak) continue;
    const gamePoints = pointGroups.get(point.gameNumber) ?? [];
    gamePoints.push(point);
    pointGroups.set(point.gameNumber, gamePoints);
  }
  const tiebreakPoints = match.points.filter((point) => point.isTiebreak);
  const currentGameNumber = match.score.trackedGames + match.score.opponentGames + 1;
  const finalRegularGame =
    match.score.trackedGames === 7 || match.score.opponentGames === 7
      ? 12
      : match.score.trackedGames + match.score.opponentGames;
  const pointWinnerName =
    (side: Side) => (side === 'tracked' ? trackedName : opponentName);
  const serverName =
    match.score.nextServer === 'tracked' ? trackedName : opponentName;
  const recordError = recordPoint.error?.message || undoPoint.error?.message;
  const pointTotal = match.score.trackedTiebreakPoints + match.score.opponentTiebreakPoints;
  const maxTiebreakColumn = Math.max(7, tiebreakPoints.length);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            testID="button-match-back"
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => [
              styles.backIcon,
              { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={19} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerMeta}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              SET {match.setNumber} · {match.surface.toUpperCase()}
            </Text>
            <Text style={[styles.headerDate, { color: colors.mutedForeground }]}>
              {match.event?.trim() || 'Match score sheet'}
              {match.round ? ` · ${match.round}` : ''}
            </Text>
          </View>
          <Pressable
            testID="button-undo-point"
            accessibilityRole="button"
            accessibilityLabel="Undo last point"
            disabled={match.points.length === 0 || isBusy}
            onPress={confirmUndo}
            style={({ pressed }) => [
              styles.undoButton,
              {
                borderColor: colors.border,
                opacity: match.points.length === 0 || isBusy ? 0.35 : pressed ? 0.65 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-undo-outline" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={[styles.scoreboard, { backgroundColor: colors.primary }]}>
          <View style={styles.scoreboardTop}>
            <Text style={[styles.scoreboardLabel, { color: colors.primaryForeground }]}>
              {match.score.isComplete ? 'SET COMPLETE' : match.score.isTiebreak ? 'TIE-BREAK' : `GAME ${currentGameNumber}`}
            </Text>
            <View style={styles.serverPill}>
              <Ionicons name="tennisball-outline" size={12} color={colors.primaryForeground} />
              <Text style={[styles.serverText, { color: colors.primaryForeground }]}>
                SERVING · {serverName}
              </Text>
            </View>
          </View>

          <View style={styles.scoreLine}>
            <View style={styles.scoreNames}>
              <Text numberOfLines={1} style={[styles.playerNameOnDark, { color: colors.primaryForeground }]}>
                {trackedName}
              </Text>
              <Text numberOfLines={1} style={[styles.playerNameOnDark, { color: colors.primaryForeground, opacity: 0.72 }]}>
                {opponentName}
              </Text>
            </View>
            <View style={styles.scoreNumbers}>
              <Text style={[styles.gamesNumber, { color: colors.primaryForeground }]}>
                {match.score.trackedGames}
              </Text>
              <Text style={[styles.gamesDash, { color: colors.primaryForeground, opacity: 0.45 }]}>–</Text>
              <Text style={[styles.gamesNumber, { color: colors.primaryForeground }]}>
                {match.score.opponentGames}
              </Text>
            </View>
            <View style={styles.pointNumbers}>
              <Text style={[styles.pointNumber, { color: colors.primaryForeground }]}>
                {match.score.trackedPoints}
              </Text>
              <Text style={[styles.pointDash, { color: colors.primaryForeground, opacity: 0.42 }]}>–</Text>
              <Text style={[styles.pointNumber, { color: colors.primaryForeground }]}>
                {match.score.opponentPoints}
              </Text>
            </View>
          </View>

          <View style={[styles.scoreFooter, { borderTopColor: 'rgba(255,255,255,0.17)' }]}>
            <Text style={[styles.scoreFooterText, { color: colors.primaryForeground, opacity: 0.72 }]}>
              {formatDate(match.matchDate)}
              {match.chairCoach ? ` · ${match.chairCoach}` : ''}
            </Text>
            {match.score.isComplete ? (
              <Text style={[styles.winnerText, { color: colors.primaryForeground }]}>
                {pointWinnerName(match.score.winner ?? 'tracked')} wins
              </Text>
            ) : (
              <Text style={[styles.scoreFooterText, { color: colors.primaryForeground, opacity: 0.72 }]}>
                {match.points.length} {match.points.length === 1 ? 'point' : 'points'}
              </Text>
            )}
          </View>
        </View>

        {match.score.isComplete ? (
          <View style={[styles.completeBanner, { backgroundColor: colors.secondary }]}>
            <Ionicons name="checkmark-circle" size={19} color={colors.primary} />
            <Text style={[styles.completeText, { color: colors.secondaryForeground }]}>
              Set recorded. Review the point patterns below.
            </Text>
          </View>
        ) : (
          <View style={[styles.scoringPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.panelHeading}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>Record a point</Text>
              <Text style={[styles.panelHint, { color: colors.mutedForeground }]}>
                Tap the player who won
              </Text>
            </View>

            <View style={styles.awardRow}>
              <Pressable
                testID="button-point-tracked"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => addPoint('tracked')}
                style={({ pressed }) => [
                  styles.awardButton,
                  { backgroundColor: colors.primary, opacity: isBusy ? 0.6 : pressed ? 0.82 : 1 },
                ]}
              >
                <Ionicons name="arrow-up-outline" size={17} color={colors.primaryForeground} />
                <Text numberOfLines={1} style={[styles.awardButtonText, { color: colors.primaryForeground }]}>
                  {trackedName}
                </Text>
              </Pressable>
              <Pressable
                testID="button-point-opponent"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => addPoint('opponent')}
                style={({ pressed }) => [
                  styles.awardButton,
                  { backgroundColor: colors.accent, opacity: isBusy ? 0.6 : pressed ? 0.82 : 1 },
                ]}
              >
                <Ionicons name="arrow-down-outline" size={17} color={colors.accentForeground} />
                <Text numberOfLines={1} style={[styles.awardButtonText, { color: colors.accentForeground }]}>
                  {opponentName}
                </Text>
              </Pressable>
            </View>

            <Pressable
              testID="toggle-first-serve-fault"
              accessibilityRole="button"
              accessibilityState={{ selected: firstServeFault }}
              onPress={() => setFirstServeFault((current) => !current)}
              style={[
                styles.faultToggle,
                {
                  borderColor: firstServeFault ? colors.accent : colors.border,
                  backgroundColor: firstServeFault ? colors.secondary : colors.background,
                },
              ]}
            >
              <View
                style={[
                  styles.faultIndicator,
                  { backgroundColor: firstServeFault ? colors.accent : colors.mutedForeground },
                ]}
              />
              <Text style={[styles.faultToggleText, { color: colors.foreground }]}>
                First-serve fault
              </Text>
              <Text style={[styles.dotNote, { color: colors.mutedForeground }]}>
                Logged as a dot
              </Text>
            </Pressable>

            <View style={styles.codeGroup}>
              <Text style={[styles.codeGroupLabel, { color: colors.mutedForeground }]}>
                WINNING SHOTS
              </Text>
              <View style={styles.codeWrap}>
                {winnerCodes.map((item) => (
                  <CodeChip
                    key={item.code}
                    code={item.code}
                    label={item.label}
                    selected={endingCode === item.code}
                    onPress={() =>
                      setEndingCode((current) => (current === item.code ? null : item.code))
                    }
                  />
                ))}
              </View>
            </View>
            <View style={styles.codeGroup}>
              <Text style={[styles.codeGroupLabel, { color: colors.mutedForeground }]}>
                ERRORS
              </Text>
              <View style={styles.codeWrap}>
                {errorCodes.map((item) => (
                  <CodeChip
                    key={item.code}
                    code={item.code}
                    label={item.label}
                    selected={endingCode === item.code}
                    onPress={() =>
                      setEndingCode((current) => (current === item.code ? null : item.code))
                    }
                  />
                ))}
              </View>
            </View>

            {recordError ? (
              <View accessibilityRole="alert" style={styles.mutationError}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                <Text style={[styles.mutationErrorText, { color: colors.destructive }]}>
                  {recordError}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Match matrix</Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              Each marked cell is one point
            </Text>
          </View>
          <View style={styles.matrixLegend}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>tracked</Text>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>opponent</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.matrixCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View>
            <View style={styles.matrixHeaderRow}>
              <Text style={[styles.matrixGameHeader, { color: colors.mutedForeground }]}>GAME / SERVER</Text>
              {scoreColumns.map((label, index) => (
                <Text
                  key={`${label}-${index}`}
                  style={[
                    styles.matrixColumnHeader,
                    { color: label === 'WIN' ? colors.accent : colors.mutedForeground },
                  ]}
                >
                  {label}
                </Text>
              ))}
              <Text style={[styles.matrixWinnerHeader, { color: colors.mutedForeground }]}>WIN</Text>
            </View>

            {Array.from({ length: 13 }, (_, index) => index + 1).map((gameNumber) => {
              const gamePoints = pointGroups.get(gameNumber) ?? [];
              const hasLaterGame = match.points.some((point) => point.gameNumber > gameNumber);
              const isCompleted =
                hasLaterGame ||
                (match.score.isComplete && gameNumber === finalRegularGame);
              const rowWinner = isCompleted ? gamePoints.at(-1)?.winner : undefined;
              const server = serverForGame(match.firstServer, gameNumber);
              return (
                <View
                  key={gameNumber}
                  testID={`matrix-game-${gameNumber}`}
                  style={[
                    styles.matrixRow,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <View style={styles.matrixGameLabel}>
                    <Text style={[styles.gameNumber, { color: colors.foreground }]}>
                      {String(gameNumber).padStart(2, '0')}
                    </Text>
                    <View
                      style={[
                        styles.serverCircle,
                        { borderColor: server === 'tracked' ? colors.primary : colors.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.serverInitial,
                          { color: server === 'tracked' ? colors.primary : colors.accent },
                        ]}
                      >
                        {server === 'tracked' ? 'T' : 'O'}
                      </Text>
                    </View>
                  </View>
                  {Array.from(
                    { length: Math.max(8, gamePoints.length) },
                    (_, pointIndex) => (
                      <CodeCell
                        key={`${gameNumber}-${pointIndex}`}
                        point={gamePoints[pointIndex]}
                        colors={colors}
                      />
                    ),
                  )}
                  <View
                    style={[
                      styles.winnerCell,
                      {
                        backgroundColor: rowWinner
                          ? rowWinner === 'tracked'
                            ? colors.primary
                            : colors.accent
                          : colors.background,
                        borderColor: rowWinner
                          ? rowWinner === 'tracked'
                            ? colors.primary
                            : colors.accent
                          : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.winnerCellText,
                        {
                          color: rowWinner
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {rowWinner ? (rowWinner === 'tracked' ? 'T' : 'O') : '—'}
                    </Text>
                  </View>
                </View>
              );
            })}

            <View style={[styles.tiebreakBlock, { borderTopColor: colors.border }]}>
              <View style={styles.tiebreakLabel}>
                <Text style={[styles.tiebreakTitle, { color: colors.foreground }]}>TIE-BREAK</Text>
                <Text style={[styles.tiebreakScore, { color: colors.mutedForeground }]}>
                  {match.score.trackedTiebreakPoints} – {match.score.opponentTiebreakPoints}
                </Text>
              </View>
              {Array.from({ length: maxTiebreakColumn }, (_, index) => (
                <View key={`tb-${index + 1}`} style={styles.tiebreakColumn}>
                  <Text style={[styles.tiebreakColumnHeader, { color: colors.mutedForeground }]}>
                    {index + 1}
                  </Text>
                  <CodeCell point={tiebreakPoints[index]} colors={colors} />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Point patterns</Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              Early signals for post-match review
            </Text>
          </View>
          <Ionicons name="analytics-outline" size={19} color={colors.primary} />
        </View>

        {insightsQuery.isLoading ? (
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.insightHint, { color: colors.mutedForeground }]}>
              Updating point patterns…
            </Text>
          </View>
        ) : insightsQuery.data ? (
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statGrid}>
              <Stat label="POINTS WON" value={String(insightsQuery.data.trackedPointsWon)} colors={colors} />
              <Stat label="FIRST FAULTS" value={String(insightsQuery.data.firstServeFaults)} colors={colors} />
              <Stat label="ON SERVE" value={String(insightsQuery.data.servicePointsWon)} colors={colors} />
              <Stat label="ON RETURN" value={String(insightsQuery.data.returnPointsWon)} colors={colors} />
            </View>
            {insightsQuery.data.codes.length > 0 ? (
              <View style={[styles.codeStats, { borderTopColor: colors.border }]}>
                <Text style={[styles.codeStatsTitle, { color: colors.foreground }]}>
                  POINT ENDINGS
                </Text>
                {insightsQuery.data.codes.map((stat) => (
                  <View key={stat.code} testID={`insight-code-${stat.code}`} style={styles.codeStatRow}>
                    <Text style={[styles.statCode, { color: colors.primary }]}>{stat.code}</Text>
                    <Text style={[styles.statCodeLabel, { color: colors.mutedForeground }]}>
                      {labelForCode(stat.code)}
                    </Text>
                    <Text style={[styles.statCodeCount, { color: colors.foreground }]}>
                      {stat.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.noStats, { borderTopColor: colors.border }]}>
                <Text style={[styles.insightHint, { color: colors.mutedForeground }]}>
                  Add a shot or error code to a point to see patterns here.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.insightHint, { color: colors.mutedForeground }]}>
              Point patterns will appear when the connection returns.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent points</Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              {match.points.length} recorded · latest first
            </Text>
          </View>
        </View>

        <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {match.points.length === 0 ? (
            <View style={styles.emptyLog}>
              <Ionicons name="list-outline" size={19} color={colors.mutedForeground} />
              <Text style={[styles.insightHint, { color: colors.mutedForeground }]}>
                The point log will fill in as the set is played.
              </Text>
            </View>
          ) : (
            [...match.points]
              .slice(-8)
              .reverse()
              .map((point, index, recentPoints) => (
                <View
                  key={point.id}
                  testID={`point-log-${point.id}`}
                  style={[
                    styles.logRow,
                    index < recentPoints.length - 1 && { borderBottomColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.logSequence,
                      {
                        backgroundColor:
                          point.winner === 'tracked' ? colors.secondary : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.logSequenceText,
                        { color: point.winner === 'tracked' ? colors.primary : colors.accent },
                      ]}
                    >
                      {point.sequenceNumber}
                    </Text>
                  </View>
                  <View style={styles.logDescription}>
                    <Text style={[styles.logWinner, { color: colors.foreground }]}>
                      {pointWinnerName(point.winner)} won point
                    </Text>
                    <Text style={[styles.logDetail, { color: colors.mutedForeground }]}>
                      Game {point.gameNumber}
                      {point.isTiebreak ? ' · tie-break' : ''}
                      {point.firstServeFault ? ' · first fault' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.logCode, { color: colors.accent }]}>
                    {point.endingCode || '—'}
                  </Text>
                </View>
              ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  function CodeChip({
    code,
    label,
    selected,
    onPress,
  }: {
    code: PointCode;
    label: string;
    selected: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        testID={`code-${code}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[
          styles.codeChip,
          {
            backgroundColor: selected ? colors.secondary : colors.background,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        <Text style={[styles.codeChipCode, { color: selected ? colors.primary : colors.foreground }]}>
          {code}
        </Text>
        <Text style={[styles.codeChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </Pressable>
    );
  }
}

function labelForCode(code: string) {
  const labels: Record<string, string> = {
    A: 'Ace',
    F: 'Forehand winner',
    B: 'Backhand winner',
    V: 'Net volley',
    O: 'Overhead',
    P: 'Drop shot',
    N: 'Into the net',
    L: 'Long',
    W: 'Wide',
    D: 'Double fault',
    FE: 'Forced error',
  };
  return labels[code] ?? 'Other';
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.background }]}>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  loadingText: { fontFamily: 'DMSans_400Regular', fontSize: 13 },
  errorTitle: { fontFamily: 'Manrope_700Bold', fontSize: 18 },
  retryButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 9, marginTop: 5 },
  retryText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  errorBack: { padding: 8 },
  errorBackText: { fontFamily: 'DMSans_500Medium', fontSize: 12 },
  content: { paddingHorizontal: 18, paddingTop: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18 },
  backIcon: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerMeta: { flex: 1 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.3 },
  headerDate: { marginTop: 3, fontFamily: 'DMSans_400Regular', fontSize: 11 },
  undoButton: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scoreboard: { borderRadius: 15, padding: 16, overflow: 'hidden' },
  scoreboardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scoreboardLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.4 },
  serverPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  serverText: { fontFamily: 'DMSans_600SemiBold', fontSize: 8, letterSpacing: 0.8 },
  scoreLine: { marginTop: 21, marginBottom: 17, flexDirection: 'row', alignItems: 'center' },
  scoreNames: { flex: 1, gap: 8, paddingRight: 7 },
  playerNameOnDark: { fontFamily: 'DMSans_600SemiBold', fontSize: 13 },
  scoreNumbers: { minWidth: 72, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  gamesNumber: { fontFamily: 'DMSans_700Bold', fontSize: 28, fontVariant: ['tabular-nums'] },
  gamesDash: { fontFamily: 'DMSans_400Regular', fontSize: 15 },
  pointNumbers: { minWidth: 57, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 3 },
  pointNumber: { minWidth: 22, textAlign: 'center', fontFamily: 'DMSans_600SemiBold', fontSize: 14, fontVariant: ['tabular-nums'] },
  pointDash: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  scoreFooter: { minHeight: 30, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scoreFooterText: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  winnerText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  completeBanner: { marginTop: 12, borderRadius: 9, paddingHorizontal: 12, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  completeText: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  scoringPanel: { marginTop: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  panelHeading: { marginBottom: 11, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  panelTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17, letterSpacing: -0.3 },
  panelHint: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  awardRow: { flexDirection: 'row', gap: 8 },
  awardButton: { flex: 1, minHeight: 57, borderRadius: 9, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  awardButtonText: { maxWidth: '80%', fontFamily: 'DMSans_700Bold', fontSize: 12 },
  faultToggle: { marginTop: 10, minHeight: 39, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  faultIndicator: { width: 7, height: 7, borderRadius: 4 },
  faultToggleText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  dotNote: { marginLeft: 'auto', fontFamily: 'DMSans_400Regular', fontSize: 10 },
  codeGroup: { marginTop: 12, gap: 7 },
  codeGroupLabel: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1.1 },
  codeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  codeChip: { minHeight: 35, borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeChipCode: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  codeChipLabel: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  mutationError: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  mutationErrorText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 11 },
  sectionHeader: { marginTop: 25, marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontFamily: 'Manrope_700Bold', fontSize: 18, letterSpacing: -0.4 },
  sectionCaption: { marginTop: 3, fontFamily: 'DMSans_400Regular', fontSize: 10 },
  matrixLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 3 },
  legendText: { fontFamily: 'DMSans_400Regular', fontSize: 8 },
  matrixCard: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 9 },
  matrixHeaderRow: { flexDirection: 'row', alignItems: 'center', minHeight: 32, gap: 4 },
  matrixGameHeader: { width: 77, fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.4 },
  matrixColumnHeader: { width: 31, textAlign: 'center', fontFamily: 'DMSans_700Bold', fontSize: 7 },
  matrixWinnerHeader: { width: 29, textAlign: 'center', fontFamily: 'DMSans_700Bold', fontSize: 7 },
  matrixRow: { minHeight: 40, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 4 },
  matrixGameLabel: { width: 77, flexDirection: 'row', alignItems: 'center', gap: 8 },
  gameNumber: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, fontVariant: ['tabular-nums'] },
  serverCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  serverInitial: { fontFamily: 'DMSans_700Bold', fontSize: 8 },
  matrixCell: { width: 31, height: 27, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  matrixCode: { fontFamily: 'DMSans_700Bold', fontSize: 8 },
  emptyCellText: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
  faultDot: { position: 'absolute', left: 3, bottom: 3, width: 4, height: 4, borderRadius: 2 },
  winnerCell: { width: 29, height: 27, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  winnerCellText: { fontFamily: 'DMSans_700Bold', fontSize: 9 },
  tiebreakBlock: { minHeight: 58, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tiebreakLabel: { width: 77, gap: 3 },
  tiebreakTitle: { fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.5 },
  tiebreakScore: { fontFamily: 'DMSans_500Medium', fontSize: 8 },
  tiebreakColumn: { width: 31, alignItems: 'center', gap: 3 },
  tiebreakColumnHeader: { fontFamily: 'DMSans_600SemiBold', fontSize: 7 },
  insightCard: { borderWidth: 1, borderRadius: 11, padding: 11 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statTile: { width: '48%', minHeight: 67, borderRadius: 8, padding: 10, justifyContent: 'center' },
  statValue: { fontFamily: 'DMSans_700Bold', fontSize: 21, fontVariant: ['tabular-nums'] },
  statLabel: { marginTop: 2, fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.8 },
  codeStats: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  codeStatsTitle: { marginBottom: 6, fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  codeStatRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statCode: { width: 28, fontFamily: 'DMSans_700Bold', fontSize: 11 },
  statCodeLabel: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 11 },
  statCodeCount: { fontFamily: 'DMSans_700Bold', fontSize: 12, fontVariant: ['tabular-nums'] },
  noStats: { marginTop: 11, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth },
  insightHint: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16 },
  logCard: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 },
  emptyLog: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logRow: { minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logSequence: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logSequenceText: { fontFamily: 'DMSans_700Bold', fontSize: 10, fontVariant: ['tabular-nums'] },
  logDescription: { flex: 1, gap: 3 },
  logWinner: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  logDetail: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  logCode: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
});
