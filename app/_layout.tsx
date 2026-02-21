import "../global.css";

import {
  ClerkLoaded,
  ClerkProvider,
  useAuth,
  useUser,
} from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, LogBox, View } from "react-native";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Suppress SafeAreaView deprecation warning from third-party libraries (React Navigation internals)
LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);

import OfflineBanner from "@/components/OfflineBanner";
import { initI18n } from "@/src/i18n";
import { setGetToken, tokenCache } from "@/src/lib/auth";
import { queryClient } from "@/src/lib/query";
import { configureRevenueCat, initRevenueCat } from "@/src/lib/revenueCat";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from "expo-router";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

const RTL_LANGUAGES = ["ar", "he"];

/**
 * Only wraps with explicit direction when we want RTL but native didn't pick it up.
 * In Expo Go, I18nManager.isRTL is true after forceRTL(true), so we don't wrap and native RTL works.
 * On standalone iOS, I18nManager.isRTL can stay false, so we wrap with direction: 'rtl' to fix layout.
 * Applying our wrapper when native RTL already works (Expo Go) was breaking layout there.
 */
function LayoutDirectionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] ?? "en";
  const wantRTL = RTL_LANGUAGES.includes(lang);
  const nativeRTL = I18nManager.isRTL;
  const useWrapper = wantRTL && !nativeRTL;
  if (useWrapper) {
    return (
      <View style={{ flex: 1, direction: "rtl" }}>
        {children}
      </View>
    );
  }
  return <>{children}</>;
}

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
            <LayoutDirectionWrapper>
              <AuthGate />
            </LayoutDirectionWrapper>
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
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();

  // Configure RevenueCat once on app load so the SDK singleton exists before paywall/getOfferings
  useEffect(() => {
    configureRevenueCat();
  }, []);

  // Wire up the getToken function for our API interceptor
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setGetToken(() => getToken());
    }
  }, [isLoaded, isSignedIn, getToken]);

  // RevenueCat: identify user with Clerk ID so webhook updates correct backend user
  useEffect(() => {
    if (isSignedIn && user?.id) {
      initRevenueCat(user.id).catch((e) =>
        console.warn("RevenueCat init failed:", e),
      );
    }
  }, [isSignedIn, user?.id]);

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

  return (
    <>
      {isSignedIn && <OfflineBanner />}
      <Slot />
    </>
  );
}
