# Project Structure

Detour is an **npm-workspaces monorepo** (Turborepo for task orchestration). Every app and shared library is its own package; the Supabase backend is shared by the mobile app and the admin console.

> See [ADR-001](ADR-001-unified-codebase.md) (why Expo Universal),
> [ADR-002](ADR-002-monorepo-workspaces.md) (why a workspaces monorepo), and
> [ADR-003](ADR-003-admin-control-plane-growth-publishing.md) (secure admin,
> growth reporting, and structured publishing).

## Top-level layout

```
detour/
├── apps/
│   ├── mobile/        # @detour/mobile    — React Native + Expo 52 (iOS, Android, web)
│   ├── admin/         # @detour/admin     — Vite + React hosted operations console
│   ├── marketing/     # @detour/marketing — Astro static site → detourtrips.com
│   └── studio/        # isolated Sanity + React 19 editorial application
├── packages/
│   └── config/        # @detour/config — shared design tokens (theme) + business constants
├── supabase/          # migrations, Deno edge functions, seed.sql — shared backend (CLI expects ./supabase)
├── marketing-ops/     # marketing strategy, templates, SEO docs (non-code)
├── design/            # brand system, design tokens, fonts, UI mockups
├── docs/              # project / technical / business / financial / legal docs
├── scripts/           # one-off operational SQL (auth_sync.sql)
├── package.json       # workspaces + turbo + consolidated dependency overrides
├── turbo.json         # build / type-check / lint / test pipeline
└── CLAUDE.md
```

## Workspaces

| Package | Path | Stack | Build | Deploy |
|---|---|---|---|---|
| `@detour/mobile` | `apps/mobile` | Expo 52, Expo Router 4, RN 0.76, NativeWind, Zustand | `expo export` / EAS | App Store / Play Store (EAS) |
| `@detour/admin` | `apps/admin` | Vite, React 18, React Router, Tailwind | `tsc -b && vite build` | Vercel; anon browser client + server-only control plane |
| `@detour/marketing` | `apps/marketing` | Astro, TypeScript, Sanity content client | `astro build` | Vercel (root dir `apps/marketing`) → detourtrips.com |
| `@detour/studio` | `apps/studio` | Sanity, React 19, TypeScript | `npm --prefix apps/studio run build` | Sanity-hosted or dedicated Vercel project |

`apps/studio` deliberately has its own `package-lock.json` and install boundary.
The mobile/admin workspaces require React 18, while the current Sanity Studio
requires React 19; isolation prevents npm peer hoisting from mixing runtimes.

## `apps/mobile` internals

```
apps/mobile/
├── app/                 # Expo Router file-based routes
│   ├── (auth)/          # login, signup, forgot-password
│   ├── (traveler)/      # browse, search, book, trips, live map
│   ├── (guide)/         # dashboard, requests, profile, itineraries
│   └── (shared)/        # messages
├── components/          # ui/, guides/, bookings/
├── lib/api/             # Supabase data layer (guides, bookings, payments, …)
├── lib/booking/         # booking state machine + snapshots (mirrored in edge fns)
├── lib/hooks/           # useAuth, useMessages, …
├── config/theme.ts      # design tokens   config/constants.ts  # business rules
├── types/index.ts       # TypeScript domain models
└── metro.config.js      # monorepo-aware Metro + react-native-maps web stub + OTEL stub
```

## Backend (`supabase/`)

```
supabase/
├── config.toml          # local project config
├── migrations/          # versioned SQL schema (source of truth)
├── functions/           # Deno edge functions + _shared/ helpers + __tests__/
└── seed.sql             # demo data
```

Both `@detour/mobile` and `@detour/admin` connect to the **same Supabase
project** with anon-key browser clients. Admin requests are authorized by
Supabase Auth, an active `admin_memberships` record, MFA assurance, and
operation-specific roles inside server-side functions. The booking
state-machine/snapshot logic in `supabase/functions/_shared/` is a deliberate
port of `apps/mobile/lib/booking/` (Deno can't import the RN code) — a candidate
for a future shared package.

## Common commands (from repo root)

```bash
npm install                 # mobile/admin/marketing/shared workspace lock
npm install --prefix apps/studio  # isolated Studio lock
npm run mobile              # Expo dev server      npm run admin   # admin at :5174
npm run type-check          # tsc across workspaces
npm run test                # mobile Jest          npm run test:edge   # Deno edge tests
npm run build               # production builds
npm run studio:test         # Studio typecheck + schema contract
npm run studio:build
```

## Conventions

- **Files:** `kebab-case.tsx` · **Components/Types:** `PascalCase` · **Functions:** `camelCase` · **Constants:** `UPPER_SNAKE_CASE` · **Routes:** `kebab-case` / `[param]`
- Root-workspace dependency `overrides` live only in the root `package.json`.
  Studio is an intentionally separate install boundary, so its security
  overrides live in `apps/studio/package.json`.
- Schema changes go in `supabase/migrations/` as a new migration — never edit an applied one.
