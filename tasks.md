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
