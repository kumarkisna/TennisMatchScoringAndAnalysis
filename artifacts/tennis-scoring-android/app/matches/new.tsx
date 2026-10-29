import { getListMatchesQueryKey, useCreateMatch } from '@workspace/api-client-react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';

type Side = 'tracked' | 'opponent';
type Surface = 'Hard' | 'Clay' | 'Grass' | 'Carpet' | 'Other';

const surfaces: Surface[] = ['Hard', 'Clay', 'Grass', 'Carpet', 'Other'];

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

  const createMatch = useCreateMatch({
    mutation: {
      onSuccess: (match) => {
        void queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        router.replace({ pathname: '/matches/[id]', params: { id: match.id } });
      },
    },
  });

  function submit() {
    setFormError('');
    const parsedSet = Number(setNumber);
    if (!trackedPlayer.trim() || !opponent.trim()) {
      setFormError('Add both player names before starting the set.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
      setFormError('Enter the date as YYYY-MM-DD.');
      return;
    }
    if (!Number.isInteger(parsedSet) || parsedSet < 1) {
      setFormError('Set number must be 1 or higher.');
      return;
    }

    createMatch.mutate({
      data: {
        matchDate,
        trackedPlayer: trackedPlayer.trim(),
        opponent: opponent.trim(),
        event: event.trim() || null,
        round: round.trim() || null,
        setNumber: parsedSet,
        chairCoach: chairCoach.trim() || null,
        surface,
        firstServer,
      },
    });
  }

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
          The match matrix keeps each point tied to its player, server, and court conditions.
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
          <Field
            label="OPPONENT"
            value={opponent}
            onChangeText={setOpponent}
            placeholder="Opposing player or team"
            testID="input-opponent"
            maxLength={80}
          />

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

        {formError || createMatch.error ? (
          <View
            accessibilityRole="alert"
            style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {formError ||
                (createMatch.error?.message.toLowerCase().includes('fetch')
                  ? 'Could not reach the scoring server. Check your connection and try again.'
                  : createMatch.error?.message) ||
                'Could not create the match.'}
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
  errorBox: { marginTop: 14, borderWidth: 1, borderRadius: 9, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 18 },
  submitButton: { marginTop: 16, minHeight: 54, borderRadius: 10, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submitText: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
});
