# RevenueCat Error 23: Configuration Issue

When you tap **Upgrade to Pro** and see **"Error 23 – There is an issue with your configuration"**, it means RevenueCat could not load any products from the store. The products in your RevenueCat dashboard don’t match what the app store (or simulator) is returning.

## What’s going on

- The app asks RevenueCat for the current **offering** (e.g. monthly subscription).
- RevenueCat returns the **product IDs** configured in your project.
- The SDK then asks the **store** (App Store, Google Play, or StoreKit in the simulator) for those products.
- If **none** of those products can be fetched, you get **Error 23**.

So the fix is always: **align RevenueCat, your app, and the store**.

---

## Expo / no Xcode (most common)

**If you’re on Expo and don’t use Xcode**, the iOS app key (`appl_...`) will almost always give Error 23 in development. Here’s why:

- The **iOS app key** makes the SDK ask **Apple** for products (or, on simulator, the **StoreKit** config).
- On the **simulator**, the only way to “fake” Apple products is a **StoreKit Configuration file** — and that is set up **in Xcode** (Edit Scheme → StoreKit Configuration). No Xcode → no StoreKit config → simulator returns no products → Error 23.
- On a **real device**, the app would need products that exist and are available in **App Store Connect** (and often TestFlight). That’s for later when you’re ready to ship.

**What to do now:** use the **Test Store** for development so you don’t need Xcode or App Store Connect yet.

1. In **RevenueCat** → **Project settings** → **API keys** → copy the **Test Store** public key (starts with `test_`).
2. In **RevenueCat** → **Offerings** → your current offering → set each package to use the **Test Store** monthly product (not the App Store product). Same in **Entitlements** → **Quotio Pro** → attach the Test Store monthly product.
3. In your app **`.env`**, use the Test Store key for now:
   ```env
   EXPO_PUBLIC_RC_API_KEY=test_xxxxxxxxxxxx
   ```
   (Comment out or remove `EXPO_PUBLIC_RC_API_KEY_IOS` while testing.)
4. Restart Expo (`npx expo start --clear`).

The paywall will then load and you can test purchases without Xcode. When you’re ready for TestFlight or the App Store, switch back to `EXPO_PUBLIC_RC_API_KEY_IOS=appl_...` and configure your offering with the real App Store product IDs (see scenario 3 below).

---

## Fixes by scenario

### 1. You’re using the **Test Store** key (development only)

- In **RevenueCat** → **Offerings** → your current offering → each **package** should use a **Test Store** product (not an App Store product).
- In **Entitlements** → **Quotio Pro** → attach the **Test Store monthly** product.
- In `.env` use **one** of:
  - `EXPO_PUBLIC_RC_API_KEY=test_...` (Test Store key from RevenueCat → Project settings → API keys), or  
  - `EXPO_PUBLIC_RC_API_KEY_IOS=appl_...` **only** when you’re testing with a real App Store / StoreKit setup (see below).

**Why Test Store products when using the Test Store key?**  
When your app uses the Test Store API key, RevenueCat returns the product IDs from your offering. The SDK then tries to load those products from the **device’s store** (App Store, or StoreKit in the simulator). **Test Store** products are virtual products that RevenueCat can serve without Apple/Google; they work in dev builds without App Store Connect or a StoreKit file. If your offering uses **App Store** product IDs (e.g. `quotio_pro_monthly`) instead, the app will ask Apple for those products—and in a dev setup (simulator without StoreKit config, or product not yet approved) Apple returns nothing, so you get Error 23. So: use Test Store products in the offering when you want to test the paywall flow without configuring the real store yet.

If the offering uses **Apple** product IDs but the app is using the **Test Store** key (or vice versa), you’ll get Error 23.

---

### 2. You’re using the **iOS app key** (`appl_...`) and running in the **simulator**

- The simulator doesn’t talk to App Store Connect. It uses a **StoreKit Configuration** file (`.storekit`) in Xcode.
- In Xcode: **Product → Scheme → Edit Scheme → Run → Options** → set **StoreKit Configuration** to your `.storekit` file.
- In that `.storekit` file, create **subscription** product(s) whose **Product ID(s)** match **exactly** what you added in RevenueCat (e.g. `quotio_pro_monthly`).
- In RevenueCat, your **offering** and **entitlement** must use those **same** product IDs.

If the StoreKit file has no matching product IDs, or the file isn’t selected in the scheme, you get Error 23.

---

### 3. You’re using the **iOS app key** with a **real device** or **TestFlight**

- In **App Store Connect** → your app → **Subscriptions**: the subscription product must exist and be in **Ready to Submit** or **Approved**. “Waiting for Review” can still cause issues in some cases.
- **Product ID** in App Store Connect must match **exactly** the product ID in RevenueCat (e.g. `quotio_pro_monthly`).
- In RevenueCat → **Apps** → your iOS app: **Bundle ID** must match the app’s bundle ID in Xcode and App Store Connect.
- Complete **App Store Connect** setup: subscription group, pricing, and (if required) agreements/localization so the product is actually available.

---

### 4. **Android** (Google Play)

- In **Google Play Console**, the in-app product must be **active**.
- RevenueCat → **Apps** → your Android app: **Google Play service credentials** (e.g. service account) must be set up so RevenueCat can talk to Play. See RevenueCat docs for “Google Play” / “Android” setup.
- Product ID in Play must match the product ID in RevenueCat.

---

## Quick checklist

| Check | Where |
|-------|--------|
| API key in `.env` matches what you’re testing (Test Store vs iOS/Android app key) | `.env` |
| Offering uses products that exist for that key (Test Store product vs Apple/Play product) | RevenueCat → Offerings |
| Entitlement **Quotio Pro** includes those products | RevenueCat → Entitlements |
| **iOS simulator:** StoreKit Configuration file set in scheme; product IDs in file match RevenueCat | Xcode scheme + `.storekit` |
| **iOS device/TestFlight:** Product in App Store Connect, correct status; Bundle ID matches | App Store Connect + RevenueCat Apps |
| **Android:** Product active in Play; RevenueCat ↔ Play connection configured | Play Console + RevenueCat Apps |

---

## More info

- RevenueCat: [Why are offerings empty?](https://rev.cat/why-are-offerings-empty)
- Project setup: [REVENUECAT_NEW_PROJECT.md](./REVENUECAT_NEW_PROJECT.md), [APP_STORE_AND_TIERS.md](./APP_STORE_AND_TIERS.md)
