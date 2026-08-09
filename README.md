# Detour

A two-sided marketplace connecting international airport layover travelers with Mumbai student guides — turning transit time into a real local experience.

## What It Is

Travelers with layovers in Mumbai get matched with verified student guides who show them the city. Guides earn income; travelers get an authentic experience in hours.

## Monorepo Layout

This is an **npm-workspaces monorepo** (orchestrated with Turborepo). Each app and shared library is its own package under `apps/` and `packages/`.

```
detour/
├── apps/
│   ├── mobile/        # @detour/mobile    — React Native + Expo app (iOS, Android, web)
│   ├── admin/         # @detour/admin     — hosted operations console (Vite + React)
│   ├── marketing/     # @detour/marketing — Astro static site → detourtrips.com
│   └── studio/        # isolated Sanity Studio — structured editorial publishing
├── packages/          # shared internal libraries (@detour/*) — see docs
├── supabase/          # database migrations, edge functions (Deno), seed data — shared backend
├── marketing-ops/     # marketing strategy, templates, SEO docs (non-code)
├── design/            # brand system, design tokens, UI mockups
├── docs/              # project, technical, business, financial & legal docs
└── scripts/           # one-off operational SQL/utility scripts
```

`mobile` and `admin` both talk to the **same Supabase project** with unprivileged
browser clients. Admin-only reads and commands cross a server-side Edge Function
boundary after Supabase Auth, MFA, and role checks; service credentials never
enter a browser bundle. See [ADR-002](docs/technical/ADR-002-monorepo-workspaces.md)
for the monorepo decision and [ADR-003](docs/technical/ADR-003-admin-control-plane-growth-publishing.md)
for the secure control-plane architecture.

## Getting Started

```bash
npm install                         # mobile, admin, marketing, shared packages
npm install --prefix apps/studio    # isolated React 19/Sanity toolchain
```

### Run an app

```bash
npm run mobile             # Expo dev server (then press i / a / w)
npm run mobile:ios         # Expo → iOS simulator
npm run admin              # admin console at http://127.0.0.1:5174
npm run dev --workspace @detour/marketing
npm run studio             # Sanity Studio at http://127.0.0.1:3333
```

### Repo-wide tasks (via Turborepo)

```bash
npm run type-check         # tsc across workspaces
npm run lint
npm run test               # mobile Jest suite
npm run test:edge          # Deno tests for supabase/functions
npm run build              # production builds (admin bundle, etc.)
npm run studio:test        # isolated Studio type/schema checks
npm run studio:build
```

### Environment variables

```bash
cp apps/mobile/.env.local.example apps/mobile/.env.local
cp apps/admin/.env.local.example  apps/admin/.env.local
```

Mobile needs `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`;
admin needs only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Privileged
Supabase and Google credentials are configured as server-side function secrets.
Full lists live in each app's environment example.

## Tech Stack

| Layer | Tech |
|---|---|
| Monorepo | npm workspaces + Turborepo |
| Mobile app | React Native 0.76, Expo 52, Expo Router 4, TypeScript, NativeWind 4, Reanimated 3, Zustand 4 |
| Admin console | Vite, React 18, React Router, Tailwind, TypeScript |
| Marketing site | Astro static output + Sanity-managed editorial content → Vercel |
| Backend | Supabase (Postgres + Auth + Storage + Deno Edge Functions) |
| Payments | Razorpay (integration in progress) |
| Maps | react-native-maps, expo-location |

## Documentation

- [docs/technical/project-structure.md](docs/technical/project-structure.md) — full layout & conventions
- [docs/technical/ADR-001-unified-codebase.md](docs/technical/ADR-001-unified-codebase.md) — why Expo Universal
- [docs/technical/ADR-002-monorepo-workspaces.md](docs/technical/ADR-002-monorepo-workspaces.md) — why a workspaces monorepo
- [docs/technical/ADR-003-admin-control-plane-growth-publishing.md](docs/technical/ADR-003-admin-control-plane-growth-publishing.md) — admin security, growth reporting, and publishing
- [CLAUDE.md](CLAUDE.md) — working context for Claude Code

## License

Copyright (c) 2026 Detour. All Rights Reserved. See [LICENSE](LICENSE).
