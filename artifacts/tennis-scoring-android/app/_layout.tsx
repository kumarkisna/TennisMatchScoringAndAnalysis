import React, { useEffect } from 'react';
import { useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { Redirect, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import * as Network from 'expo-network';
import { LOCAL_MATCH_LIST_KEY } from '@/lib/local-matches';
import { requestMatchSync } from '@/lib/match-sync';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function RootLayoutNav() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const queryClientForUser = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  const isAuthRoute = segments[0] === 'sign-in' || segments[0] === 'sign-up';

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn && !isAuthRoute) router.replace('/sign-in');
    if (isSignedIn && isAuthRoute) router.replace('/');
  }, [isAuthRoute, isLoaded, isSignedIn, router]);

  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null);
  }, [getToken, isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const syncAndRefresh = () => {
      void requestMatchSync(userId ?? '')
        .catch(() => undefined)
        .finally(() => {
          void queryClientForUser.invalidateQueries({
            queryKey: LOCAL_MATCH_LIST_KEY,
          });
          void queryClientForUser.invalidateQueries({
            queryKey: ['device-match'],
          });
        });
    };

    syncAndRefresh();
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncAndRefresh();
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncAndRefresh();
    });

    return () => {
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [isLoaded, isSignedIn, queryClientForUser, userId]);

  useEffect(() => {
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClientForUser.clear();
    }
    previousUserId.current = userId ?? null;
  }, [queryClientForUser, userId]);

  if (!isLoaded) return null;
  if (!isSignedIn && !isAuthRoute) return <Redirect href="/sign-in" />;
  if (isSignedIn && isAuthRoute) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="matches/new" />
      <Stack.Screen name="matches/[id]" />
      <Stack.Screen name="players" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
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
  if (!clerkPublishableKey) {
    throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      proxyUrl={process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
