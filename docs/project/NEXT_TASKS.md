# Detour — Next Tasks

> Last verified: 2026-09-05. This replaces the April 2026 task list (Tasks 0–7), which is fully done — see git history and [SMOKE_TEST_RESULTS.md](SMOKE_TEST_RESULTS.md).

Current prioritized roadmap. Work top-to-bottom within a group; items are independent across groups unless noted.

**Reference files to always consult:**
- [../technical/RUNBOOK.md](../technical/RUNBOOK.md) — how to run everything; test accounts
- [../technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md](../technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md) — the 10 Admin 2.0 config steps
- [../technical/ADR-003-admin-control-plane-growth-publishing.md](../technical/ADR-003-admin-control-plane-growth-publishing.md) — Admin 2.0 charter and required gates
- [DEFERRED.md](DEFERRED.md) — built-but-inactive features with enablement runbooks
- `packages/config/constants.ts` — business rules (never change without founder sign-off)

---

## Now

### 1. Decide the commission rate — owner decision needed
`COMMISSION_RATE` is **25%** in `packages/config/constants.ts`; the retired April task spec said 15%. **Undecided since April.** Agreement snapshots freeze rates at signing, so this must be decided before the first real booking. Decide, update the constant, and delete the stale cross-references.

### 2. PR #55 — trip fit, party shape, split pricing: rebase or close
Open since Aug 9: +4,558/−1,426 across 45 files — `age_band`, `party_type`, party size 1–4, base+per-person pricing, slimmer `BookingRequest`, nationality picker, 438 tests. A month stale; main has moved a lot since → expect conflicts. **Decide: rebase+merge, or close.** Repo: `GauravKumar9920/layover-buddies` (main protected, PRs only).

### 3. Dependency hygiene
Merge **PR #65** first (CI guard pinning Expo SDK 52 dependency alignment — it declares the SDK-incompatible dependabot majors unsafe), then triage the remaining dependabot batch (#67–#72): close the SDK-incompatible majors (#68, #70, #71), review the compatible patches (#67, #69, #72) after CI. Root `package.json` `overrides` are the security-patch mechanism — see [../technical/DEPENDENCY_SECURITY.md](../technical/DEPENDENCY_SECURITY.md).

### 4. Admin 2.0 — run the 10 provider-config steps
All remaining Admin 2.0 work is configuration, not code. Follow [ADMIN2_PROVIDER_SETUP_RUNBOOK.md](../technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md) in order:
DNS for `admin.detourtrips.com` + Supabase redirects (step 2) → MFA enable/protect decision (step 3) → Resend lead email (4) → GA4 service account (5) → Search Console (6) → publishing-loop hooks (7) → Sanity content import (8) → marketing production release (9 — the privacy/terms 404 there is **already fixed**, both routes live) → ops acceptance test (10). Step 10 also covers the deferred surfaces + 507 KB bundle code-split.

### 5. Port the 16 SEO place pages into Astro
The rebuilt static marketing site + 16 SEO place pages exist only on the `archive/static-marketing-seo` branch (pre-Astro architecture). Port them: drop HTML into `apps/marketing/src/legacy/`, add JSON manifests in `apps/marketing/src/content/pages/`, and extend `expectedRoutes` in `apps/marketing/scripts/check-route-parity.mjs` from 12 → 28. Do **not** ship the old branch as-is (FormSubmit-only forms, pre-consent GA — both superseded on main).

### 6. Booking lifecycle gaps
Known edges of the 27-state machine (from [APP_REVIEW.md](APP_REVIEW.md), June 2026 — still open):
- No **no-show** event (neither party can be marked as not showing up)
- No exit from `deposits_held` if the webhook never fires
- `disputed` is terminal with no admin resolution path
- No post-completion dispute window
- No **guide verification flow** despite marketing claiming "vetted students"
- No availability calendar / double-booking guard

### 7. Extract `@detour/types` + de-duplicate the booking state machine
`apps/mobile/types/index.ts` is coupled to `BookingState` from `apps/mobile/lib/booking/stateMachine.ts`. Extract together with de-duplicating the state machine mirrored between `apps/mobile/lib/booking/` and `supabase/functions/_shared/` (parity test: `supabase/functions/__tests__/stateMachineParity.test.ts`).

---

## Next

- **Native maps:** wire `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` so the `trips/live/[id].native.tsx` variant renders real maps (web fallback already stubbed in `apps/mobile/metro.config.js`).
- **Push enablement:** the pipeline is built (`send-push` drains `notifications` → Expo Push; pg_cron schedules it). Remaining: FCM/APNs credentials + device-token registration verification, then flip it on. See [DEFERRED.md](DEFERRED.md).
- **EAS / store submission:** run `eas init` in `apps/mobile/` to replace the placeholder projectId in `app.json`; add `eas.json` (verify current state first).
- **Marketing content backlog** (see `marketing-ops/`): 6-hour + overnight layover guides, street-food guide, meet-the-buddies page, founding-traveler stories; manual ops: Brevo, Google Business Profile, Trustpilot, GSC/Bing verification, PR/Reddit.
- **Admin bundle code-split** (part of runbook step 10): the main admin bundle is ~507 KB.

---

## Blocked-external

- **Razorpay live keys** — blocked on company registration + GST. Checkout already works in test mode; what live keys unlock is real money-out (refunds/payouts/fund accounts behind `RAZORPAY_LIVE_FEATURES_ENABLED`) — full runbook in [DEFERRED.md](DEFERRED.md) §1, including draining the stubbed-payout backlog via `replay-stubbed-payouts`.
- **App Store / Play submission** — needs EAS setup (above) + Apple/Google developer accounts.

---

## Working agreements
- Commit frequently with conventional messages (`feat(booking): …`, `fix(rls): …`); PRs only — `main` is protected.
- When you finish an item, delete it here (history lives in git) and update the "Last verified" stamp.
- Keep `CLAUDE.md` / `AGENTS.md` in sync when structure, commands, or priorities change.
