# Detour — Next Tasks

> Last verified: 2026-09-08. This replaces the April 2026 task list (Tasks 0–7), which is fully done — see git history and [SMOKE_TEST_RESULTS.md](SMOKE_TEST_RESULTS.md).

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

### 2. Completed application handoff
PR #55 has been reviewed and merged. The September application handoff implements reviewed no-shows, support cases, bounded post-completion disputes, audited settlement outcomes, shared `@detour/types`, one canonical state machine, and lazy admin routes. The existing two-deposit recovery sweep was verified with database tests. See [BOOKING_SUPPORT_RUNBOOK.md](../technical/BOOKING_SUPPORT_RUNBOOK.md) for deployment and operations.

### 3. Dependency hygiene
Keep Expo 52's `react-native-maps` at exactly 1.18.0. Tailwind 4 requires a coordinated NativeWind migration; Node typings should match the oldest supported runtime (22). Review patch PRs with Expo alignment, mobile tests, admin build and CI. Root overrides remain the security-patch mechanism.

### 4. Admin 2.0 — run the 10 provider-config steps
Remaining provider activation requires the owner accounts and credentials. Route-level bundle splitting is implemented. Follow [ADMIN2_PROVIDER_SETUP_RUNBOOK.md](../technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md) in order:
DNS for `admin.detourtrips.com` + Supabase redirects (step 2) → MFA enable/protect decision (step 3) → Resend lead email (4) → GA4 service account (5) → Search Console (6) → publishing-loop hooks (7) → Sanity content import (8) → marketing production release (9 — the privacy/terms 404 there is **already fixed**, both routes live) → ops acceptance test (10). Step 10 still covers acceptance of provider-dependent surfaces.

### 5. Port the 16 SEO place pages into Astro
The rebuilt static marketing site + 16 SEO place pages exist only on the `archive/static-marketing-seo` branch (pre-Astro architecture). Port them: drop HTML into `apps/marketing/src/legacy/`, add JSON manifests in `apps/marketing/src/content/pages/`, and extend `expectedRoutes` in `apps/marketing/scripts/check-route-parity.mjs` from 12 → 28. Do **not** ship the old branch as-is (FormSubmit-only forms, pre-consent GA — both superseded on main).

### 6. Product decisions and separate roadmap
- Confirm the proposed seven-day post-completion reporting window (`POST_COMPLETION_DISPUTE_DAYS` and its matching SQL interval) before launch.
- Guide verification and availability-calendar work remain separate product scope; these were not part of the September implementation handoff.
- The marketing website and SEO page port remain excluded from this handoff completion.

---

## Next

- **Native maps:** wire `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` so the `trips/live/[id].native.tsx` variant renders real maps (web fallback already stubbed in `apps/mobile/metro.config.js`).
- **Push enablement:** the pipeline is built (`send-push` drains `notifications` → Expo Push; pg_cron schedules it). Remaining: FCM/APNs credentials + device-token registration verification, then flip it on. See [DEFERRED.md](DEFERRED.md).
- **EAS / store submission:** run `eas init` in `apps/mobile/` to replace the placeholder projectId in `app.json`; add `eas.json` (verify current state first).
- **Marketing content backlog** (see `marketing-ops/`): 6-hour + overnight layover guides, street-food guide, meet-the-buddies page, founding-traveler stories; manual ops: Brevo, Google Business Profile, Trustpilot, GSC/Bing verification, PR/Reddit.

---

## Blocked-external

- **Razorpay live keys** — blocked on company registration + GST. Checkout already works in test mode; what live keys unlock is real money-out (refunds/payouts/fund accounts behind `RAZORPAY_LIVE_FEATURES_ENABLED`) — full runbook in [DEFERRED.md](DEFERRED.md) §1, including draining the stubbed-payout backlog via `replay-stubbed-payouts`.
- **App Store / Play submission** — needs EAS setup (above) + Apple/Google developer accounts.

---

## Working agreements
- Commit frequently with conventional messages (`feat(booking): …`, `fix(rls): …`); PRs only — `main` is protected.
- When you finish an item, delete it here (history lives in git) and update the "Last verified" stamp.
- Keep `CLAUDE.md` / `AGENTS.md` in sync when structure, commands, or priorities change.
