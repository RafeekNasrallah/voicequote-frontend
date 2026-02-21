# Add Quotio to App Store (Just You) + RevenueCat Tiers

Use this guide to get your app on TestFlight **only for you** (no public App Store release) and set up subscription tiers so RevenueCat and your paywall work.

**Your app:** Quotio · Bundle ID: `com.getquotio.quotio` · Entitlement in code: **Esti Pro**

---

## Part 1: App Store Connect (Apple)

### 1.1 Agreements, Tax & Banking (required for IAP)

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) → **Agreements, Tax, and Banking**.
2. **Paid Applications Agreement** — Sign the latest version if not already done.
3. **Tax** — Complete required forms (e.g. W-9 for US).
4. **Banking** — Add bank account; status must be **Clear** before you can test in-app purchases.

Without this, subscription products won’t be testable.

### 1.2 Create the app in App Store Connect

1. **Register Bundle ID** (if not already):
   - [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
   - Click **+** → **App IDs** → **App**.
   - Description: e.g. "Quotio".
   - Bundle ID: **Explicit** → `com.getquotio.quotio`.
   - Enable **In-App Purchase**.
   - Register.

2. **Create App record:**
   - App Store Connect → **My Apps** → **+** → **New App**.
   - Platform: **iOS**.
   - Name: **Quotio** (or your store name).
   - Primary Language, Bundle ID: select `com.getquotio.quotio`.
   - SKU: e.g. `quotio-ios-001`.
   - Create.

You don’t have to fill every field for “release”; you only need a build for TestFlight.

### 1.3 Create a Subscription Group + products (your tiers)

1. In **My Apps** → **Quotio** → left sidebar **Subscriptions** (under Monetization).
2. Click **+** to create a **Subscription Group**:
   - Reference name: e.g. `Quotio Pro` (internal only).
   - Create, then add localizations for the **group** (Subscription Group Display Name, etc.).
3. Inside that group, click **+** to add subscription **products**. Create at least one (e.g. monthly):

| Field                   | Example                                            | Notes                                           |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------- |
| **Reference name**      | Pro Monthly                                        | Internal only.                                  |
| **Product ID**          | `quotio_pro_monthly`                               | **Must be unique forever**; use a clear scheme. |
| **Duration**            | 1 month                                            | Set in the product.                             |
| **Subscription prices** | Add price (e.g. $4.99)                             | Add in Subscription Prices.                     |
| **Localization**        | Display name + description                         | Required; user-facing.                          |
| **Review**              | Screenshot (e.g. 640×920 paywall) + optional notes | Required to submit IAP.                         |

4. Optional: add a second product (e.g. `quotio_pro_yearly`) in the same group.
5. **Subscription group localization**: Add at least one localization for the **group** (Add localizations on the group) so products can be submitted.
6. **Save** on each product and the group.

Product IDs you create here are what you’ll add to RevenueCat (e.g. `quotio_pro_monthly`).

### 1.4 Set environment variables for EAS (production) builds

EAS does **not** upload your local `.env`. If you see “Clerk Expo missing publishable key” (or other missing env) in the TestFlight build, add the variables in EAS:

1. Go to [expo.dev](https://expo.dev) → your account → project **Quotio**.
2. Open **Project settings** (or **Environment variables** / **Secrets**).
3. For the **production** environment, add at least:
   - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — your Clerk publishable key (from [Clerk Dashboard](https://dashboard.clerk.com) → API Keys).
   - `EXPO_PUBLIC_API_URL` — your backend API URL (e.g. `https://your-api.com`).
   - `EXPO_PUBLIC_RC_API_KEY_IOS` — RevenueCat iOS public API key (from RevenueCat dashboard).
4. Save, then **create a new production build** (step 1.5 below). Existing builds won’t pick up new env vars.

### 1.5 Upload a build (for TestFlight only — no public release)

You only need a build so you (and optionally internal testers) can install via TestFlight. No App Store “release” required.

1. **Build with EAS:**
   ```bash
   cd C:\Users\Rafiq\Desktop\Templates\Apps\voicequote-frontend
   npx eas-cli build --platform ios --profile production
   ```
2. When the build finishes, **submit to App Store Connect** (so it appears in TestFlight):

   ```bash
   npx eas-cli submit --platform ios --latest
   ```

   When prompted, sign in with your Apple ID and select the **Quotio** app in App Store Connect.  
   (Optional: for non-interactive submit, use your App Store Connect App ID in `eas.json` under `submit.production.ios.asc_app_id`. Find the ID in App Store Connect → My Apps → Quotio → App Information → **Apple ID**.)

3. In App Store Connect → **TestFlight** tab:
   - The build will appear under **iOS** after processing (often 5–15 minutes).
   - Go to **Internal Testing** → create a group if needed → add yourself (and only yourself if you want “only me”).
   - Install **TestFlight** on your iPhone and open the invite/link to install Quotio.

Internal testers don’t go through App Review. You can use this build to test IAP in Sandbox (see below).

### 1.6 (Optional) Submit app + IAP for review later

When you’re ready to go public:

- In the app version (e.g. 1.0.0), in **App Store** tab, under **In-App Purchases and Subscriptions**, add your subscription products to the version.
- Upload/submit the same build (or a new one), fill required metadata (screenshot, description, etc.), then **Submit for Review**.

For “only me” and adding tiers, you can stop after TestFlight + Sandbox.

---

## Part 2: RevenueCat — Tiers (Products + Entitlement + Offering)

RevenueCat needs: **Products** (from Apple), one **Entitlement** (e.g. “Esti Pro”), and an **Offering** with **packages** so your app’s `getOfferings()` returns something.

### 2.1 App Store Connect app in RevenueCat

1. RevenueCat dashboard → your project → **Project settings** → **Apps**.
2. Add or select the **iOS app**; link it to the same **Bundle ID** (`com.getquotio.quotio`).
3. In **App Store Connect API** (or Shared Secret) section, add:
   - **App-Specific Shared Secret** from App Store Connect:  
      **My Apps** → **Quotio** → **App Information** → **App-Specific Shared Secret** (generate if needed).  
     This lets RevenueCat validate receipts.

### 2.2 Products (Apple product IDs)

1. RevenueCat → **Products** (or **Catalog**).
2. Add **Apple App Store** products with the **exact Product IDs** from App Store Connect, e.g.:
   - `quotio_pro_monthly`
   - `quotio_pro_yearly` (if you created it)

### 2.3 Entitlement (access level)

1. RevenueCat → **Entitlements**.
2. Create an entitlement with identifier: **`Esti Pro`** (must match `ENTITLEMENT_ID` in your paywall code).
3. Attach the Apple products above to this entitlement (so a purchase of `quotio_pro_monthly` or yearly grants “Esti Pro”).

### 2.4 Offering (what the app fetches)

1. RevenueCat → **Offerings**.
2. Create an **Offering** (e.g. identifier `default`).
3. Set it as **Current** (so `offerings.current` in the SDK returns it).
4. Add **Packages** to this offering:
   - At least one package that references your monthly (or primary) product, e.g.:
     - Package identifier: `monthly` (or `$rc_monthly`).
     - Product: `quotio_pro_monthly`.
   - Optionally add a yearly package (e.g. `yearly` / `quotio_pro_yearly`).

After this, `Purchases.getOfferings()` in your app will return `offerings.current` with `availablePackages`, and your paywall will show the monthly (or first) package and price.

---

## Part 3: Test in-app purchases (Sandbox)

- **Sandbox tester:** App Store Connect → **Users and Access** → **Sandbox** → **Testers** → create a Sandbox Apple ID (e.g. `quotio+sandbox@yourdomain.com`).
- On your iPhone: **Settings → App Store → Sandbox Account** → sign in with that Sandbox account (only for testing; don’t use a real Apple ID).
- Install Quotio via **TestFlight**, open the app, and go to the paywall; the purchase will use Sandbox and won’t charge real money.

---

## Checklist

| Step                                                        | Where                          | Done |
| ----------------------------------------------------------- | ------------------------------ | ---- |
| Paid Apps + Tax + Banking                                   | App Store Connect              | ☐    |
| Bundle ID with In-App Purchase                              | Developer Portal               | ☐    |
| App record (Quotio)                                         | App Store Connect              | ☐    |
| Subscription group + ≥1 product                             | App Store Connect              | ☐    |
| Product IDs noted (e.g. `quotio_pro_monthly`)               | —                              | ☐    |
| Build + submit to TestFlight                                | EAS + App Store Connect        | ☐    |
| Install via TestFlight (only you)                           | iPhone                         | ☐    |
| App-Specific Shared Secret in RevenueCat                    | RevenueCat + App Store Connect | ☐    |
| Products in RevenueCat (same IDs as Apple)                  | RevenueCat                     | ☐    |
| Entitlement **Esti Pro** + products attached                | RevenueCat                     | ☐    |
| Current Offering with monthly (and optional yearly) package | RevenueCat                     | ☐    |
| Sandbox tester + test purchase                              | App Store Connect + device     | ☐    |

Once this is done, your app is on the App Store **only for you** (via TestFlight), and you have tiers (products + entitlement + offering) so RevenueCat and the paywall work.
