# Apple Submission Readiness Audit

Date: 2026-02-22  
Scope: iOS App Store submission readiness review  
Status: Not submission-ready

This document captures the current high-risk findings and exact remediation steps.

---

## 1) Likely Rejection (Guideline 4.8): Google login exists, Apple login does not

- Severity: Critical
- Evidence:
1. `app/auth/sign-in.tsx` used `oauth_google` and rendered Google-only social login.
2. No Apple auth integration in auth UI/native config at time of audit.
- Impact:
1. If Google/third-party login is offered as primary auth, Apple commonly requires Sign in with Apple unless a specific exception applies.
- Resolution:
1. Add native Apple auth button on iOS sign-in screen.
2. Integrate Clerk Apple flow (`useSignInWithApple`) and handle cancel/error cases.
3. Add native dependency/config (`expo-apple-authentication`, `expo-crypto`, iOS config/plugin).
4. Configure Apple SSO in Clerk and bind native app with correct Team ID + Bundle ID.
5. Validate on iOS dev/TestFlight build (not Expo Go).
- Acceptance criteria:
1. iOS sign-in screen shows Apple option.
2. Apple login succeeds and creates/uses Clerk session.
3. App passes manual auth smoke test for email/password, Google, Apple.
- Status: Completed (validated on TestFlight build)

---

## 2) Potential Rejection/Runtime Failure: Photo-library permission declaration not explicit

- Severity: High
- Evidence:
1. `app/(tabs)/settings.tsx` requests media library permission.
2. `app.json` only declared microphone usage description at time of audit.
- Impact:
1. Missing iOS usage descriptions can cause permission prompt failures/crashes and review rejection.
- Resolution:
1. Add iOS `Info.plist` permission strings for photo library access and add-only access as needed.
2. Verify permission request path and behavior on iOS.
3. Confirm there is no unused or misleading permission text.
- Suggested keys:
1. `NSPhotoLibraryUsageDescription`
2. `NSPhotoLibraryAddUsageDescription`
- Acceptance criteria:
1. Permission prompt appears with correct text.
2. Selecting/uploading logo works on iOS without crash.
- Status: In progress (Info.plist keys added; device permission-flow verification pending)

---

## 3) High Accessibility Risk: Touch targets below 44x44

- Severity: High
- Evidence:
1. Multiple controls sized around `40x40`, e.g. add/filter/back/delete icon buttons.
- Impact:
1. Increases mis-taps and fails Apple HIG accessibility expectations.
- Resolution:
1. Standardize icon-button minimum size to `44x44` (or larger).
2. Ensure edge spacing prevents accidental taps in dense headers.
3. Keep visual icon size independent from target size.
- Acceptance criteria:
1. All tappable controls meet `>=44x44`.
2. No key action relies on tiny tap areas.
- Status: Completed (primary controls remediated to >=44pt targets)

---

## 4) High Accessibility Risk: Missing accessibility labels on icon-only buttons

- Severity: High
- Evidence:
1. Only a few controls had `accessibilityLabel`/`accessibilityRole`.
2. Many icon-only actions in headers/tabs/cards lacked labels.
- Impact:
1. VoiceOver announces generic or unclear controls, reducing usability and risking accessibility rejection feedback.
- Resolution:
1. Add `accessibilityLabel` to all icon-only controls.
2. Add `accessibilityHint` where behavior is destructive or non-obvious.
3. Ensure `accessibilityRole="button"` is set consistently.
- Acceptance criteria:
1. VoiceOver traversal reads meaningful action names for every icon-only control.
2. Destructive actions clearly announce intent.
- Status: Completed in code (labels/roles added on icon-only controls; VoiceOver walkthrough pending)

---

## 5) High Readability/Contrast Risk: Low-contrast small text

- Severity: High
- Evidence:
1. Very small labels (for example around 11px) with low-contrast slate shades on white.
2. Contrast observed around ~2.56:1 in impacted area, below normal text target.
- Impact:
1. Poor readability and accessibility failure risk.
- Resolution:
1. Increase small labels to readable size (practically 12-13+ with sufficient weight).
2. Raise contrast to meet at least 4.5:1 for normal text.
3. Recheck all low-emphasis text styles in cards/tab labels/meta labels.
- Acceptance criteria:
1. No critical label below readable size/contrast threshold.
2. Contrast checks pass for normal text in key screens.
- Status: Completed in code (critical text size/contrast remediated on key screens; final on-device spot check pending)

---

## 6) Major Product Quality Issue: Client detail totals inconsistent with quote grand total

- Severity: High (Product trust)
- Evidence:
1. Client history surfaces `quote.totalCost` (materials-only).
2. Backend client aggregate also sums `totalCost`.
- Impact:
1. Home/quotes may show grand totals while client history shows materials-only totals, creating trust-damaging inconsistency.
- Resolution:
1. Define one canonical total model for list/detail/history (grand total including labor/tax rules).
2. Either persist grand total on quote or compute consistently server-side for all read endpoints.
3. Update client history and client aggregate endpoints to use same total logic.
4. Add regression tests for totals across screens.
- Acceptance criteria:
1. Same quote shows same displayed total in Home, Quotes, Client history, Quote detail, and PDF context rules.
2. Aggregate client total matches sum of displayed quote totals.
- Status: Completed in code (client quote-history endpoint now returns canonical grand totals and aggregate total value)

---

## 7) Localization/UX Quality Gaps: Hardcoded locale and non-translated strings

- Severity: Medium
- Evidence:
1. Hardcoded date locale `en-US` in multiple screens.
2. Hardcoded English snippets (for example “by date”, restart text, URL error fragments).
- Impact:
1. Mixed-language UI and US date formatting in non-English locales degrade polish and credibility.
- Resolution:
1. Replace hardcoded date locale with active i18n language or device locale.
2. Move all user-facing strings to i18n JSON keys.
3. Verify pluralization and RTL-sensitive strings.
- Acceptance criteria:
1. No user-facing hardcoded English text in app screens.
2. Dates and number formatting follow selected language/locale.
- Status: Completed in code (date formatting now follows selected app locale and hardcoded UI strings moved to i18n keys)

---

## 8) Engineering Health: TypeScript build failures

- Severity: Medium (Release reliability)
- Evidence:
1. `npx tsc --noEmit` fails.
2. Errors observed in:
   - `app/quote/[id].tsx`
   - `components/Skeleton.tsx`
   - `src/hooks/useCreateQuote.ts`
- Impact:
1. Type regressions can hide runtime bugs and reduce release confidence.
- Resolution:
1. Fix nullable mismatch in quote labor rate mutation path.
2. Fix skeleton style typing (`width` typing compatibility).
3. Update `expo-file-system` info options usage for current type signature.
4. Add CI check for `tsc --noEmit`.
- Acceptance criteria:
1. `npx tsc --noEmit` passes cleanly.
2. CI blocks merges on TS errors.
- Status: Completed (`npx tsc --noEmit` passes)

---

## 9) Release-Config Risk: Insecure/default API URL fallback

- Severity: Medium
- Evidence:
1. API client defaults to `http://localhost:3000`.
2. Local `.env` uses LAN HTTP URL.
- Impact:
1. Misconfigured release env can break networking in review and violate ATS expectations.
- Resolution:
1. Remove insecure localhost fallback for production paths.
2. Enforce HTTPS API URL in production builds.
3. Add startup/runtime guard if API URL is missing in release.
4. Add ATS exceptions only if absolutely required and justified.
- Acceptance criteria:
1. Production build always points to HTTPS backend.
2. No accidental localhost fallback in release.
- Status: Completed in code (production API URL is now required and validated as public HTTPS; localhost/LAN fallback is dev-only)

---

## Execution Order (recommended)

1. Guideline blockers: Apple login + iOS photo permissions.
2. Accessibility blockers: touch targets + labels + contrast.
3. Trust-critical math consistency.
4. Localization cleanup.
5. TypeScript health and release-config hardening.

---

## Tracking Checklist

- [x] Apple login fully compliant and validated on iOS build.
- [ ] Photo library permission keys configured and tested.
- [x] All primary controls meet 44x44 target size.
- [x] Icon-only controls have accessibility labels/roles/hints.
- [x] Critical text contrast and size remediated.
- [x] Totals consistent across all surfaces.
- [x] Hardcoded locale/strings removed.
- [x] `npx tsc --noEmit` passes.
- [x] Production API configuration hardened (HTTPS, no localhost fallback).
