import AsyncStorage from '@react-native-async-storage/async-storage';
import currentColors from '@/constants/colors';

export interface ThemeTokens {
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

const themeFamilies = [
  { id: 'court-green', name: 'Court Green', hue: 150, accentHue: 16, backgroundHue: 42 },
  { id: 'ocean', name: 'Deep Ocean', hue: 207, accentHue: 45, backgroundHue: 201 },
  { id: 'sunset', name: 'Sunset', hue: 15, accentHue: 194, backgroundHue: 32 },
  { id: 'rose', name: 'Rose Garden', hue: 340, accentHue: 165, backgroundHue: 346 },
  { id: 'violet', name: 'Orchid', hue: 276, accentHue: 57, backgroundHue: 278 },
  { id: 'sunrise', name: 'Sunrise', hue: 32, accentHue: 213, backgroundHue: 43 },
  { id: 'citrus', name: 'Citrus', hue: 75, accentHue: 253, backgroundHue: 60 },
  { id: 'slate', name: 'Carbon', hue: 220, accentHue: 23, backgroundHue: 220 },
  { id: 'saffron', name: 'Saffron', hue: 39, accentHue: 162, backgroundHue: 47 },
  { id: 'lagoon', name: 'Lagoon', hue: 174, accentHue: 326, backgroundHue: 180 },
] as const;

const variants = [
  { name: 'Airy', hueShift: 18, saturation: 49, lightness: 34, accentHueShift: 0, accentSaturation: 54, accentLightness: 44, backgroundHueShift: 8, backgroundSaturation: 17, backgroundLightness: 98, darkBackgroundLightness: 11 },
  { name: 'Soft', hueShift: -15, saturation: 38, lightness: 31, accentHueShift: 12, accentSaturation: 46, accentLightness: 43, backgroundHueShift: -12, backgroundSaturation: 12, backgroundLightness: 96, darkBackgroundLightness: 12 },
  { name: 'Calm', hueShift: 0, saturation: 43, lightness: 28, accentHueShift: -18, accentSaturation: 61, accentLightness: 43, backgroundHueShift: 22, backgroundSaturation: 18, backgroundLightness: 97, darkBackgroundLightness: 10 },
  { name: 'Classic', hueShift: 0, saturation: 38, lightness: 25, accentHueShift: 0, accentSaturation: 59, accentLightness: 43, backgroundHueShift: 0, backgroundSaturation: 22, backgroundLightness: 94, darkBackgroundLightness: 11 },
  { name: 'Deep', hueShift: -4, saturation: 66, lightness: 26, accentHueShift: 26, accentSaturation: 68, accentLightness: 42, backgroundHueShift: -30, backgroundSaturation: 20, backgroundLightness: 95, darkBackgroundLightness: 9 },
  { name: 'Bold', hueShift: 8, saturation: 78, lightness: 34, accentHueShift: -32, accentSaturation: 72, accentLightness: 44, backgroundHueShift: 36, backgroundSaturation: 24, backgroundLightness: 96, darkBackgroundLightness: 12 },
  { name: 'Vivid', hueShift: -10, saturation: 82, lightness: 36, accentHueShift: 44, accentSaturation: 75, accentLightness: 43, backgroundHueShift: -48, backgroundSaturation: 17, backgroundLightness: 97, darkBackgroundLightness: 10 },
  { name: 'Rich', hueShift: 24, saturation: 70, lightness: 28, accentHueShift: -52, accentSaturation: 64, accentLightness: 42, backgroundHueShift: 52, backgroundSaturation: 25, backgroundLightness: 94, darkBackgroundLightness: 8 },
  { name: 'Mellow', hueShift: -24, saturation: 47, lightness: 38, accentHueShift: 64, accentSaturation: 62, accentLightness: 43, backgroundHueShift: -66, backgroundSaturation: 18, backgroundLightness: 96, darkBackgroundLightness: 13 },
  { name: 'Night', hueShift: 34, saturation: 60, lightness: 24, accentHueShift: -76, accentSaturation: 72, accentLightness: 45, backgroundHueShift: 78, backgroundSaturation: 19, backgroundLightness: 95, darkBackgroundLightness: 8 },
] as const;

export const DEFAULT_THEME_ID = 'court-green-classic';

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const offset = l - chroma / 2;
  const [red, green, blue] =
    h < 60
      ? [chroma, x, 0]
      : h < 120
        ? [x, chroma, 0]
        : h < 180
          ? [0, chroma, x]
          : h < 240
            ? [0, x, chroma]
            : h < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function readableForeground(background: string): string {
  const luminance = relativeLuminance(background);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? '#ffffff' : '#171510';
}

function createTokens(
  hue: number,
  familyAccentHue: number,
  familyBackgroundHue: number,
  variantIndex: number,
  dark: boolean,
): ThemeTokens {
  const variant = variants[variantIndex]!;
  const primaryHue = hue + variant.hueShift;
  const accentHue = familyAccentHue + variant.accentHueShift;
  const backgroundHue = familyBackgroundHue + variant.backgroundHueShift;
  const primary = hslToHex(
    primaryHue,
    variant.saturation,
    dark ? 69 : variant.lightness,
  );
  const background = dark
    ? hslToHex(backgroundHue, 21, variant.darkBackgroundLightness)
    : hslToHex(backgroundHue, variant.backgroundSaturation, variant.backgroundLightness);
  const card = dark
    ? hslToHex(backgroundHue, 18, 15 + (variantIndex % 3))
    : hslToHex(backgroundHue, variant.backgroundSaturation * 0.72, 99);
  const foreground = dark
    ? hslToHex(primaryHue, 10, 94)
    : hslToHex(primaryHue, 23, 17);
  const secondary = dark
    ? hslToHex(primaryHue, Math.min(30, variant.saturation * 0.35), 23)
    : hslToHex(primaryHue, Math.min(35, variant.saturation * 0.45), 90);
  const muted = dark
    ? hslToHex(primaryHue, 15, 22)
    : hslToHex(primaryHue, 13, 92);
  const border = dark
    ? hslToHex(backgroundHue, 16, 31)
    : hslToHex(backgroundHue, 21, 86);
  const accent = hslToHex(
    accentHue,
    variant.accentSaturation,
    dark ? 68 : variant.accentLightness,
  );

  return {
    text: foreground,
    tint: primary,
    background,
    foreground,
    card,
    cardForeground: foreground,
    primary,
    primaryForeground: readableForeground(primary),
    secondary,
    secondaryForeground: foreground,
    muted,
    mutedForeground: dark
      ? hslToHex(primaryHue, 9, 69)
      : hslToHex(primaryHue, 8, 47),
    accent,
    accentForeground: readableForeground(accent),
    destructive: dark ? '#d9786b' : '#a8433b',
    destructiveForeground: '#ffffff',
    border,
    input: border,
  };
}

export const THEME_PRESETS: ThemePreset[] = themeFamilies.flatMap((family) =>
  variants.map((variant, variantIndex) => ({
    id: `${family.id}-${variant.name.toLowerCase()}`,
    name: variant.name,
    groupId: family.id,
    groupName: family.name,
    light: createTokens(
      family.hue,
      family.accentHue,
      family.backgroundHue,
      variantIndex,
      false,
    ),
    dark: createTokens(
      family.hue,
      family.accentHue,
      family.backgroundHue,
      variantIndex,
      true,
    ),
  })),
);

const originalCourtGreen = THEME_PRESETS.find(
  (theme) => theme.id === DEFAULT_THEME_ID,
);
if (originalCourtGreen) {
  originalCourtGreen.light = currentColors.light;
  originalCourtGreen.dark = currentColors.dark;
  originalCourtGreen.light.primaryForeground = readableForeground(
    originalCourtGreen.light.primary,
  );
  originalCourtGreen.light.accentForeground = readableForeground(
    originalCourtGreen.light.accent,
  );
  originalCourtGreen.dark.primaryForeground = readableForeground(
    originalCourtGreen.dark.primary,
  );
  originalCourtGreen.dark.accentForeground = readableForeground(
    originalCourtGreen.dark.accent,
  );
}

export const THEME_GROUPS = themeFamilies.map((family) => ({
  id: family.id,
  name: family.name,
  presets: THEME_PRESETS.filter((theme) => theme.groupId === family.id),
}));

export const SELECTED_THEME_STORAGE_KEY =
  '@tennis-scoring/selected-theme-v1';

export function isThemeId(value: string | null | undefined): value is string {
  return THEME_PRESETS.some((theme) => theme.id === value);
}

export function getThemePreset(themeId: string): ThemePreset {
  return THEME_PRESETS.find((theme) => theme.id === themeId) ??
    THEME_PRESETS.find((theme) => theme.id === DEFAULT_THEME_ID)!;
}

export async function getSavedThemeId(): Promise<string> {
  const savedThemeId = await AsyncStorage.getItem(SELECTED_THEME_STORAGE_KEY);
  return isThemeId(savedThemeId) ? savedThemeId : DEFAULT_THEME_ID;
}

export async function saveThemeId(themeId: string): Promise<void> {
  if (!isThemeId(themeId)) {
    throw new Error('Choose one of the available themes.');
  }
  await AsyncStorage.setItem(SELECTED_THEME_STORAGE_KEY, themeId);
}
