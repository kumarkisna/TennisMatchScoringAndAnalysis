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
  createCustomThemeTokens,
  getSavedCustomThemeColors,
  getSavedThemeId,
  getThemePreset,
  isThemeId,
  saveCustomThemeColors,
  saveThemeId,
  type CustomThemeColors,
  type ThemeTokens,
} from '@/lib/theme-presets';

interface AppThemeContextValue {
  themeId: string;
  themeLoaded: boolean;
  customThemeColors: CustomThemeColors | null;
  colors: ThemeTokens & { radius: number };
  selectTheme: (themeId: string) => Promise<void>;
  saveCustomTheme: (colors: CustomThemeColors) => Promise<void>;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [customThemeColors, setCustomThemeColors] =
    useState<CustomThemeColors | null>(null);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([getSavedThemeId(), getSavedCustomThemeColors()])
      .then(([storedThemeId, storedCustomColors]) => {
        if (isMounted && isThemeId(storedThemeId)) {
          setThemeId(storedThemeId);
          setCustomThemeColors(
            storedThemeId === CUSTOM_THEME_ID ? storedCustomColors : null,
          );
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

  const selectTheme = useCallback(async (nextThemeId: string) => {
    await saveThemeId(nextThemeId);
    setThemeId(nextThemeId);
    if (nextThemeId !== CUSTOM_THEME_ID) setCustomThemeColors(null);
  }, []);

  const saveCustomTheme = useCallback(async (nextColors: CustomThemeColors) => {
    await saveCustomThemeColors(nextColors);
    await saveThemeId(CUSTOM_THEME_ID);
    setCustomThemeColors(nextColors);
    setThemeId(CUSTOM_THEME_ID);
  }, []);

  const value = useMemo(() => {
    const preset = getThemePreset(themeId);
    return {
      themeId,
      themeLoaded,
      customThemeColors,
      colors: {
        ...(themeId === CUSTOM_THEME_ID && customThemeColors
          ? createCustomThemeTokens(customThemeColors, colorScheme === 'dark')
          : colorScheme === 'dark'
            ? preset.dark
            : preset.light),
        radius: 14,
      },
      selectTheme,
      saveCustomTheme,
    };
  }, [
    colorScheme,
    customThemeColors,
    saveCustomTheme,
    selectTheme,
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
