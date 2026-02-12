import "../global.css";

import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { tokenCache, setGetToken } from "@/src/lib/auth";
import { queryClient } from "@/src/lib/query";
import { initI18n } from "@/src/i18n";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [i18nReady, setI18nReady] = useState(false);

  // Initialize i18n on app start
  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && i18nReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, i18nReady]);

  if (!loaded || !i18nReady) {
    return null;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <StatusBar style="dark" />
            <AuthGate />
          </SafeAreaProvider>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

/**
 * AuthGate handles routing based on authentication state.
 * - Signed in  -> /(tabs)
 * - Signed out -> /auth/sign-in
 */
function AuthGate() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Wire up the getToken function for our API interceptor
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setGetToken(() => getToken());
    }
  }, [isLoaded, isSignedIn, getToken]);

  // Auth-based routing
  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "auth";

    if (!isSignedIn && !inAuthGroup) {
      // User is not signed in and not on an auth screen -> redirect to sign-in
      router.replace("/auth/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      // User is signed in but still on an auth screen -> redirect to home
      router.replace("/(tabs)");
    }
  }, [isSignedIn, isLoaded, segments]);

  return <Slot />;
}
