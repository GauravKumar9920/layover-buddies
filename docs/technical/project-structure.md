# Project Structure

Detour is an **npm-workspaces monorepo** (Turborepo for task orchestration). Every app and shared library is its own package; the Supabase backend is shared by the mobile app and the admin console.

> See [ADR-001](ADR-001-unified-codebase.md) (why Expo Universal) and [ADR-002](ADR-002-monorepo-workspaces.md) (why a workspaces monorepo).

## Top-level layout

```
detour/
├── apps/
│   ├── mobile/        # @detour/mobile    — React Native + Expo 52 (iOS, Android, web)
│   ├── admin/         # @detour/admin     — Vite + React, local-only admin console
│   └── marketing/     # @detour/marketing — static HTML site → detourtrips.com (no build)
├── packages/          # @detour/* shared internal libraries
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
| `@detour/admin` | `apps/admin` | Vite, React 18, React Router, Tailwind | `tsc -b && vite build` | local-only (service-role key) |
| `@detour/marketing` | `apps/marketing` | static HTML/CSS/JS | none | Vercel (root dir `apps/marketing`) → detourtrips.com |

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

Both `@detour/mobile` (anon key, under RLS) and `@detour/admin` (service-role key, bypasses RLS) connect to the **same Supabase project**. The booking state-machine/snapshot logic in `supabase/functions/_shared/` is a deliberate port of `apps/mobile/lib/booking/` (Deno can't import the RN code) — a candidate for a future shared package.

## Common commands (from repo root)

```bash
npm install                 # install all workspaces (one lockfile)
npm run mobile              # Expo dev server      npm run admin   # admin at :5174
npm run type-check          # tsc across workspaces
npm run test                # mobile Jest          npm run test:edge   # Deno edge tests
npm run build               # production builds
```

## Conventions

- **Files:** `kebab-case.tsx` · **Components/Types:** `PascalCase` · **Functions:** `camelCase` · **Constants:** `UPPER_SNAKE_CASE` · **Routes:** `kebab-case` / `[param]`
- Dependency `overrides` live **only** in the root `package.json` (npm ignores workspace-level overrides).
- Schema changes go in `supabase/migrations/` as a new migration — never edit an applied one.
