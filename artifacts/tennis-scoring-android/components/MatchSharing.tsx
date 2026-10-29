import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getListMatchSharesQueryKey,
  useCreateMatchShare,
  useDeleteMatchShare,
  useListMatchShares,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

interface MatchSharingProps {
  matchId: string | null;
  canManage: boolean;
  checking?: boolean;
  deviceOnly?: boolean;
  waitingForSync?: boolean;
}

export function MatchSharing({
  matchId,
  canManage,
  checking = false,
  deviceOnly = false,
  waitingForSync = false,
}: MatchSharingProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const sharesQuery = useListMatchShares(matchId ?? '', {
    query: {
      enabled: Boolean(matchId && canManage),
      queryKey: getListMatchSharesQueryKey(matchId ?? ''),
    },
  });
  const addShare = useCreateMatchShare({
    mutation: {
      onSuccess: async () => {
        setEmail('');
        setMessage('Viewer access added.');
        if (matchId) {
          await queryClient.invalidateQueries({
            queryKey: getListMatchSharesQueryKey(matchId),
          });
        }
      },
      onError: () => setMessage('Could not add this viewer. Check the email and try again.'),
    },
  });
  const removeShare = useDeleteMatchShare({
    mutation: {
      onSuccess: async () => {
        setMessage('Viewer access removed.');
        if (matchId) {
          await queryClient.invalidateQueries({
            queryKey: getListMatchSharesQueryKey(matchId),
          });
        }
      },
      onError: () => setMessage('Could not remove viewer access. Please try again.'),
    },
  });

  if (!matchId) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>MATCH SHARING</Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {deviceOnly
            ? 'This older device-only match stays on this phone and is not uploaded or shared automatically.'
            : waitingForSync
              ? 'Sharing becomes available after this new match syncs to your private account.'
              : 'This match is only stored on this device.'}
        </Text>
      </View>
    );
  }

  if (checking && !canManage) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>MATCH SHARING</Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Checking the match owner before showing sharing controls…
        </Text>
      </View>
    );
  }

  if (!canManage) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>MATCH SHARING</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Only invited accounts with a verified matching email can read this match and its insights.
      </Text>
      <View style={styles.form}>
        <TextInput
          accessibilityLabel="Invite viewer by email"
          testID="input-share-email"
          value={email}
          onChangeText={setEmail}
          placeholder="viewer@example.com"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          testID="button-share-match"
          disabled={!email.trim() || addShare.isPending}
          onPress={() => addShare.mutate({ id: matchId, data: { email: email.trim() } })}
          style={[
            styles.button,
            { backgroundColor: colors.primary, opacity: !email.trim() || addShare.isPending ? 0.5 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            {addShare.isPending ? 'Adding…' : 'Invite'}
          </Text>
        </Pressable>
      </View>
      {message ? (
        <Text accessibilityRole="alert" style={[styles.hint, { color: colors.mutedForeground }]}>
          {message}
        </Text>
      ) : null}
      <Text style={[styles.listTitle, { color: colors.mutedForeground }]}>
        PEOPLE WITH ACCESS
      </Text>
      {sharesQuery.isLoading ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Loading viewers…</Text>
      ) : sharesQuery.isError ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Viewer list is unavailable. Try again when online.
        </Text>
      ) : sharesQuery.data?.length ? (
        sharesQuery.data.map((share) => (
          <View key={share.id} style={[styles.shareRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.email, { color: colors.foreground }]}>{share.email}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${share.email}`}
              testID={`button-remove-share-${share.id}`}
              disabled={removeShare.isPending}
              onPress={() =>
                Alert.alert(
                  'Remove viewer access?',
                  `${share.email} will no longer be able to read this match or its insights.`,
                  [
                    { text: 'Keep access', style: 'cancel' },
                    {
                      text: 'Remove access',
                      style: 'destructive',
                      onPress: () => removeShare.mutate({ id: matchId, shareId: share.id }),
                    },
                  ],
                )
              }
              style={styles.removeButton}
            >
              <Text style={[styles.removeText, { color: colors.destructive }]}>Remove</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          No viewers have been invited.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.1 },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16 },
  form: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 40, flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 13 },
  button: { minHeight: 40, borderRadius: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  listTitle: { marginTop: 5, fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  shareRow: { minHeight: 38, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  email: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  removeButton: { paddingHorizontal: 6, paddingVertical: 8 },
  removeText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
});
