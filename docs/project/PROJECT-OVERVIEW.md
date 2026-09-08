# Detour — Project Overview

> Last verified: 2026-09-05.

## One-line
A platform connecting international airport-layover travelers with Mumbai student guides — authentic local experiences for travelers, earning opportunities for students.

## Shape of the codebase
An **npm-workspaces monorepo** with five products in one repo:

| Product | Package | Status |
|---|---|---|
| Mobile app (iOS/Android/web) | `@detour/mobile` (`apps/mobile`) | ✅ Built — Expo 52, end-to-end booking flow incl. deposits/balance/top-ups/proofs, smoke-tested |
| Admin console (Admin 2.0) | `@detour/admin` (`apps/admin`) | ✅ Deployed — `detour-admin.vercel.app`; anon-key SPA, privileged ops via `admin-api`/`admin-growth-report` edge functions; provider config pending ([runbook](../technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md)) |
| Marketing site | `@detour/marketing` (`apps/marketing`) | ✅ Live — Astro static site → detourtrips.com (Vercel); 12 routes, consent-aware GA, lead capture via `submit-marketing-lead` |
| Content Studio | `@detour/studio` (`apps/studio`) | ✅ Deployed — Sanity Studio at `detour-content.sanity.studio`; content import pending |
| Backend | `supabase/` | ✅ One shared project — 60+ migrations (~40 tables), 24 Deno edge functions, seed data |

> Full layout: [docs/technical/project-structure.md](../technical/project-structure.md).
> Architecture decisions: [ADR-001](../technical/ADR-001-unified-codebase.md) (Expo Universal), [ADR-002](../technical/ADR-002-monorepo-workspaces.md) (workspaces monorepo), [ADR-003](../technical/ADR-003-admin-control-plane-growth-publishing.md) (secure admin control plane, growth reporting, structured publishing).

## Architecture at a glance
- **Clients:** mobile (Expo), admin (Vite SPA), marketing (Astro static) — all talk to the same Supabase project with **anon keys only**. Admin privilege crosses a server-side edge-function boundary with role checks (`owner`/`operations`/`finance`/`growth`) and an append-only audit log.
- **Booking lifecycle:** a pure state machine (`booking_status` enum, 27 values) mirrored between `apps/mobile/lib/booking/` and `supabase/functions/_shared/`, guarded by a parity test (`stateMachineParity.test.ts`). Money is integer paise end-to-end.
- **Financial core:** agreements (rate-freezing snapshots) → ₹500 refundable deposits → balance + GST → QR trip start → in-trip top-ups → expense proofs/reconciliation → payout dispatches. Razorpay is **webhook-driven** (HMAC-verified `razorpay-webhook` is the brain); live payouts/refunds are code-complete behind `RAZORPAY_LIVE_FEATURES_ENABLED` (see [DEFERRED](DEFERRED.md)).
- **Publishing loop:** Astro builds detourtrips.com from code + JSON page manifests (`apps/marketing/src/content/pages/`) with optional Sanity-managed content; Sanity → `content-deployment-webhook` → Vercel deploy hook → `vercel-deployment-webhook` tracks each publish in `content_deployments`.
- **Ops:** pg_cron jobs drive timed transitions (balance reminders, late fees, no-pay cancels, deposits-held sweep, proofs overdue, rating links); push via `send-push` draining `notifications` → Expo Push; SOS pages ops in realtime.

## What works today
- End-to-end booking flow (smoke-tested 2026-04-14; deposits/QR/proofs/SOS/push/structured profiles landed since).
- Marketing lead capture → `marketing_leads` table → admin Operations surface.
- Admin console: operations, marketplace, trust & safety (realtime SOS), money ledgers, growth reports (fail-closed when providers unconfigured), platform health/audit/team.

## Where things stand — open items
See [NEXT_TASKS.md](NEXT_TASKS.md) for the prioritized roadmap. Headline: PR #55 rebase decision, Admin 2.0's 10 provider-config steps, 16 SEO pages to port into Astro, the **undecided commission rate** (25% in code vs 15% in old docs — owner decision needed before real users), lifecycle gaps (no no-show event, no guide verification flow, no availability calendar), and pre-launch blockers (Razorpay live keys, push enablement, Google Maps key).

## Tech stack (summary)
- **Monorepo:** npm workspaces + Turborepo
- **Mobile:** React Native 0.76 / Expo 52 / Expo Router 4 / TypeScript / NativeWind 4 / Zustand 4 / Reanimated 3
- **Admin:** Vite 8 + React 18 + Tailwind · **Marketing:** Astro 7 → Vercel · **Studio:** Sanity 6 + React 19
- **Backend:** Supabase (Postgres + Auth + Storage + Deno edge functions, pg_cron)
- **Payments:** Razorpay (checkout wired, test mode) · **Push:** Expo Push (built, pending enable) · **Maps:** react-native-maps + expo-location

## Quick start
```bash
npm install                     # all root workspaces, one lockfile
npm install --prefix apps/studio
npm run mobile                  # Expo dev server
npm run admin                   # admin console (:5174)
```
See the root [README.md](../../README.md), [CLAUDE.md](../../CLAUDE.md), and the [RUNBOOK](../technical/RUNBOOK.md) for details, env vars, and test accounts.

## Team & contact
| Role | Name | Contact |
|---|---|---|
| Founder / Project Lead | Gaurav | admin@detourtrips.com |

*Last updated: 2026-09-05*
