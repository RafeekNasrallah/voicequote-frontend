/**
 * RevenueCat Paywall UI and Customer Center.
 * Uses react-native-purchases-ui. Native paywall/customer center only work in dev builds (not Expo Go).
 */

import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { isRevenueCatConfigured } from "./revenueCat";

export type PaywallResult = PAYWALL_RESULT;

/**
 * Present the RevenueCat Paywall (remotely configured in dashboard).
 * Returns the result when the paywall is dismissed. Use for "upgrade" flows.
 * No-op if RevenueCat is not configured; returns PAYWALL_RESULT.NOT_PRESENTED.
 */
export async function presentPaywall(): Promise<PAYWALL_RESULT> {
  if (!isRevenueCatConfigured()) {
    return "NOT_PRESENTED" as PAYWALL_RESULT;
  }
  try {
    return await RevenueCatUI.presentPaywall({ displayCloseButton: true });
  } catch (e) {
    console.warn("[RevenueCatUI] presentPaywall failed:", e);
    return "NOT_PRESENTED" as PAYWALL_RESULT;
  }
}

/**
 * Present paywall only if the user does not have the given entitlement.
 * Use for gating a feature (e.g. show paywall if not Pro).
 * Returns the result; check for PURCHASED or RESTORED to know if user became entitled.
 */
export async function presentPaywallIfNeeded(requiredEntitlementIdentifier: string): Promise<PAYWALL_RESULT> {
  if (!isRevenueCatConfigured()) {
    return "NOT_PRESENTED" as PAYWALL_RESULT;
  }
  try {
    return await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier,
      displayCloseButton: true,
    });
  } catch (e) {
    console.warn("[RevenueCatUI] presentPaywallIfNeeded failed:", e);
    return "NOT_PRESENTED" as PAYWALL_RESULT;
  }
}

/**
 * Present the Customer Center (manage subscription, restore, cancel, etc.).
 * Only works when RevenueCat is configured; requires Pro/Enterprise for full config in dashboard.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!isRevenueCatConfigured()) return;
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (e) {
    console.warn("[RevenueCatUI] presentCustomerCenter failed:", e);
  }
}

export function isPurchaseOrRestore(result: PAYWALL_RESULT): boolean {
  return result === "PURCHASED" || result === "RESTORED";
}
