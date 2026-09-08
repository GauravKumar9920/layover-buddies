# Detour — System Architecture

> Last verified: 2026-09-05. This describes the system **as built**; the April 2024 Next.js/FlightAware/FCM design doc it replaces lives in git history.

## Overview

Detour is a two-sided marketplace: international layover travelers at Mumbai (BOM) book local student guides. Four client surfaces share **one Supabase project**:

```
 apps/mobile (Expo 52 / RN 0.76)      apps/admin (Vite 8 SPA — Admin 2.0)
 apps/marketing (Astro 7 → Vercel)    apps/studio (Sanity 6, React 19)
                 │                            │
                 └──── anon-key clients ─────┘
                               │
                 ┌─────────────▼──────────────┐
                 │   Supabase (one project)   │
                 │   Postgres + RLS · Auth    │
                 │   Storage · Realtime       │
                 │   24 Deno Edge Functions   │
                 │   pg_cron · pg_net         │
                 └─────────────┬──────────────┘
                               │
        Razorpay (orders/webhooks/payouts) · Expo Push ·
        GA4 + Search Console APIs · Sanity · Vercel deploy hooks
```

**Deployment:** marketing → detourtrips.com (Vercel) · admin → detour-admin.vercel.app (Vercel; `admin.detourtrips.com` DNS pending) · studio → detour-content.sanity.studio · backend → Supabase project `kajybmmqccfmsejrrpqs`.

## Security model (ADR-003)

- All browser clients hold **anon keys only**; Postgres RLS is the data boundary for direct table access.
- Privileged admin reads/commands run inside the `admin-api` and `admin-growth-report` Edge Functions: Supabase Auth → active `admin_memberships` row → role check (`owner` / `operations` / `finance` / `growth`) → validated command → append-only `admin_action_log` record.
- TOTP MFA is code-complete; enforcement is config-gated (`ADMIN_REQUIRE_MFA`).
- Service-role key, Google service-account, Razorpay secrets, and webhook secrets live **only** in Edge Function secrets (`supabase secrets`). The built admin bundle is scanned for credential signatures in CI (`npm run security:admin-bundle`).
- Fail-closed by design: a misconfigured provider renders "unavailable" in the UI, never a silent zero.

## Booking lifecycle (the core)

A pure state machine drives everything. `booking_status` is a 27-value enum (`pending → chat_open → agreement_drafting → … → deposits_held → … → balance_paid → trip_ready → … → reconciling → rated`, plus 6 cancelled variants and `disputed`). The machine is:

- implemented in TypeScript at `apps/mobile/lib/booking/stateMachine.ts`,
- mirrored in `supabase/functions/_shared/stateMachine.ts` (Deno can't import RN code),
- guarded by `supabase/functions/__tests__/stateMachineParity.test.ts`.

Money is **integer paise** end-to-end, with DB CHECK constraints on the financial invariants (₹500 deposit, 20% buffer). Flow:

```
inquiry → agreement (rate-freezing snapshot, both signatures)
  → ₹500 refundable deposits (both sides) → balance + GST
  → QR scan starts trip (trip pot) → in-trip top-ups (15-min decision window)
  → expense proofs (24h post-trip) → reconciliation receipts
  → payout dispatches → rated
```

Timed transitions are driven by **pg_cron** jobs: balance reminders (T−84/48/24/18h), late-fee assessment, no-pay cancel, deposit-window expiry, deposits-held sweep, proofs-overdue, rating-link send (T+3h).

## Payments — Razorpay, webhook-driven

- Orders are created **server-side** (`create-deposit-order`, `create-balance-order`, `create-topup-order`); the app opens the native Razorpay sheet via `apps/mobile/lib/api/razorpayCheckout.ts`.
- `razorpay-webhook` (HMAC-verified) is the brain: idempotent capture, then the state-machine transition. Client callbacks only confirm (`confirm-payment`).
- Live money-out (refunds, payouts, fund accounts) is code-complete behind `RAZORPAY_LIVE_FEATURES_ENABLED`, blocked on company registration/GST — runbook in [../project/DEFERRED.md](../project/DEFERRED.md) §1. Stubbed payouts accumulate in `payout_dispatches` and are drained later by `replay-stubbed-payouts` (deterministic idempotency keys).

## Safety & messaging

- Per-booking chat via Supabase Realtime on `messages` (RLS: participants only).
- `sos-alert` creates the alert and pages ops via `pg_net`; admin Trust & Safety subscribes to realtime signals (no PII in the signal payload).
- Push: rows in `notifications` → `send-push` Edge fn → Expo Push API (pipeline built, pending enablement). `delete-account` handles account deletion (App Store requirement).

## Admin 2.0 control plane

Vite SPA with areas: Overview (Action Centre), Operations (leads/bookings/disputes), Marketplace, Trust & Safety (realtime SOS), Money (payment/refund/payout ledgers, reconciliation, pricing), Growth (GA4/GSC), Platform (health/audit/team/settings). Growth reports are **fixed server-side queries** executed by `admin-growth-report` with a Google service account; responses carry freshness and partial-failure metadata. Some surfaces intentionally fail closed until provider config lands — see [ADMIN2_PROVIDER_SETUP_RUNBOOK.md](ADMIN2_PROVIDER_SETUP_RUNBOOK.md).

## Marketing & publishing loop

- The public site is **Astro static output** built from code + JSON page manifests (`apps/marketing/src/content/pages/`, 12 routes) with checked-in legacy HTML as the parity source (`scripts/check-route-parity.mjs` enforces routes, canonical tags, JSON-LD, no pre-consent GA, no inline FormSubmit).
- Leads: site form → `submit-marketing-lead` (validation, HMAC, rate limiting) → `marketing_leads` table → Resend notification → admin Operations surface. GA4 stays free of PII; acquisition joins to bookings via lead records.
- Editorial content: **Sanity Studio** (`guide` + `landingPage` documents; faq/media/seo/sourceLink/testimonial objects). Publish flow: Sanity webhook → `content-deployment-webhook` → Vercel deploy hook → Astro rebuild; `vercel-deployment-webhook` reports completion back and `content_deployments` tracks `requested → building → ready`.
- Search Console data lands via scheduled `sync-search-console` into `search_console_daily`.

## Data layer

~40 tables across 60+ migrations. Core: `users`, `guide_profiles`, `traveler_profiles`, `itineraries`, `itinerary_stops`, `bookings`, `agreements`, `deposits`, `expenses`, `expense_proofs`, `cost_line_items`, `payment_events`, `payout_dispatches`, `reviews`, `messages`, `notifications`, `sos_alerts`; ops/admin: `admin_memberships`, `admin_action_log`, `marketing_leads`, `growth_report_cache`, `content_deployments`. Schema source of truth: `supabase/migrations/` (new migration per change; never edit an applied one). Generated types flow to browsers via `packages/database`.

## Known gaps

See [../project/NEXT_TASKS.md](../project/NEXT_TASKS.md): no-show event, stuck `deposits_held` exit, terminal `disputed`, post-completion dispute window, guide verification flow, availability calendar; commission rate undecided; `@detour/types` extraction + state-machine dedup pending.
