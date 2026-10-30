import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import type { LocalPlayer } from '@/lib/local-players';

type Side = 'tracked' | 'opponent';

export function LocalPlayerPicker({
  players,
  side,
  selectedPlayerId,
  onSelect,
  testIDPrefix,
}: {
  players: LocalPlayer[];
  side: Side;
  selectedPlayerId: string | null | undefined;
  onSelect: (player: LocalPlayer) => void;
  testIDPrefix: string;
}) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const sideLabel = side === 'tracked' ? 'tracked player' : 'opponent';
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);
  const visiblePlayers = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);
    return players
      .filter((player) => {
        const searchableText = normalizeSearch(
          [
            player.name,
            ...player.profileUrlLabels,
            ...player.profileUrls,
          ].join(' '),
        );
        return !normalizedSearch || searchableText.includes(normalizedSearch);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [players, search]);

  function closePicker() {
    setIsOpen(false);
    setSearch('');
  }

  return (
    <>
      <View style={styles.pickerBlock}>
        <Pressable
          testID={`button-open-saved-player-picker-${testIDPrefix}`}
          accessibilityRole="button"
          accessibilityLabel={
            selectedPlayer
              ? `Change saved profile for ${sideLabel}, currently ${selectedPlayer.name}`
              : `Choose a saved profile for ${sideLabel}`
          }
          accessibilityHint={`Search ${players.length} saved player profiles on this device`}
          onPress={() => setIsOpen(true)}
          style={({ pressed }) => [
            styles.openButton,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons
            name={selectedPlayer ? 'person-circle-outline' : 'search-outline'}
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.openButtonText, { color: colors.primary }]}>
            {selectedPlayer ? 'Change saved profile' : 'Find a saved player'}
          </Text>
          <Text style={[styles.playerCount, { color: colors.mutedForeground }]}>
            {players.length}
          </Text>
        </Pressable>
        {selectedPlayer ? (
          <View
            testID={`saved-player-link-status-${testIDPrefix}`}
            accessibilityLiveRegion="polite"
          >
            <Text style={[styles.linkStatus, { color: colors.mutedForeground }]}>
              {selectedPlayer.profileUrls.length > 0
                ? `Saved profile linked · ${selectedPlayer.profileUrls.length} profile ${
                    selectedPlayer.profileUrls.length === 1 ? 'link' : 'links'
                  }`
                : 'Saved player linked · no profile links'}
            </Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={isOpen}
        animationType="slide"
        onRequestClose={closePicker}
      >
        <SafeAreaView
          style={[styles.modal, { backgroundColor: colors.background }]}
          edges={['top', 'left', 'right']}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleGroup}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                SAVED PLAYERS
              </Text>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: colors.foreground }]}
              >
                Choose {sideLabel}
              </Text>
            </View>
            <Pressable
              testID={`button-close-saved-player-picker-${testIDPrefix}`}
              accessibilityRole="button"
              accessibilityLabel="Close saved player search"
              onPress={closePicker}
              hitSlop={8}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <View
            style={[
              styles.searchField,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search-outline" size={17} color={colors.mutedForeground} />
            <TextInput
              testID={`input-search-saved-player-${testIDPrefix}`}
              accessibilityLabel={`Search saved profiles for ${sideLabel}`}
              accessibilityHint="Search by player name or saved profile label"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearch}
              placeholder="Search by name or profile"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.foreground }]}
              value={search}
            />
            {search ? (
              <Pressable
                testID={`button-clear-saved-player-search-${testIDPrefix}`}
                accessibilityRole="button"
                accessibilityLabel="Clear player search"
                onPress={() => setSearch('')}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          <Text
            accessibilityLiveRegion="polite"
            style={[styles.resultCount, { color: colors.mutedForeground }]}
          >
            {visiblePlayers.length} {visiblePlayers.length === 1 ? 'player' : 'players'}
          </Text>

          <FlatList
            data={visiblePlayers}
            keyExtractor={(player) => player.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.resultList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No saved players match this search.
              </Text>
            }
            renderItem={({ item: player }) => {
              const selected = player.id === selectedPlayerId;
              const linkLabels = player.profileUrlLabels
                .map((label) => label.trim())
                .filter(Boolean);
              const linkSummary =
                player.profileUrls.length > 0
                  ? `${player.profileUrls.length} saved profile ${
                      player.profileUrls.length === 1 ? 'link' : 'links'
                    }${linkLabels.length ? ` · ${linkLabels.join(' · ')}` : ''}`
                  : 'No saved profile links';
              return (
                <Pressable
                  testID={`saved-player-search-result-${testIDPrefix}-${player.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${player.name} as ${sideLabel}. ${linkSummary}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSelect(player);
                    closePicker();
                  }}
                  style={({ pressed }) => [
                    styles.resultRow,
                    {
                      backgroundColor: selected ? colors.secondary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                      opacity: pressed ? 0.76 : 1,
                    },
                  ]}
                >
                  <View style={styles.resultCopy}>
                    <Text style={[styles.playerName, { color: colors.foreground }]}>
                      {player.name}
                    </Text>
                    <Text style={[styles.profileSummary, { color: colors.mutedForeground }]}>
                      {linkSummary}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'chevron-forward'}
                    size={20}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

const styles = StyleSheet.create({
  pickerBlock: { gap: 6, marginTop: -8 },
  openButton: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  openButtonText: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  playerCount: { fontFamily: 'DMSans_500Medium', fontSize: 10 },
  linkStatus: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  modal: { flex: 1 },
  header: {
    minHeight: 72,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleGroup: { gap: 3 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.2 },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 21 },
  closeButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  searchField: {
    marginHorizontal: 20,
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: { flex: 1, minHeight: 44, fontFamily: 'DMSans_500Medium', fontSize: 14 },
  resultCount: { marginHorizontal: 22, marginTop: 14, marginBottom: 6, fontFamily: 'DMSans_500Medium', fontSize: 11 },
  resultList: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  resultRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultCopy: { flex: 1, gap: 4 },
  playerName: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  profileSummary: { fontFamily: 'DMSans_400Regular', fontSize: 10 },
  emptyText: { padding: 20, fontFamily: 'DMSans_400Regular', fontSize: 13, textAlign: 'center' },
});
