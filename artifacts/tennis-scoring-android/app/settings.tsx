import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBar } from '@/components/BottomTabBar';
import { ThemeSettingsPanel } from '@/components/ThemeSettingsPanel';
import { useColors } from '@/hooks/useColors';
import { listLocalMatches, LOCAL_MATCH_LIST_KEY } from '@/lib/local-matches';
import { splitHomeMatches } from '@/lib/home-screen-state';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const matchesQuery = useQuery({
    queryKey: LOCAL_MATCH_LIST_KEY,
    queryFn: listLocalMatches,
  });
  const historyCount = splitHomeMatches(matchesQuery.data ?? []).history.length;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ThemeSettingsPanel />
      </ScrollView>
      <BottomTabBar activeTab="settings" historyCount={historyCount} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1 },
});
