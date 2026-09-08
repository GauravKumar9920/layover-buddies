# Project Structure

> Last verified: 2026-09-05.

Detour is an **npm-workspaces monorepo** (Turborepo for task orchestration). Every app and shared library is its own package; the Supabase backend is shared by the mobile app, the admin console, and the marketing lead flow.

> See [ADR-001](ADR-001-unified-codebase.md) (why Expo Universal),
> [ADR-002](ADR-002-monorepo-workspaces.md) (why a workspaces monorepo), and
> [ADR-003](ADR-003-admin-control-plane-growth-publishing.md) (secure admin,
> growth reporting, and structured publishing).

## Top-level layout

```
detour/
├── apps/
│   ├── mobile/        # @detour/mobile    — React Native + Expo 52 (iOS, Android, web)
│   ├── admin/         # @detour/admin     — Vite 8 + React 18 hosted operations console (Admin 2.0)
│   ├── marketing/     # @detour/marketing — Astro 7 static site → detourtrips.com
│   └── studio/        # @detour/studio    — isolated Sanity + React 19 editorial app (own lockfile)
├── packages/
│   ├── config/        # @detour/config   — shared design tokens (v3 theme) + business constants
│   └── database/      # @detour/database — generated Supabase types, browser-safe re-export
├── supabase/          # migrations, Deno edge functions, seed.sql — shared backend (CLI expects ./supabase)
├── marketing-ops/     # marketing strategy, templates, SEO docs (non-code)
├── design/            # brand system, design tokens, fonts, UI mockups
├── docs/              # project / technical / business / financial / legal / product docs
├── scripts/           # one-off ops SQL + repo utilities (see scripts/README.md)
├── package.json       # workspaces + turbo + consolidated dependency overrides
├── turbo.json         # build / type-check / lint / test pipeline
└── CLAUDE.md
```

## Workspaces

| Package | Path | Stack | Build | Deploy |
|---|---|---|---|---|
| `@detour/mobile` | `apps/mobile` | Expo 52, Expo Router 4, RN 0.76, NativeWind 4, Zustand 4 | `expo export` / EAS | App Store / Play Store (EAS) |
| `@detour/admin` | `apps/admin` | Vite 8, React 18, React Router 7, Tailwind | `tsc -b && vite build` | Vercel (`detour-admin.vercel.app`); anon browser client + server-only control plane |
| `@detour/marketing` | `apps/marketing` | Astro 7, TypeScript, optional Sanity content | `astro build` | Vercel → detourtrips.com |
| `@detour/studio` | `apps/studio` | Sanity 6, React 19, TypeScript | `npm --prefix apps/studio run build` | Sanity-hosted (`detour-content.sanity.studio`) |

`apps/studio` deliberately has its own `package-lock.json` and install boundary
(it is **not** in the root `workspaces` array). The mobile/admin workspaces
require React 18, while the current Sanity Studio requires React 19; isolation
prevents npm peer hoisting from mixing runtimes.

## `apps/mobile` internals

```
apps/mobile/
├── app/                 # Expo Router file-based routes
│   ├── (auth)/          # login, signup, forgot-password
│   ├── (traveler)/      # browse, search, book, trips, live map ([id].native.tsx variant)
│   ├── (guide)/         # dashboard, requests, profile, itineraries
│   └── (shared)/        # messages
├── components/          # ui/, guides/, bookings/
├── lib/api/             # Supabase data layer (guides, bookings, deposits, balance, topUp,
│                        #   razorpayCheckout, expenseProofs, sos, moderation, …)
├── lib/booking/         # booking state machine + snapshots (mirrored in edge fns)
├── lib/hooks/           # useAuth, useMessages, …
├── config/              # re-export shims → @detour/config; app-local LEGAL/support URLs
├── types/index.ts       # TypeScript domain models
└── metro.config.js      # monorepo-aware Metro + react-native-maps web stub + OTEL stub
```

## `apps/marketing` internals

```
apps/marketing/
├── src/pages/           # [...slug].astro, 404.astro, sitemap.xml.ts
├── src/content/pages/   # JSON page manifests — one per clean route (12 today)
├── src/legacy/          # checked-in legacy HTML, the visual parity source
├── src/components/      # shared layout, forms, metadata, tracking (consent-aware GA)
├── public/              # optimized media and static downloads
├── scripts/check-route-parity.mjs   # route/metadata/security parity test (npm test)
└── vercel.json          # static deploy config
```

## `apps/studio` internals

```
apps/studio/
├── schemaTypes/documents/   # guide, landingPage
├── schemaTypes/objects/     # faq, media, seo, sourceLink, testimonial
├── docs/publishing.md       # draft → preview → publish → rollback workflow
└── scripts/                 # build.mjs, check-schema.mjs
```

## Backend (`supabase/`)

```
supabase/
├── config.toml          # local project config (local URLs — do NOT `config push` over hosted)
├── migrations/          # 60+ versioned SQL migrations (~40 tables) — source of truth
├── functions/           # 24 Deno edge functions + _shared/ helpers + __tests__/
└── seed.sql             # demo data: 5 guides, 3 travelers, 1 owner admin, 15 itineraries, 6 bookings
```

Edge functions, grouped:
- **Booking/money:** `create-deposit-order`, `create-balance-order`, `create-topup-order`, `request-top-up`, `decide-top-up`, `confirm-payment`, `razorpay-webhook` (HMAC-verified brain), `sign-agreement`, `cancel-booking`, `issue-refund`, `submit-proofs`, `qr-scan`, `end-trip`, `replay-stubbed-payouts` (`create-booking-payment` is **deprecated** but still deployed)
- **Safety/account:** `sos-alert`, `send-push`, `delete-account`
- **Admin control plane:** `admin-api`, `admin-growth-report`
- **Marketing/publishing:** `submit-marketing-lead`, `sync-search-console`, `content-deployment-webhook`, `vercel-deployment-webhook`

`supabase/functions/_shared/` holds the server copies of the booking state
machine, Razorpay client/signature helpers, admin auth/contracts, growth
reports, and the generated `database.types.ts` (re-exported to browsers via
`@detour/database`).

All browser clients connect with **anon keys**. Admin requests are authorized
by Supabase Auth, an active `admin_memberships` record, MFA assurance, and
operation-specific roles inside server-side functions. The booking
state-machine/snapshot logic in `supabase/functions/_shared/` is a deliberate
port of `apps/mobile/lib/booking/` (Deno can't import the RN code) — kept
honest by `functions/__tests__/stateMachineParity.test.ts`; a candidate for a
future shared package.

## Common commands (from repo root)

```bash
npm install                     # mobile/admin/marketing/shared workspace lock
npm install --prefix apps/studio  # isolated Studio lock
npm run mobile                  # Expo dev server      npm run admin   # admin at :5174
npm run dev --workspace @detour/marketing   # marketing at :8791
npm run studio                  # Sanity Studio at :3333
npm run type-check              # tsc across workspaces
npm run test                    # mobile Jest          npm run test:edge   # Deno edge tests
npm run build                   # production builds
npm run security:admin-bundle   # scan built admin bundle for secrets
npm run studio:test             # Studio typecheck + schema contract
npm run studio:build
```

## Conventions

- **Files:** `kebab-case.tsx` · **Components/Types:** `PascalCase` · **Functions:** `camelCase` · **Constants:** `UPPER_SNAKE_CASE` · **Routes:** `kebab-case` / `[param]`
- Root-workspace dependency `overrides` live only in the root `package.json`.
  Studio is an intentionally separate install boundary, so its security
  overrides live in `apps/studio/package.json`.
- Schema changes go in `supabase/migrations/` as a new migration — never edit an applied one.
- GitHub repo: `GauravKumar9920/layover-buddies`; `main` is protected, PRs only.
