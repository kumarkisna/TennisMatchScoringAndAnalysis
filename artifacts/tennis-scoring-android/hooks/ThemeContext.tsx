import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  DEFAULT_THEME_ID,
  CUSTOM_THEME_ID,
  DEFAULT_THEME_INTENSITY,
  applyThemeIntensity,
  createCustomThemeTokens,
  getSavedCustomThemeColors,
  getSavedThemeIntensity,
  getSavedThemeId,
  getThemePreset,
  isThemeId,
  saveThemeIntensity as saveThemeIntensityToStorage,
  saveCustomThemeColors,
  saveThemeId,
  type CustomThemeColors,
  type ThemeTokens,
} from '@/lib/theme-presets';

interface AppThemeContextValue {
  themeId: string;
  themeLoaded: boolean;
  themeIntensity: number;
  customThemeColors: CustomThemeColors | null;
  colors: ThemeTokens & { radius: number };
  selectTheme: (themeId: string) => Promise<void>;
  setThemeIntensity: (intensity: number) => void;
  persistThemeIntensity: (intensity: number) => Promise<void>;
  saveCustomTheme: (colors: CustomThemeColors) => Promise<void>;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [themeIntensity, setThemeIntensityState] = useState(
    DEFAULT_THEME_INTENSITY,
  );
  const [customThemeColors, setCustomThemeColors] =
    useState<CustomThemeColors | null>(null);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([
      getSavedThemeId(),
      getSavedCustomThemeColors(),
      getSavedThemeIntensity(),
    ])
      .then(([storedThemeId, storedCustomColors, storedIntensity]) => {
        if (isMounted) {
          if (isThemeId(storedThemeId)) setThemeId(storedThemeId);
          setCustomThemeColors(storedCustomColors);
          setThemeIntensityState(storedIntensity);
        }
      })
      .catch(() => {
        // The default theme remains available if this optional preference cannot be read.
      })
      .finally(() => {
        if (isMounted) setThemeLoaded(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeIntensity = useCallback((nextIntensity: number) => {
    setThemeIntensityState(
      Math.round(Math.max(0, Math.min(100, nextIntensity))),
    );
  }, []);

  const persistThemeIntensity = useCallback(async (nextIntensity: number) => {
    const normalized = Math.round(Math.max(0, Math.min(100, nextIntensity)));
    await saveThemeIntensityToStorage(normalized);
    setThemeIntensityState(normalized);
  }, []);

  const selectTheme = useCallback(async (nextThemeId: string) => {
    await saveThemeId(nextThemeId);
    setThemeId(nextThemeId);
  }, []);

  const saveCustomTheme = useCallback(async (nextColors: CustomThemeColors) => {
    await saveCustomThemeColors(nextColors);
    await saveThemeId(CUSTOM_THEME_ID);
    setCustomThemeColors(nextColors);
    setThemeId(CUSTOM_THEME_ID);
  }, []);

  const value = useMemo(() => {
    const preset = getThemePreset(themeId);
    const baseTokens =
      themeId === CUSTOM_THEME_ID && customThemeColors
        ? createCustomThemeTokens(customThemeColors, colorScheme === 'dark')
        : colorScheme === 'dark'
          ? preset.dark
          : preset.light;
    return {
      themeId,
      themeLoaded,
      themeIntensity,
      customThemeColors,
      colors: {
        ...applyThemeIntensity(baseTokens, themeIntensity),
        radius: 14,
      },
      selectTheme,
      setThemeIntensity,
      persistThemeIntensity,
      saveCustomTheme,
    };
  }, [
    colorScheme,
    customThemeColors,
    saveCustomTheme,
    selectTheme,
    persistThemeIntensity,
    setThemeIntensity,
    themeIntensity,
    themeId,
    themeLoaded,
  ]);

  return (
    <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider.');
  }
  return context;
}
