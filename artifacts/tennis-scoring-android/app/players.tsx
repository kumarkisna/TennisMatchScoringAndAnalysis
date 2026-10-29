import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  addLocalPlayer,
  deleteLocalPlayer,
  listLocalPlayers,
  LOCAL_PLAYERS_KEY,
  updateLocalPlayer,
  type LocalPlayerDetailsInput,
  type LocalPlayer,
  type PlayerHand,
} from '@/lib/local-players';

function playerProfileSummary(player: LocalPlayer) {
  const details = [
    player.nationality,
    player.playingHand ? `${player.playingHand} hand` : null,
    player.atpPlayerId ? `ATP ID ${player.atpPlayerId}` : null,
    player.atpRanking ? `ATP #${player.atpRanking}` : null,
    player.itfPlayerId ? `ITF ID ${player.itfPlayerId}` : null,
    player.itfRanking ? `ITF #${player.itfRanking}` : null,
    player.heightCm ? `${player.heightCm} cm` : null,
    player.weightKg ? `${player.weightKg} kg` : null,
  ].filter(Boolean);
  return details.join(' · ');
}

export default function PlayersScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [playerName, setPlayerName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [showTourDetails, setShowTourDetails] = useState(false);
  const [atpPlayerId, setAtpPlayerId] = useState('');
  const [itfPlayerId, setItfPlayerId] = useState('');
  const [atpRanking, setAtpRanking] = useState('');
  const [itfRanking, setItfRanking] = useState('');
  const [nationality, setNationality] = useState('');
  const [playingHand, setPlayingHand] = useState<PlayerHand | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [profileUrls, setProfileUrls] = useState<string[]>([]);
  const playersQuery = useQuery({
    queryKey: LOCAL_PLAYERS_KEY,
    queryFn: listLocalPlayers,
  });
  const savePlayer = useMutation({
    mutationFn: ({
      id,
      name,
      details,
    }: {
      id: string | null;
      name: string;
      details: LocalPlayerDetailsInput;
    }) =>
      id
        ? updateLocalPlayer(id, name, details)
        : addLocalPlayer(name, details),
    onSuccess: async () => {
      resetForm();
      await queryClient.invalidateQueries({ queryKey: LOCAL_PLAYERS_KEY });
    },
  });
  const removePlayer = useMutation({
    mutationFn: deleteLocalPlayer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOCAL_PLAYERS_KEY }),
  });

  function confirmRemove(player: LocalPlayer) {
    Alert.alert(
      'Remove saved player?',
      `${player.name} will be removed from your player list. Existing match records will not change.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removePlayer.mutate(player.id),
        },
      ],
    );
  }

  function submitPlayer() {
    savePlayer.mutate({
      id: editingPlayerId,
      name: playerName,
      details: {
        dateOfBirth: dateOfBirth.trim() || null,
        atpPlayerId,
        itfPlayerId,
        atpRanking,
        itfRanking,
        nationality,
        playingHand,
        heightCm,
        weightKg,
        profileUrls,
      },
    });
  }

  function resetForm() {
    setPlayerName('');
    setDateOfBirth('');
    setEditingPlayerId(null);
    setShowTourDetails(false);
    setAtpPlayerId('');
    setItfPlayerId('');
    setAtpRanking('');
    setItfRanking('');
    setNationality('');
    setPlayingHand(null);
    setHeightCm('');
    setWeightKg('');
    setProfileUrls([]);
  }

  function beginEditing(player: LocalPlayer) {
    setEditingPlayerId(player.id);
    setPlayerName(player.name);
    setDateOfBirth(player.dateOfBirth ?? '');
    setShowTourDetails(true);
    setAtpPlayerId(player.atpPlayerId ?? '');
    setItfPlayerId(player.itfPlayerId ?? '');
    setAtpRanking(player.atpRanking?.toString() ?? '');
    setItfRanking(player.itfRanking?.toString() ?? '');
    setNationality(player.nationality ?? '');
    setPlayingHand(player.playingHand);
    setHeightCm(player.heightCm?.toString() ?? '');
    setWeightKg(player.weightKg?.toString() ?? '');
    setProfileUrls(player.profileUrls ?? []);
    savePlayer.reset();
  }

  function cancelEditing() {
    resetForm();
    savePlayer.reset();
  }

  async function openProfileLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Couldn’t open profile', 'Check that your device has a browser available and try again.');
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          testID="button-back-from-players"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.65 : 1 }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Match book</Text>
        </Pressable>

        <Text style={[styles.eyebrow, { color: colors.accent }]}>ON THIS DEVICE</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Saved players</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Keep a local player list and select names when setting up a match.
        </Text>

        <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {editingPlayerId ? 'Edit player' : 'Add a player'}
          </Text>
          <TextInput
            testID="input-saved-player-name"
            accessibilityLabel="Player name"
            value={playerName}
            onChangeText={setPlayerName}
            placeholder="Player name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            maxLength={80}
            returnKeyType="next"
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          />
          <View style={styles.profileLinksHeader}>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
              PROFILE LINKS · OPTIONAL
            </Text>
            <Pressable
              testID="button-add-player-profile-link"
              accessibilityRole="button"
              accessibilityLabel="Add profile link"
              onPress={() => setProfileUrls((urls) => [...urls, ''])}
              style={({ pressed }) => [
                styles.addLinkButton,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={17} color={colors.primary} />
              <Text style={[styles.addLinkText, { color: colors.primary }]}>Add link</Text>
            </Pressable>
          </View>
          {profileUrls.map((url, index) => (
            <View key={`profile-url-${index}`} style={styles.profileLinkInputRow}>
              <TextInput
                testID={`input-player-profile-link-${index}`}
                accessibilityLabel={`Player profile link ${index + 1}`}
                value={url}
                onChangeText={(value) =>
                  setProfileUrls((urls) => urls.map((item, itemIndex) => itemIndex === index ? value : item))
                }
                placeholder="https://example.com/player"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={2048}
                style={[
                  styles.profileLinkInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
              <Pressable
                testID={`button-remove-player-profile-link-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove profile link ${index + 1}`}
                onPress={() => setProfileUrls((urls) => urls.filter((_, itemIndex) => itemIndex !== index))}
                style={({ pressed }) => [styles.removeLinkButton, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ))}
          <View style={styles.dateField}>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
              DATE OF BIRTH · OPTIONAL
            </Text>
            <TextInput
              testID="input-saved-player-dob"
              accessibilityLabel="Date of birth, optional, year-month-day"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={submitPlayer}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
          </View>
          <Pressable
            testID="toggle-official-player-details"
            accessibilityRole="button"
            accessibilityState={{ expanded: showTourDetails }}
            onPress={() => setShowTourDetails((shown) => !shown)}
            style={[
              styles.profileDetailsToggle,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Ionicons name="clipboard-outline" size={15} color={colors.primary} />
            <Text style={[styles.profileDetailsToggleText, { color: colors.foreground }]}>
              ATP/ITF details · optional
            </Text>
            <Ionicons
              name={showTourDetails ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
          {showTourDetails ? (
            <View style={styles.tourDetails}>
              <View style={styles.pairRow}>
                <View style={styles.profileInputGroup}>
                  <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                    ATP PLAYER ID
                  </Text>
                  <TextInput
                    testID="input-player-atp-id"
                    accessibilityLabel="ATP player ID, optional"
                    value={atpPlayerId}
                    onChangeText={setAtpPlayerId}
                    placeholder="Optional"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={64}
                    style={[
                      styles.profileInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  />
                </View>
                <View style={styles.profileInputGroup}>
                  <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                    ATP RANK
                  </Text>
                  <TextInput
                    testID="input-player-atp-ranking"
                    accessibilityLabel="ATP ranking, optional"
                    value={atpRanking}
                    onChangeText={setAtpRanking}
                    placeholder="Optional"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[
                      styles.profileInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.pairRow}>
                <View style={styles.profileInputGroup}>
                  <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                    ITF PLAYER ID
                  </Text>
                  <TextInput
                    testID="input-player-itf-id"
                    accessibilityLabel="ITF player ID, optional"
                    value={itfPlayerId}
                    onChangeText={setItfPlayerId}
                    placeholder="Optional"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={64}
                    style={[
                      styles.profileInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  />
                </View>
                <View style={styles.profileInputGroup}>
                  <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                    ITF RANK
                  </Text>
                  <TextInput
                    testID="input-player-itf-ranking"
                    accessibilityLabel="ITF ranking, optional"
                    value={itfRanking}
                    onChangeText={setItfRanking}
                    placeholder="Optional"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[
                      styles.profileInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.pairRow}>
                <View style={styles.profileInputGroup}>
                  <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                    NATIONALITY
                  </Text>
                  <TextInput
                    testID="input-player-nationality"
                    accessibilityLabel="Nationality, optional"
                    value={nationality}
                    onChangeText={setNationality}
                    placeholder="Country or code"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={80}
                    style={[
                      styles.profileInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  />
                </View>
                <View style={styles.profileInputGroup}>
                  <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                    HEIGHT · CM
                  </Text>
                  <TextInput
                    testID="input-player-height"
                    accessibilityLabel="Height in centimeters, optional"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="Optional"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={[
                      styles.profileInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.profileInputGroup}>
                <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                  WEIGHT · KG
                </Text>
                <TextInput
                  testID="input-player-weight"
                  accessibilityLabel="Weight in kilograms, optional"
                  value={weightKg}
                  onChangeText={setWeightKg}
                  placeholder="Optional"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={3}
                  style={[
                    styles.profileInput,
                    styles.weightInput,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                />
              </View>
              <View style={styles.profileInputGroup}>
                <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>
                  PLAYING HAND
                </Text>
                <View style={styles.handChoiceRow}>
                  {([
                    ['right', 'Right'],
                    ['left', 'Left'],
                    ['ambidextrous', 'Both'],
                  ] as const).map(([value, label]) => {
                    const selected = playingHand === value;
                    return (
                      <Pressable
                        key={value}
                        testID={`button-playing-hand-${value}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setPlayingHand(selected ? null : value)}
                        style={[
                          styles.handChoice,
                          {
                            backgroundColor: selected ? colors.primary : colors.background,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.handChoiceText,
                            { color: selected ? colors.primaryForeground : colors.foreground },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}
          <View style={styles.addRow}>
            <Pressable
              testID="button-add-saved-player"
              accessibilityRole="button"
              disabled={!playerName.trim() || savePlayer.isPending}
              onPress={submitPlayer}
              style={({ pressed }) => [
                styles.addButton,
                {
                  backgroundColor: colors.primary,
                  opacity: !playerName.trim() || savePlayer.isPending ? 0.5 : pressed ? 0.82 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={20} color={colors.primaryForeground} />
              <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>
                {savePlayer.isPending ? 'Saving' : editingPlayerId ? 'Save changes' : 'Add'}
              </Text>
            </Pressable>
            {editingPlayerId ? (
              <Pressable
                testID="button-cancel-edit-player"
                accessibilityRole="button"
                onPress={cancelEditing}
                style={[styles.cancelButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
          {savePlayer.error ? (
            <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
              {savePlayer.error.message}
            </Text>
          ) : null}
          {removePlayer.error ? (
            <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
              {removePlayer.error.message}
            </Text>
          ) : null}
        </View>

        <View style={styles.listHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your players</Text>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>
            {playersQuery.data?.length ?? 0}
          </Text>
        </View>

        {playersQuery.isLoading ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading saved players…</Text>
        ) : playersQuery.isError ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Couldn’t read the player list from this device.
            </Text>
            <Pressable
              testID="button-retry-saved-players"
              accessibilityRole="button"
              onPress={() => void playersQuery.refetch()}
              style={[styles.retryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
            </Pressable>
          </View>
        ) : playersQuery.data?.length ? (
          <View style={[styles.playersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {playersQuery.data.map((player, index) => {
              const profileSummary = playerProfileSummary(player);
              return (
                <View
                  key={player.id}
                  testID={`saved-player-${player.id}`}
                  style={[
                    styles.playerRow,
                    index < playersQuery.data!.length - 1 && { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.playerIcon, { backgroundColor: colors.secondary }]}>
                    <Ionicons name="person-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.playerDetails}>
                    <Text style={[styles.playerName, { color: colors.foreground }]}>{player.name}</Text>
                    <Text style={[styles.playerDate, { color: colors.mutedForeground }]}>
                      {player.dateOfBirth ? `DOB · ${player.dateOfBirth}` : 'Date of birth not added'}
                    </Text>
                    {profileSummary ? (
                      <Text
                        numberOfLines={2}
                        style={[styles.playerDate, { color: colors.mutedForeground }]}
                      >
                        {profileSummary}
                      </Text>
                    ) : null}
                    {player.profileUrls?.map((url, linkIndex) => {
                      const host = new URL(url).hostname;
                      return (
                        <Pressable
                          key={`${url}-${linkIndex}`}
                          testID={`button-open-player-profile-${player.id}-${linkIndex}`}
                          accessibilityRole="link"
                          accessibilityLabel={`Open ${player.name} profile ${linkIndex + 1} at ${host}`}
                          onPress={() => void openProfileLink(url)}
                          style={({ pressed }) => [styles.profileLink, { opacity: pressed ? 0.65 : 1 }]}
                        >
                          <Ionicons name="open-outline" size={12} color={colors.primary} />
                          <Text numberOfLines={1} style={[styles.profileLinkText, { color: colors.primary }]}>
                            Profile {linkIndex + 1} · {host}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    testID={`button-edit-player-${player.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${player.name}`}
                    onPress={() => beginEditing(player)}
                    style={({ pressed }) => [
                      styles.removeButton,
                      { opacity: pressed ? 0.65 : 1 },
                    ]}
                  >
                    <Ionicons name="create-outline" size={17} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    testID={`button-remove-player-${player.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${player.name} from saved players`}
                    disabled={removePlayer.isPending}
                    onPress={() => confirmRemove(player)}
                    style={({ pressed }) => [
                      styles.removeButton,
                      { opacity: removePlayer.isPending ? 0.45 : pressed ? 0.65 : 1 },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.destructive} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={25} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No saved players yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add player names here, then tap them to fill match setup fields.
            </Text>
          </View>
        )}

        <View style={styles.localNote}>
          <Ionicons name="phone-portrait-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.localNoteText, { color: colors.mutedForeground }]}>
            Player names, details, and profile links stay on this phone. Existing match sheets are not affected when you remove a name.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, marginBottom: 22 },
  backText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.6 },
  title: { marginTop: 8, fontFamily: 'Manrope_700Bold', fontSize: 31, letterSpacing: -1.1 },
  subtitle: { marginTop: 6, marginBottom: 20, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  addCard: { borderWidth: 1, borderRadius: 13, padding: 13, gap: 11 },
  sectionTitle: { fontFamily: 'Manrope_700Bold', fontSize: 16 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: { width: '100%', minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, fontFamily: 'DMSans_500Medium', fontSize: 14 },
  addButton: { flex: 1, minWidth: 80, minHeight: 46, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  addButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  dateField: { gap: 5 },
  dateLabel: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 0.8 },
  profileLinksHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addLinkButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLinkText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  profileLinkInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileLinkInput: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  removeLinkButton: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  profileLink: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  profileLinkText: { flexShrink: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 10, textDecorationLine: 'underline' },
  profileDetailsToggle: { minHeight: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileDetailsToggleText: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  tourDetails: { gap: 10 },
  pairRow: { flexDirection: 'row', gap: 9 },
  profileInputGroup: { flex: 1, gap: 5 },
  profileLabel: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 0.75 },
  profileInput: { minHeight: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  weightInput: { width: '48%' },
  handChoiceRow: { flexDirection: 'row', gap: 7 },
  handChoice: { flex: 1, minHeight: 35, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  handChoiceText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  cancelButton: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  errorText: { fontFamily: 'DMSans_500Medium', fontSize: 11, lineHeight: 16 },
  listHeading: { marginTop: 25, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  playersCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  playerRow: { minHeight: 76, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  playerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  playerDetails: { flex: 1, gap: 3 },
  playerName: { fontFamily: 'DMSans_600SemiBold', fontSize: 13 },
  playerDate: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  removeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { minHeight: 152, borderWidth: 1, borderRadius: 12, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 9 },
  emptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { marginTop: 4, minHeight: 36, borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  localNote: { marginTop: 18, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 7 },
  localNoteText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
