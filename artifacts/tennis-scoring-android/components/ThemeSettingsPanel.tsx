import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/hooks/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { THEME_GROUPS } from '@/lib/theme-presets';
import { CustomThemeEditor } from '@/components/CustomThemeEditor';
import { ThemeSlider } from '@/components/ThemeSlider';

export function ThemeSettingsPanel() {
  const colors = useColors();
  const {
    themeId,
    themeLoaded,
    themeIntensity,
    setThemeIntensity,
    persistThemeIntensity,
    selectTheme,
  } = useAppTheme();
  const [savingThemeId, setSavingThemeId] = useState<string | null>(null);

  async function chooseTheme(nextThemeId: string) {
    setSavingThemeId(nextThemeId);
    try {
      await selectTheme(nextThemeId);
    } catch (error) {
      Alert.alert(
        'Could not save theme',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSavingThemeId(null);
    }
  }

  async function saveIntensity(value: number) {
    try {
      await persistThemeIntensity(value);
    } catch (error) {
      Alert.alert(
        'Could not save theme tone',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>PERSONALIZE</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Choose from 200 themes or build a palette from your own colors. Changes stay on this device.
        </Text>
      </View>

      <View
        testID="theme-tone-control"
        style={[
          styles.toneCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.toneHeading}>
          <View style={styles.toneCopy}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Theme tone
            </Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              Adjust the selected palette from softer to more vivid.
            </Text>
          </View>
          <Text style={[styles.toneValue, { color: colors.primary }]}>
            {themeIntensity < 45
              ? 'Soft'
              : themeIntensity > 55
                ? 'Vivid'
                : 'Original'}
          </Text>
        </View>
        <ThemeSlider
          testID="theme-intensity-slider"
          label="Theme intensity"
          value={themeIntensity}
          color={colors.primary}
          railColor={colors.border}
          thumbSurfaceColor={colors.card}
          shadowColor={colors.foreground}
          disabled={!themeLoaded || savingThemeId !== null}
          onValueChange={setThemeIntensity}
          onSlidingComplete={(value) => void saveIntensity(value)}
        />
        <View style={styles.toneLabels}>
          <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
            Softer
          </Text>
          <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
            Original
          </Text>
          <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
            More vivid
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Theme collections
          </Text>
          <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
            20 color families · 10 variations each
          </Text>
        </View>
        <View style={[styles.totalCount, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.totalCountText, { color: colors.primary }]}>200</Text>
        </View>
      </View>

      <CustomThemeEditor />

      {THEME_GROUPS.map((group) => (
        <View
          key={group.id}
          testID={`theme-group-${group.id}`}
          style={[
            styles.groupCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.groupHeading}>
            <Text style={[styles.groupTitle, { color: colors.foreground }]}>
              {group.name}
            </Text>
            <Text style={[styles.groupCount, { color: colors.mutedForeground }]}>
              {group.presets.length}
            </Text>
          </View>
          <View style={styles.optionsGrid}>
            {group.presets.map((preset) => {
              const selected = themeId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  testID={`theme-option-${preset.id}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${group.name} ${preset.name} theme`}
                  accessibilityState={{
                    selected,
                    disabled: !themeLoaded || savingThemeId !== null,
                  }}
                  disabled={!themeLoaded || savingThemeId !== null}
                  onPress={() => void chooseTheme(preset.id)}
                  style={({ pressed }) => [
                    styles.themeOption,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.secondary : colors.background,
                      opacity: !themeLoaded || (savingThemeId && savingThemeId !== preset.id)
                        ? 0.55
                        : pressed
                          ? 0.72
                          : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeSwatch,
                      {
                        backgroundColor: selected
                          ? colors.primary
                          : preset.light.primary,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.themeAccent,
                        {
                          backgroundColor: selected
                            ? colors.accent
                            : preset.light.accent,
                        },
                      ]}
                    />
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={11}
                        color={colors.primaryForeground}
                      />
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.themeName,
                      { color: selected ? colors.primary : colors.foreground },
                    ]}
                  >
                    {preset.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <View style={styles.bottomSpace} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 22, paddingTop: 16 },
  heading: { marginBottom: 23 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.5 },
  title: { marginTop: 5, fontFamily: 'Manrope_700Bold', fontSize: 28 },
  subtitle: { marginTop: 6, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  sectionCaption: { marginTop: 3, fontFamily: 'DMSans_400Regular', fontSize: 10 },
  toneCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 7,
    marginBottom: 17,
  },
  toneHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toneCopy: { flex: 1 },
  toneValue: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  toneLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  totalCount: {
    minWidth: 36,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  totalCountText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  groupCard: { borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 9 },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  groupTitle: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  groupCount: { fontFamily: 'DMSans_600SemiBold', fontSize: 9 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  themeOption: {
    width: '18.6%',
    minWidth: 52,
    minHeight: 63,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 5,
    gap: 4,
  },
  themeSwatch: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeAccent: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  themeName: { fontFamily: 'DMSans_600SemiBold', fontSize: 7, textAlign: 'center' },
  bottomSpace: { height: 20 },
});
