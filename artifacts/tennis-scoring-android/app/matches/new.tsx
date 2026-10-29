import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import {
  createLocalMatch,
  LOCAL_MATCH_LIST_KEY,
  localMatchKey,
  validateLocalMatchDetails,
  type LocalMatchDetails,
} from '@/lib/local-matches';
import {
  addLocalPlayer,
  listLocalPlayers,
  LOCAL_PLAYERS_KEY,
} from '@/lib/local-players';

import { useAuth } from '@clerk/expo';
import { requestMatchSync } from '@/lib/match-sync';

type Side = 'tracked' | 'opponent';
type Surface = 'Hard' | 'Clay' | 'Grass' | 'Carpet' | 'Other';

const surfaces: Surface[] = ['Hard', 'Clay', 'Grass', 'Carpet', 'Other'];

function SavedPlayerChoices({
  players,
  value,
  testIDPrefix,
  onSelect,
}: {
  players: { id: string; name: string }[];
  value: string;
  testIDPrefix: string;
  onSelect: (name: string) => void;
}) {
  const colors = useColors();
  if (players.length === 0) return null;

  return (
    <View style={styles.savedPlayersBlock}>
      <Text style={[styles.savedPlayersLabel, { color: colors.mutedForeground }]}>
        SAVED PLAYERS · TAP TO USE
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.savedPlayersRow}>
          {players.map((player) => {
            const selected =
              value.trim().toLocaleLowerCase() === player.name.toLocaleLowerCase();
            return (
              <Pressable
                key={player.id}
                testID={`saved-player-choice-${testIDPrefix}-${player.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(player.name)}
                style={[
                  styles.savedPlayerChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.background,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.savedPlayerChipText,
                    { color: selected ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {player.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function localDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface FieldProps {
  label: string;
  value: string;
  placeholder: string;
  testID: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
}

function Field({
  label,
  value,
  placeholder,
  testID,
  onChangeText,
  keyboardType = 'default',
  maxLength,
}: FieldProps) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="words"
        style={[
          styles.input,
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

export default function NewMatchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const [matchDate, setMatchDate] = useState(localDate());
  const [trackedPlayer, setTrackedPlayer] = useState('');
  const [opponent, setOpponent] = useState('');
  const [event, setEvent] = useState('');
  const [round, setRound] = useState('');
  const [setNumber, setSetNumber] = useState('1');
  const [chairCoach, setChairCoach] = useState('');
  const [surface, setSurface] = useState<Surface>('Hard');
  const [firstServer, setFirstServer] = useState<Side>('tracked');
  const [formError, setFormError] = useState('');
  const playersQuery = useQuery({
    queryKey: LOCAL_PLAYERS_KEY,
    queryFn: listLocalPlayers,
  });
  const savePlayers = useMutation({
    mutationFn: (names: string[]) => Promise.all(names.map((name) => addLocalPlayer(name))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOCAL_PLAYERS_KEY }),
  });

  const createMatch = useMutation({
    mutationFn: createLocalMatch,
    onSuccess: (match) => {
      queryClient.setQueryData(localMatchKey(match.id), match);
      void queryClient.invalidateQueries({ queryKey: LOCAL_MATCH_LIST_KEY });
      router.replace({ pathname: '/matches/[id]', params: { id: match.id } });
      void requestMatchSync(userId ?? '')
        .catch(() => undefined)
        .finally(() => {
          void queryClient.invalidateQueries({ queryKey: LOCAL_MATCH_LIST_KEY });
          void queryClient.invalidateQueries({ queryKey: localMatchKey(match.id) });
        });
    },
  });

  function submit() {
    setFormError('');
    const parsedSet = Number(setNumber);
    const details: LocalMatchDetails = {
      matchDate,
      trackedPlayer,
      opponent,
      event,
      round,
      chairCoach,
      surface,
      firstServer,
    };
    if (!userId) {
      setFormError('Sign in before creating a match.');
      return;
    }
    const detailsError = validateLocalMatchDetails(details);
    if (detailsError) {
      setFormError(detailsError);
      return;
    }
    if (!Number.isInteger(parsedSet) || parsedSet < 1) {
      setFormError('Set number must be 1 or higher.');
      return;
    }

    createMatch.mutate({
      ownerUserId: userId,
      ...details,
      setNumber: parsedSet,
    });
  }

  function saveCurrentPlayers() {
    const names = [...new Set([trackedPlayer.trim(), opponent.trim()].filter(Boolean))];
    if (names.length > 0) savePlayers.mutate(names);
  }

  const players = playersQuery.data ?? [];
  const nameFor = (side: Side) =>
    side === 'tracked'
      ? trackedPlayer.trim() || 'Tracked player'
      : opponent.trim() || 'Opponent';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 28 },
        ]}
        bottomOffset={84}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          testID="button-back-home"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Match book</Text>
        </Pressable>

        <Text style={[styles.eyebrow, { color: colors.accent }]}>NEW SCORE SHEET</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Set up the set</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Enter both names, choose the court and first server, then open the live score.
        </Text>

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.twoFields}>
            <View style={styles.halfField}>
              <Field
                label="DATE"
                value={matchDate}
                onChangeText={setMatchDate}
                placeholder="YYYY-MM-DD"
                testID="input-match-date"
                maxLength={10}
              />
            </View>
            <View style={styles.halfField}>
              <Field
                label="SET NUMBER"
                value={setNumber}
                onChangeText={setSetNumber}
                placeholder="1"
                testID="input-set-number"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
          </View>

          <Field
            label="TRACKED PLAYER"
            value={trackedPlayer}
            onChangeText={setTrackedPlayer}
            placeholder="Player being recorded"
            testID="input-tracked-player"
            maxLength={80}
          />
          <SavedPlayerChoices
            players={players}
            value={trackedPlayer}
            testIDPrefix="tracked"
            onSelect={setTrackedPlayer}
          />
          <Field
            label="OPPONENT"
            value={opponent}
            onChangeText={setOpponent}
            placeholder="Opposing player or team"
            testID="input-opponent"
            maxLength={80}
          />
          <SavedPlayerChoices
            players={players}
            value={opponent}
            testIDPrefix="opponent"
            onSelect={setOpponent}
          />
          {players.length === 0 ? (
            <Pressable
              testID="button-manage-players-from-match"
              accessibilityRole="button"
              onPress={() => router.push('/players')}
              style={styles.managePlayersLink}
            >
              <Ionicons name="people-outline" size={14} color={colors.primary} />
              <Text style={[styles.managePlayersText, { color: colors.primary }]}>
                Add saved players
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="button-save-match-player-names"
            accessibilityRole="button"
            disabled={(!trackedPlayer.trim() && !opponent.trim()) || savePlayers.isPending}
            onPress={saveCurrentPlayers}
            style={[
              styles.savePlayersButton,
              {
                borderColor: colors.border,
                opacity:
                  !trackedPlayer.trim() && !opponent.trim() || savePlayers.isPending
                    ? 0.45
                    : 1,
              },
            ]}
          >
            <Ionicons name="person-add-outline" size={14} color={colors.primary} />
            <Text style={[styles.managePlayersText, { color: colors.primary }]}>
              {savePlayers.isPending ? 'Saving names…' : 'Save typed names for next time'}
            </Text>
          </Pressable>

          <View style={styles.twoFields}>
            <View style={styles.halfField}>
              <Field
                label="TOURNAMENT / EVENT"
                value={event}
                onChangeText={setEvent}
                placeholder="Optional"
                testID="input-event"
                maxLength={100}
              />
            </View>
            <View style={styles.halfField}>
              <Field
                label="ROUND"
                value={round}
                onChangeText={setRound}
                placeholder="Optional"
                testID="input-round"
                maxLength={60}
              />
            </View>
          </View>

          <Field
            label="CHAIR / COACH"
            value={chairCoach}
            onChangeText={setChairCoach}
            placeholder="Optional"
            testID="input-chair-coach"
            maxLength={80}
          />

          <View style={styles.choiceSection}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>COURT SURFACE</Text>
            <View style={styles.choiceWrap}>
              {surfaces.map((item) => {
                const selected = surface === item;
                return (
                  <Pressable
                    key={item}
                    testID={`surface-${item.toLowerCase()}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSurface(item)}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.choiceSection}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>FIRST SERVER</Text>
            <View style={styles.serverChoices}>
              {(['tracked', 'opponent'] as Side[]).map((side) => {
                const selected = firstServer === side;
                return (
                  <Pressable
                    key={side}
                    testID={`first-server-${side}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFirstServer(side)}
                    style={[
                      styles.serverChoice,
                      {
                        backgroundColor: selected ? colors.secondary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={side === firstServer ? 'radio-button-on' : 'radio-button-off'}
                      size={17}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.serverChoiceText, { color: colors.foreground }]}>
                      {nameFor(side)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {formError || createMatch.error || savePlayers.error ? (
          <View
            accessibilityRole="alert"
            style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {formError ||
                savePlayers.error?.message ||
                createMatch.error?.message ||
                'Could not save this match on this device.'}
            </Text>
          </View>
        ) : null}

        <Pressable
          testID="button-create-match"
          accessibilityRole="button"
          disabled={createMatch.isPending}
          onPress={submit}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: colors.primary,
              opacity: createMatch.isPending ? 0.62 : pressed ? 0.88 : 1,
            },
          ]}
        >
          {createMatch.isPending ? (
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
              Saving…
            </Text>
          ) : (
            <>
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                Open live score
              </Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </>
          )}
        </Pressable>
        <View style={styles.localNote}>
          <Ionicons name="phone-portrait-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.localNoteText, { color: colors.mutedForeground }]}>
            Saved on this phone first. New matches sync privately when signed in.
          </Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, marginBottom: 23 },
  backText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.6 },
  title: { marginTop: 8, fontFamily: 'Manrope_700Bold', fontSize: 31, letterSpacing: -1.1 },
  subtitle: { marginTop: 6, marginBottom: 21, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  formCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 16 },
  twoFields: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  field: { gap: 7, flex: 1 },
  fieldLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.1 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontFamily: 'DMSans_500Medium', fontSize: 14 },
  choiceSection: { gap: 9 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceChip: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  serverChoices: { gap: 8 },
  serverChoice: { minHeight: 43, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  serverChoiceText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 13 },
  savedPlayersBlock: { gap: 6, marginTop: -8 },
  savedPlayersLabel: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 0.8 },
  savedPlayersRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  savedPlayerChip: { minHeight: 31, paddingHorizontal: 10, borderWidth: 1, borderRadius: 16, justifyContent: 'center' },
  savedPlayerChipText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  managePlayersLink: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6 },
  managePlayersText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  savePlayersButton: { minHeight: 36, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  errorBox: { marginTop: 14, borderWidth: 1, borderRadius: 9, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 18 },
  submitButton: { marginTop: 16, minHeight: 54, borderRadius: 10, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submitText: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  localNote: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  localNoteText: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
});
