import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type AppTab = 'home' | 'history' | 'settings';

const tabs: { id: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', route: '/' },
  { id: 'history', label: 'History', icon: 'archive-outline', route: '/history' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings' },
];

export function BottomTabBar({
  activeTab,
  historyCount,
}: {
  activeTab: AppTab;
  historyCount?: number;
}) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="match-book-bottom-tabs"
      accessibilityRole="tablist"
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeTab;
        const count = tab.id === 'history' ? historyCount : undefined;
        return (
          <Pressable
            key={tab.id}
            testID={`match-book-tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) router.replace(tab.route as never);
            }}
            style={({ pressed }) => [
              styles.tab,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.tabLabel}>
              <Ionicons
                name={tab.icon}
                size={18}
                color={selected ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: selected ? colors.primary : colors.mutedForeground },
                ]}
              >
                {tab.label}
              </Text>
              {count !== undefined ? (
                <Text
                  style={[
                    styles.tabCount,
                    { color: selected ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {count}
                </Text>
              ) : null}
            </View>
            {selected ? (
              <View style={[styles.indicator, { backgroundColor: colors.primary }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    minHeight: 60,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tabLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  tabCount: { fontFamily: 'DMSans_700Bold', fontSize: 9 },
  indicator: { height: 2, width: 42, borderRadius: 2, marginTop: 6 },
});
