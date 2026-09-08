# Detour — Agent Context

> Last verified: 2026-09-05 (against `main` @ `d2a94f7`).

## What This Project Is
A two-sided marketplace connecting international airport layover travelers with Mumbai student guides.

This is an **npm-workspaces monorepo** (Turborepo for task orchestration). Packages:
- **Mobile app**: React Native + Expo 52, file-based routing via Expo Router — `apps/mobile/` (`@detour/mobile`)
- **Admin console**: Admin 2.0 — hosted Vite 8 + React 18 + Tailwind SPA, deployed at `detour-admin.vercel.app` — `apps/admin/` (`@detour/admin`)
- **Marketing site**: Astro 7 static site → detourtrips.com on Vercel — `apps/marketing/` (`@detour/marketing`)
- **Content Studio**: Sanity Studio (React 19, isolated lockfile), deployed at `detour-content.sanity.studio` — `apps/studio/` (`@detour/studio`, **not** an npm workspace)
- **Backend**: Supabase (auth + database + storage + Deno edge functions) — `supabase/` at the repo root (CLI expects `./supabase`)
- **Shared libraries**: `packages/config` (`@detour/config` — theme + business constants), `packages/database` (`@detour/database` — generated Supabase types for browser clients)
- **Design system**: `design/brand/detour-design-philosophy.md` (current, v3); `design/brand/design-system.md` is the superseded v2 saffron palette, kept for history

`apps/mobile`, `apps/admin`, and `apps/marketing` share **one Supabase project**. All browser clients use the **anon key only**. Privileged admin reads/commands run inside the `admin-api` / `admin-growth-report` Edge Functions after Supabase Auth + `admin_memberships` role checks (`owner` / `operations` / `finance` / `growth`); every sensitive mutation writes to an append-only `admin_action_log`. Never put a service-role or Google credential in a `VITE_*` / `EXPO_PUBLIC_*` variable. See `docs/technical/ADR-003-admin-control-plane-growth-publishing.md`.

---

## How To Run

Install once at the repo root, then install the isolated Studio toolchain:
```bash
npm install                       # mobile, admin, marketing, packages (one lockfile)
npm install --prefix apps/studio  # Sanity Studio — separate React 19 lockfile
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
npm run studio:test         # type-check + schema contract check
```

### Local backend
```bash
npx supabase start          # Docker required; API at http://127.0.0.1:54321
npx supabase db reset       # re-apply 60+ migrations + seed.sql
```

### Repo-wide checks (Turborepo)
```bash
npm run type-check          # tsc across workspaces
npm run lint
npm run test                # mobile Jest suite
npm run test:edge           # Deno tests for supabase/functions
npm run build               # production builds
npm run security:admin-bundle   # scan built admin bundle for secrets (required pre-release)
npm run test:dependency-security
```

---

## Current Priorities

The April-era task list (smoke test, booking UI, seed data, constants) is **done** — history lives in git. The live roadmap is in **`docs/project/NEXT_TASKS.md`**. Headline items as of 2026-09-05:

1. **PR #55 decision** — trip-fit / party-shape / split-pricing feature (+4.5k lines, a month stale): rebase+merge or close.
2. **Admin 2.0 provider config** — 10 steps in `docs/technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md` (DNS for admin.detourtrips.com, MFA enable, Resend, GA4, Search Console, publishing hooks, Sanity content import, ops acceptance, bundle split). Privacy/terms 404 is already fixed.
3. **Port 16 SEO place pages** from the `archive/static-marketing-seo` branch into Astro (extend `apps/marketing/scripts/check-route-parity.mjs` expectedRoutes 12→28).
4. **Commission-rate decision** — 25% in `packages/config/constants.ts` vs 15% in old docs. **Undecided — owner decision needed.** Agreement snapshots freeze rates at signing, so decide before real users.
5. **Pre-launch blockers** — Razorpay live keys (blocked on company registration/GST), push-notification enablement, Google Maps key, `@detour/types` extraction + booking state-machine dedup.

Deferred-but-specced items (with runbooks) live in `docs/project/DEFERRED.md`.

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
│   │   ├── lib/api/             # guides.ts, bookings.ts, deposits.ts, razorpayCheckout.ts, …
│   │   ├── lib/booking/         # booking state machine + snapshots (mirrored in edge fns)
│   │   ├── config/              # re-export shims → @detour/config (+ app-local LEGAL URLs)
│   │   ├── types/index.ts       # TypeScript models
│   │   ├── metro.config.js      # monorepo-aware Metro (watchFolders + nodeModulesPaths)
│   │   └── .env.local.example   # EXPO_PUBLIC_SUPABASE_* etc.
│   ├── admin/                   # @detour/admin — Admin 2.0 Vite+React+Tailwind console
│   │   ├── src/pages/           # Overview, Operations, Marketplace, TrustSafety, Money, Growth, Platform
│   │   ├── src/lib/             # anon Supabase Auth client + typed admin API
│   │   ├── tests/               # security-boundary test (node --test)
│   │   └── .env.local.example   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY only
│   ├── marketing/               # @detour/marketing — Astro static site → detourtrips.com
│   │   ├── src/pages/           # [...slug].astro, 404.astro, sitemap.xml.ts
│   │   ├── src/content/pages/   # JSON page manifests (12 routes)
│   │   ├── src/legacy/          # checked-in legacy HTML sources of truth
│   │   ├── scripts/check-route-parity.mjs
│   │   └── vercel.json          # static deploy config
│   └── studio/                  # @detour/studio — Sanity Studio (own lockfile, React 19)
│       ├── schemaTypes/         # documents: guide, landingPage · objects: faq, media, seo, sourceLink, testimonial
│       └── docs/publishing.md
├── packages/
│   ├── config/                  # @detour/config — theme (v3) + business constants
│   └── database/                # @detour/database — generated DB types (browser-safe re-export)
├── supabase/
│   ├── migrations/              # 60+ versioned SQL migrations (~40 tables) — source of truth
│   ├── functions/               # 24 Deno edge functions + _shared/ + __tests__/
│   └── seed.sql                 # 5 guides, 3 travelers, 1 owner admin, 15 itineraries, 6 bookings
├── marketing-ops/               # marketing strategy, templates, SEO docs (non-code)
├── design/                      # brand system, design tokens, UI mockups
├── docs/                        # project / technical / business / financial / legal / product docs
├── scripts/                     # one-off ops (auth_sync.sql, bundle secret scan, image-size patch)
├── package.json                 # workspaces + turbo + consolidated security overrides
└── turbo.json
```

### Admin console (`apps/admin/`)
- Runs on `127.0.0.1:5174` locally; production at `https://detour-admin.vercel.app` (`admin.detourtrips.com` DNS pending — runbook step 2).
- Anon-key browser client; privileged ops via `admin-api` / `admin-growth-report` Edge Functions. TOTP MFA is code-complete but `ADMIN_REQUIRE_MFA=false` until runbook step 3 is decided.
- Nav groups: Overview, Operations (leads/bookings/disputes), Marketplace, Trust & Safety (realtime SOS), Money (ledgers/refunds/payouts/pricing), Growth (GA4/GSC), Platform (health/audit/team/settings).
- Some surfaces intentionally fail closed until provider config lands (see runbook).
- No guide-approval queue — guides auto-approve per product spec.

---

## Design System Quick Reference

**v3 "Warm Editorial"** — shared by the mobile app and detourtrips.com. Tokens live in `packages/config/theme.ts`; `apps/mobile/config/theme.ts` is a re-export shim.

**Colors:**
- Canvas: Paper `#F4EDDD` / Paper Light `#FCF7EA` (cards) / Paper Deep `#EBE0C5` (insets) / hairline `#C5BA9C`
- Text: Ink `#0E1929` / Ink Muted `#445169` / Ink Soft `#7C8597`
- Primary CTA: Terracotta `#C8542A` / Dark `#9E3A1F` / Light `#F7DECC`
- Secondary: Sea `#2D7BA9` (links/info) · Marigold `#E89F2C` (ratings/warnings)
- Success `#3D8B5A` · Error `#C0392B` · Purple (badges) `#6C5CE7`

**Fonts:** Display — Bricolage Grotesque · Body — Plus Jakarta Sans · Editorial serif — Instrument Serif · Eyebrows/prices — DM Mono

> ⚠️ The saffron `#F97316` palette in `design/brand/design-system.md` is **superseded** — do not use it for new work.

---

## Environment Variables Needed
Create `apps/mobile/.env.local` (see `apps/mobile/.env.local.example`):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_RAZORPAY_KEY_ID=       # test key; live keys blocked on company registration
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=   # needed for the native live-map variant
```
Admin needs `apps/admin/.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. Server-only values (GA4, Search Console, Resend, Sanity/Vercel hooks, Razorpay secrets) live in `supabase/.env.local` locally / `supabase secrets set` in production — see `supabase/.env.local.example`.

---

## Tech Stack Summary
- **Monorepo:** npm workspaces + Turborepo (Node ^22.12 / ^24 / >=26, npm >= 10)
- **Mobile:** React Native 0.76, Expo 52, Expo Router 4, TypeScript 5.x
- **Styling:** NativeWind 4 (Tailwind for RN) · **Animations:** Reanimated 3 · **State:** Zustand 4
- **Admin:** Vite 8 + React 18 + React Router 7 + Tailwind · **Marketing:** Astro 7 static output · **Studio:** Sanity 6 + React 19
- **Backend:** Supabase JS v2, Postgres (RLS + pg_cron), Deno edge functions
- **Payments:** Razorpay — checkout wired via `apps/mobile/lib/api/razorpayCheckout.ts` (orders created server-side; webhook-driven). Live payouts/refunds deferred behind `RAZORPAY_LIVE_FEATURES_ENABLED`.
- **Push:** Expo Push pipeline built (`send-push` drains `notifications`); pending enablement.
- **Maps:** react-native-maps 1.18, expo-location
