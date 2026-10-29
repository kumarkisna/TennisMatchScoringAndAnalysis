import { useCreateMatch } from '@workspace/api-client-react';
import { getListMatchesQueryKey } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';

export default function ConnectivityCheckScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const started = useRef(false);
  const createMatch = useCreateMatch({
    mutation: {
      onSuccess: async (match) => {
        await queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        router.replace({ pathname: '/matches/[id]', params: { id: match.id } });
      },
    },
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createMatch.mutate({
      data: {
        matchDate: '2026-10-29',
        trackedPlayer: 'Temporary API Check',
        opponent: 'Temporary API Check',
        event: null,
        round: null,
        setNumber: 1,
        chairCoach: null,
        surface: 'Hard',
        firstServer: 'tracked',
      },
    });
  }, []);

  const result = createMatch.data
    ? `Created match ${createMatch.data.id}`
    : createMatch.error
      ? `${createMatch.error.name}: ${createMatch.error.message}`
      : 'Sending create request…';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>API connection check</Text>
        <Text selectable style={[styles.body, { color: colors.mutedForeground }]}>
          {result}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { borderWidth: 1, borderRadius: 12, padding: 18, gap: 10 },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 18 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 20 },
});
