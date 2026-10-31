import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '@/hooks/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { applyColorDepth, type CustomThemeColors } from '@/lib/theme-presets';
import { ThemeSlider } from '@/components/ThemeSlider';

type ColorKey = 'primary' | 'accent' | 'background';
type DepthKey = 'primaryDepth' | 'accentDepth' | 'backgroundDepth';

const depthKeyForColor: Record<ColorKey, DepthKey> = {
  primary: 'primaryDepth',
  accent: 'accentDepth',
  background: 'backgroundDepth',
};

const colorRoles: { key: ColorKey; label: string; options: string[] }[] = [
  {
    key: 'primary',
    label: 'Primary',
    options: [
      '#0077ff', '#e6007e', '#7c00ff', '#00b85a', '#ff3b1f', '#ff7a00',
      '#0d98ba', '#d00049', '#7020e5', '#00a2ff', '#eab900', '#14a800',
    ],
  },
  {
    key: 'accent',
    label: 'Accent',
    options: [
      '#ff2e63', '#ffb800', '#00c2a8', '#00b8f5', '#9b5de5', '#f15bb5',
      '#00d6b2', '#ff6d00', '#7a00ff', '#e8006f', '#00a3ff', '#b7e000',
    ],
  },
  {
    key: 'background',
    label: 'Background',
    options: [
      '#f9f5ef', '#f2f7ff', '#fff3e9', '#f5f0ff', '#fff1f6', '#f0fff6',
      '#f6f7fb', '#fdf8df', '#eafbff', '#f9f0e7', '#f2ffe9', '#fff0e8',
    ],
  },
];

function isValidHexColor(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function CustomThemeEditor() {
  const colors = useColors();
  const { themeId, themeLoaded, customThemeColors, saveCustomTheme } =
    useAppTheme();
  const [draft, setDraft] = useState<CustomThemeColors>({
    primary: colors.primary,
    accent: colors.accent,
    background: colors.background,
    primaryDepth: 50,
    accentDepth: 50,
    backgroundDepth: 50,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(
      customThemeColors ?? {
        primary: colors.primary,
        accent: colors.accent,
        background: colors.background,
        primaryDepth: 50,
        accentDepth: 50,
        backgroundDepth: 50,
      },
    );
  }, [customThemeColors, themeId]);

  const valid = colorRoles.every(({ key }) => isValidHexColor(draft[key]));

  async function applyCustomTheme() {
    if (!valid || isSaving) return;
    setIsSaving(true);
    try {
      await saveCustomTheme({
        primary: draft.primary.trim(),
        accent: draft.accent.trim(),
        background: draft.background.trim(),
      });
    } catch (error) {
      Alert.alert(
        'Could not save custom theme',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View
      testID="custom-theme-editor"
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Make your own palette
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Choose colors or enter their hex values. Your palette stays on this device.
          </Text>
        </View>
        <Ionicons name="color-palette-outline" size={21} color={colors.primary} />
      </View>

      {colorRoles.map(({ key, label, options }) => (
        <View key={key} style={styles.colorRole}>
          <View style={styles.roleHeading}>
            <Text style={[styles.roleLabel, { color: colors.foreground }]}>{label}</Text>
            <TextInput
              testID={`custom-theme-input-${key}`}
              accessibilityLabel={`${label} hex color`}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              onChangeText={(value) =>
                setDraft((current) => ({ ...current, [key]: value }))
              }
              placeholder="#RRGGBB"
              placeholderTextColor={colors.mutedForeground}
              value={draft[key]}
              style={[
                styles.hexInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
          </View>
          <View style={styles.swatches}>
            {options.map((option) => {
              const selected = draft[key].trim().toLowerCase() === option;
              const depth = draft[depthKeyForColor[key]] ?? 50;
              return (
                <Pressable
                  key={option}
                  testID={`custom-theme-swatch-${key}-${option.slice(1)}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Set ${label.toLowerCase()} color to ${option}`}
                  accessibilityState={{ selected }}
                  onPress={() => setDraft((current) => ({ ...current, [key]: option }))}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: applyColorDepth(option, depth),
                      borderColor: selected ? colors.foreground : colors.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                />
              );
            })}
          </View>
          <View style={styles.depthHeading}>
            <Text style={[styles.depthLabel, { color: colors.mutedForeground }]}>
              Color depth
            </Text>
            <View
              style={[
                styles.depthPreview,
                {
                  backgroundColor: isValidHexColor(draft[key])
                    ? applyColorDepth(
                        draft[key],
                        draft[depthKeyForColor[key]] ?? 50,
                      )
                    : colors.muted,
                  borderColor: colors.border,
                },
              ]}
            />
          </View>
          <ThemeSlider
            testID={`custom-theme-depth-${key}`}
            label={`${label} color depth`}
            value={draft[depthKeyForColor[key]] ?? 50}
            color={colors.primary}
            railColor={colors.border}
            thumbSurfaceColor={colors.card}
            shadowColor={colors.foreground}
            disabled={!themeLoaded || isSaving}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                [depthKeyForColor[key]]: value,
              }))
            }
          />
          <View style={styles.depthLabels}>
            <Text style={[styles.depthCaption, { color: colors.mutedForeground }]}>
              Softer
            </Text>
            <Text style={[styles.depthCaption, { color: colors.mutedForeground }]}>
              Original
            </Text>
            <Text style={[styles.depthCaption, { color: colors.mutedForeground }]}>
              Deeper
            </Text>
          </View>
        </View>
      ))}

      {!valid ? (
        <Text
          accessibilityRole="alert"
          style={[styles.validation, { color: colors.destructive }]}
        >
          Enter a valid 3- or 6-digit hex color for each field.
        </Text>
      ) : null}

      <Pressable
        testID="button-apply-custom-theme"
        accessibilityRole="button"
        accessibilityLabel="Apply custom color palette"
        disabled={!valid || !themeLoaded || isSaving}
        onPress={() => void applyCustomTheme()}
        style={({ pressed }) => [
          styles.applyButton,
          {
            backgroundColor: colors.primary,
            opacity: !valid || !themeLoaded || isSaving ? 0.5 : pressed ? 0.78 : 1,
          },
        ]}
      >
        <Text style={[styles.applyButtonText, { color: colors.primaryForeground }]}>
          {isSaving
            ? 'Saving palette…'
            : themeId === 'custom-palette'
              ? 'Update my palette'
              : 'Apply custom palette'}
        </Text>
        <Ionicons name="checkmark" size={17} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 13, padding: 14, marginBottom: 16, gap: 13 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headingCopy: { flex: 1, gap: 4 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16 },
  colorRole: { gap: 8 },
  roleHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  roleLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  hexInput: {
    minWidth: 92,
    height: 34,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderRadius: 7,
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    textAlign: 'center',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  swatch: { width: 23, height: 23, borderRadius: 12 },
  depthHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  depthLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  depthPreview: { width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
  depthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  depthCaption: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  validation: { fontFamily: 'DMSans_500Medium', fontSize: 10 },
  applyButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  applyButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
});
