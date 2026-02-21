import { Platform } from "react-native";
import Purchases, { CustomerInfo } from "react-native-purchases";

let isConfigured = false;

/** Entitlement identifier — must match the one created in RevenueCat (e.g. "Quotio Pro"). */
export const REVENUECAT_ENTITLEMENT_ID = "Quotio Pro";

/**
 * Single API key (e.g. Test Store key) used when platform-specific keys are not set.
 * Set EXPO_PUBLIC_RC_API_KEY for development/testing with RevenueCat Test Store.
 */
function getApiKey(): { ios?: string; android?: string } {
  const iosKey = process.env.EXPO_PUBLIC_RC_API_KEY_IOS;
  const androidKey = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID;
  const fallback = process.env.EXPO_PUBLIC_RC_API_KEY; // Test Store or single key
  return {
    ios: iosKey || fallback,
    android: androidKey || fallback,
  };
}

/**
 * Configure RevenueCat once (no user). Call early in app lifecycle so the SDK
 * singleton exists before any screen calls getOfferings().
 */
export function configureRevenueCat(): void {
  if (isConfigured) return;
  const { ios, android } = getApiKey();
  if (Platform.OS === "ios" && ios) {
    Purchases.configure({ apiKey: ios });
    isConfigured = true;
  } else if (Platform.OS === "android" && android) {
    Purchases.configure({ apiKey: android });
    isConfigured = true;
  }
}

/**
 * Whether RevenueCat has been configured (safe to call Purchases.getOfferings(), etc.).
 */
export function isRevenueCatConfigured(): boolean {
  return isConfigured;
}

/**
 * Configure RevenueCat (if not yet) and log in with Clerk user ID.
 * Call when the user is signed in so the webhook can update the correct backend user.
 */
export async function initRevenueCat(clerkUserId: string): Promise<void> {
  configureRevenueCat();
  if (!isConfigured) return;

  await Purchases.logIn(clerkUserId);
}

/**
 * Get current customer info (subscriptions, entitlements). Returns null if SDK not configured or on error.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  configureRevenueCat();
  if (!isConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/**
 * Check if the user has the Pro entitlement active.
 */
export function hasProEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID] != null;
}
