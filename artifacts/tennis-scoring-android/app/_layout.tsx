import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppThemeProvider } from '@/hooks/ThemeContext';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

const MIN_NATIVE_SPLASH_DURATION_MS = 1800;
const appStartTime = Date.now();

// Keep the generated branded splash visible until the app is ready.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="head-to-head" />
      <Stack.Screen name="matches/new" />
      <Stack.Screen name="matches/[id]" />
      <Stack.Screen name="players" />
      <Stack.Screen name="about" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      const remainingSplashTime =
        Platform.OS === 'web'
          ? 0
          : Math.max(
              0,
              MIN_NATIVE_SPLASH_DURATION_MS - (Date.now() - appStartTime),
            );
      const hideTimer = setTimeout(() => {
        void SplashScreen.hideAsync();
      }, remainingSplashTime);
      return () => clearTimeout(hideTimer);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
