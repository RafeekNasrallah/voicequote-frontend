# RevenueCat implementation summary (Quotio)

This doc summarizes how RevenueCat is integrated so you can match it to your dashboard setup (entitlement **Quotio Pro**, monthly product, etc.).

---

## 1. Installation

- **react-native-purchases** — core SDK (already installed).
- **react-native-purchases-ui** — Paywall UI and Customer Center (installed).

```bash
npm install --save react-native-purchases react-native-purchases-ui
```

---

## 2. Configuration (API key)

Configure **once** at app startup; the SDK singleton is shared app-wide.

- **Single key (dev / Test Store):** set `EXPO_PUBLIC_RC_API_KEY` in `.env` (e.g. `test_...` from RevenueCat).
- **Production:** set `EXPO_PUBLIC_RC_API_KEY_IOS` and/or `EXPO_PUBLIC_RC_API_KEY_ANDROID` (app-specific keys from Project Settings → API keys).

Configuration runs in `_layout.tsx` via `configureRevenueCat()`. When the user signs in (Clerk), `initRevenueCat(clerkUserId)` is called so RevenueCat (and your webhook) use the same user ID.

---

## 3. Entitlement

- **Identifier in app:** `Quotio Pro` (constant `REVENUECAT_ENTITLEMENT_ID` in `src/lib/revenueCat.ts`).
- In RevenueCat dashboard → **Entitlements** → create an entitlement with identifier **Quotio Pro** and attach your products (e.g. monthly).

---

## 4. Subscription flows

### Presenting the paywall

- **Route `/paywall`:** When the user opens the paywall screen, the app first calls **RevenueCat Paywall** (`RevenueCatUI.presentPaywall()`). If the user purchases or restores, the screen closes and profile is refreshed.
- If RevenueCat Paywall is not shown (e.g. not configured or native module unavailable), the **custom paywall** is shown (manual purchase + Restore).

### Entitlement checking

- **Backend:** Your API uses `User.isPro` (updated by the RevenueCat webhook and by `POST /api/me/sync-subscription`).
- **Client:** Helpers in `src/lib/revenueCat.ts`:
  - `getCustomerInfo()` — fetch current subscriptions/entitlements.
  - `hasProEntitlement(customerInfo)` — true if **Quotio Pro** is active.

### Subscription sync (account status after purchase)

The backend gets updates from: (1) **RevenueCat webhook** — configure in RevenueCat → Integrations → Webhooks (can take 5–60 s). (2) **Sync endpoint** — after purchase/restore, the app calls `POST /api/me/sync-subscription`, which fetches entitlements from RevenueCat and updates `User.isPro` immediately. Set `REVENUECAT_API_SECRET` (Secret key `sk_...` from RevenueCat) on the backend.

### Customer info and best practices

- Always use **customer info** from the SDK or your backend after purchase/restore; avoid assuming state from a single call.
- After purchase or restore, the app calls the sync endpoint, invalidates the `["me"]` query, and navigates back so the UI reflects the backend’s `isPro`.

---

## 5. RevenueCat Paywall (react-native-purchases-ui)

- **Present paywall:** `presentPaywall()` in `src/lib/revenueCatUI.ts` (used when the user navigates to `/paywall`).
- **Present if needed (gate):** `presentPaywallIfNeeded({ requiredEntitlementIdentifier: "Quotio Pro" })` — use when you want to show the paywall only if the user does **not** have Quotio Pro.
- **Result:** `PAYWALL_RESULT` (e.g. `PURCHASED`, `RESTORED`, `CANCELLED`, `NOT_PRESENTED`). Helper `isPurchaseOrRestore(result)` is used to close the paywall and refresh.

---

## 6. Customer Center

- **Settings:** When RevenueCat is configured, Settings shows **“Manage subscription”** (Restore, cancel, contact support).
- Implemented via `presentCustomerCenter()` from `src/lib/revenueCatUI.ts`.
- Full Customer Center behavior (e.g. cancel, refunds) is configured in the RevenueCat dashboard and may require a Pro/Enterprise plan.

---

## 7. Products and offering

- **Products:** Add in RevenueCat with the **same product IDs** as in App Store Connect (e.g. `quotio_pro_monthly`).
- **Offering:** Create an offering (e.g. `default`), set it as **Current**, and add a **monthly** package linked to your monthly product. `Purchases.getOfferings()` / `offerings.current` is used by both the RevenueCat Paywall and the custom paywall.

---

## 8. Error handling

- **Not configured:** If no API key is set, `isRevenueCatConfigured()` is false; paywall and Customer Center calls no-op instead of throwing.
- **Purchase errors:** The custom paywall shows an alert on purchase failure (and does not treat user cancel as an error).
- **Restore:** “Restore purchases” is available on the custom paywall; Customer Center also supports restore.

---

## 9. Where things live

| What | Where |
|------|--------|
| Configure SDK, log in user, entitlement ID, getCustomerInfo, hasProEntitlement | `src/lib/revenueCat.ts` |
| presentPaywall, presentPaywallIfNeeded, presentCustomerCenter | `src/lib/revenueCatUI.ts` |
| Paywall screen (RevenueCat Paywall first, then custom fallback) | `app/paywall.tsx` |
| Configure on app load, init on sign-in | `app/_layout.tsx` |
| “Manage subscription” (Customer Center) | `app/(tabs)/settings.tsx` |

---

## 10. RevenueCat dashboard checklist

- [ ] Project created; iOS app added (Bundle ID + App-Specific Shared Secret).
- [ ] iOS public API key in `.env` as `EXPO_PUBLIC_RC_API_KEY` or `EXPO_PUBLIC_RC_API_KEY_IOS`.
- [ ] Product(s) added (e.g. `quotio_pro_monthly`) matching App Store Connect.
- [ ] Entitlement **Quotio Pro** created and products attached.
- [ ] Current Offering with a monthly (and optional yearly) package.
- [ ] (Optional) Paywall template and Customer Center configured in dashboard.

After this, the app can show the RevenueCat Paywall, your custom paywall as fallback, and Customer Center from Settings.
