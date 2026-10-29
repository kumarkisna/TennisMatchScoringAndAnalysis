import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  getLocalInsights,
  getLocalMatch,
  getLocalSetHistory,
  LOCAL_MATCH_LIST_KEY,
  addLocalSet,
  finishLocalMatch,
  localInsightsKey,
  localMatchKey,
  recordLocalPoint,
  updateLocalMatchDetails,
  undoLocalPoint,
  validateLocalMatchDetails,
  type CourtSurface,
  type LocalMatch,
  type LocalMatchDetails,
  type LocalSetResult,
  type NewLocalPoint,
  type PlayerSide,
  type PointCode,
  type SetFormat,
} from '@/lib/local-matches';
import { summarizePlayerPerformance } from '@/lib/player-insights';
import { buildPlayerReportHtml } from '@/lib/player-report-html';

type Side = PlayerSide;

const courtSurfaces: CourtSurface[] = ['Hard', 'Clay', 'Grass', 'Carpet', 'Other'];

function MatchDetailsField({
  label,
  value,
  placeholder,
  testID,
  onChangeText,
  maxLength,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  placeholder: string;
  testID: string;
  onChangeText: (value: string) => void;
  maxLength?: number;
  keyboardType?: 'default' | 'numeric';
}) {
  const colors = useColors();
  return (
    <View style={styles.editField}>
      <Text style={[styles.editFieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize="words"
        style={[
          styles.editInput,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      />
    </View>
  );
}

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

function formatPercent(value: number | null) {
  return value === null ? '—' : `${value}%`;
}

function formatSetResult(set: LocalSetResult) {
  if (set.format === 'match_tiebreak') {
    return `${set.score.trackedTiebreakPoints}–${set.score.opponentTiebreakPoints} TB`;
  }
  return `${set.score.trackedGames}–${set.score.opponentGames}`;
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
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [reportExportError, setReportExportError] = useState('');
  const [customTiebreakTarget, setCustomTiebreakTarget] = useState('');
  const [selectedReviewSetNumber, setSelectedReviewSetNumber] = useState<number | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDraft, setEditDraft] = useState<LocalMatchDetails | null>(null);
  const [editValidationError, setEditValidationError] = useState('');

  const matchQuery = useQuery({
    queryKey: localMatchKey(matchId),
    queryFn: () => getLocalMatch(matchId),
    enabled: Boolean(matchId),
  });
  const insightsQuery = useQuery({
    queryKey: localInsightsKey(matchId),
    queryFn: () => getLocalInsights(matchId),
    enabled: Boolean(matchId),
  });
  useEffect(() => {
    setSelectedReviewSetNumber(null);
  }, [matchId, matchQuery.data?.setNumber]);

  const onUpdated = (updatedMatch: LocalMatch) => {
    queryClient.setQueryData(localMatchKey(matchId), updatedMatch);
    void queryClient.invalidateQueries({ queryKey: LOCAL_MATCH_LIST_KEY });
    void queryClient.invalidateQueries({ queryKey: localInsightsKey(matchId) });
  };

  const recordPoint = useMutation({
    mutationFn: (input: NewLocalPoint) => recordLocalPoint(matchId, input),
    onSuccess: (updatedMatch) => {
      setEndingCode(null);
      setFirstServeFault(false);
      onUpdated(updatedMatch);
    },
  });
  const undoPoint = useMutation({
    mutationFn: () => undoLocalPoint(matchId),
    onSuccess: onUpdated,
  });
  const addSet = useMutation({
    mutationFn: (input: { format: SetFormat; tiebreakTarget?: number }) =>
      addLocalSet(matchId, input.format, input.tiebreakTarget),
    onSuccess: (updatedMatch) => {
      setCustomTiebreakTarget('');
      onUpdated(updatedMatch);
    },
  });
  const finishMatch = useMutation({
    mutationFn: () => finishLocalMatch(matchId),
    onSuccess: onUpdated,
  });
  const updateDetails = useMutation({
    mutationFn: (details: LocalMatchDetails) =>
      updateLocalMatchDetails(matchId, details),
    onSuccess: (updatedMatch) => {
      onUpdated(updatedMatch);
      setIsEditingDetails(false);
      setEditDraft(null);
      setEditValidationError('');
    },
  });
  const match = matchQuery.data;
  const setHistory = match ? getLocalSetHistory(match) : [];
  const currentSet = setHistory.find((set) => set.isCurrent);
  const displayedSet =
    setHistory.find((set) => set.setNumber === selectedReviewSetNumber) ?? currentSet;
  const isReviewingHistoricalSet = Boolean(displayedSet && !displayedSet.isCurrent);
  const isBusy =
    recordPoint.isPending ||
    undoPoint.isPending ||
    addSet.isPending ||
    finishMatch.isPending ||
    updateDetails.isPending;
  const customTarget = Number(customTiebreakTarget);
  const customTargetValid =
    /^\d{1,2}$/.test(customTiebreakTarget) &&
    Number.isInteger(customTarget) &&
    customTarget >= 1 &&
    customTarget <= 99;
  const performance = insightsQuery.data
    ? summarizePlayerPerformance(insightsQuery.data)
    : null;

  function openDetailsEditor() {
    if (!match) return;
    updateDetails.reset();
    setEditValidationError('');
    setEditDraft({
      matchDate: match.matchDate,
      trackedPlayer: match.trackedPlayer,
      opponent: match.opponent,
      event: match.event,
      round: match.round,
      chairCoach: match.chairCoach,
      surface: match.surface,
      firstServer: match.firstServer,
    });
    setIsEditingDetails(true);
  }

  function closeDetailsEditor() {
    if (updateDetails.isPending) return;
    setIsEditingDetails(false);
    setEditDraft(null);
    setEditValidationError('');
    updateDetails.reset();
  }

  function changeEditDraft<Key extends keyof LocalMatchDetails>(
    key: Key,
    value: LocalMatchDetails[Key],
  ) {
    setEditDraft((current) => (current ? { ...current, [key]: value } : current));
    setEditValidationError('');
  }

  function saveMatchDetails() {
    if (!editDraft) return;
    const error = validateLocalMatchDetails(editDraft);
    if (error) {
      setEditValidationError(error);
      return;
    }
    setEditValidationError('');
    updateDetails.mutate(editDraft);
  }

  function addPoint(winner: Side) {
    if (!match || isReviewingHistoricalSet || match.score.isComplete || isBusy) return;
    recordPoint.mutate({ winner, endingCode, firstServeFault });
  }

  function addNextSet(format: SetFormat, tiebreakTarget = 10) {
    if (!match || isReviewingHistoricalSet || !match.score.isComplete || isBusy) return;
    addSet.mutate({ format, tiebreakTarget });
  }

  function finishCurrentMatch() {
    if (!match || isReviewingHistoricalSet || !match.score.isComplete || isBusy) return;
    finishMatch.mutate();
  }

  function confirmUndo() {
    if (!match || isReviewingHistoricalSet || match.points.length === 0 || isBusy) return;
    Alert.alert(
      'Undo last point?',
      'This removes the latest point from the set and recalculates the score.',
      [
        { text: 'Keep point', style: 'cancel' },
        {
          text: 'Undo point',
          style: 'destructive',
          onPress: () => undoPoint.mutate(),
        },
      ],
    );
  }

  async function exportPlayerReport() {
    if (!match || !insightsQuery.data || isExportingReport) return;

    setIsExportingReport(true);
    setReportExportError('');
    const summary = summarizePlayerPerformance(insightsQuery.data);
    const html = buildPlayerReportHtml(match, insightsQuery.data, summary);

    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const file = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save or share player report',
            UTI: 'com.adobe.pdf',
          });
        } else {
          await Print.printAsync({ html });
        }
      }
    } catch (error) {
      setReportExportError(
        error instanceof Error ? error.message : 'Could not prepare the PDF report.',
      );
    } finally {
      setIsExportingReport(false);
    }
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
        <Ionicons name="document-text-outline" size={28} color={colors.accent} />
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
  const viewedSet = displayedSet ?? currentSet ?? setHistory[setHistory.length - 1]!;
  const pointGroups = new Map<number, typeof viewedSet.points>();
  for (const point of viewedSet.points) {
    if (point.isTiebreak) continue;
    const gamePoints = pointGroups.get(point.gameNumber) ?? [];
    gamePoints.push(point);
    pointGroups.set(point.gameNumber, gamePoints);
  }
  const matrixColumnCount = Math.max(
    8,
    ...Array.from(pointGroups.values(), (gamePoints) => gamePoints.length),
  );
  const scoreColumns = Array.from({ length: matrixColumnCount }, (_, index) =>
    index < 3 ? ['15', '30', '40'][index] : 'AD',
  );
  const tiebreakPoints = match.points.filter((point) => point.isTiebreak);
  const matrixTiebreakPoints = viewedSet.points.filter((point) => point.isTiebreak);
  const currentGameNumber = match.score.trackedGames + match.score.opponentGames + 1;
  const matrixCurrentGameNumber =
    viewedSet.score.trackedGames + viewedSet.score.opponentGames + 1;
  const matrixCompletedRegularGameCount = Math.min(
    12,
    viewedSet.score.trackedGames + viewedSet.score.opponentGames,
  );
  const matrixHasActiveRegularGame =
    viewedSet.isCurrent &&
    viewedSet.format === 'standard' &&
    !viewedSet.score.isComplete &&
    !viewedSet.score.isTiebreak;
  const matrixRegularGameNumbers = [
    ...(matrixHasActiveRegularGame ? [matrixCurrentGameNumber] : []),
    ...Array.from(
      { length: matrixCompletedRegularGameCount },
      (_, index) => index + 1,
    ),
  ];
  const matrixShowsTiebreakRows =
    viewedSet.format === 'match_tiebreak' ||
    viewedSet.score.isTiebreak ||
    matrixTiebreakPoints.length > 0;
  const matrixTiebreakIsLive =
    viewedSet.isCurrent &&
    !viewedSet.score.isComplete &&
    (viewedSet.format === 'match_tiebreak' || viewedSet.score.isTiebreak);
  const liveGamePoints =
    match.setFormat === 'match_tiebreak' || match.score.isTiebreak
      ? tiebreakPoints
      : pointGroups.get(currentGameNumber) ?? [];
  const liveServerSide =
    match.setFormat === 'match_tiebreak' || match.score.isTiebreak
      ? match.score.nextServer
      : serverForGame(match.firstServer, currentGameNumber);
  const liveServerName = liveServerSide === 'tracked' ? trackedName : opponentName;
  const pointWinnerName =
    (side: Side) => (side === 'tracked' ? trackedName : opponentName);
  const serverName =
    match.score.nextServer === 'tracked' ? trackedName : opponentName;
  const recordError = recordPoint.error?.message || undoPoint.error?.message;
  const maxMatrixTiebreakColumn = Math.max(
    viewedSet.format === 'match_tiebreak' ? Math.min(viewedSet.tiebreakTarget, 10) : 7,
    matrixTiebreakPoints.length,
  );
  const matrixTiebreakRow = matrixShowsTiebreakRows ? (
    <View
      style={[
        styles.tiebreakBlock,
        {
          borderTopColor: colors.border,
          backgroundColor: matrixTiebreakIsLive ? colors.secondary : 'transparent',
        },
      ]}
    >
      <View style={styles.tiebreakLabel}>
        <Text style={[styles.tiebreakTitle, { color: colors.foreground }]}>
          {viewedSet.format === 'match_tiebreak'
            ? `MATCH TIE-BREAK TO ${viewedSet.tiebreakTarget}`
            : 'TIE-BREAK'}
        </Text>
        <Text style={[styles.tiebreakScore, { color: colors.mutedForeground }]}>
          {viewedSet.score.trackedTiebreakPoints} – {viewedSet.score.opponentTiebreakPoints}
        </Text>
      </View>
      {Array.from({ length: maxMatrixTiebreakColumn }, (_, index) => (
        <View key={`tb-${index + 1}`} style={styles.tiebreakColumn}>
          <Text style={[styles.tiebreakColumnHeader, { color: colors.mutedForeground }]}>
            {index + 1}
          </Text>
          <CodeCell point={matrixTiebreakPoints[index]} colors={colors} />
        </View>
      ))}
    </View>
  ) : null;

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
            testID="button-edit-match-details"
            accessibilityRole="button"
            accessibilityLabel="Edit saved match details"
            onPress={openDetailsEditor}
            style={({ pressed }) => [
              styles.undoButton,
              { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="create-outline" size={18} color={colors.foreground} />
          </Pressable>
          <Pressable
            testID="button-undo-point"
            accessibilityRole="button"
            accessibilityLabel="Undo last point"
            disabled={isReviewingHistoricalSet || match.points.length === 0 || isBusy}
            onPress={confirmUndo}
            style={({ pressed }) => [
              styles.undoButton,
              {
                borderColor: colors.border,
                opacity:
                  isReviewingHistoricalSet || match.points.length === 0 || isBusy
                    ? 0.35
                    : pressed
                      ? 0.65
                      : 1,
              },
            ]}
          >
            <Ionicons name="arrow-undo-outline" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={[styles.scoreboard, { backgroundColor: colors.primary }]}>
          <View style={styles.scoreboardTop}>
            <Text style={[styles.scoreboardLabel, { color: colors.primaryForeground }]}>
              {match.score.isComplete
                ? `SET ${match.setNumber} COMPLETE`
                : match.setFormat === 'match_tiebreak'
                  ? `MATCH TIE-BREAK · FIRST TO ${match.tiebreakTarget}`
                  : match.score.isTiebreak
                    ? 'TIE-BREAK'
                    : `GAME ${currentGameNumber}`}
            </Text>
            <View style={styles.serverPill}>
              <Ionicons name="tennisball-outline" size={12} color={colors.primaryForeground} />
              <Text style={[styles.serverText, { color: colors.primaryForeground }]}>
                {match.score.isComplete
                  ? match.matchStatus === 'complete'
                    ? 'MATCH FINAL'
                    : `NEXT SET · ${serverName} SERVES`
                  : `SERVING · ${serverName}`}
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
            {match.setFormat === 'match_tiebreak' ? (
              <View style={styles.matchTiebreakScore}>
                <Text style={[styles.matchTiebreakScoreLabel, { color: colors.primaryForeground, opacity: 0.72 }]}>
                  TIE-BREAK POINTS
                </Text>
                <Text style={[styles.matchTiebreakScoreValue, { color: colors.primaryForeground }]}>
                  {match.score.trackedTiebreakPoints} – {match.score.opponentTiebreakPoints}
                </Text>
              </View>
            ) : (
              <>
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
              </>
            )}
          </View>

          <View style={[styles.scoreFooter, { borderTopColor: 'rgba(255,255,255,0.17)' }]}>
            <Text style={[styles.scoreFooterText, { color: colors.primaryForeground, opacity: 0.72 }]}>
              {formatDate(match.matchDate)}
              {match.chairCoach ? ` · ${match.chairCoach}` : ''}
            </Text>
            {match.score.isComplete ? (
              <Text style={[styles.winnerText, { color: colors.primaryForeground }]}>
                {pointWinnerName(match.score.winner ?? 'tracked')} wins Set {match.setNumber}
              </Text>
            ) : (
              <Text style={[styles.scoreFooterText, { color: colors.primaryForeground, opacity: 0.72 }]}>
                {match.points.length} {match.points.length === 1 ? 'point' : 'points'}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.setHistoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.setHistoryTop}>
            <Text style={[styles.setHistoryTitle, { color: colors.foreground }]}>MATCH SETS</Text>
            <Text style={[styles.setHistoryCount, { color: colors.mutedForeground }]}>
              {setHistory.length} {setHistory.length === 1 ? 'set' : 'sets'}
            </Text>
          </View>
          <View style={styles.setHistoryWrap}>
            {setHistory.map((set) => {
              const selected = viewedSet.setNumber === set.setNumber;
              return (
                <Pressable
                  key={set.setNumber}
                  testID={`button-review-set-${set.setNumber}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Review Set ${set.setNumber}, ${formatSetResult(set)}${set.isCurrent ? ', current set' : ''}`}
                  accessibilityHint="Opens this set without changing the live score."
                  accessibilityState={{ selected }}
                  style={[
                    styles.setHistoryChip,
                    {
                      backgroundColor: selected ? colors.secondary : colors.background,
                      borderColor: selected || set.isCurrent ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() =>
                    setSelectedReviewSetNumber(set.isCurrent ? null : set.setNumber)
                  }
                >
                  <Text
                    style={[
                      styles.setHistoryLabel,
                      {
                        color:
                          selected || set.isCurrent
                            ? colors.primary
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    SET {set.setNumber}
                    {set.isCurrent ? ' · CURRENT' : selected ? ' · REVIEWING' : ''}
                  </Text>
                  <Text style={[styles.setHistoryScore, { color: colors.foreground }]}>
                    {formatSetResult(set)}
                  </Text>
                  {set.format === 'match_tiebreak' ? (
                    <Text style={[styles.setHistoryTarget, { color: colors.mutedForeground }]}>
                      FIRST TO {set.tiebreakTarget}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.setHistoryHint, { color: colors.mutedForeground }]}>
            Tap any set to review its points. Review never changes the active scoring set.
          </Text>
        </View>

        {isReviewingHistoricalSet ? (
          <View
            style={[
              styles.reviewModeCard,
              { backgroundColor: colors.secondary, borderColor: colors.primary },
            ]}
          >
            <Ionicons name="eye-outline" size={18} color={colors.primary} />
            <View style={styles.reviewModeCopy}>
              <Text style={[styles.reviewModeTitle, { color: colors.secondaryForeground }]}>
                Reviewing Set {viewedSet.setNumber} · read-only
              </Text>
              <Text style={[styles.reviewModeHint, { color: colors.mutedForeground }]}>
                Live scoring stays in Set {match.setNumber}. Return to the current set to record points.
              </Text>
            </View>
            <Pressable
              testID="button-return-to-current-set"
              accessibilityRole="button"
              onPress={() => setSelectedReviewSetNumber(null)}
              style={[styles.returnToCurrentButton, { borderColor: colors.primary }]}
            >
              <Text style={[styles.returnToCurrentText, { color: colors.primary }]}>
                Current
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!isReviewingHistoricalSet && !match.score.isComplete ? (
          <View style={[styles.liveGameCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <View style={styles.liveGameHeader}>
              <View style={styles.liveGameCopy}>
                <Text style={[styles.liveGameEyebrow, { color: colors.accent }]}>
                  LIVE · SET {match.setNumber}
                </Text>
                <Text style={[styles.liveGameTitle, { color: colors.foreground }]}>
                  {match.setFormat === 'match_tiebreak'
                    ? `Match tiebreak to ${match.tiebreakTarget}`
                    : match.score.isTiebreak
                      ? 'Set tiebreak'
                      : `Game ${currentGameNumber}`}
                </Text>
              </View>
              <View style={styles.liveGameScoreBox}>
                <Text style={[styles.liveGameScoreLabel, { color: colors.mutedForeground }]}>
                  {match.setFormat === 'match_tiebreak' || match.score.isTiebreak
                    ? 'TIE-BREAK'
                    : 'POINTS'}
                </Text>
                <Text style={[styles.liveGameScore, { color: colors.primary }]}>
                  {match.setFormat === 'match_tiebreak' || match.score.isTiebreak
                    ? `${match.score.trackedTiebreakPoints}–${match.score.opponentTiebreakPoints}`
                    : `${match.score.trackedPoints}–${match.score.opponentPoints}`}
                </Text>
              </View>
            </View>
            <View style={styles.livePointRow}>
              {liveGamePoints.map((point) => (
                <CodeCell key={point.id} point={point} colors={colors} />
              ))}
              <View style={[styles.liveNextPoint, { borderColor: colors.primary, backgroundColor: colors.secondary }]}>
                <Text style={[styles.liveNextPointText, { color: colors.primary }]}>NEXT</Text>
              </View>
            </View>
            <Text style={[styles.liveGameServer, { color: colors.mutedForeground }]}>
              {match.setFormat === 'match_tiebreak' || match.score.isTiebreak
                ? `Next point server · ${liveServerName}`
                : `Serving · ${liveServerName}`}
            </Text>
          </View>
        ) : null}

        {!isReviewingHistoricalSet && match.score.isComplete ? (
          <>
            <View style={[styles.completeBanner, { backgroundColor: colors.secondary }]}>
              <Ionicons name="checkmark-circle" size={19} color={colors.primary} />
              <Text style={[styles.completeText, { color: colors.secondaryForeground }]}>
                Set {match.setNumber} is complete. Add another set or finish the match.
              </Text>
            </View>
            <View style={[styles.setActionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.setActionTitle, { color: colors.foreground }]}>
                {match.matchStatus === 'complete' ? 'Match finished' : `Add Set ${match.setNumber + 1}`}
              </Text>
              <Text style={[styles.setActionHint, { color: colors.mutedForeground }]}>
                {serverName} serves first in the next set. Choose a format:
              </Text>
              <Pressable
                testID="button-add-standard-set"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => addNextSet('standard')}
                style={({ pressed }) => [
                  styles.setActionButton,
                  { backgroundColor: colors.primary, opacity: isBusy ? 0.55 : pressed ? 0.82 : 1 },
                ]}
              >
                <Text style={[styles.setActionButtonText, { color: colors.primaryForeground }]}>
                  Add standard set
                </Text>
              </Pressable>
              <View style={styles.setActionRow}>
                {[7, 10].map((target) => (
                  <Pressable
                    key={target}
                    testID={`button-add-tiebreak-set-${target}`}
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() => addNextSet('match_tiebreak', target)}
                    style={({ pressed }) => [
                      styles.setActionButton,
                      styles.setActionButtonHalf,
                      {
                        backgroundColor: colors.secondary,
                        opacity: isBusy ? 0.55 : pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.setActionSecondaryText, { color: colors.secondaryForeground }]}>
                      Add tiebreak to {target}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.customTargetRow}>
                <TextInput
                  testID="input-custom-tiebreak-target"
                  accessibilityLabel="Custom tiebreak target"
                  value={customTiebreakTarget}
                  onChangeText={(value) => setCustomTiebreakTarget(value.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="Custom target"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.customTargetInput,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                />
                <Pressable
                  testID="button-add-custom-tiebreak-set"
                  accessibilityRole="button"
                  disabled={isBusy || !customTargetValid}
                  onPress={() => addNextSet('match_tiebreak', customTarget)}
                  style={({ pressed }) => [
                    styles.setActionButton,
                    styles.customTargetButton,
                    {
                      backgroundColor: colors.secondary,
                      opacity: isBusy || !customTargetValid ? 0.45 : pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.setActionSecondaryText, { color: colors.secondaryForeground }]}>
                    Add custom
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.setActionHint, { color: colors.mutedForeground }]}>
                Tiebreaks are won by two points. Custom targets can be 1–99.
              </Text>
              {match.matchStatus === 'complete' ? (
                <Text style={[styles.setActionHint, { color: colors.primary }]}>
                  This match is marked final. Adding a set will reopen it.
                </Text>
              ) : (
                <Pressable
                  testID="button-finish-match"
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={finishCurrentMatch}
                  style={({ pressed }) => [
                    styles.finishMatchButton,
                    { borderColor: colors.border, opacity: isBusy ? 0.55 : pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.finishMatchText, { color: colors.mutedForeground }]}>
                    Finish match
                  </Text>
                </Pressable>
              )}
              {addSet.error ? (
                <View accessibilityRole="alert" style={styles.mutationError}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                  <Text style={[styles.mutationErrorText, { color: colors.destructive }]}>
                    {addSet.error.message}
                  </Text>
                </View>
              ) : null}
              {finishMatch.error ? (
                <View accessibilityRole="alert" style={styles.mutationError}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                  <Text style={[styles.mutationErrorText, { color: colors.destructive }]}>
                    {finishMatch.error.message}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : !isReviewingHistoricalSet ? (
          <View style={[styles.scoringPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.panelHeading}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>Record a point</Text>
              <Text style={[styles.panelHint, { color: colors.mutedForeground }]}>
                Tap the winner after each point; the score updates automatically.
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
                WINNING SHOTS · OPTIONAL
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
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Set {viewedSet.setNumber} matrix
            </Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              {isReviewingHistoricalSet
                ? `Read-only review · live scoring stays in Set ${match.setNumber}`
                : viewedSet.score.isComplete
                  ? 'Completed set · games in order'
                : viewedSet.format === 'match_tiebreak'
                  ? 'Live tiebreak first; completed games follow in order'
                  : 'Current game first; completed games follow in order'}
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
                    { color: colors.mutedForeground },
                  ]}
                >
                  {label}
                </Text>
              ))}
              <Text style={[styles.matrixWinnerHeader, { color: colors.mutedForeground }]}>WIN</Text>
            </View>

            {matrixTiebreakIsLive ? matrixTiebreakRow : null}
            {matrixRegularGameNumbers.map((gameNumber) => {
              const gamePoints = pointGroups.get(gameNumber) ?? [];
              const isCompleted = gameNumber <= matrixCompletedRegularGameCount;
              const rowWinner = isCompleted ? gamePoints.at(-1)?.winner : undefined;
              const isActiveGame =
                matrixHasActiveRegularGame && gameNumber === matrixCurrentGameNumber;
              const server = serverForGame(viewedSet.firstServer, gameNumber);
              return (
                <View
                  key={gameNumber}
                  testID={`matrix-game-${gameNumber}`}
                  style={[
                    styles.matrixRow,
                    {
                      borderTopColor: colors.border,
                      backgroundColor: isActiveGame ? colors.secondary : 'transparent',
                    },
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
                    { length: matrixColumnCount },
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

            {!matrixTiebreakIsLive ? matrixTiebreakRow : null}
          </View>
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Player report</Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              {insightsQuery.data?.pointCount ?? match.points.length} points across {setHistory.length} sets · calculated on this device
            </Text>
          </View>
          <Pressable
            testID="button-export-player-report"
            accessibilityRole="button"
            accessibilityLabel="Print or save player report as PDF"
            disabled={isExportingReport || !insightsQuery.data}
            onPress={() => void exportPlayerReport()}
            style={[
              styles.exportButton,
              {
                backgroundColor: colors.secondary,
                opacity: isExportingReport || !insightsQuery.data ? 0.55 : 1,
              },
            ]}
          >
            {isExportingReport ? (
              <ActivityIndicator size="small" color={colors.secondaryForeground} />
            ) : (
              <Ionicons name="print-outline" size={15} color={colors.secondaryForeground} />
            )}
            <Text style={[styles.exportButtonText, { color: colors.secondaryForeground }]}>
              {isExportingReport ? 'Preparing…' : 'PDF report'}
            </Text>
          </Pressable>
        </View>

        {reportExportError ? (
          <View accessibilityRole="alert" style={styles.exportError}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
            <Text style={[styles.insightHint, { color: colors.destructive }]}>
              {reportExportError}
            </Text>
          </View>
        ) : null}

        {insightsQuery.isLoading ? (
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.insightHint, { color: colors.mutedForeground }]}>
              Updating point patterns…
            </Text>
          </View>
        ) : insightsQuery.data && performance ? (
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.reportPlayer, { color: colors.foreground }]}>
              {match.trackedPlayer}
            </Text>
            <Text style={[styles.reportCaption, { color: colors.mutedForeground }]}>
              Based on recorded results and tags; small samples are directional.
            </Text>
            <View style={styles.statGrid}>
              <Stat
                label="POINTS WON"
                value={formatPercent(performance.overallWinPercent)}
                detail={`${insightsQuery.data.trackedPointsWon} of ${insightsQuery.data.pointCount} points`}
                colors={colors}
              />
              <Stat
                label="SERVE WIN RATE"
                value={formatPercent(performance.serviceWinPercent)}
                detail={`${insightsQuery.data.servicePointsWon} of ${insightsQuery.data.trackedServicePoints} service points`}
                colors={colors}
              />
              <Stat
                label="RETURN WIN RATE"
                value={formatPercent(performance.returnWinPercent)}
                detail={`${insightsQuery.data.returnPointsWon} of ${insightsQuery.data.trackedReturnPoints} return points`}
                colors={colors}
              />
              <Stat
                label="FIRST-SERVE FAULT RATE"
                value={formatPercent(performance.firstServeFaultPercent)}
                detail={`${insightsQuery.data.trackedFirstServeFaults} marked across ${insightsQuery.data.trackedServicePoints} service points`}
                colors={colors}
              />
            </View>

            <View style={[styles.feedbackBlock, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.codeStatsTitle, { color: colors.secondaryForeground }]}>
                PLAYER FEEDBACK
              </Text>
              {performance.feedback.map((item, index) => (
                <View key={`${index}-${item}`} style={styles.feedbackRow}>
                  <View style={[styles.feedbackDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.feedbackText, { color: colors.secondaryForeground }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            {performance.codeInsights.length > 0 ? (
              <View style={[styles.codeStats, { borderTopColor: colors.border }]}>
                <Text style={[styles.codeStatsTitle, { color: colors.foreground }]}>
                  SHOT & POINT-ENDING PERCENTAGES
                </Text>
                {performance.codeInsights.map((stat) => (
                  <View key={stat.code} testID={`insight-code-${stat.code}`} style={styles.codeStatRow}>
                    <Text style={[styles.statCode, { color: colors.primary }]}>{stat.code}</Text>
                    <View style={styles.codeStatCopy}>
                      <Text style={[styles.statCodeLabel, { color: colors.foreground }]}>
                        {labelForCode(stat.code)}
                      </Text>
                      <Text style={[styles.codeStatDetail, { color: colors.mutedForeground }]}>
                        {stat.trackedWon}/{stat.count} tracked wins · {stat.sharePercent}% of tags
                      </Text>
                    </View>
                    <Text style={[styles.statCodeCount, { color: colors.primary }]}>
                      {stat.trackedWinPercent}%
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.noStats, { borderTopColor: colors.border }]}>
                <Text style={[styles.insightHint, { color: colors.mutedForeground }]}>
                  No shot or point-ending tags yet. Add tags while recording points to build shot percentages.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.insightHint, { color: colors.mutedForeground }]}>
              Point patterns couldn’t be loaded from this device.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Set {viewedSet.setNumber} points
            </Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              {viewedSet.points.length} recorded · latest first
            </Text>
          </View>
        </View>

        <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {viewedSet.points.length === 0 ? (
            <View style={styles.emptyLog}>
              <Ionicons name="list-outline" size={19} color={colors.mutedForeground} />
              <Text style={[styles.insightHint, { color: colors.mutedForeground }]}>
                No points have been recorded in Set {viewedSet.setNumber}.
              </Text>
            </View>
          ) : (
            [...viewedSet.points]
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
      <Modal
        visible={isEditingDetails}
        animationType="slide"
        onRequestClose={closeDetailsEditor}
      >
        <SafeAreaView
          style={[styles.editModalSafeArea, { backgroundColor: colors.background }]}
        >
          <View style={[styles.editModalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              testID="button-cancel-edit-match"
              accessibilityRole="button"
              accessibilityLabel="Cancel editing match details"
              disabled={updateDetails.isPending}
              onPress={closeDetailsEditor}
              style={({ pressed }) => [
                styles.editModalIconButton,
                { opacity: updateDetails.isPending ? 0.35 : pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={23} color={colors.foreground} />
            </Pressable>
            <View style={styles.editModalTitleGroup}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>MATCH BOOK</Text>
              <Text style={[styles.editModalTitle, { color: colors.foreground }]}>
                Edit match details
              </Text>
            </View>
            <Pressable
              testID="button-save-edit-match"
              accessibilityRole="button"
              accessibilityLabel="Save match details"
              disabled={!editDraft || updateDetails.isPending}
              onPress={saveMatchDetails}
              style={({ pressed }) => [
                styles.editModalIconButton,
                { opacity: !editDraft || updateDetails.isPending ? 0.35 : pressed ? 0.6 : 1 },
              ]}
            >
              {updateDetails.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="checkmark" size={23} color={colors.primary} />
              )}
            </Pressable>
          </View>
          {editDraft ? (
            <KeyboardAwareScrollViewCompat
              contentContainerStyle={[
                styles.editModalContent,
                { paddingBottom: Math.max(insets.bottom, 20) + 26 },
              ]}
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.editModalNote, { color: colors.mutedForeground }]}>
                Update the match information. Saved sets, points, and performance stats stay as recorded.
              </Text>
              <MatchDetailsField
                label="DATE"
                value={editDraft.matchDate}
                onChangeText={(value) => changeEditDraft('matchDate', value)}
                placeholder="YYYY-MM-DD"
                testID="edit-input-match-date"
                maxLength={10}
              />
              <MatchDetailsField
                label="TRACKED PLAYER"
                value={editDraft.trackedPlayer}
                onChangeText={(value) => changeEditDraft('trackedPlayer', value)}
                placeholder="Player being recorded"
                testID="edit-input-tracked-player"
                maxLength={80}
              />
              <MatchDetailsField
                label="OPPONENT"
                value={editDraft.opponent}
                onChangeText={(value) => changeEditDraft('opponent', value)}
                placeholder="Opposing player or team"
                testID="edit-input-opponent"
                maxLength={80}
              />
              <View style={styles.editTwoFields}>
                <View style={styles.editHalfField}>
                  <MatchDetailsField
                    label="TOURNAMENT / EVENT"
                    value={editDraft.event ?? ''}
                    onChangeText={(value) => changeEditDraft('event', value)}
                    placeholder="Optional"
                    testID="edit-input-event"
                    maxLength={100}
                  />
                </View>
                <View style={styles.editHalfField}>
                  <MatchDetailsField
                    label="ROUND"
                    value={editDraft.round ?? ''}
                    onChangeText={(value) => changeEditDraft('round', value)}
                    placeholder="Optional"
                    testID="edit-input-round"
                    maxLength={60}
                  />
                </View>
              </View>
              <MatchDetailsField
                label="CHAIR / COACH"
                value={editDraft.chairCoach ?? ''}
                onChangeText={(value) => changeEditDraft('chairCoach', value)}
                placeholder="Optional"
                testID="edit-input-chair-coach"
                maxLength={80}
              />

              <View style={styles.editChoiceSection}>
                <Text style={[styles.editFieldLabel, { color: colors.foreground }]}>
                  COURT SURFACE
                </Text>
                <View style={styles.editChoiceWrap}>
                  {courtSurfaces.map((surface) => {
                    const selected = editDraft.surface === surface;
                    return (
                      <Pressable
                        key={surface}
                        testID={`edit-surface-${surface.toLowerCase()}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => changeEditDraft('surface', surface)}
                        style={[
                          styles.editChoiceChip,
                          {
                            backgroundColor: selected ? colors.primary : colors.background,
                            borderColor: selected ? colors.primary : colors.border,
                            borderRadius: colors.radius,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.editChoiceText,
                            { color: selected ? colors.primaryForeground : colors.foreground },
                          ]}
                        >
                          {surface}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.editChoiceSection}>
                <Text style={[styles.editFieldLabel, { color: colors.foreground }]}>
                  FIRST SERVER
                </Text>
                {(['tracked', 'opponent'] as Side[]).map((side) => {
                  const selected = editDraft.firstServer === side;
                  const name =
                    side === 'tracked' ? editDraft.trackedPlayer : editDraft.opponent;
                  return (
                    <Pressable
                      key={side}
                      testID={`edit-first-server-${side}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => changeEditDraft('firstServer', side)}
                      style={[
                        styles.editServerChoice,
                        {
                          backgroundColor: selected ? colors.secondary : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                          borderRadius: colors.radius,
                        },
                      ]}
                    >
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={17}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[styles.editChoiceText, { color: colors.foreground }]}>
                        {name.trim() || (side === 'tracked' ? 'Tracked player' : 'Opponent')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {editValidationError || updateDetails.error instanceof Error ? (
                <View
                  accessibilityRole="alert"
                  style={[
                    styles.editErrorBanner,
                    { borderColor: colors.destructive, backgroundColor: colors.card },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={colors.destructive}
                  />
                  <Text style={[styles.editErrorText, { color: colors.destructive }]}>
                    {editValidationError ||
                      (updateDetails.error instanceof Error
                        ? updateDetails.error.message
                        : 'Could not save match details.')}
                  </Text>
                </View>
              ) : null}
            </KeyboardAwareScrollViewCompat>
          ) : null}
        </SafeAreaView>
      </Modal>
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
  detail,
  colors,
}: {
  label: string;
  value: string;
  detail: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.background }]}>
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statDetail, { color: colors.mutedForeground }]}>{detail}</Text>
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
  editModalSafeArea: { flex: 1 },
  editModalHeader: { minHeight: 64, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  editModalIconButton: { minWidth: 36, minHeight: 40, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  editModalTitleGroup: { flex: 1, gap: 2 },
  editModalTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  editModalContent: { paddingHorizontal: 18, paddingTop: 17, gap: 16 },
  editModalNote: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 1 },
  editField: { gap: 7 },
  editFieldLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.1 },
  editInput: { minHeight: 48, borderWidth: 1, paddingHorizontal: 12, fontFamily: 'DMSans_400Regular', fontSize: 14 },
  editTwoFields: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  editHalfField: { flex: 1 },
  editChoiceSection: { gap: 9 },
  editChoiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editChoiceChip: { minHeight: 39, paddingHorizontal: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editChoiceText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  editServerChoice: { minHeight: 48, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  editErrorBanner: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  editErrorText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17 },
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
  matchTiebreakScore: { minWidth: 112, alignItems: 'flex-end', gap: 4 },
  matchTiebreakScoreLabel: { fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.8 },
  matchTiebreakScoreValue: { fontFamily: 'DMSans_700Bold', fontSize: 25, fontVariant: ['tabular-nums'] },
  scoreFooter: { minHeight: 30, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scoreFooterText: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  winnerText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  completeBanner: { marginTop: 12, borderRadius: 9, paddingHorizontal: 12, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  completeText: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  setHistoryCard: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 12, gap: 9 },
  setHistoryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setHistoryTitle: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.1 },
  setHistoryCount: { fontFamily: 'DMSans_500Medium', fontSize: 10 },
  setHistoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  setHistoryChip: { minWidth: 75, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  setHistoryLabel: { fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.6 },
  setHistoryScore: { marginTop: 3, fontFamily: 'DMSans_700Bold', fontSize: 13, fontVariant: ['tabular-nums'] },
  setHistoryTarget: { marginTop: 2, fontFamily: 'DMSans_500Medium', fontSize: 7, letterSpacing: 0.4 },
  setHistoryHint: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  reviewModeCard: { marginTop: 10, borderWidth: 1, borderRadius: 11, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  reviewModeCopy: { flex: 1, gap: 3 },
  reviewModeTitle: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  reviewModeHint: { fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 13 },
  returnToCurrentButton: { minHeight: 31, paddingHorizontal: 8, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  returnToCurrentText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  setActionCard: { marginTop: 10, borderWidth: 1, borderRadius: 13, padding: 13, gap: 8 },
  setActionTitle: { fontFamily: 'Manrope_700Bold', fontSize: 15 },
  setActionHint: { fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15 },
  setActionButton: { minHeight: 42, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  setActionButtonHalf: { flex: 1 },
  setActionButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  setActionSecondaryText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  setActionRow: { flexDirection: 'row', gap: 8 },
  customTargetRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  customTargetInput: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  customTargetButton: { width: 110 },
  finishMatchButton: { minHeight: 38, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  finishMatchText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  liveGameCard: { marginTop: 11, borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 9 },
  liveGameHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  liveGameCopy: { flex: 1, gap: 3 },
  liveGameEyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  liveGameTitle: { fontFamily: 'Manrope_700Bold', fontSize: 15 },
  liveGameScoreBox: { alignItems: 'flex-end', gap: 2 },
  liveGameScoreLabel: { fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.8 },
  liveGameScore: { fontFamily: 'DMSans_700Bold', fontSize: 17, fontVariant: ['tabular-nums'] },
  livePointRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  liveNextPoint: { width: 42, height: 27, borderWidth: 1, borderStyle: 'dashed', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  liveNextPointText: { fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.5 },
  liveGameServer: { fontFamily: 'DMSans_500Medium', fontSize: 9 },
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
  exportButton: { minHeight: 36, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  exportButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  exportError: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
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
  reportPlayer: { fontFamily: 'Manrope_700Bold', fontSize: 16 },
  reportCaption: { marginTop: 3, marginBottom: 11, fontFamily: 'DMSans_400Regular', fontSize: 10 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statTile: { width: '48%', minHeight: 79, borderRadius: 8, padding: 10, justifyContent: 'center' },
  statValue: { fontFamily: 'DMSans_700Bold', fontSize: 21, fontVariant: ['tabular-nums'] },
  statLabel: { marginTop: 2, fontFamily: 'DMSans_700Bold', fontSize: 7, letterSpacing: 0.8 },
  statDetail: { marginTop: 3, fontFamily: 'DMSans_400Regular', fontSize: 8, lineHeight: 11 },
  feedbackBlock: { marginTop: 12, borderRadius: 8, padding: 10, gap: 7 },
  feedbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  feedbackDot: { width: 5, height: 5, borderRadius: 3, marginTop: 5 },
  feedbackText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15 },
  codeStats: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  codeStatsTitle: { marginBottom: 6, fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  codeStatRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statCode: { width: 28, fontFamily: 'DMSans_700Bold', fontSize: 11 },
  codeStatCopy: { flex: 1 },
  statCodeLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  codeStatDetail: { marginTop: 2, fontFamily: 'DMSans_400Regular', fontSize: 8 },
  statCodeCount: { minWidth: 38, textAlign: 'right', fontFamily: 'DMSans_700Bold', fontSize: 12, fontVariant: ['tabular-nums'] },
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
