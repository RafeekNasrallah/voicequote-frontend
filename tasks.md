# VoiceQuote Frontend Implementation Plan

## Project Context

We are building the **Expo (React Native)** frontend for VoiceQuote.
**Core Workflow:** Record Audio -> Upload to S3 -> Backend Processes -> User Edits Quote -> Generate PDF -> Share.

## Tech Stack

- **Framework:** Expo (Router 'Tabs' Template).
- **Styling:** NativeWind (Tailwind CSS) + Lucide Icons.
- **State:** TanStack Query (React Query) + Zustand (optional for recorder state).
- **Auth:** Clerk (Expo SDK).
- **API:** Axios (Pre-configured with Bearer token).

---

## Phase 1: Foundations & Config

### Task 1.1: Install & Config

- **Action:** Install dependencies.
  - `npm install nativewind tailwindcss react-native-reanimated react-native-safe-area-context clsx tailwind-merge`
  - `npm install @clerk/clerk-expo expo-secure-store`
  - `npm install @tanstack/react-query axios`
  - `npm install expo-av expo-file-system expo-sharing lucide-react-native`
- **Action:** Configure `tailwind.config.js` to scan `app/**/*.{js,jsx,ts,tsx}` and `components/**/*.{js,jsx,ts,tsx}`.
- **Action:** Configure `babel.config.js` for NativeWind.

### Task 1.2: API & Query Client

- **Action:** Create `src/lib/api.ts`.
  - Create Axios instance pointing to `http://localhost:3000` (or your generic IP for physical device testing).
  - Add interceptor: `Clerk.session.getToken()` -> Header `Authorization: Bearer <token>`.
- **Action:** Create `src/lib/query.ts` (QueryClient provider).

### Task 1.3: Root Layout

- **Action:** Update `app/_layout.tsx`.
  - Wrap with `<ClerkProvider>` (using `tokenCache` from SecureStore).
  - Wrap with `<QueryClientProvider>`.
  - Add `Slot` or `Stack`.
  - **Auth Check:** `useEffect` to check `isSignedIn`. If false, `router.replace('/auth/sign-in')`.

---

## Phase 2: Authentication (The Gate)

### Task 2.1: Sign In Screen

- **Action:** Create `app/auth/sign-in.tsx`.
- **Logic:**
  - Use Clerk `useSignIn`.
  - Create a custom UI (NOT the pre-built component) matching `designs.md`.
  - Fields: Email/Password or "Sign in with Google".
- **Success:** Redirect to `/(tabs)`.

### Task 2.2: Sign Up Screen

- **Action:** Create `app/auth/sign-up.tsx`.
- **Logic:** Custom UI for Email/Password registration. Hnandle email verification code step.

### ✅ Validation (Phase 2)

- App launches -> Redirects to Sign In.
- Login successful -> Redirects to Tabs (Home).

---

## Phase 3: Home Dashboard (The Recorder)

### Task 3.1: Dashboard UI

- **Action:** Build `app/(tabs)/index.tsx`.
- **Reference:** See `designs.md` -> "Home Dashboard".
- **Components:** Header (Greeting), Stats Cards (Mock data for now), Recent Jobs List.

### Task 3.2: The Record Button Component

- **Action:** Create `components/RecordButton.tsx`.
- **Logic:**
  - Use `expo-av` to request permissions.
  - `startAsync()`: Configured for High Quality M4A.
  - `stopAsync()`: Returns the local file URI.
- **State:** Visual feedback (Mic icon changes to Stop icon/Waveform).

### Task 3.3: Integration

- **Action:** Place button in Dashboard. On "Stop", console.log the URI.

---

## Phase 4: Processing Logic (The "Magic")

### Task 4.1: The "UseCreateQuote" Hook

- **Action:** Create `src/hooks/useCreateQuote.ts` (TanStack Mutation).
- **Step 1 (Sign):** `POST /api/upload-url` -> Get `uploadUrl`, `fileKey`.
- **Step 2 (Upload):** `FileSystem.uploadAsync(uploadUrl, localUri, { httpMethod: 'PUT' })`.
- **Step 3 (Process):** `POST /api/process-quote` -> Body `{ fileKey, language }`.
- **Step 4 (Redirect):** On success, `router.push('/quote/[id]')`.

### Task 4.2: Connect UI

- **Action:** In Dashboard, wrap the Record logic.
- **UI:** When recording stops, show a "Processing..." modal/spinner. Trigger the hook.

### ✅ Validation (Phase 4)

- Record audio -> Spinner appears -> Redirects to Quote Screen (even if empty for now).

---

## Phase 5: The Quote Editor

### Task 5.1: Quote Skeleton

- **Action:** Create `app/quote/[id].tsx`.
- **Query:** `useQuery` fetching `GET /api/quotes/:id`.
- **Reference:** See `designs.md` -> "Quote Editor".

### Task 5.2: Client Management Integration

- **Action:** Add "Client Card" section.
- **Logic:** If no client, button "Select Client". Opens a Modal with Client List (fetch `GET /api/clients`).
- **Update:** `PATCH /api/quotes/:id/client` on selection.

### Task 5.3: Line Items (Editable)

- **Action:** Render list of items.
- **Components:** `QuoteItemRow`. Inputs for Qty, Name, Price.
- **Logic:** On "Blur" (focus lost), trigger `PATCH /api/quotes/:id/items`. Auto-recalculate totals locally for instant feedback.

---

## Phase 6: Clients & Settings

### Task 6.1: Clients Tab

- **Action:** `app/(tabs)/clients.tsx`.
- **UI:** Search bar + List.
- **Action:** FAB to "Add Client" (Simple form modal: Name, Address).

### Task 6.2: Settings Tab

- **Action:** `app/(tabs)/settings.tsx`.
- **UI:** Sign Out button. Toggle for "Language" (store in User Preferences via API).

---

## Phase 7: Finalize & Share

### Task 7.1: PDF Generation

- **Action:** In Quote Editor, add "Finalize PDF" button.
- **Logic:** `POST /api/quotes/:id/regenerate-pdf`.
- **Result:** Update local data with new `pdfUrl`.

### Task 7.2: Native Share

- **Action:** Add "Share" button (Top right header or footer).
- **Logic:**
  - `FileSystem.downloadAsync(pdfUrl)` -> local temp file.
  - `Sharing.shareAsync(localFileUri)`.

### ✅ Validation (Phase 7)

- Full loop: Record -> Process -> Edit Item -> Add Client -> Finalize -> Share PDF.

---

## Phase 8: Live Dashboard & Quote Navigation

### Task 8.1: Real Quote List on Home

- **Action:** Replace hardcoded mock "Recent Jobs" with real data from `GET /api/quotes`.
- **UI:** Each card is tappable -> navigates to `/quote/[id]` for editing/viewing.
- **Display:** Quote date, total cost, client name (or "No client"), status indicator.

### Task 8.2: Live Stats

- **Action:** Replace the 3 mock stat cards with real counts derived from the quotes list.
- **Examples:** Total Quotes, Quotes with Clients, Quotes with PDFs (or similar meaningful metrics).

### Task 8.3: Pull-to-Refresh & Cache Invalidation

- **Action:** Add pull-to-refresh on the Home screen so new quotes appear after processing.
- **Action:** Invalidate the quotes cache when navigating back from the Quote Editor.

### ✅ Validation (Phase 8)

- Record a quote -> Go back to Home -> See the new quote in the list.
- Tap a quote -> Opens the editor -> Edit -> Go back -> See updated data.
- Pull down to refresh -> List updates.

---

## Phase 9: All Quotes Screen

### Task 9.1: "More" Button on Home

- **Action:** Add a "More" / "View All" button to the right of the "Recent Quotes" heading on the Home Dashboard.
- **Navigation:** Taps to `app/quotes.tsx` (full Quotes screen).
- **Home Limit:** Only show the 5 most recent quotes on the dashboard.

### Task 9.2: Quotes Screen

- **Action:** Create `app/quotes.tsx`.
- **UI:** Full-screen list of all quotes with a search bar at the top.
- **Search:** Filter by quote ID, client name, date, total cost — match against all fields.
- **List Items:** Same card style as Home (quote title, date, cost, status badge). Tappable -> `/quote/[id]`.
- **Empty State:** "No quotes found" when search has no results.

### Task 9.3: Pull-to-Refresh & Sort

- **Action:** Add pull-to-refresh on the Quotes screen.
- **Sort:** Newest first (default from API).

### ✅ Validation (Phase 9)

- Home shows max 5 recent quotes with "View All" button on the right.
- Tap "View All" -> Full quotes list with search.
- Search by client name -> Filters correctly.
- Tap any quote -> Opens the editor.

---

## Phase 10: Multi-Language Support (i18n)

### Task 10.1: i18n Setup

- **Action:** Install `i18next`, `react-i18next`, and `expo-localization`.
- **Action:** Create `src/i18n/` folder with:
  - `index.ts` — initialize i18next with language detection (via `expo-localization`) and fallback to English.
  - `en.json` — English translations (default).
  - `de.json` — German translations.
  - `he.json` — Hebrew translations.
  - `ar.json` — Arabic translations.
  - `es.json` — Spanish translations.
- **Action:** Wrap app with i18n provider in `app/_layout.tsx`.

### Task 10.2: Extract All UI Strings

- **Action:** Replace every hardcoded string in the app with `t("key")` calls.
- **Screens to cover:**
  - Auth (Sign In / Sign Up) — titles, buttons, placeholders, errors.
  - Home Dashboard — greeting, stats labels, "Recent Quotes", "View All".
  - Quotes tab — header, search placeholder, empty states.
  - Quote Editor — section labels, buttons ("Finalize PDF", "Share PDF", "Add Item"), alerts.
  - Clients tab — header, search placeholder, empty states, add client modal fields.
  - Settings — header, profile labels, language picker, sign out.
- **Action:** Populate all 5 translation files with translated strings.

### Task 10.3: RTL Support (Hebrew & Arabic)

- **Action:** Detect RTL languages (`he`, `ar`) and apply `I18nManager.forceRTL(true)` / `I18nManager.allowRTL(true)`.
- **Action:** Ensure layouts flip correctly (flex-row, text alignment, icons, padding).
- **Action:** Handle RTL reload if needed (Expo may require a restart for RTL to take effect).

### Task 10.4: Language Picker in Settings

- **Action:** Update the Settings screen language picker to show all 5 languages: English, Deutsch, עברית, العربية, Español.
- **Action:** On language change:
  1. Update i18next language (`i18n.changeLanguage(lang)`).
  2. Persist selection locally (AsyncStorage or SecureStore).
  3. Optionally sync to backend via `PATCH /api/me` (update `preferredLanguage`).
- **Action:** On app launch, restore persisted language before rendering.

### Task 10.5: Recording Language

- **Action:** When recording a quote, pass the user's selected language to `POST /api/process-quote` so the backend uses the correct Whisper language for transcription.
- **Action:** Ensure the language code sent matches what the backend expects (e.g., `en`, `de`, `he`, `ar`, `es`).

### ✅ Validation (Phase 10)

- Switch language to German in Settings -> All UI strings update to German.
- Switch to Hebrew -> App flips to RTL, all strings in Hebrew.
- Switch to Arabic -> RTL layout, Arabic strings.
- Record a quote in German -> Backend transcribes in German.
- Kill and reopen app -> Language preference persists.

---

## Phase 11: Enhanced Client Search

### Task 11.1: Deep Client Search

- **Action:** Update the search filter in the Clients tab (`app/(tabs)/clients.tsx`) to match against all client fields — not just `name`.
- **Fields to search:** name, address, email, phone.
- **Behavior:** Any field containing the search term should surface that client in the results.

### ✅ Validation (Phase 11)

- Type an address fragment in the Clients search bar -> Client with that address appears.
- Search by email -> Matching client appears.
- Search by phone number -> Matching client appears.
- Search by name still works as before.

---

## Phase 12: Fix Deprecation Warnings

### Task 12.1: Replace `SafeAreaView` from React Native

- **Warning:** `SafeAreaView` from `react-native` is deprecated.
- **Action:** Ensure every import of `SafeAreaView` comes from `react-native-safe-area-context`, not from `react-native`. Audit all files for any stray `react-native` SafeAreaView imports.

### Task 12.2: Migrate from `expo-av` to `expo-audio`

- **Warning:** `expo-av` is deprecated as of SDK 54. Use `expo-audio` instead.
- **Action:** Install `expo-audio`.
- **Action:** Update `components/RecordButton.tsx` to use `expo-audio` APIs instead of `expo-av`:
  - Replace `Audio.requestPermissionsAsync()` with the `expo-audio` equivalent.
  - Replace `Audio.Recording.createAsync()` and `Audio.RecordingOptionsPresets` with the new recording API.
  - Replace `Audio.setAudioModeAsync()` with the new API.
  - Ensure start/stop/getURI still works identically.
- **Action:** Uninstall `expo-av` after migration.

### ✅ Validation (Phase 12)

- No deprecation warnings in the console on app start.
- SafeAreaView still works correctly on all screens (content respects notch/home indicator).
- Recording still works: tap to record, tap to stop, audio file URI is returned.

---

## Phase 13: Quote Editor Enhancements — Unit Field & Editable Quote Name

### Task 13.1: Add Unit Field to Quote Items

- **Problem:** Each quote item currently only has Item (description), Quantity, and Price — but no Unit (e.g., "pcs", "m²", "kg", "hours").
- **Action:** Add a "Unit" column/field to each quote item row in the Quote Editor (`app/quote/[id].tsx`).
- **Action:** The unit field should be a text input so users can type any unit they need.
- **Action:** Include the `unit` field when saving/patching items to the backend (`PATCH /api/quotes/:id/items`).
- **Backend note:** The `unit` field already exists in the items JSON structure (AI extracts `{ name, qty, unit }`).

### Task 13.2: Editable Quote Name

- **Problem:** Quotes are currently displayed as "Quote #10", "Quote #23", etc. Users should be able to give quotes a custom name/title.
- **Action:** In the Quote Editor header, make the quote title editable — tapping on "Quote #10" should let the user type a custom name (e.g., "Kitchen Renovation", "Office Repair").
- **Action:** If the user hasn't set a custom name, fall back to "Quote #ID" as the default display.
- **Action:** Save the custom name to the backend when changed (`PATCH /api/quotes/:id` with a `name` field).
- **Action:** Update the QuoteCard components (Home, Quotes tab) to display the custom name when available, falling back to "Quote #ID".
- **Backend requirement:** The `Quote` model needs a `name` (String, optional) field. See backend `tasks.md` Phase 14 for the required changes.

### ✅ Validation (Phase 13)

- In the Quote Editor, each item row shows Item, Unit, Qty, and Price fields.
- The unit value is saved and persists after reloading the quote.
- Tapping the quote title in the editor allows renaming.
- Custom quote names appear on the Home dashboard and Quotes tab.
- Quotes without a custom name still show "Quote #ID" as fallback.

---

## Phase 14: Price List Management

### Task 14.1: Price List Screen

- **Goal:** Allow users to manage a personal price list of items with prices and units. When a new quote is processed, the backend fuzzy-matches extracted items against this list and auto-fills prices.
- **Action:** Create a new screen accessible from Settings (e.g., "My Price List" row).
- **Action:** The screen should:
  - Fetch the current price list from `GET /api/me` (the `priceList` field).
  - Display a list of items, each showing **Name**, **Price**, and **Unit**.
  - Allow the user to **add** new items (inline or via a modal).
  - Allow the user to **edit** existing items (tap to edit inline).
  - Allow the user to **delete** items (swipe or long-press).
  - Include a **search/filter** bar at the top for quick lookup.
- **Action:** On save, send the full updated list to `PUT /api/me/pricelist` with body `{ items: [{ name, price, unit }] }`.
- **Backend note:** The endpoint `PUT /api/me/pricelist` and `GET /api/me` (returns `priceList`) are already fully implemented. Fuse.js fuzzy matching is already integrated in `POST /api/process-quote`.

### Task 14.2: Settings Integration

- **Action:** Add a "My Price List" row in the Settings tab (under Preferences), showing the item count (e.g., "12 items").
- **Action:** Tapping the row navigates to the Price List screen.

### Task 14.3: Translations

- **Action:** Add translation keys for the Price List screen in all 5 languages (en, de, he, ar, es):
  - `settings.priceList`, `settings.priceListCount`
  - `priceList.title`, `priceList.searchPlaceholder`, `priceList.addItem`, `priceList.itemName`, `priceList.price`, `priceList.unit`, `priceList.unitPlaceholder`, `priceList.noItems`, `priceList.noItemsMsg`, `priceList.saveFailed`, `priceList.saved`, `priceList.savedMsg`, `priceList.deleteItem`, `priceList.deleteItemConfirm`

### ✅ Validation (Phase 14)

- Settings shows "My Price List" with item count.
- Tapping opens the Price List screen.
- User can add items (e.g., "Copper Pipe", $10.00, "ft").
- User can edit and delete items.
- Changes are saved to the backend via `PUT /api/me/pricelist`.
- After saving a price list, recording a new quote auto-fills prices for matching items.

---

## Phase 15: Labor Hours in Quote Editor

### Task 15.1: Display Labor Hours

- **Goal:** Show the labor hours extracted by AI in the Quote Editor.
- **Action:** Update the `QuoteData` interface in `app/quote/[id].tsx` to include `laborHours: number | null`.
- **Action:** Add a "Labor Hours" section in the Quote Editor (above or below the items table) that displays the current labor hours value.
- **Backend requirement:** `GET /api/quotes/:id` must return `laborHours`. See backend `tasks.md` Phase 15.

### Task 15.2: Editable Labor Hours

- **Goal:** Allow users to edit the labor hours value.
- **Action:** Make the labor hours field editable (numeric input).
- **Action:** On blur/change, save the updated value to the backend via `PATCH /api/quotes/:id` with `{ laborHours: number }`.
- **Backend requirement:** `PATCH /api/quotes/:id` must accept an optional `laborHours` field. If not already supported, add to backend tasks.

### Task 15.3: Labor Cost Calculation (Optional Enhancement)

- **Goal:** Allow users to set an hourly rate and calculate labor cost.
- **Action:** Add a "Labor Rate" field (e.g., $/hour) — this could be stored in user settings or entered per quote.
- **Action:** Display calculated labor cost = `laborHours × laborRate`.
- **Action:** Include labor cost in the total calculation.
- **Note:** This is an optional enhancement; skip if not needed for MVP.

### Task 15.4: Translations

- **Action:** Add translation keys for labor hours in all 5 languages (en, de, he, ar, es):
  - `quoteEditor.laborHours`, `quoteEditor.laborHoursPlaceholder`, `quoteEditor.hours`, `quoteEditor.failedSaveLaborHours`

### ✅ Validation (Phase 15)

- Record a voice note mentioning labor time (e.g., "This will take about 4 hours").
- Open the quote — labor hours should display (e.g., "4").
- Edit the labor hours value and blur — it should save to the backend.
- Reload the quote — the edited value persists.

---

## Phase 16: Labor Rate & Cost Calculation

### Task 16.1: Fetch Labor Rate from Profile

- **Goal:** Fetch the user's hourly labor rate from their profile.
- **Action:** Update the `UserProfile` interface in `app/(tabs)/settings.tsx` to include `laborRate: number | null`.
- **Action:** Ensure `GET /api/me` returns `laborRate`.
- **Backend requirement:** See backend `tasks.md` Phase 16.

### Task 16.2: Labor Rate Setting in Settings

- **Goal:** Allow users to set their hourly labor rate in Settings.
- **Action:** Add a "Labor Rate" row in the Settings Preferences section (below "My Price List").
- **Action:** Tapping the row opens an editable input (modal or inline) to set the hourly rate.
- **Action:** Save the rate via `PATCH /api/me` with `{ laborRate: number }`.
- **Action:** Display the current rate (e.g., "$50/hr") or "Not set" if null.

### Task 16.3: Display Labor Cost in Quote Editor

- **Goal:** Show the calculated labor cost in the Quote Editor.
- **Action:** Fetch the user's `laborRate` (from `GET /api/me` or cache it in context/state).
- **Action:** In the Labor Hours section, display:
  - Labor Hours: `4`
  - Rate: `× $50/hr`
  - Labor Cost: `= $200`
- **Action:** If `laborRate` is null, show "Set rate in Settings" link or just show hours without cost.

### Task 16.4: Include Labor Cost in Total

- **Goal:** Add labor cost to the quote total.
- **Action:** Calculate `laborCost = laborHours × laborRate`.
- **Action:** Update total display to show:
  - Materials: $500
  - Labor: $200
  - **Total: $700**
- **Action:** The PDF generation should also include labor cost (backend may need update).

### Task 16.5: Translations

- **Action:** Add translation keys in all 5 languages (en, de, he, ar, es):
  - `settings.laborRate`, `settings.laborRateDesc`, `settings.laborRatePlaceholder`, `settings.laborRateNotSet`, `settings.perHour`
  - `quoteEditor.laborRate`, `quoteEditor.laborCost`, `quoteEditor.materials`, `quoteEditor.setRateInSettings`

### ✅ Validation (Phase 16)

- In Settings, set labor rate to $50/hr. Confirm it saves.
- Open a quote with labor hours (e.g., 4 hrs).
- Labor section shows: `4 hrs × $50/hr = $200`.
- Total shows Materials + Labor = Grand Total.
- If labor rate is not set, quote shows hours only without cost calculation.

---

## Phase 17: Currency Setting

### Task 17.1: Fetch Currency from Profile

- **Goal:** Fetch the user's preferred currency from their profile.
- **Action:** Update the `UserProfile` interface to include `currency: string`.
- **Action:** Ensure `GET /api/me` returns `currency` (defaults to "USD" if not set).
- **Backend requirement:** See backend `tasks.md` Phase 17.

### Task 17.2: Currency Setting in Settings

- **Goal:** Allow users to select their preferred currency in Settings.
- **Action:** Add a "Currency" row in the Settings Preferences section.
- **Action:** Tapping the row opens a picker/modal with common currencies:
  - USD ($), EUR (€), GBP (£), ILS (₪), AED (د.إ), etc.
- **Action:** Save the selection via `PATCH /api/me` with `{ currency: string }`.
- **Action:** Display the current currency code and symbol (e.g., "USD ($)").

### Task 17.3: Create Currency Utility

- **Action:** Create `src/lib/currency.ts` with:
  - `SUPPORTED_CURRENCIES`: Array of `{ code, symbol, name }` (e.g., `{ code: "USD", symbol: "$", name: "US Dollar" }`).
  - `getCurrencySymbol(code: string)`: Returns the symbol for a currency code.
  - `formatCurrency(amount: number, code: string)`: Returns formatted string (e.g., "$420.00", "€350.00", "₪1,500").

### Task 17.4: Apply Currency Throughout the App

- **Action:** Update all price displays to use `formatCurrency()` or the user's currency symbol:
  - Quote Editor: items, labor, totals
  - Home Dashboard: quote cards
  - Quotes Tab: quote list
  - Price List: item prices
- **Action:** Replace hardcoded "$" with dynamic currency symbol from user profile.

### Task 17.5: Translations

- **Action:** Add translation keys in all 5 languages (en, de, he, ar, es):
  - `settings.currency`, `settings.currencyDesc`, `settings.selectCurrency`

### ✅ Validation (Phase 17)

- In Settings, select EUR (€) as currency. Confirm it saves.
- Open a quote — all prices should display with € symbol.
- Home dashboard shows quote totals in €.
- Quotes tab shows amounts in €.
- Price List shows prices in €.
- Change back to USD ($) — all displays update accordingly.

---

## Phase 18: Business Logo Upload

**Goal:** Allow users to upload a business logo that will appear on their PDF quotes.

### Task 18.1: Add Logo Upload in Settings

- **Action:** In `app/(tabs)/settings.tsx`, add a "Business Logo" row in the "Account" section.
- **UI:**
  - Display the current logo as a small preview (if uploaded), or a placeholder icon.
  - Tap to open image picker (`expo-image-picker`).
  - Show upload progress indicator.
- **Flow:**
  1. User taps "Business Logo" row.
  2. Opens image picker (camera roll / gallery).
  3. On selection, get presigned S3 URL via `POST /api/upload-url` with `{ ext: "png" }` (or jpg).
  4. Upload image to S3.
  5. Call `POST /api/me/logo` with `{ fileKey }` to save the logo key.
  6. Invalidate `["me"]` query to refresh profile.
  7. Show success message.

### Task 18.2: Install Dependencies

- **Action:** Install `expo-image-picker`:
  ```bash
  npx expo install expo-image-picker
  ```

### Task 18.3: Display Logo Preview

- **Action:** Fetch `logoKey` from `GET /api/me` (if it's returned) or infer logo existence.
- **Note:** The backend generates a signed URL when needed for PDF. For settings preview, you may need a separate endpoint or store a permanent public URL. For MVP, display a checkmark/success state if `logoKey` exists.

### Task 18.4: Translations

- **Action:** Add translation keys in all 5 languages (en, de, he, ar, es):
  - `settings.businessLogo`, `settings.businessLogoDesc`, `settings.uploadLogo`, `settings.logoUploaded`, `settings.logoUploadFailed`

### ✅ Validation (Phase 18)

- In Settings, tap "Business Logo".
- Select an image from camera roll.
- Confirm upload succeeds and shows confirmation.
- Generate a PDF for any quote — logo should appear in top-left corner.
- If no logo uploaded, PDF still generates without a logo.

---

## Phase 19: Home Dashboard Stats (Live Data)

**Goal:** Display accurate quote statistics on the home dashboard using the backend stats endpoint.

### Task 19.1: Fetch Stats from Backend

- **Problem:** The home dashboard currently computes stats from the limited 4 recent quotes, which is inaccurate.
- **Action:** In `app/(tabs)/index.tsx`, add a separate query to fetch stats from `GET /api/quotes/stats`.
- **Response type:**
  ```typescript
  interface QuoteStats {
    total: number;
    withClient: number;
    ready: number;
  }
  ```

### Task 19.2: Update Stats Display

- **Action:** Replace the locally computed stats (`totalQuotes`, `withClient`, `ready`) with data from the stats query.
- **Action:** Show skeleton or loading state for stats while fetching.
- **Action:** Invalidate stats query when a quote is created or deleted.

### ✅ Validation (Phase 19)

- Home dashboard shows accurate total count (not limited to 4).
- Create a new quote — stats update to reflect the new total.
- Delete a quote — stats decrease accordingly.
- Assign a client to a quote — "With Client" count increases.

---

## Phase 20: Customizable Terms & Conditions

**Goal:** Allow users to view and edit their PDF terms and conditions from the Settings screen.

### Task 20.1: Create Terms & Conditions Screen ✅

- **Action:** Create `app/terms.tsx` — a dedicated screen for managing terms.
- **UI:**
  - Header with back button and title "Terms & Conditions"
  - List of editable term items (TextInput for each)
  - "Add Term" button to add new terms
  - "Delete" button (trash icon) on each term to remove it
  - "Save" button in header (enabled when changes exist)
  - "Reset to Defaults" button to restore standard terms

### Task 20.2: Add Terms Setting Row ✅

- **Action:** In `app/(tabs)/settings.tsx`, add a "Terms & Conditions" row in the Preferences section.
- **UI:** Shows count of current terms (e.g., "4 terms") or "Default" if using defaults.
- **Navigation:** Taps navigate to `app/terms.tsx`.

### Task 20.3: Fetch and Save Terms ✅

- **Action:** Fetch `termsAndConditions` from `GET /api/me`.
- **Action:** Save terms via `PATCH /api/me` with `{ termsAndConditions: string[] }`.
- **Action:** Send `null` to reset to defaults.

### Task 20.4: Default Terms Display ✅

- **Action:** Define default terms in a constant (matching backend defaults):
  ```typescript
  const DEFAULT_TERMS = [
    "This quote is valid for 30 days from the date of issue.",
    "Payment is due upon completion of work unless otherwise agreed.",
    "Prices are subject to change if project scope is altered.",
    "All materials and labor are guaranteed as specified above.",
  ];
  ```
- **Action:** When user has no custom terms (`null`), display defaults with a note "Using default terms".

### Task 20.5: Translations ✅

- **Action:** Add translation keys in all 5 languages (en, de, he, ar, es):
  - `settings.termsAndConditions`, `settings.termsAndConditionsDesc`
  - `terms.title`, `terms.addTerm`, `terms.deleteTerm`, `terms.resetToDefaults`
  - `terms.usingDefaults`, `terms.customTerms`, `terms.termPlaceholder`
  - `terms.saved`, `terms.savedMsg`, `terms.saveFailed`

### ✅ Validation (Phase 20)

- In Settings, tap "Terms & Conditions" — navigates to terms screen.
- Default terms are shown with "Using default terms" indicator.
- Edit a term, add a new term, delete a term — Save button enables.
- Tap Save — terms are saved and reflected on next PDF.
- Tap "Reset to Defaults" — custom terms are cleared, defaults restored.
- Generate a PDF — verify custom/default terms appear correctly.

---

## Phase 21: Business Info Settings

**Goal:** Allow users to configure their business information (company name, address, phone, email) that appears on PDF quotes.

### Task 21.1: Create Business Info Screen ✅

- **Action:** Create `app/business-info.tsx` — a dedicated screen for managing business details.
- **UI:**
  - Header with back button and title "Business Info"
  - Form fields for:
    - Company Name (TextInput)
    - Address (TextInput, multiline)
    - Phone (TextInput, phone keyboard)
    - Email (TextInput, email keyboard)
  - "Save" button in header (enabled when changes exist)
- **Navigation:** Back button returns to Settings tab.

### Task 21.2: Add Business Info Setting Row ✅

- **Action:** In `app/(tabs)/settings.tsx`, add a "Business Info" row in the Preferences section (near Business Logo).
- **UI:**
  - Shows company name if set, or "Not configured"
  - Green checkmark if all fields are filled
- **Navigation:** Taps navigate to `app/business-info.tsx`.

### Task 21.3: Fetch and Save Business Info ✅

- **Action:** Fetch `companyName`, `companyAddress`, `companyPhone`, `companyEmail` from `GET /api/me`.
- **Action:** Save via `PATCH /api/me` with the business info fields.
- **Action:** Update `UserProfile` interface to include these fields.

### Task 21.4: Translations ✅

- **Action:** Add translation keys in all 5 languages (en, de, he, ar, es):
  - `settings.businessInfo`, `settings.businessInfoDesc`, `settings.notConfigured`
  - `businessInfo.title`, `businessInfo.companyName`, `businessInfo.companyNamePlaceholder`
  - `businessInfo.address`, `businessInfo.addressPlaceholder`
  - `businessInfo.phone`, `businessInfo.phonePlaceholder`
  - `businessInfo.email`, `businessInfo.emailPlaceholder`
  - `businessInfo.saved`, `businessInfo.savedMsg`, `businessInfo.saveFailed`

### ✅ Validation (Phase 21)

- In Settings, tap "Business Info" — navigates to business info screen.
- Enter company details and tap Save.
- Regenerate a PDF — verify company info appears in the header.
- Return to Settings — row shows company name.

---

## Phase 22: Tax/VAT Support

**Goal:** Allow users to configure tax settings and display subtotal, tax, and total on quotes.

### Task 22.1: Create Tax Settings Screen ✅

- **Action:** Create `app/tax-settings.tsx` — a screen for configuring tax.
- **UI:**
  - Header with back button and title "Tax Settings"
  - Toggle switch for "Enable Tax"
  - Tax Rate input (number, percentage, 0-100)
  - Tax Label input (e.g., "VAT", "GST", "Sales Tax")
  - Preview showing how tax will appear:
    - "Subtotal: $100.00"
    - "{Label} ({Rate}%): $19.00"
    - "Total: $119.00"
  - "Save" button in header

### Task 22.2: Add Tax Setting Row ✅

- **Action:** In `app/(tabs)/settings.tsx`, add a "Tax / VAT" row in the Preferences section.
- **UI:**
  - Shows "{Label} {Rate}%" if enabled (e.g., "VAT 19%")
  - Shows "Disabled" if tax is off
- **Navigation:** Taps navigate to `app/tax-settings.tsx`.

### Task 22.3: Fetch and Save Tax Settings ✅

- **Action:** Fetch `taxRate`, `taxLabel`, `taxEnabled` from `GET /api/me`.
- **Action:** Save via `PATCH /api/me` with tax settings.
- **Action:** Update `UserProfile` interface to include tax fields.

### Task 22.4: Display Tax in Quote Editor (Optional)

- **Action:** In `app/quote/[id].tsx`, if user has tax enabled, show a preview:
  - "Subtotal: $X"
  - "{taxLabel} ({taxRate}%): $Y"
  - "Total: $Z"
- **Note:** This is a read-only preview. Actual tax calculation happens in PDF generation.

### Task 22.5: Translations ✅

- **Action:** Add translation keys in all 5 languages:
  - `settings.taxSettings`, `settings.taxSettingsDesc`, `settings.taxDisabled`
  - `taxSettings.title`, `taxSettings.enableTax`, `taxSettings.taxRate`, `taxSettings.taxRatePlaceholder`
  - `taxSettings.taxLabel`, `taxSettings.taxLabelPlaceholder`, `taxSettings.preview`
  - `taxSettings.subtotal`, `taxSettings.total`
  - `taxSettings.saved`, `taxSettings.savedMsg`, `taxSettings.saveFailed`

### ✅ Validation (Phase 22)

- In Settings, tap "Tax / VAT" — navigates to tax settings screen.
- Enable tax, set rate to 19%, label to "VAT".
- Save and return to Settings — row shows "VAT 19%".
- Regenerate a PDF — verify subtotal, tax, and total are shown.
- Disable tax — PDF shows only total without tax breakdown.

---

## Phase 23: Client Quote History

**Goal:** Display all quotes associated with a client when viewing client details.

### Task 23.1: Update Client Detail Screen ✅

- **Action:** In `app/client/[id].tsx`, add a "Quote History" section below client info.
- **UI:**
  - Section header: "Quote History" with count badge (e.g., "5 quotes")
  - List of quotes showing:
    - Quote name (or "Quote #ID" if no name)
    - Date created
    - Total amount
    - Status indicator (Ready/Draft/No Client)
  - Empty state: "No quotes yet for this client"
- **Data:** Fetch from `GET /api/clients/:id/quotes`.

### Task 23.2: Navigate to Quote from History ✅

- **Action:** Tapping a quote in the history list navigates to `app/quote/[id].tsx`.
- **Note:** User can view/edit the quote and return to client detail.

### Task 23.3: Show Quote Count on Client List ✅

- **Action:** In `app/(tabs)/clients.tsx`, display quote count on each client card.
- **UI:** Small badge or text like "5 quotes" or just a number indicator.
- **Data:** Use `quoteCount` from `GET /api/clients` response.

### Task 23.4: Add Total Value Summary ✅

- **Action:** In `app/client/[id].tsx`, show a summary card above the quote list:
  - "Total Quotes: X"
  - "Total Value: $Y,YYY.YY"
- **Note:** This helps users quickly see the client's business value.

### Task 23.5: Translations ✅

- **Action:** Add translation keys in all 5 languages:
  - `clients.quoteHistory`, `clients.noQuotesForClient`
  - `clients.totalQuotes`, `clients.totalValue`
  - `clients.quotesCount` (pluralized: "1 quote", "5 quotes")

### ✅ Validation (Phase 23)

- Create a client and assign 3 quotes to them.
- In Clients tab, verify each client card shows quote count.
- Tap a client — verify "Quote History" section shows all 3 quotes.
- Verify summary shows "Total Quotes: 3" and "Total Value: $X".
- Tap a quote in the list — navigates to quote editor.
- Test empty state with a client that has no quotes.

---

## Phase 24: Tax Inclusive/Exclusive Setting ✅

**Goal:** Allow users to specify whether item prices include tax or if tax is added on top.

### Task 24.1: Update Tax Settings Screen

- **Action:** In `app/tax-settings.tsx`, add a toggle/checkbox for "Prices include tax".
- **UI:**
  - New toggle: "Prices include tax"
  - Description text explaining the modes:
    - OFF: "Tax will be added on top of your prices"
    - ON: "Your prices already include tax"
  - Update preview to reflect the selected mode:
    - Tax Exclusive: Subtotal $100 + Tax $19 = Total $119
    - Tax Inclusive: Total $100 = Subtotal $84.03 + Tax $15.97

### Task 24.2: Fetch and Save Tax Inclusive Setting

- **Action:** Fetch `taxInclusive` from `GET /api/me`.
- **Action:** Save via `PATCH /api/me` with `{ taxInclusive: boolean }`.
- **Action:** Update `UserProfile` interface to include `taxInclusive: boolean`.

### Task 24.3: Update Preview Calculation

- **Action:** In the preview section, calculate differently based on mode:
  ```typescript
  if (taxInclusive) {
    // Prices include tax
    const subtotal = previewTotal / (1 + taxRate / 100);
    const taxAmount = previewTotal - subtotal;
    // Show: Subtotal (excl. tax): $84.03, Tax: $15.97, Total: $100.00
  } else {
    // Tax added on top
    const subtotal = previewTotal;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    // Show: Subtotal: $100.00, Tax: $19.00, Total: $119.00
  }
  ```

### Task 24.4: Translations

- **Action:** Add translation keys in all 5 languages:
  - `taxSettings.taxInclusive`, `taxSettings.taxInclusiveDesc`
  - `taxSettings.taxExclusiveHint`, `taxSettings.taxInclusiveHint`
  - `taxSettings.subtotalExclTax`

### ✅ Validation (Phase 24)

- In Tax Settings, toggle "Prices include tax" OFF.
- Preview shows: Subtotal $100 + Tax (19%) $19 = Total $119.
- Toggle "Prices include tax" ON.
- Preview shows: Total $100 = Subtotal (excl. tax) $84.03 + Tax $15.97.
- Save and regenerate a PDF — verify calculation matches the selected mode.

---

## Phase 25: Offline & Network Error Handling ✅

**Goal:** When the device is offline or the API fails, show a clear message and allow retry instead of generic errors.

### Task 25.1: Network State (Optional)

- **Action:** Optionally use `@react-native-community/netinfo` or handle via Axios error to detect offline.
- **Alternative:** Rely on API failure (timeout / network error) to show the same UX.

### Task 25.2: Global or Per-Screen Error UX

- **Action:** In key screens (Home, Quotes, Clients, Quote Editor) or via a shared component:
  - When a query fails with a network error (e.g. `error.code === 'ERR_NETWORK'` or timeout), show a friendly message: e.g. "No connection" / "Something went wrong. Check your connection and try again."
  - Provide a "Try again" or "Retry" button that refetches (e.g. `refetch()` from `useQuery`).
- **Action:** Reuse the same copy for mutation failures where appropriate (e.g. create quote failed).

### Task 25.3: Translations

- **Action:** Add translation keys in all languages, e.g. `errors.noConnection`, `errors.somethingWentWrong`, `errors.retry`.

### ✅ Validation (Phase 25)

- Turn off Wi‑Fi/data, open app or refresh a list — see friendly message and Retry.
- Turn connection back on, tap Retry — data loads.

---

## Phase 26: Privacy Policy & Terms of Use Links ✅

**Goal:** Add app-level Privacy Policy and Terms of Use links in Settings (required for store listings).

### Task 26.1: Settings UI

- **Action:** In `app/(tabs)/settings.tsx`, add a new section (e.g. "Legal" or under Account):
  - Row: "Privacy Policy" — opens URL in browser (e.g. `Linking.openURL(PRIVACY_POLICY_URL)`).
  - Row: "Terms of Use" — opens URL in browser (e.g. `Linking.openURL(TERMS_OF_USE_URL)`).
- **Action:** URLs can come from env (e.g. `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_OF_USE_URL`) with fallback to placeholder or your site.

### Task 26.2: Translations

- **Action:** Add keys e.g. `settings.privacyPolicy`, `settings.termsOfUse`, `settings.legal` (section title).

### ✅ Validation (Phase 26)

- In Settings, tap Privacy Policy and Terms of Use — correct URLs open in browser.

---

## Phase 27: App Version from Build ✅

**Goal:** Show the real app version in Settings (from app config), not hardcoded in translations.

### Task 27.1: Read Version at Runtime

- **Action:** Use `expo-constants`: `Constants.expoConfig?.version` or `Application.nativeApplicationVersion` (or Expo’s recommended approach for your SDK).
- **Action:** Display in Settings where "App Version" is shown, e.g. `VoiceQuote v${version}` (or "Version 1.0.0" only).

### Task 27.2: Optional Build Number

- **Action:** If desired, show build number (e.g. `Constants.expoConfig?.android?.versionCode` / iOS equivalent) for support/debugging.

### ✅ Validation (Phase 27)

- Change version in `app.json`, rebuild or reload — Settings shows updated version.

---

## Phase 28: Pull-to-Refresh ✅

**Goal:** Let users refresh lists by pulling down on Home, Quotes, and Clients.

### Task 28.1: Home (Dashboard)

- **Action:** In `app/(tabs)/index.tsx`, wrap the list/content in `ScrollView` with `refreshControl={<RefreshControl refreshing={...} onRefresh={...} />}` (or use `refetch` from `useQuery` for recent quotes/stats).

### Task 28.2: Quotes Tab

- **Action:** In `app/(tabs)/quotes.tsx`, add pull-to-refresh that triggers refetch of the quotes list.

### Task 28.3: Clients Tab

- **Action:** In `app/(tabs)/clients.tsx`, add pull-to-refresh that triggers refetch of the clients list.

### ✅ Validation (Phase 28)

- On Home, Quotes, and Clients, pull down — spinner appears and list refreshes.

---

## Phase 29: Delete Account (Frontend) ✅

**Goal:** Allow user to delete their account from Settings; requires Backend Phase 27 (Delete Account).

### Task 29.1: Settings UI

- **Action:** In `app/(tabs)/settings.tsx`, under Account section, add "Delete account" (destructive style).
- **Action:** On press, show confirmation alert: explain that data will be deleted and ask for explicit confirm (e.g. "Type DELETE" or two-step confirm).

### Task 29.2: API Call

- **Action:** Call `DELETE /api/me` (or endpoint from backend). On success, sign out via Clerk and redirect to sign-in.

### Task 29.3: Error Handling

- **Action:** On failure, show alert with backend error message or generic "Could not delete account. Try again."

### Task 29.4: Translations

- **Action:** Add keys e.g. `settings.deleteAccount`, `settings.deleteAccountConfirm`, `settings.deleteAccountSuccess`, `settings.deleteAccountFailed`.

### ✅ Validation (Phase 29)

- Tap Delete account → confirm → account deleted and user signed out. If backend not ready, show appropriate error.

---

## Phase 30: Friendlier Error Boundary

**Goal:** When the app crashes (ErrorBoundary catches), show a friendly screen instead of a blank or technical error.

### Task 30.1: Custom Error UI

- **Action:** Customize the ErrorBoundary UI (expo-router exports one; override or wrap so that the fallback shows):
  - Short message: e.g. "Something went wrong."
  - Button: "Try again" that resets the error boundary (e.g. retry render) or navigates back to a safe screen (e.g. Home).
- **Reference:** Use `expo-router`’s `ErrorBoundary` props or a custom error boundary component that wraps children.

### Task 30.2: Optional Copy

- **Action:** Add translation key for the message and button if you want it localized.

### ✅ Validation (Phase 30)

- Trigger a deliberate error (e.g. throw in a component) — friendly screen appears with Try again.

---

## Phase 31: Monetization (RevenueCat & Paywall)

**Goal:** Integrate RevenueCat for subscriptions, show a paywall when free users hit the quote limit (403), and display Pro status / usage in Settings. Backend Phase 28 (Monetization & Limits) must be done first.

**Context:** Backend returns 403 with `{ error: "Limit Reached. Upgrade to Pro.", code: "QUOTA_EXCEEDED" }` when a free user exceeds 3 quotes per period. Backend webhook receives RevenueCat events and sets `User.isPro`. Use the same Clerk User ID as RevenueCat app user ID so the webhook updates the correct user.

### Task 31.1: Install RevenueCat SDK

- **Action:** In the frontend project root:
  - `npm install react-native-purchases`
  - `npx expo install expo-application` (required for native identifying)
- **Action:** Add to `.env` (or app config):
  - `EXPO_PUBLIC_RC_API_KEY_IOS` — Public API key from RevenueCat dashboard (iOS)
  - `EXPO_PUBLIC_RC_API_KEY_ANDROID` — Public API key from RevenueCat dashboard (Android)

### Task 31.2: Initialize & Identify (Bridge to Backend)

- **Action:** Create `src/lib/revenueCat.ts` (or equivalent).
- **Logic:**
  - Configure RevenueCat by platform: `Purchases.configure({ apiKey: ... })` using `EXPO_PUBLIC_RC_API_KEY_IOS` on iOS and `EXPO_PUBLIC_RC_API_KEY_ANDROID` on Android.
  - Call `Purchases.logIn(clerkUserId)` with the **Clerk User ID** so RevenueCat (and the webhook) link purchases to your backend user.
- **Action:** Call this init (e.g. `initRevenueCat(userId)`) from the root layout or auth gate whenever the signed-in user (Clerk) is available — e.g. inside `useEffect` when `user?.id` changes. Do not configure before user is known; login with Clerk ID is critical.

### Task 31.3: Paywall Screen / Modal

- **Action:** Create a paywall screen (e.g. `app/paywall.tsx`) or a full-screen modal reachable via route (e.g. `router.push("/paywall")`).
- **Design:**
  - Header: e.g. "Upgrade to Pro" with a close/cancel (X) button.
  - Benefits list: e.g. "Unlimited Quotes", "Remove Watermark", "Custom Logo" (or as per your product).
  - Price: **Fetch dynamically** from RevenueCat — do not hardcode. Use `Purchases.getOfferings()`, then `offerings.current`, and display the price from the default package (e.g. monthly).
  - Buttons:
    - Primary: "Subscribe for $X/mo" (or equivalent) — uses the fetched offering/package.
    - Secondary: "Restore Purchases" (required for App Store).
    - Cancel / X to close.
- **Logic (fetching price):**
  - On mount, call `Purchases.getOfferings()`, set state with `offerings.current` (e.g. `PurchasesOffering | null`).
  - Display the current offering’s default package (e.g. monthly) price string.
- **Logic (purchase):**
  - On primary button press, call `Purchases.purchasePackage(offering.monthly)` (or the package you use).
  - On success, check `customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]` (or your entitlement ID); if active, close paywall (e.g. `router.back()`) and optionally show success feedback.
  - On error: if not user cancel, show `Alert.alert` with error message.
- **Logic (restore):**
  - "Restore Purchases" calls `Purchases.restorePurchases()`.
  - If `customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]` is set, show success alert and close paywall; otherwise show "No active subscriptions found to restore."

### Task 31.4: Intercept 403 Quota Exceeded

- **Action:** In the flow that calls `POST /api/process-quote` (e.g. in `useCreateQuote` or the hook that triggers after recording), check response status and body.
- **Logic:**
  - If `response.status === 403` and response body has `code === "QUOTA_EXCEEDED"`, open the paywall (e.g. `router.push("/paywall")` or present paywall modal) instead of showing a generic error.
  - Optionally pass a flag so the paywall can show a message like "You’ve reached the free limit. Upgrade to continue."
- **Note:** Ensure this runs in the same code path that handles process-quote (and optionally regenerate-pdf if backend also enforces quota there).

### Task 31.5: Settings / Profile – Pro Status & Usage

- **Action:** Ensure `GET /api/me` is used where profile/settings are loaded (e.g. Settings tab). Backend now returns `isPro`, `quoteCount`, `periodEnd`.
- **UI:**
  - If **Pro:** Show a "Pro" badge or "Pro Active" (e.g. gold badge or distinct style).
  - If **Free:** Show usage: e.g. "Quote usage: {quoteCount} / 3" with an optional progress bar; show `periodEnd` if useful (e.g. "Resets on …").
  - **Upgrade:** If free, show a clear CTA: e.g. "Upgrade to Remove Limits" or "Upgrade to Pro" that navigates to the paywall.
- **Action:** Invalidate or refetch profile after returning from paywall (e.g. after purchase or restore) so Pro status and quote count update.

### Task 31.6: Restore Purchases (App Store Requirement)

- **Action:** Implement "Restore Purchases" on the paywall (see Task 31.3). Call `Purchases.restorePurchases()`, then check `entitlements.active[REVENUECAT_ENTITLEMENT_ID]`; show success or "No active subscriptions found" and close paywall on success.
- **Action:** Ensure the button is visible and clearly labeled (e.g. "Restore Purchases") for Apple review.

### Task 31.7: Translations (Optional)

- **Action:** Add translation keys for paywall and settings copy: e.g. `paywall.title`, `paywall.subscribe`, `paywall.restore`, `paywall.cancel`, `settings.pro`, `settings.quoteUsage`, `settings.upgradeToPro`, etc., for all supported languages.

### ✅ Validation (Phase 31)

- **Init:** Sign in with Clerk → RevenueCat configured and `logIn(clerkUserId)` called (check logs or RevenueCat dashboard).
- **Limit:** As a free user, create 3 quotes then record a 4th → backend returns 403 → app opens paywall (no generic error only).
- **Purchase:** On paywall, subscribe (sandbox) → webhook sets `isPro` → profile shows Pro; PDF has no watermark.
- **Restore:** Restore purchases → Pro restored and reflected in app.
- **Settings:** Free user sees quote usage (e.g. 2/3) and "Upgrade" CTA; Pro user sees Pro badge/status.

---

## Phase 32: Voice Playback on Quote Screen

**Goal:** After creating a quote from voice, the user can play the original recording from the quote editor screen.

### Backend tasks (copy to backend repo `tasks.md`)

- **Task 32.B.1: Persist audio key on quote**
  - When processing a quote (`POST /api/process-quote`), ensure the quote record stores the S3 (or storage) key for the uploaded audio file (e.g. `audioKey` or reuse the same key used for upload). If the backend already stores this, no change needed; otherwise add a column and persist it when creating the quote.

- **Task 32.B.2: Endpoint to get playable audio URL**
  - Add one of:
    - **Option A:** `GET /api/quotes/:id/audio-url` that returns `{ url: string }` (a short-lived signed URL for the quote’s recording). Return 404 if the quote has no recording.
    - **Option B:** Include an optional `audioUrl` (signed URL) or `hasRecording: boolean` in `GET /api/quotes/:id` and, if you prefer not to put short-lived URLs in the main response, a separate `GET /api/quotes/:id/audio-url` that returns the signed URL.
  - Generate a presigned GET URL for the stored audio object (same bucket/key as used for upload). Use a reasonable TTL (e.g. 1 hour). Ensure only the quote owner can request the URL (same auth as other quote endpoints).

- **Task 32.B.3: CORS / response**
  - If the signed URL is used from a mobile app (e.g. fetch/stream for playback), no CORS change is needed. If played in a web view, ensure the storage bucket allows the app origin if required.

### Frontend tasks (this repo)

- **Task 32.1: API and types**
  - Add a way to get the quote’s audio URL: e.g. call `GET /api/quotes/:id/audio-url` when the user opens the quote screen (or when they tap “Play recording”). Extend quote type or add a small hook/query that returns `audioUrl | null` so the UI can show a play control only when a recording exists.

- **Task 32.2: Playback UI on quote screen**
  - On the quote editor screen (`app/quote/[id].tsx`), add a compact “Play recording” or “Listen to recording” control (e.g. icon button + label) that is visible when the quote has an audio URL.
  - Use a simple in-app audio player (e.g. `expo-av` / `Audio.Sound` or expo-audio) to play the URL: load the URI, play/pause, and show a simple playing state (e.g. playing indicator or progress). Handle errors (e.g. 404 or network) with a short message or toast.

- **Task 32.3: Copy and accessibility**
  - Add translation keys (e.g. `quoteEditor.playRecording`, `quoteEditor.recordingUnavailable`) for all supported locales. Ensure the control is accessible (e.g. accessible label for screen readers).

### ✅ Validation (Phase 32)

- Create a quote from voice → open quote screen → see “Play recording” (or similar). Tap → recording plays. Quote without recording does not show the control or shows a disabled/unavailable state.

---

## Phase 33: UX Guardrails (Frontend Limits)

**Goal:** Provide immediate feedback to the user before they hit backend limits, saving them time and saving you bandwidth/processing costs.

### Task 33.1: Recording Duration Limit

- **Action:** Update `components/RecordButton.tsx`.
- **Logic:**
  - Use a `useEffect` or an interval to monitor the recording duration while active.
  - **Visual Warning:** When the user reaches 9 minutes (if the limit is 10), change the timer color to **Red**.
  - **Hard Stop:** At 10 minutes (600,000 ms), automatically call `stopAsync()`, trigger a haptic feedback, and show a message: "Maximum recording length reached (10m)."
- **Benefit:** Prevents the user from talking forever and ensures the file stays within your cost/size budget.

### Task 33.2: File Size Pre-Check

- **Action:** In `src/hooks/useCreateQuote.ts`.
- **Logic:**
  - After recording stops but **before** calling `POST /api/upload-url`, check the file size using `expo-file-system`:
    - `const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });`
  - If `fileInfo.size > 20 * 1024 * 1024` (20 MB):
    - Stop the process.
    - Show an **Alert:** "File is too large. Please try a shorter recording."
- **Benefit:** Saves user data and prevents "zombie" uploads that the backend would eventually reject anyway.

### Task 33.3: "Pro" Soft Limit UI

- **Action:** In `app/(tabs)/index.tsx` (Dashboard).
- **Logic:**
  - If `user.isPro === true`, check the `quoteCount` from your `GET /api/me` query.
  - If `quoteCount >= 90` (approaching the 100 soft limit):
    - Show a small, non-intrusive **warning banner:** "You are approaching your monthly high-volume limit."
  - If `quoteCount >= 100`:
    - **Disable** the Record button and show a message to contact support.
- **Note:** Extend the `UserProfile` type (or the type used for `/api/me`) with `isPro?: boolean` and `quoteCount?: number` if not already present.

### Task 33.4: Translations

- **Action:** Add keys to `en.json`, `de.json`, etc.:
  - `errors.maxDurationReached`
  - `errors.fileTooLarge`
  - `errors.softLimitApproaching`
  - `errors.softLimitReached`

### ✅ Validation (Phase 33)

- Start recording → Wait 10 minutes (or test with 10 seconds by temporarily lowering the limit) → App stops automatically.
- Mock a large file → Attempt upload → App alerts "File too large" immediately.
- Mock a Pro user with 100 quotes → Record button is disabled with a clear explanation.

---

## Phase 34: Voice-Extracted Terms & Conditions (Quote-Specific)

**Goal:** Extract terms and conditions mentioned in the voice recording (e.g. "this quote is valid for 30 days", "payment due in 14 days") and add them to the terms and conditions for **this quote only** — not as default user terms. Users can view, edit, and remove these quote-specific terms in the Quote Editor.

**Context:** Users already have default/custom terms in Settings (Phase 20). This phase adds **quote-level** extra terms that come from the recording and appear only on that quote’s PDF. Combined terms on PDF = user’s terms (from Settings) + quote-specific extra terms (from voice).

### Task 34.1: Types and API

- **Action:** Update the quote type (e.g. in `app/quote/[id].tsx` or a shared types file) to include `extraTerms: string[] | null` (or the field name the backend returns).
- **Action:** Ensure `GET /api/quotes/:id` is used and that the response includes the new field. No frontend API change if backend adds the field to the existing response.

### Task 34.2: Quote Editor — Display Quote-Specific Terms

- **Action:** In the Quote Editor (`app/quote/[id].tsx`), add a section **"Terms for this quote"** or **"Additional terms (from recording)"** (or similar).
- **UI:**
  - Show the list of quote-specific terms (from `extraTerms`). If empty or null, show an empty state (e.g. "No extra terms from recording" or hide the section).
  - Each term is editable (e.g. TextInput or inline edit) and removable (e.g. trash icon).
  - Optionally allow **adding** a new quote-specific term manually (e.g. "Add term" button).
- **Behavior:** These terms are **only for this quote**; they do not affect the user’s default/custom terms in Settings.

### Task 34.3: Save Quote-Specific Terms

- **Action:** When the user edits, adds, or removes a quote-specific term, persist via `PATCH /api/quotes/:id` with a body that includes the extra terms (e.g. `{ extraTerms: string[] }`). Use the same field name as the backend.
- **Action:** On blur/save or explicit "Save" for this section, call the PATCH and invalidate the quote query so the UI stays in sync.

### Task 34.4: Translations

- **Action:** Add translation keys in all 5 languages (en, de, he, ar, es), e.g.:
  - `quoteEditor.termsForThisQuote`, `quoteEditor.additionalTermsFromRecording`, `quoteEditor.noExtraTerms`, `quoteEditor.addQuoteTerm`, `quoteEditor.removeQuoteTerm`, `quoteEditor.extraTermsSaved`, `quoteEditor.extraTermsSaveFailed`

### ✅ Validation (Phase 34)

- Record a quote saying e.g. "This price is valid for 30 days" → open the quote → see an extra term like "This price is valid for 30 days" in the "Terms for this quote" section.
- Edit or remove the term and save → PATCH is called and the list updates.
- Add a manual term for this quote only → save → it persists and appears on the PDF for this quote.
- Generate PDF → user’s default/custom terms plus quote-specific extra terms all appear in the Terms section.
- Default terms in Settings are unchanged; only this quote shows the extra terms.

---

## Phase 35: Voice-Extracted Quote Title

**Goal:** When the customer mentions in the voice what the quote is for (e.g. "this is for the construction in Downtown", "for the Smith family kitchen"), use that as the quote’s title. If nothing is mentioned, keep the current behaviour: show "Quote #ID" or "Quote #ID - &lt;client name&gt;".

**Context:** The quote is currently displayed as **Quote #ID** (or **Quote #ID - Client name** when a client is assigned). The user can already set a custom name in the editor (Phase 13). This phase **auto-fills** the quote name from the recording when the speaker describes the project—so the list and header show e.g. "Construction in Downtown" or "Kitchen renovation for Smith family" without the user typing it. The user can still edit or clear the name.

### Task 35.1: Use Quote Name from API Everywhere

- **Action:** Confirm that every place that shows the quote title uses `quote.name` with fallback to `Quote #${quote.id}` (and client name where applicable).
- **Places to check:** Quote Editor header (`app/quote/[id].tsx`), Home dashboard cards (`app/(tabs)/index.tsx`), Quotes tab list (`app/quotes.tsx`), Client quote history (`app/client/[id].tsx`). Logic should be: display `quote.name || \`Quote #${quote.id}\``; when client is present, append " - {clientName}" where appropriate.
- **Note:** Once the backend sets `name` from the extracted title on quote creation, the frontend will show it automatically—no new field required if backend writes into `name`.

### Task 35.2: Optional — "From recording" Hint

- **Action:** If the backend adds a flag such as `nameFromRecording?: boolean` (or equivalent) in `GET /api/quotes/:id` and list responses, show a small hint next to the quote title in the editor (e.g. "From recording" or an icon) when the name was auto-set from the voice, so users know they can edit it. If the backend does not expose this, skip this task.

### Task 35.3: Translations

- **Action:** If any new strings are added (e.g. "From recording"), add translation keys in all 5 languages (en, de, he, ar, es).

### ✅ Validation (Phase 35)

- Record a quote and say e.g. "This is for the construction in Downtown" or "Kitchen renovation for the Smith family" → after processing, the quote appears with that title (e.g. "Construction in Downtown") in the list and in the editor header instead of only "Quote #ID".
- Record a quote without mentioning what it’s for → quote still shows "Quote #ID" (or "Quote #ID - Client" when assigned).
- User can edit or clear the auto-filled name in the Quote Editor; changes persist via existing `PATCH /api/quotes/:id` with `name`.

---

## Phase 36: Create Quote Without Recording (Manual Quote)

**Goal:** Let users create a quote without recording voice. They can start with an empty quote and add all items (and optional name, client, labor hours, etc.) manually in the Quote Editor.

**Context:** Today, quotes are created only via **Record → Upload → Process** (voice). This phase adds a second path: **Create empty quote** → open Quote Editor → add items and details by hand. The existing editor already supports editing items, name, client, labor; we only need a way to create the empty quote and navigate to it.

### Task 36.1: API and Hook for Creating an Empty Quote

- **Action:** Add a way to call the new backend endpoint that creates a quote without audio (e.g. `POST /api/quotes` with optional body `{ name?: string }`). See backend Phase 32.
- **Action:** Create a mutation (e.g. in a hook like `useCreateManualQuote` or extend an existing one) that calls this endpoint and returns the new quote ID (or full quote). On success, invalidate the quotes list cache so the new quote appears.

### Task 36.2: Entry Point in the UI

- **Action:** Add an entry point for "Create quote without recording". Options (choose one or combine):
  - **Home dashboard:** A button or FAB such as "New quote" / "Add quote manually" (in addition to or near the record button) that creates an empty quote and navigates to `/quote/[id]`.
  - **Quotes tab:** A FAB or header button "New quote" that does the same.
- **Action:** On tap, trigger the create-empty-quote API; show a short loading state; on success, navigate to `router.push(\`/quote/${quoteId}\`)` (or equivalent). On error, show an error message (e.g. toast or alert).

### Task 36.3: Quote Editor Behaviour for Manual Quotes

- **Action:** The Quote Editor (`app/quote/[id].tsx`) already supports empty or partial quotes (add items, set name, assign client, labor hours). Ensure that when the quote has no items initially, the UI shows an empty items list and the user can add rows (existing "Add item" or equivalent). No recording-related UI (e.g. "Play recording") should be shown or should be disabled when the quote has no recording; existing behaviour (e.g. audio URL 404) likely already handles this.
- **Action:** Optional: If the backend returns a flag like `hasRecording: boolean` or the frontend infers from absence of audio URL, hide or disable the "Play recording" control for manual quotes.

### Task 36.4: Translations

- **Action:** Add translation keys in all 5 languages (en, de, he, ar, es), e.g.:
  - `home.newQuote`, `home.newQuoteManual`, `quotes.newQuote`, `quotes.createManual`, or similar for the button labels and any tooltips. Add error keys if needed (e.g. `errors.createQuoteFailed`).

### ✅ Validation (Phase 36)

- User taps "New quote" (or equivalent) on Home or Quotes tab → loading → redirect to Quote Editor with a new, empty quote (no items, no recording).
- User adds items manually (name, qty, unit, price), optionally sets quote name, assigns client, labor hours → can save and later "Finalize PDF" / "Regenerate PDF" as with voice-created quotes.
- Manual quote appears in the quotes list and behaves like any other quote (edit, delete, assign client, generate PDF).
- Creating a quote via voice (record → process) still works as before.
