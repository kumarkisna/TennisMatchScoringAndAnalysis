import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { setBaseUrl } from '@workspace/api-client-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LOCAL_MATCH_LIST_KEY } from '@/lib/local-matches';
import { requestMatchSync } from '@/lib/match-sync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

setBaseUrl(
  process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : null,
);

const queryClient = new QueryClient();

function MatchSyncBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let isDisposed = false;
    const synchronizeWhenOnline = async () => {
      const network = await Network.getNetworkStateAsync();
      if (network.isConnected !== true || network.isInternetReachable === false) return;
      await requestMatchSync();
      if (!isDisposed) {
        void queryClient.invalidateQueries({ queryKey: LOCAL_MATCH_LIST_KEY });
        void queryClient.invalidateQueries({ queryKey: ['device-match'] });
      }
    };

    void synchronizeWhenOnline().catch(() => undefined);
    const networkSubscription = Network.addNetworkStateListener((network) => {
      if (network.isConnected === true && network.isInternetReachable !== false) {
        void synchronizeWhenOnline().catch(() => undefined);
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void synchronizeWhenOnline().catch(() => undefined);
      }
    });

    return () => {
      isDisposed = true;
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [queryClient]);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="matches/new" />
      <Stack.Screen name="matches/[id]" />
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
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <MatchSyncBridge />
          <GestureHandlerRootView>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
