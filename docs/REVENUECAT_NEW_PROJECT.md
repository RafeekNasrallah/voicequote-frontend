# RevenueCat: New project setup (step-by-step)

Do this **after** you’ve finished the App Store Connect part (app, subscription group, at least one product like `quotio_pro_monthly`).

---

## Step 1: Create a new project in RevenueCat

1. Go to [RevenueCat](https://app.revenuecat.com/) and sign in.
2. If you have an old “Quotio” project you want to replace: **Project settings** (gear) → scroll down → **Delete project**. Confirm.
3. Click **+ New** (or **Create project**).
4. **Project name:** e.g. `Quotio`.
5. Create the project.

You’re now inside the new project.

---

## Step 2: Add your iOS app (this is when the iOS public API key appears)

1. In the left sidebar, go to **Project settings** (gear icon).
2. Open the **Apps** tab (or **Apps** in the left menu under the project).
3. Click **+ New** (or **Add app**).
4. Choose **Apple App Store**.
5. Fill in:
   - **App name:** e.g. `Quotio`.
   - **Bundle ID:** must match App Store Connect exactly, e.g. `com.getquotio.quotio`.
6. Save / Create.

**App-Specific Shared Secret (needed for real purchases):**

- In **App Store Connect** → **My Apps** → **Quotio** → **App Information**.
- Find **App-Specific Shared Secret** (generate if you haven’t).
- Back in RevenueCat, open your new iOS app → **App Store Connect** / **Shared Secret** section.
- Paste the **App-Specific Shared Secret** and save.

After you add this iOS app, RevenueCat generates a **public API key for iOS**. You’ll use it in the next step.

---

## Step 3: Get your iOS public API key

1. In RevenueCat, go to **Project settings** → **API keys** (or **API keys** in the sidebar).
2. Find the **SDK API keys** section (not “Secret API keys”).
3. You should see a row for your **iOS app** (e.g. “Quotio” or the app name you gave).  
   - If you only see **“Test Store”**, you haven’t added the iOS app yet — go back to **Step 2** and add the app.
4. In that row, under **Public API key**, click **Show key** (eye icon).
5. Copy the key (it usually starts with `appl_`).
6. In your app’s `.env` (voicequote-frontend), add:
   ```env
   EXPO_PUBLIC_RC_API_KEY_IOS=appl_xxxxxxxxxxxxxxxx
   ```
   Paste your real key after the `=`.
7. Restart Expo (`npx expo start --clear`) so the new env var is picked up.

You do **not** use the **Secret API key** (`sk_...`) in the app — only in your backend (e.g. webhooks). The app uses the **public** SDK key.

---

## Step 4: Products — Test Store vs Apple (do you need to create one?)

### Two ways to get products in RevenueCat

| Source | When to use | Do you create it? |
|--------|----------------|-------------------|
| **Test Store** | Development: testing paywall and purchases **without** App Store Connect. Your app uses the **Test Store API key** (`test_...`) in `.env`. | **No.** RevenueCat gives you a **Test Store monthly product** (and optionally more) automatically. You only **use** it. |
| **Apple App Store** | Production: real subscriptions on TestFlight / App Store. Your app uses the **iOS app API key** (`appl_...`). | **Yes.** You create the subscription in **App Store Connect**, then add the **same product ID** in RevenueCat. |

### Right now: use the Test Store product (no new product needed)

You said you only have the **Test Store monthly product**. That’s enough to test the full flow (paywall, purchase, entitlement) **before** touching App Store Connect.

1. You do **not** need to create a new product for Test Store.
2. Go to **Entitlements** → create **Quotio Pro** → attach the **Test Store monthly product** to it.
3. Go to **Offerings** → create an offering (e.g. `default`) → set as **Current** → add a package (e.g. `monthly`) and select the **Test Store monthly product**.
4. Keep using `EXPO_PUBLIC_RC_API_KEY=test_...` in `.env`. Your app will fetch this offering and the paywall will work in dev.

When you’re ready for real subscriptions (TestFlight/App Store), do Step 4b below.

---

### Step 4a: Products for Test Store (you already have this)

- RevenueCat → **Products** (or **Catalog**).
- You should see a **Test Store** product (e.g. “Monthly” or similar). No need to create anything; just use it in the **Entitlement** and **Offering** as above.

---

### Step 4b: Add products for Apple App Store (when you go to TestFlight)

Do this **only when** you have created a subscription in App Store Connect (see [APP_STORE_AND_TIERS.md](./APP_STORE_AND_TIERS.md) Part 1).

1. In RevenueCat, go to **Products** (or **Catalog**).
2. Click **+ New** (or **Add product**).
3. Choose **Apple App Store**.
4. **Product ID:** must match App Store Connect **exactly**, e.g. `quotio_pro_monthly`.
5. Save. Add a yearly product too if you have one (e.g. `quotio_pro_yearly`).
6. In **Entitlements** → **Quotio Pro** → attach these Apple products (in addition to or instead of the Test Store product).
7. In **Offerings** → your current offering → add or edit packages to use the Apple product(s) (e.g. package `monthly` → product `quotio_pro_monthly`).

For production builds, use `EXPO_PUBLIC_RC_API_KEY_IOS=appl_...` (from Step 3) so the app talks to Apple, not Test Store.

---

## Step 5: Create the entitlement

1. Go to **Entitlements** in the sidebar.
2. Click **+ New** (or **Create entitlement**).
3. **Identifier:** `Quotio Pro` (must match `REVENUECAT_ENTITLEMENT_ID` in the app).
4. **Attach products:** For Test Store–only testing, attach the **Test Store monthly product**. When you add Apple products (Step 4b), attach those too (e.g. `quotio_pro_monthly`).
5. Save.

---

## Step 6: Create the offering (what the app fetches)

1. Go to **Offerings** in the sidebar.
2. Create a new **Offering** (e.g. identifier `default`).
3. Set this offering as **Current** (there’s usually a “Set as current” or similar).
4. Add **Packages** to this offering:
   - **Package identifier:** e.g. `monthly` (or `$rc_monthly`).
   - **Product:** for Test Store, select the **Test Store monthly product**. For production, select your Apple product (e.g. `quotio_pro_monthly`).
   - Add and save.
   - If you have yearly, add another package (e.g. `yearly` → yearly product).

After this, `Purchases.getOfferings()` in your app will return `offerings.current` with packages and prices.

---

## Quick checklist

| # | Step | Done |
|---|------|------|
| 1 | New RevenueCat project created (old one deleted if desired) | ☐ |
| 2 | iOS app added (Bundle ID + App-Specific Shared Secret) | ☐ |
| 3 | iOS public API key copied → `EXPO_PUBLIC_RC_API_KEY_IOS` in `.env` | ☐ |
| 4 | Products added (same IDs as App Store Connect) | ☐ |
| 5 | Entitlement **Quotio Pro** created, products attached | ☐ |
| 6 | Offering created, set as Current, monthly (and yearly) package added | ☐ |

---

**Why you didn’t see an iOS key before:** The **iOS public API key** only appears under **SDK API keys** after you **add an app** (Step 2). “Test Store” is a built-in key for testing without connecting to Apple; for real App Store subscriptions you need the key for your own iOS app row.
