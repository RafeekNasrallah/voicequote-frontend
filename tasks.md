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
  - Create a custom UI (NOT the pre-built component) matching `DESIGN.md`.
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
- **Reference:** See `DESIGN.md` -> "Home Dashboard".
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
- **Reference:** See `DESIGN.md` -> "Quote Editor".

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
