# VoiceQuote Design System & Visual Guidelines

**Theme:** "Clean Industrial SaaS"
**Inspiration:** ServiceTitan, Linear Mobile, Modern Fintech.
**Mode:** Light Mode Only (High readability in sunlight).

## Color Palette (NativeWind / Tailwind)

- **Background:** `bg-slate-50` (Main), `bg-white` (Cards).
- **Primary Text:** `text-slate-900` (Headers), `text-slate-600` (Body).
- **Primary Brand:** `bg-slate-900` (Buttons, Headers).
- **Accent / Action:** `bg-orange-600` (Record Button, Call-to-Actions).
- **Borders:** `border-slate-200`.

---

## Screen 1: Auth (Sign In)

- **Layout:** Clean white center card on a soft slate background.
- **Elements:**
  - Logo: Simple Text "VoiceQuote" (Bold, Slate-900).
  - Title: "Welcome back, Pro."
  - Inputs: Large, rounded-lg, gray border.
  - Button: Full width, Slate-900, "Sign In".
  - Social: "Sign in with Google" (White button, gray border).

## Screen 2: Home Dashboard (The Recorder)

- **Header:**
  - Left: "Good Morning, [Name]" (text-2xl font-bold text-slate-900).
  - Right: Small circular Avatar.
- **Stats Row (Top):**
  - 3 Horizontal Cards: "Active Jobs", "Pending", "Completed".
  - Style: White bg, shadow-sm, rounded-xl, padding-4.
- **Hero Section (Center):**
  - The **Record Button**: A massive (w-32 h-32) circle.
  - Color: `bg-slate-900` (Idle) -> `bg-orange-600` (Recording).
  - Icon: White Microphone (Lucide `Mic`).
  - Feedback: When recording, show a pulsing ring animation or "00:12" text below.
- **List (Bottom):**
  - Title: "Recent Jobs".
  - Items: Simple white cards. Left: Job Name (Bold). Right: Status Badge (Green "Sent" / Gray "Draft").

## Screen 3: Quote Editor (The "Invoice" Look)

- **Vibe:** Should look like a physical piece of paper.
- **Container:** `bg-white`, `rounded-xl`, `shadow-sm`, `mx-4`, `my-4`.
- **Header Section:**
  - "Quote #123" (Large).
  - Date (Small gray).
- **Client Section:**
  - A distinct box. If empty: Dotted border + "Select Client" (Blue text).
  - If filled: Solid border + Name/Address.
- **Line Items Table:**
  - Header Row: "Item", "Qty", "Price" (text-xs uppercase text-slate-400).
  - Rows: `flex-row`, `border-b border-slate-100`, `py-3`.
  - Inputs: Make them look seamless (no heavy borders), just text fields.
- **Footer:**
  - "Total": Text-xl Bold Slate-900.
  - Action Button: "Finalize PDF" -> Full width, `bg-orange-600`, rounded-lg.

## Screen 4: Clients List

- **Search:** Top bar, gray background (`bg-slate-100`), rounded-full.
- **List Items:**
  - Left: Circle Avatar (Gray bg, Initials).
  - Middle: Name (Bold), Company (Small).
  - Right: Arrow icon.
- **FAB (Floating Action Button):**
  - Bottom Right fixed.
  - `bg-slate-900`, `rounded-full`, `w-14 h-14`.
  - Icon: White Plus.

## Components Style Guide

- **Buttons:** `h-12`, `rounded-lg`, `font-semibold`.
- **Inputs:** `h-12`, `bg-white`, `border border-slate-200`, `rounded-lg`, `px-4`.
- **Cards:** `bg-white`, `rounded-xl`, `p-4`, `shadow-sm`, `border border-slate-100`.
- **Icons:** Use `lucide-react-native`. Size usually 20 or 24.
