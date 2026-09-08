# Detour — Claude Context

> Last verified: 2026-09-05 (against `main` @ `d2a94f7`).

## What This Project Is
A two-sided marketplace connecting international airport layover travelers with Mumbai student guides.

This is an **npm-workspaces monorepo** (Turborepo for task orchestration). Packages:
- **Mobile app**: React Native + Expo 52, file-based routing via Expo Router — `apps/mobile/` (`@detour/mobile`)
- **Admin console**: Admin 2.0 — hosted Vite 8 + React 18 + Tailwind operations console, deployed at `detour-admin.vercel.app` — `apps/admin/` (`@detour/admin`)
- **Marketing site**: Astro 7 static site with bounded Sanity content — `apps/marketing/` (`@detour/marketing`) → deploys to detourtrips.com
- **Content Studio**: isolated Sanity + React 19 application — `apps/studio/`; its own lockfile prevents React 19 from being hoisted into Expo/admin
- **Backend**: Supabase (auth + database + storage + Deno edge functions) — `supabase/` at the repo root (CLI expects `./supabase`)
- **Shared libraries**: `packages/config` (`@detour/config`) and `packages/database` (`@detour/database`)
- **Design system**: `design/brand/detour-design-philosophy.md` (current v3) and `design/brand/design-handoff-spec.md`; `design/brand/design-system.md` is the superseded v2 saffron palette

`apps/mobile`, `apps/admin`, and `apps/marketing` share **one Supabase project**. All browser
clients use an anon key. Admin-only reads and commands run behind authenticated,
role-checked Edge Functions (`admin-api`, `admin-growth-report`); never put a
service-role or Google credential in a `VITE_*` / `EXPO_PUBLIC_*` variable. See
`docs/technical/ADR-003-admin-control-plane-growth-publishing.md`.

---

## How To Run The App

Install the React 18 workspaces at the root, then the isolated React 19 Studio:
```bash
npm install
npm install --prefix apps/studio
```

### iOS Simulator
```bash
npm run mobile:ios          # = expo start --ios in apps/mobile
# OR: npm run mobile  then press `i`
```
Open iOS Simulator first from Xcode, or run: `open -a Simulator`

### Android Emulator
```bash
# First add SDK paths to shell:
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH

npm run mobile:android      # = expo start --android in apps/mobile
# OR: npm run mobile  then press `a`
```
Start an emulator from Android Studio → Device Manager first.

### Admin console
```bash
npm run admin               # Vite dev server at http://127.0.0.1:5174
```

### Marketing site
```bash
npm run dev --workspace @detour/marketing   # Astro at http://127.0.0.1:8791
```

### Sanity Studio
```bash
npm run studio              # http://127.0.0.1:3333
npm run studio:test
npm run studio:build
```

### Repo-wide checks (Turborepo)
```bash
npm run type-check          # tsc across workspaces
npm run lint
npm run test                # mobile Jest suite
npm run test:edge           # Deno tests for supabase/functions
npm run build               # production builds
npm run security:admin-bundle   # scan built admin bundle for secrets (pre-release gate)
```

---

## Current Priorities

The April-era TODOs (schema fixes, seed data, smoke test, booking UI, business
constants) are all **done** — see git history and `docs/project/SMOKE_TEST_RESULTS.md`.
The live roadmap is **`docs/project/NEXT_TASKS.md`**; deferred items with
runbooks are in `docs/project/DEFERRED.md`. Headline open items:

1. **PR #55** — trip-fit / party-shape / split-pricing (+4.5k lines, stale): rebase or close.
2. **Admin 2.0 config** — 10 provider steps in `docs/technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md`.
3. **16 SEO place pages** on `archive/static-marketing-seo` → port into Astro (route parity 12→28).
4. **Commission rate** — 25% in code vs 15% in old docs: **undecided, owner decision needed** before real users (agreement snapshots freeze rates at signing).
5. **Pre-launch** — Razorpay live keys (blocked on company registration/GST), push enablement, Google Maps key, `@detour/types` extraction + state-machine dedup.

### Notes that are still true
- `apps/mobile/app/(traveler)/trips/live/[id].native.tsx` is the native map variant; web falls back via a Metro stub (`apps/mobile/metro.config.js`). Native maps need `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Razorpay checkout is wired via `apps/mobile/lib/api/razorpayCheckout.ts` (native sheet wrapper; orders created server-side by edge functions; used by `deposits.ts`/`balance.ts`/`topUp.ts`). Remaining: live keys + payouts (see `docs/project/DEFERRED.md`).
- `@detour/config` (theme + constants) is extracted; `apps/mobile/config/*` files are re-export shims. **Still TODO:** extract `@detour/types` — it's coupled to `BookingState` from `apps/mobile/lib/booking/stateMachine.ts`, so do it together with de-duplicating the booking state machine mirrored between `apps/mobile/lib/booking/` and `supabase/functions/_shared/`.

---

## Project Structure
```
detour/                          # npm-workspaces monorepo root (package.json + turbo.json)
├── apps/
│   ├── mobile/                  # @detour/mobile — React Native + Expo app
│   │   ├── app/                 # Expo Router screens
│   │   │   ├── _layout.tsx      # Root auth routing logic
│   │   │   ├── (auth)/          # Login, signup, forgot-password
│   │   │   ├── (traveler)/      # Browse, search, book, trips, live map
│   │   │   ├── (guide)/         # Dashboard, requests, profile, itineraries
│   │   │   └── (shared)/        # Messages
│   │   ├── components/          # ui/, guides/, bookings/
│   │   ├── lib/api/             # guides.ts, bookings.ts, deposits.ts, razorpayCheckout.ts, earnings.ts, …
│   │   ├── lib/booking/         # state machine + snapshots (mirrored in edge fns)
│   │   ├── config/              # re-export shims → @detour/config (+ app-local LEGAL URLs)
│   │   ├── types/index.ts       # TypeScript models
│   │   ├── metro.config.js      # monorepo-aware Metro (watchFolders + nodeModulesPaths)
│   │   └── .env.local.example   # EXPO_PUBLIC_SUPABASE_* etc.
│   ├── admin/                   # @detour/admin — hosted Vite+React+Tailwind console
│   │   ├── src/pages/           # Overview, Operations, Marketplace, TrustSafety, Money, Growth, Platform
│   │   ├── src/lib/             # anon Supabase Auth client + typed admin API
│   │   ├── tests/               # security-boundary test (node --test)
│   │   └── .env.local.example   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
│   ├── marketing/               # @detour/marketing — Astro static site → detourtrips.com
│   │   ├── src/pages/           # [...slug].astro, 404.astro, sitemap.xml.ts
│   │   ├── src/content/pages/   # JSON page manifests (12 routes)
│   │   ├── src/legacy/          # checked-in legacy HTML parity sources
│   │   ├── public/              # optimized media and static downloads
│   │   ├── scripts/check-route-parity.mjs
│   │   └── vercel.json          # static deploy config
│   └── studio/                  # @detour/studio — Sanity Studio, React 19, own lockfile
│       ├── schemaTypes/         # guide + landingPage documents; faq/media/seo/sourceLink/testimonial objects
│       └── docs/publishing.md
├── packages/
│   ├── config/                  # @detour/config — theme (v3) + business constants
│   └── database/                # @detour/database — generated DB types (browser-safe re-export)
├── supabase/                    # migrations (60+), 24 edge functions (Deno), seed.sql — shared backend
├── marketing-ops/               # marketing strategy, templates, SEO docs (non-code)
├── design/                      # brand system, design tokens, UI mockups
├── docs/                        # project / technical / business / financial / legal / product docs
├── scripts/                     # one-off operational SQL + repo utility scripts
├── package.json                 # workspaces + turbo + consolidated overrides
├── turbo.json
└── CLAUDE.md                    # This file
```

### Admin console (`apps/admin/`)
- Runs on `127.0.0.1:5174` locally; production at `https://detour-admin.vercel.app` (permanent domain `admin.detourtrips.com` pending DNS — runbook step 2).
- Uses Supabase Auth, TOTP MFA (code-complete; `ADMIN_REQUIRE_MFA=false` until runbook step 3), and `admin_memberships` roles (`owner` / `operations` / `finance` / `growth`). The browser has only the anon key; privileged access stays inside Edge Functions and audited RPCs.
- Navigation: Overview, Operations, Marketplace, Trust & Safety, Money, Growth, Platform.
- No guide-approval queue — guides auto-approve per product spec.

Run: `npm install` (root) then `cp apps/admin/.env.local.example apps/admin/.env.local`, fill env vars, and `npm run admin`.

---

## Design System Quick Reference

**Colors (v3 "Warm Editorial" — paper/ink, shared by the app and detourtrips.com):**
- Canvas: Paper `#F4EDDD` / Paper Light `#FCF7EA` (cards) / Paper Deep `#EBE0C5` (insets) / hairline `#C5BA9C`
- Text: Ink `#0E1929` / Ink Muted `#445169` / Ink Soft `#7C8597`
- Primary CTA: Terracotta `#C8542A` / Dark `#9E3A1F` / Light tint `#F7DECC`
- Secondary: Sea `#2D7BA9` (links/info) · Marigold `#E89F2C` (ratings/warnings)
- Success `#3D8B5A` · Error `#C0392B` · Purple (badges) `#6C5CE7`

**Fonts:** Display — Bricolage Grotesque · Body — Plus Jakarta Sans · Editorial pull quotes — Instrument Serif · Eyebrows/Prices — DM Mono

**Animation (spring):** Button press `scale(0.96)` `damping:15, stiffness:150`; Card tap `scale(0.97)`, `translateY(-2px)`.

**Key theme file:** `packages/config/theme.ts` (`@detour/config`; `apps/mobile/config/theme.ts` is a re-export shim). Full philosophy: `design/brand/detour-design-philosophy.md`. The older `design/brand/design-system.md` documents the superseded v2 saffron palette.

---

## Environment Variables Needed
Create `apps/mobile/.env.local` (see `apps/mobile/.env.local.example`):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_RAZORPAY_KEY_ID=       # test key; live keys blocked on company registration
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=   # needed for the native live-map variant
```
Admin needs `apps/admin/.env.local` with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Provider and service credentials are server-side
Supabase function secrets (see `supabase/.env.local.example`).

---

## Tech Stack Summary
- **Monorepo:** npm workspaces + Turborepo
- **Mobile:** React Native 0.76, Expo 52, Expo Router 4, TypeScript 5.x
- **Styling:** NativeWind 4 (Tailwind for RN) · **Animations:** Reanimated 3 · **State:** Zustand 4
- **Admin/Marketing web:** Vite 8 + React 18 (admin); Astro 7 static output + optional Sanity content (marketing); Sanity 6 + React 19 (studio)
- **Backend:** Supabase JS v2, Postgres (RLS + pg_cron), Deno edge functions
- **Payments:** Razorpay — checkout wired in test mode; live payouts/refunds behind `RAZORPAY_LIVE_FEATURES_ENABLED` · **Maps:** react-native-maps 1.18, expo-location
- **Push:** Expo Push via `send-push` edge function draining the `notifications` table — pipeline built, pending enablement
