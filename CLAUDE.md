# Detour — Claude Context

## What This Project Is
A two-sided marketplace connecting international airport layover travelers with Mumbai student guides.

This is an **npm-workspaces monorepo** (Turborepo for task orchestration). Packages:
- **Mobile app**: React Native + Expo 52, file-based routing via Expo Router — `apps/mobile/` (`@detour/mobile`)
- **Admin console**: local-only Vite + React + Tailwind — `apps/admin/` (`@detour/admin`)
- **Marketing site** (live brand page): self-contained static HTML at `apps/marketing/` (`@detour/marketing`) → deploys to detourtrips.com
- **Backend**: Supabase (auth + database + storage + Deno edge functions) — `supabase/` at the repo root (CLI expects `./supabase`)
- **Shared libraries**: `packages/*` (`@detour/*`)
- **Design system**: `design/brand/design-system.md` and `design/brand/design-handoff-spec.md`

`apps/mobile` and `apps/admin` share **one Supabase project** (mobile uses the anon key under RLS; admin uses the service-role key). See `docs/technical/ADR-002-monorepo-workspaces.md`.

---

## How To Run The App

Install once at the repo root (single lockfile, all workspaces):
```bash
npm install
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

### Repo-wide checks (Turborepo)
```bash
npm run type-check          # tsc across workspaces
npm run lint
npm run test                # mobile Jest suite
npm run test:edge           # Deno tests for supabase/functions
npm run build               # production builds
```

---

## Immediate TODOs (Priority Order)

> Paths below were updated for the monorepo move (`mobile/` → `apps/mobile/`, live
> marketing site is `apps/marketing/`). The legacy Vite template `web/old-template/`
> was removed, so TODOs that referenced its `index.html` / `know-more.html` /
> `src/style.css` no longer apply — re-check them against `apps/marketing/`.

### 1. ✅ Fix API 400 Errors — Schema/Query Mismatch (DONE)
All queries in `apps/mobile/lib/api/` are aligned to the schema. `is_published` used correctly.

### 2. ✅ Seed Mumbai Demo Data (DONE)
`supabase/seed.sql` has 5 guides, 15 itineraries, 6 bookings, 5 reviews, 6 messages.

### 3. ✅ End-to-End Smoke Test (DONE 2026-04-14)
See `docs/project/SMOKE_TEST_RESULTS.md`. Five bugs found and fixed:
- **Fixed:** Missing `bookings` UPDATE RLS policy (guides/travelers can now update)
- **Fixed:** Missing `itinerary_stops` public read policy (travelers see stops)
- **Fixed:** `payment_status` enum extended for Razorpay lifecycle values
- **Fixed:** Guide names now resolved from `users.full_name` via JOIN
- **Fixed:** `review.rating` mapped from `overall_rating` DB column
Migration: `supabase/migrations/20260414_rls_fixes.sql`

### 3b. ✅ Task 7 — Business Logic Constants (DONE 2026-04-14)
Added to `apps/mobile/config/constants.ts`: `ESTIMATED_EXPENSES_PERCENT=30`, `MIN_BOOKING_NOTICE_HOURS=4`, `MAX_BOOKING_ADVANCE_DAYS=90`, `CURRENCY='INR'`, `CURRENCY_SYMBOL='₹'`.
**NOTE:** `COMMISSION_RATE` stays at 25% pending Gaurav's confirmation (`docs/project/NEXT_TASKS.md` Task 7 says 15%).

### 3c. ✅ Task 1 — Booking Flow UI (DONE 2026-04-14)
Rewrote `apps/mobile/app/(traveler)/book/[guideId].tsx` to match spec (guide hero header, horizontal itinerary cards, arrival/departure/flight inputs, price breakdown, coral confirm button with haptics, skeleton loading, inline errors).

### 4. Restore Native Map Experience
- `apps/mobile/app/(traveler)/trips/live/[id].tsx` has a `.native.tsx` variant for maps
- Ensure `react-native-maps` is properly configured for iOS (needs Google Maps API key)
- Keep web fallback working (Metro stubs `react-native-maps` on web — see `apps/mobile/metro.config.js`)

### 5. Cosmetic Alignment — Marketing Site ↔ Design System
Verify `apps/marketing/` matches the saffron-led design system (Saffron `#F97316`, Bougainvillea Pink `#EC4899`, fonts Plus Jakarta Sans / Inter / DM Sans). The recent marketing rebuild largely addressed this; confirm against `design/brand/design-system.md`.

### 6. Marketing Site Placeholders
Confirm no placeholder values remain in `apps/marketing/` (production booking URL, real WhatsApp/Instagram/X handles). The rebuilt site appears to use real links — verify before launch.

### 7. Image & Video Assets
Confirm hero/gallery/testimonial images and any video assets resolve in `apps/marketing/` (no 404s).

### 8. Deferred (Do Later)
- Razorpay payment integration (`apps/mobile/lib/api/payments.ts` stub exists)
- Google Maps API key wiring
- Push notifications setup
- Extract shared `@detour/types` / `@detour/config` packages (see ADR-002) and de-duplicate the booking state-machine logic that is currently mirrored between `apps/mobile/lib/booking/` and `supabase/functions/_shared/`

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
│   │   ├── lib/api/             # guides.ts, bookings.ts, payments.ts, etc.
│   │   ├── lib/booking/         # state machine + snapshots (mirrored in edge fns)
│   │   ├── config/theme.ts      # Design tokens (colors, spacing, shadows)
│   │   ├── config/constants.ts  # Business rules
│   │   ├── types/index.ts       # TypeScript models
│   │   ├── metro.config.js      # monorepo-aware Metro (watchFolders + nodeModulesPaths)
│   │   └── .env.local.example   # EXPO_PUBLIC_SUPABASE_* etc.
│   ├── admin/                   # @detour/admin — local-only Vite+React+Tailwind console
│   │   ├── src/pages/           # Users, Bookings, Revenue, SOS
│   │   ├── src/lib/             # supabase client (service role), auth gate, helpers
│   │   └── .env.local.example   # VITE_SUPABASE_URL / SERVICE_KEY / ADMIN_PASSWORD
│   └── marketing/               # @detour/marketing — static site → detourtrips.com
│       ├── index.html           # Detour brand/story page
│       ├── guides/              # SEO layover-guide cluster
│       ├── assets/              # site.css, booking.js, utm.js
│       ├── images/              # web-optimized Mumbai photos
│       └── vercel.json          # static deploy config
├── packages/                    # shared internal libraries (@detour/*)
├── supabase/                    # migrations, edge functions (Deno), seed.sql — shared backend
├── marketing-ops/               # marketing strategy, templates, SEO docs (non-code)
├── design/                      # brand system, design tokens, UI mockups
├── docs/                        # project / technical / business / financial / legal docs
├── scripts/                     # one-off operational SQL (auth_sync.sql)
├── package.json                 # workspaces + turbo + consolidated overrides
├── turbo.json
└── CLAUDE.md                    # This file
```

### Admin panel (`apps/admin/`)
- Runs on `127.0.0.1:5174`. Password-gated (`VITE_ADMIN_PASSWORD`), session-scoped auth.
- Uses the Supabase **service role** key and bypasses RLS. Local-only; never deploy as-is.
- Day-1 screens: Users (role filter), Bookings (status filter + joined names), Revenue (7d/30d/90d/all-time; earned vs pipeline), SOS events (Acknowledge/Resolve + Google Maps link).
- No guide-approval queue — guides auto-approve per product spec.

Run: `npm install` (root) then `cp apps/admin/.env.local.example apps/admin/.env.local`, fill env vars, and `npm run admin`.

---

## Design System Quick Reference

**Colors (v2 "City of Dreams" — saffron-led):**
- Primary: Mumbai Saffron `#F97316` / Dark `#EA580C`
- Secondary: Bougainvillea Pink `#EC4899` / Dark `#BE185D`
- Background: Warm Cream `#FFFAF5`
- Text: Midnight Navy `#0B1229`
- Gold (ratings): `#F59E0B` · Success: `#22C55E` · Mumbai Purple (premium): `#6C5CE7`

**Fonts:** Headings — Plus Jakarta Sans · Body — Inter · Numbers/Prices — DM Sans

**Animation (spring):** Button press `scale(0.96)` `damping:15, stiffness:150`; Card tap `scale(0.97)`, `translateY(-2px)`.

**Key theme file:** `apps/mobile/config/theme.ts`

---

## Environment Variables Needed
Create `apps/mobile/.env.local` (see `apps/mobile/.env.local.example`):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_RAZORPAY_KEY_ID=       # deferred
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=   # deferred
```
Admin needs `apps/admin/.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_SERVICE_KEY`, `VITE_ADMIN_PASSWORD`.

---

## Tech Stack Summary
- **Monorepo:** npm workspaces + Turborepo
- **Mobile:** React Native 0.76, Expo 52, Expo Router 4, TypeScript 5.x
- **Styling:** NativeWind 4 (Tailwind for RN) · **Animations:** Reanimated 3 · **State:** Zustand 4
- **Admin/Marketing web:** Vite 8 + React 18 (admin); static HTML (marketing)
- **Backend:** Supabase JS v2, Postgres, Deno edge functions
- **Payments:** Razorpay (deferred) · **Maps:** react-native-maps 1.18, expo-location
