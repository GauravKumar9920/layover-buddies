# Detour — Project Overview

## One-line
A platform connecting international airport-layover travelers with Mumbai student guides — authentic local experiences for travelers, earning opportunities for students.

## Shape of the codebase
An **npm-workspaces monorepo** with four products in one repo:

| Product | Package | Status |
|---|---|---|
| Mobile app (iOS/Android/web) | `@detour/mobile` (`apps/mobile`) | ✅ Built — Expo 52, end-to-end booking flow, smoke-tested |
| Admin console (local-only) | `@detour/admin` (`apps/admin`) | ✅ Built — users, bookings, revenue, SOS |
| Marketing site | `@detour/marketing` (`apps/marketing`) | ✅ Live → detourtrips.com (incl. SEO guide cluster) |
| Backend | `supabase/` | ✅ Migrations + Deno edge functions + seed; shared by mobile & admin |

> Full layout: [docs/technical/project-structure.md](../technical/project-structure.md).
> Architecture decisions: [ADR-001](../technical/ADR-001-unified-codebase.md) (Expo Universal), [ADR-002](../technical/ADR-002-monorepo-workspaces.md) (workspaces monorepo).

## Tech stack (summary)
- **Monorepo:** npm workspaces + Turborepo
- **Mobile:** React Native 0.76 / Expo 52 / Expo Router 4 / TypeScript / NativeWind / Zustand / Reanimated
- **Admin:** Vite + React 18 + Tailwind · **Marketing:** static HTML → Vercel
- **Backend:** Supabase (Postgres + Auth + Storage + Deno edge functions)
- **Payments:** Razorpay (in progress) · **Maps:** react-native-maps + expo-location

## Quick start
```bash
npm install        # all workspaces, one lockfile
npm run mobile     # Expo dev server
npm run admin      # admin console (:5174)
```
See the root [README.md](../../README.md) and [CLAUDE.md](../../CLAUDE.md) for details and env vars.

## What's next
- Razorpay payment integration · Google Maps key wiring · push notifications
- Extract shared `@detour/types` / `@detour/config` packages and de-duplicate the booking logic mirrored between `apps/mobile/lib/booking/` and `supabase/functions/_shared/` (see ADR-002)

## Team & contact
| Role | Name | Contact |
|---|---|---|
| Founder / Project Lead | Gaurav | admin@detourtrips.com |

*Last updated: 2026-06-26*
