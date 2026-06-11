# Detour — Claude Context

## What This Project Is
A two-sided marketplace connecting international airport layover travelers with Mumbai student guides.
- **Marketing site** (live brand page): self-contained static HTML at `web/marketing/` → deploys to detourtrips.com
- **Old template website**: legacy Vite + Tailwind site at `web/old-template/` (`index.html`, `know-more.html`; superseded by the marketing site)
- **Mobile app**: React Native + Expo 52, file-based routing via Expo Router (`/mobile/`)
- **Backend**: Supabase (auth + database + storage)
- **Design system**: `/design/brand/design-system.md` and `/design/brand/design-handoff-spec.md`

---

## How To Run The App

### iOS Simulator
```bash
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start
# then press `i` in the Expo terminal
# OR one-command:
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start:ios
```
Open iOS Simulator first from Xcode, or run: `open -a Simulator`

### Android Emulator
```bash
# First add SDK paths to shell:
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH

npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start
# then press `a` in the Expo terminal
# OR one-command:
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start:android
```
Start an emulator from Android Studio → Device Manager first.

---

## Current State (updated 2026-06-11)

The app is far further along than the old TODO list here suggested. What exists and works:

- **25-state booking lifecycle** — pure reducer in `mobile/lib/booking/stateMachine.ts`,
  mirrored in `supabase/functions/_shared/stateMachine.ts`. Money in integer paise,
  DB-enforced invariants, snapshot tests for agreements/cancellation/reconciliation
  (`mobile/lib/booking/__tests__/`, 238 tests).
- **Razorpay payments** — Edge Functions for deposit/balance/top-up orders, webhook with
  signature verification, refunds/payouts (stub gracefully when live keys are absent).
  NOT deferred anymore.
- **pg_cron lifecycle drivers** — balance reminders, late-fee assessment, T-12 no-pay
  cancel, deposit-window expiry, proofs-overdue nudge, rating link, deposits-held sweep
  (`supabase/migrations/20260512*` + `20260611*`).
- **Push notifications** — client token registration + `send-push` Edge Function, drained
  every minute by `cron_send_pending_pushes` via pg_net.
- **CTA mapping** — `mobile/lib/booking/cta.ts`, centralized per state × viewer.
- **Admin console** (`/admin/`) — users, bookings, revenue, SOS events (local-only).
- 45+ screens/components across traveler/guide/shared flows.

### Open work (see APP_REVIEW.md for the full prioritized review)
- **Commission rate decision** — `COMMISSION_RATE=0.25` in `mobile/config/constants.ts`;
  Task 7 spec said 15%. Still awaiting Gaurav's call. Model a sample ₹2,000 trip
  end-to-end first (the stack is 25% commission + 12.5% down + 12.5% up + 1% TDS).
- **Marketing-site pricing vs. app** — site promises "no service fee" in early access;
  the app charges platform fees. Needs an `EARLY_ACCESS` flag or softer site copy.
- **No-show event** — `trip_ready` persists forever if the QR is never scanned;
  needs a `no_show` event + money rule (product decision pending).
- **Dispute lifecycle** — `disputed` is terminal; no dispute window after `completed`;
  `reconciling` has no failure path; admin console has no dispute-resolution action.
- **Guide verification capture** — `is_verified` is a bare boolean; no college-ID upload.
- **P1s** — visa checklist + reminders, in-app SOS button (admin reads `sos_events` but
  nothing writes them), guide earnings dashboard, availability calendar.
- Google Maps API key wiring; CI/CD pipeline.

---

## Project Structure
```
mumbai-buddies/
├── web/
│   ├── marketing/              # LIVE marketing site (static HTML) → detourtrips.com
│   │   ├── index.html          # Detour brand/story page (inline CSS/SVG)
│   │   ├── images/             # web-optimized Mumbai photos
│   │   └── vercel.json         # static deploy config
│   └── old-template/           # legacy Vite + Tailwind site (superseded)
│       ├── index.html          # old marketing landing page
│       ├── know-more.html      # old deep-dive info page
│       ├── src/style.css       # custom CSS + Tailwind directives
│       ├── tailwind.config.js  # Tailwind config
│       └── vite.config.js      # Vite build config
├── mobile/                     # React Native + Expo app
│   ├── app/                    # Expo Router screens (45+ screens/components)
│   │   ├── _layout.tsx         # Root auth routing logic
│   │   ├── (auth)/             # Login, signup, forgot-password
│   │   ├── (traveler)/         # Browse, search, book, trips, live map
│   │   ├── (guide)/            # Dashboard, requests, profile, itineraries
│   │   └── (shared)/           # Messages
│   ├── components/ui/          # Button, Card, Badge, Input, Loading, etc.
│   ├── components/guides/      # GuideCard
│   ├── components/bookings/    # BookingCard
│   ├── lib/api/                # guides.ts, bookings.ts, payments.ts, etc.
│   ├── lib/booking/            # State machine, CTA map, money snapshots + tests
│   ├── lib/hooks/              # useAuth.ts, useMessages.ts
│   ├── config/theme.ts         # Design tokens (colors, spacing, shadows)
│   ├── config/constants.ts     # Business rules
│   ├── types/index.ts          # All TypeScript models
│   └── .env.local.example      # Required env vars
├── supabase/                   # Backend: schema, RLS, crons, Edge Functions
│   ├── migrations/             # Schema + pg_cron lifecycle drivers
│   ├── functions/              # Deno Edge Functions (payments, webhook, push, QR…)
│   │   └── _shared/            # stateMachine mirror, razorpay client, deposit flow
│   └── seed.sql                # Mumbai demo data
├── admin/                      # Local-only solo-admin console (Vite+React+Tailwind)
│   ├── src/pages/              # Users, Bookings, Revenue, SOS
│   ├── src/components/         # Shell, Login, DataTable, StatusBadge, PageHeader
│   ├── src/lib/                # supabase client (service role), auth gate, format helpers
│   ├── .env.local.example      # VITE_SUPABASE_URL / SERVICE_KEY / ADMIN_PASSWORD
│   └── README.md               # Setup + security notes (do NOT deploy publicly)
├── design/
│   ├── brand/design-system.md       # Color palette, typography, animation specs
│   ├── brand/design-handoff-spec.md # Component specs with copy-paste code
│   └── ui-mockups/                  # HTML prototypes (reference only)
└── CLAUDE.md                   # This file
```

### Admin panel (`/admin/`)
- Runs on `127.0.0.1:5174` — separate from the marketing site (`5173`).
- Password-gated (`VITE_ADMIN_PASSWORD`), session-scoped auth.
- Uses the Supabase **service role** key and bypasses RLS. Local-only; never deploy as-is.
- Day-1 screens: Users (role filter), Bookings (status filter + joined names), Revenue (7d/30d/90d/all-time; earned vs pipeline), SOS events (Acknowledge/Resolve actions + Google Maps link).
- No guide-approval queue — guides auto-approve per product spec.

Run: `cd admin && npm install && cp .env.local.example .env.local` then fill in env vars and `npm run dev`.

---

## Design System Quick Reference

**Colors (v3 "Warm Editorial" — paper/ink, ported 1:1 from the marketing site):**
- Primary: Terracotta `#C8542A` / Dark `#9E3A1F` / Light `#F7DECC`
- Accent: Sea Blue `#2D7BA9` / Dark `#1F5B7E` / Light `#C9DEEB`
- Marigold (highlights): `#E89F2C` / Light `#FBEACB`
- Background: Paper `#F4EDDD` (cards `#FCF7EA`, insets `#EBE0C5`, lines `#C5BA9C`)
- Text: Ink `#0E1929` (secondary `#445169`, muted `#7C8597`)
- Extras: Taxi Yellow `#F4C430`, Pink `#D4347A`, Green `#3D8B5A`, Purple `#6C5CE7`

**Fonts (registered in `app/_layout.tsx`, splash held until loaded):**
- Display: Bricolage Grotesque (600/700/800)
- Serif accents: Instrument Serif
- Body: Plus Jakarta Sans (400–700)
- Mono labels/prices: DM Mono (400/500)

**Animation pattern (spring):**
- Button press: `scale(0.96)`, spring `damping: 15, stiffness: 150`
- Card tap: `scale(0.97)`, `translateY(-2px)` on press

**Key theme file:** `mobile/config/theme.ts` (token keys unchanged from v2 — only values moved).
There is also a `design-preview` gallery screen for eyeballing tokens/components.

---

## Environment Variables Needed
See `mobile/.env.local.example`. Create `mobile/.env.local` with:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_RAZORPAY_KEY_ID=       # payments live; Edge Functions stub when absent
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=   # deferred
```

---

## Tech Stack Summary
- **Web:** Vite 5, Tailwind CSS 3, Vanilla JS
- **Mobile:** React Native 0.76, Expo 52, Expo Router 4, TypeScript 5.3
- **Styling:** NativeWind 4 (Tailwind for RN)
- **Animations:** React Native Reanimated 3
- **State:** Zustand 4
- **Backend:** Supabase JS v2 (+ Deno Edge Functions, pg_cron, pg_net)
- **Payments:** Razorpay — orders/webhook/refunds implemented; stubs without live keys
- **Maps:** react-native-maps 1.18, expo-location
