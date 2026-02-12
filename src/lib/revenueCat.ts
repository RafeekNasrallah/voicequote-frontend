import { Platform } from "react-native";
import Purchases from "react-native-purchases";

let isConfigured = false;

/**
 * Configure RevenueCat and log in with Clerk user ID.
 * Call this when the user is signed in so the webhook can update the correct backend user.
 */
export async function initRevenueCat(clerkUserId: string): Promise<void> {
  const iosKey = process.env.EXPO_PUBLIC_RC_API_KEY_IOS;
  const androidKey = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID;

  if (Platform.OS === "ios" && iosKey) {
    if (!isConfigured) {
      Purchases.configure({ apiKey: iosKey });
      isConfigured = true;
    }
    await Purchases.logIn(clerkUserId);
  } else if (Platform.OS === "android" && androidKey) {
    if (!isConfigured) {
      Purchases.configure({ apiKey: androidKey });
      isConfigured = true;
    }
    await Purchases.logIn(clerkUserId);
  }
}
