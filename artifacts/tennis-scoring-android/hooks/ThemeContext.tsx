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
  getSavedThemeId,
  getThemePreset,
  isThemeId,
  saveThemeId,
  type ThemeTokens,
} from '@/lib/theme-presets';

interface AppThemeContextValue {
  themeId: string;
  themeLoaded: boolean;
  colors: ThemeTokens & { radius: number };
  selectTheme: (themeId: string) => Promise<void>;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void getSavedThemeId()
      .then((storedThemeId) => {
        if (isMounted && isThemeId(storedThemeId)) {
          setThemeId(storedThemeId);
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
  }, []);

  const value = useMemo(() => {
    const preset = getThemePreset(themeId);
    return {
      themeId,
      themeLoaded,
      colors: {
        ...(colorScheme === 'dark' ? preset.dark : preset.light),
        radius: 14,
      },
      selectTheme,
    };
  }, [colorScheme, selectTheme, themeId, themeLoaded]);

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
