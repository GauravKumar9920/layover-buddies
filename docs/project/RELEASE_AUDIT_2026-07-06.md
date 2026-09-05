# Detour — End-to-End Release Audit

*Historical snapshot from July 6, 2026 — rescued from a session worktree. Several findings have since been fixed (e.g. RLS policy coverage landed in later migrations; account deletion now exists via the `delete-account` edge function). Verify against the code before acting on any item. See [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md) for current state.*

> Generated 2026-07-06 on branch `claude/quizzical-hodgkin-fb136e` by a 6-subsystem
> sequential code audit (traveler UX, guide UX, auth + booking core, backend,
> money + safety, ops + release) followed by a cross-area synthesis. Every claim
> cites the file it was read from. Priorities: **P0** = blocks any public release
> (money, safety, legal, auth, data integrity, or every user hits it) · **P1** =
> first weeks after launch · **P2** = polish. Effort: S < 1 day · M = 1–3 days ·
> L ≈ 1 week · XL = external dependency / multi-week.

## 1. Executive summary

Detour is much closer to a real product than its own docs suggest: the 25-state booking lifecycle is implemented end-to-end on both sides (inquiry → agreement → deposit/balance → QR trip start → trip pot/top-ups → expense proofs → reconciliation receipts), money-in is genuinely production-shaped (server-side Razorpay order creation, HMAC-verified webhook, idempotent capture, service-role-only financial tables, pg_cron for every timed transition), and the admin console, CI, and push pipeline are all further along than CLAUDE.md's "deferred" notes. The launch blockers are almost never missing screens — they are enforcement, compliance, and operational gaps: a permissive bookings UPDATE RLS policy that lets any participant rewrite status/amounts from the client, a confirmed state-machine drift where the server penalizes travelers for platform-initiated cancellations, SOS alerts that no human is actually notified about, a password-reset flow with no completion screen, no account deletion or block/report (both hard App Store rejection risks), and an app that literally cannot be store-submitted today (placeholder EAS projectId, debug-keystore release signing, no eas.json).

Realistic distance: roughly 2–4 focused weeks of P0 work gets an invite-scale, early-access-free-mode launch (money captured only as the ₹500 deposit or not at all, payouts queued) — most P0s are small, well-localized fixes in code that already exists. A monetized public launch is gated on an external timeline: Razorpay live KYC + RazorpayX onboarding, flipping RAZORPAY_LIVE_FEATURES_ENABLED, and draining the stubbed payout backlog — until then the platform can take money but cannot refund travelers or pay guides, which is untenable for anything beyond a hand-held pilot. The strategic liability to budget for is the three-way state-machine duplication (mobile TS / edge TS / plpgsql), which has already produced one real money bug and will produce more on every lifecycle change until a parity test and eventual dedup land.

### Verification pass — branch-reality corrections

Every P0 was re-verified by hand against this branch (`claude/quizzical-hodgkin-fb136e`) after the automated audit, because some audit agents partially read the repo's main-branch checkout (relative paths resolved into a main-based worktree). Results:

**Confirmed on this branch (evidence re-checked in code):** server-side cancellation drift (edge machine lumps `platform`/`system` cancel actors with traveler-fault at `_shared/stateMachine.ts:143`, plpgsql maps `system` into the traveler-penalty branch at `20260512100300:178`, while mobile routes both to `cancelled_force_majeure`); permissive bookings UPDATE RLS (no WITH CHECK, no column limits, no transition trigger); SOS has no push kind and no ops alert; password reset dead-ends (`resetPasswordForEmail` without redirectTo, no `updateUser` screen); no account deletion / legal links; no report/block; push pipeline present but not live (reproduced on device: FCM uninitialized); EAS projectId literally `PLACEHOLDER_RUN_EAS_INIT_TO_GENERATE`, no `eas.json`; money-out gated behind `RAZORPAY_LIVE_FEATURES_ENABLED`; 7-hour onboarding gate; "Continue with Google" stub; storage policies allowing any authenticated user to modify any photo.

**Removed as stale (true on main, already resolved on this branch by the 2026-07-02 flow rework):**
- ~~Guide dashboard filters on defunct statuses~~ — fixed 2026-07-03; `REQUEST_STATES = ['chat_open']` + `isUpcomingBookingState` partitioning.
- ~~"Test Mode — Sample Cards" hint on the payment screen~~ — the legacy full-pay screen (`book/payment/[bookingId].tsx`) and `lib/api/payments.ts` no longer exist; Razorpay checkout lives in `lib/api/razorpayCheckout.ts` (deposits/balance/top-up only).

Subsystem sections below are the auditors' raw maps: where they mention `payments.ts`, the payment screen's test-card box, `recordPaymentResult`, or an empty guide dashboard, read them with the corrections above.

## 2. Cross-cutting risks

- Three-way state-machine duplication (mobile TS / edge TS / plpgsql RPC) has already produced a real money bug — platform cancellations forfeit the traveler's deposit server-side — and will keep drifting until a parity test and dedup land.
- Money-in works but money-out is stubbed: cancellation receipts show refunds that are actually parked in payout_dispatches, and guides earn nothing until Razorpay live KYC + RazorpayX complete and the replay runbook is executed. Public launch before that must stay in early-access free mode.
- The server-enforced FSM is undermined by client trust: permissive bookings UPDATE RLS plus still-exported legacy write helpers (cancelBooking, recordPaymentResult) let any participant jump states or fake payment from the anon key.
- App Store compliance is a cluster of independent rejection risks — no account deletion, no tappable Terms/Privacy, no block/report, dead 'Coming soon' buttons — any one of which blocks the release regardless of code quality.
- Safety UI overpromises capability: SOS claims to 'immediately notify ops' but only writes an unmonitored DB row; the live map waits for location data nothing publishes; escrow copy shows 'Held in escrow' for unpaid bookings. Real liability if an incident occurs mid-trip.
- Zero notification delivery on a 4-hour-notice marketplace breaks the core loop for both sides: guides miss requests, travelers miss agreement/payment events; the coded push pipeline just needs to be turned on.
- Production is flying blind: no crash reporting, no error boundary, ops on one laptop with no audit trail — incidents during live trips or payments are invisible and unrecoverable.
- Docs/memory drift is actively misleading development: CLAUDE.md calls push 'deferred' (it is built), memory says the legacy payment path was 'deleted' (it is present and dangerous), and stale in-code comments mislabel wired features as stubs.

## 3. Prioritized roadmap

### P0 — must fix before any public user (9)

| # | Item | Effort | Why |
|---|------|--------|-----|
| 1 | **Fix server-side cancellation drift (platform/system → force majeure) + add state-machine parity test** | S | The DB RPC and edge state machine forfeit the traveler's deposit for platform-initiated cancellations; the client fix never landed server-side, and the server is what moves money. A Deno parity test across the transition tables prevents recurrence permanently.<br>_`supabase/functions/_shared/stateMachine.ts`, `supabase/migrations/20260512100300_cancellation_function.sql`, `apps/mobile/lib/booking/stateMachine.ts`_ |
| 2 | **Lock down bookings UPDATE RLS (WITH CHECK + column restrictions or a transition trigger)** | M | Either party can PATCH status/payment_status/amounts via the anon key — the 20260414 policies are `FOR UPDATE USING (auth.uid() = party)` with no WITH CHECK and no column restriction, and the only bookings trigger is updated_at (verified on-branch). A traveler can self-mark trip_ready/captured or cancel a paid trip with no refund resolution. Add a transition-validating trigger or column-restricted policies. (The audit's companion claim about legacy client write paths — `recordPaymentResult`, the full-pay payment screen — is stale: those were deleted in the 2026-07-02 flow rework on this branch.)<br>_`supabase/migrations/20260414100000_rls_fixes.sql`, `apps/mobile/lib/api/bookings.ts`, `apps/mobile/app/(traveler)/book/payment/[bookingId].tsx`_ |
| 3 | **Wire SOS to a real-time ops channel (email/WhatsApp + push kind)** | S | SOS currently only inserts a DB row whose sole consumer is a never-deployed local console, while the UI promises immediate ops notification. A trigger/edge hook on sos_alerts insert alerting the founder's phone is a few hours of work and removes the worst safety gap before any public trip runs.<br>_`apps/mobile/components/bookings/SafetyBar.tsx`, `supabase/functions/_shared/pushCopy.ts`, `apps/admin/src/pages/SOS.tsx`_ |
| 4 | **Complete the password-reset flow end-to-end** | S | resetPasswordForEmail is called with no redirectTo, detectSessionInUrl is false, and no screen calls updateUser({password}) — every locked-out user hits a dead end. Auth-critical and hit repeatedly in production.<br>_`apps/mobile/lib/auth.ts`, `apps/mobile/lib/supabase.ts`, `apps/mobile/app/(auth)/forgot-password.tsx`_ |
| 5 | **Add account deletion + tappable Terms/Privacy (app screens + static marketing pages)** | M | Apple 5.1.1(v) requires in-app account deletion; both stores require a privacy policy (Google especially with location permission). Currently neither exists anywhere — a guaranteed store rejection and a GDPR exposure for international travelers.<br>_`apps/mobile/app/(traveler)/(tabs)/profile.tsx`, `apps/mobile/app/(auth)/signup.tsx`, `apps/marketing/`_ |
| 6 | **Add report/block user mechanism surfaced in admin** | M | An in-person-meeting marketplace with chat has zero block/report/moderation; Apple guideline 1.2 requires it for UGC apps and it is a genuine trust/safety gap. Minimal path: a reports table + in-app 'Report user' action + admin list view.<br>_`apps/mobile/app/(shared)/messages/[bookingId].tsx`, `apps/admin/src/pages`_ |
| 7 | **Turn on push notifications end-to-end (EAS dev build, prod cron + secrets, verify delivery)** | M | The entire pipeline is coded and tested (tokens → notifications → cron → send-push → Expo) but not live. With a 4-hour booking notice, guides miss requests and travelers miss agreement/balance events without it — the core marketplace loop depends on delivery. Add SOS as a push kind while here.<br>_`supabase/functions/send-push/index.ts`, `apps/mobile/lib/push/registerPushToken.ts`, `supabase/migrations/20260520100200_cron_send_pending_pushes.sql`_ |
| 8 | **Stand up the store build pipeline: eas init + eas.json, release signing, delete app.json** | M | EAS projectId is a literal placeholder, there is no eas.json, and the Android release buildType is signed with the debug keystore — the app cannot be submitted to either store today. Also resolves the app.json/app.config.js drift.<br>_`apps/mobile/app.config.js`, `apps/mobile/android/app/build.gradle`, `apps/mobile/app.json`_ |
| 9 | **Decide launch money mode; if monetized, complete Razorpay live KYC + RazorpayX and run the payout-replay flip** | XL | Refunds/payouts throw behind RAZORPAY_LIVE_FEATURES_ENABLED — the platform can take money but cannot return or disburse it. Either launch publicly in early-access free mode (defensible for invite scale) or complete live onboarding, flip the flag, drain payout_dispatches, and set all prod secrets. This is the single hard blocker for a real marketplace; external KYC timeline makes it XL.<br>_`supabase/functions/_shared/razorpayClient.ts`, `supabase/functions/replay-stubbed-payouts/index.ts`_ |

### P1 — first weeks after launch (13)

| # | Item | Effort | Why |
|---|------|--------|-----|
| 1 | **Add crash reporting (Sentry via Expo plugin) + root ErrorBoundary** | S | No Sentry/analytics/error boundary anywhere — production crashes during live trips, SOS, or payments are invisible. One dependency + wizard run for the bulk of the value.<br>_`apps/mobile/package.json`, `apps/mobile/app/_layout.tsx`_ |
| 2 | **Soften the 7-hour layover gate in traveler onboarding** | S | Step 2 hard-blocks anyone under 7 hours with no skip, waitlist, or exit, and the root layout gates the whole app on onboarding — a large class of real users hits an unrecoverable dead end at first launch.<br>_`apps/mobile/app/(traveler)/onboarding.tsx`_ |
| 3 | **Make live trip tracking honest: wire the Google Maps key and build a guide location publisher, or de-scope the promise** | L | The traveler map subscribes to location_tracking that nothing ever writes, both map variants need the deferred Maps key, and SOS's location fallback depends on it. Either ship a guide-side foreground publisher for in-progress trips (M–L) or hide the map layer and fix the 'Waiting for guide…' copy before launch (S).<br>_`apps/mobile/app/(traveler)/trips/live/[id].native.tsx`, `apps/mobile/app.config.js`_ |
| 4 | **Tighten storage RLS on itinerary-photos and avatars to owner folders** | S | Any authenticated user can overwrite or delete any guide's photos/avatar (policies check only auth.uid() IS NOT NULL) — a defacement/abuse vector once public. One migration mirroring the expense-proofs pattern.<br>_`supabase/migrations/20260414103000_storage_buckets.sql`_ |
| 5 | **Surface payout VPA in guide Profile and fix hardcoded fee copy** | S | Guides discover the VPA requirement standing next to the traveler at the airport (qr-scan error path is the only route), cannot view/correct a typo'd VPA, and see hardcoded '25%/75%' copy that contradicts the dynamic rate system and their own receipts. Money-copy mismatch invites disputes. Also settle the 25% vs 15% commission decision before monetization.<br>_`apps/mobile/app/(guide)/profile.tsx`, `apps/mobile/app/(guide)/requests.tsx`, `packages/config/constants.ts`_ |
| 6 | **Harden the production Supabase client and audit prod auth config** | S | lib/supabase.ts silently falls back to a placeholder URL and retries against localhost/Metro origins in prod builds; email-confirm settings and redirect URLs are unaudited and signUp sets no emailRedirectTo. Hard-fail on missing env, __DEV__-gate the fallback, and verify dashboard auth settings + deep links before launch.<br>_`apps/mobile/lib/supabase.ts`, `apps/mobile/lib/auth.ts`_ |
| 7 | **Add network-error states with retry across traveler screens** | S | Load failures render as 'No guides found' (Explore), silent drops (Saved), or unhandled rejections (Search) — airport travelers on flaky roaming data see a convincingly empty marketplace with no retry affordance.<br>_`apps/mobile/app/(traveler)/(tabs)/index.tsx`, `apps/mobile/app/(traveler)/(tabs)/search.tsx`, `apps/mobile/app/(traveler)/(tabs)/saved.tsx`_ |
| 8 | **Set up EAS Update (expo-updates) for OTA fixes** | S | Without OTA, every post-launch JS bug requires a full store review cycle — painful for a time-sensitive layover product. Piggybacks on the eas.json work.<br>_`apps/mobile/package.json`, `apps/mobile/app.config.js`_ |
| 9 | **Add double-booking guard at booking creation** | S | Nothing prevents two travelers reaching balance_paid with the same guide at overlapping times (or booking past dates); the conflict surfaces on trip day. A tstzrange EXCLUDE constraint or edge-fn check is small.<br>_`apps/mobile/lib/api/bookings.ts`, `supabase/migrations/`_ |
| 10 | **Guide verification: student-ID upload + admin verify/ban toggle** | M | The core product promise is 'verified Mumbai student guides' but guides auto-approve with free-text university and no ID artifact, and admin cannot verify or suspend anyone. Minimum: ID photo upload, admin toggle on the existing is_verified column, verified badge, ban action.<br>_`apps/mobile/app/(guide)/profile.tsx`, `apps/admin/src/pages/Users.tsx`_ |
| 11 | **Guide earnings/payout history screen** | M | Guides cannot see payouts across trips, pending vs dispatched status, or anything for tax purposes despite TDS withholding under §194C — the only aggregate is a broken dashboard stat using legacy math. Reuse the reconciliation snapshot data.<br>_`apps/mobile/lib/booking/reconciliationSnapshot.ts`, `apps/mobile/app/(guide)/index.tsx`_ |
| 12 | **Add pg_cron sweep for stale chat_open/agreement_* inquiries** | S | Nothing expires dead inquiries from departed travelers, so guide request queues accumulate garbage indefinitely; existing cron patterns make this a small addition.<br>_`supabase/migrations/20260512100400_pg_cron_jobs.sql`_ |
| 13 | **Strengthen money-path tests: cancellation golden tests, balance/top-up capture, drop --no-check** | M | The P0 drift happened because the promised checks were never built; test:edge currently ignores type errors. Golden tests on compute_cancellation_resolution amounts plus capture-handler tests protect every rupee-moving path (parity test lands with the drift fix).<br>_`supabase/functions/__tests__/`, `package.json`_ |

### P2 — polish / later (11)

| # | Item | Effort | Why |
|---|------|--------|-----|
| 1 | **Launch-polish sweep: dead affordances and copy honesty** | S | One pass to remove the review-bait and trust dents: hide the 'Continue with Google' stub, implement or remove itinerary Share and the video placeholder, fix search hero copy to match name-only behavior (or extend search to skills/bio), style the 'Booking not found' fallback, add useFocusEffect refresh to Trips, fix the 'Held in escrow' claim on unpaid bookings, and correct SOS copy until real alerting lands.<br>_`apps/mobile/app/(auth)/signup.tsx`, `apps/mobile/app/(traveler)/itinerary/[id].tsx`, `apps/mobile/app/(traveler)/trips/[id].tsx`_ |
| 2 | **QR-scan manual token-entry fallback + user-facing copy** | S | A denied camera permission or hardware failure dead-ends trip start (and fund release) at the airport with developer-facing 'Install expo-camera' copy.<br>_`apps/mobile/app/(guide)/bookings/qr-scan/[bookingId].tsx`_ |
| 3 | **Extend seed.sql with financial-lifecycle fixtures** | S | Seed bookings use only legacy statuses with zero agreements/deposits rows, so the exact flows that gate launch cannot be QA'd locally without manual SQL. One booking per key state (awaiting_deposits, awaiting_balance, trip_ready, awaiting_proofs) fixes it.<br>_`supabase/seed.sql`_ |
| 4 | **Log or alert on malformed webhook payment notes instead of silent 200** | S | Returning ok:true on malformed notes means Razorpay never retries and no payment_events row records the anomaly — a notes-schema regression would silently strand captured payments.<br>_`supabase/functions/razorpay-webhook/index.ts`_ |
| 5 | **Dispute resolution path for the terminal 'disputed' state** | M | Both state machines list disputed with zero outgoing transitions and no admin RPC resolves it — the first real dispute post-launch requires manual SQL against production. Acceptable to defer for invite scale, needed soon after.<br>_`supabase/functions/_shared/stateMachine.ts`, `supabase/functions/issue-refund/index.ts`_ |
| 6 | **Decline reason capture + traveler messaging on guide decline** | S | Declines silently produce a dead cancelled_pre_signing booking with no reason or re-match hook — poor traveler experience on a short layover clock.<br>_`apps/mobile/lib/api/bookings.ts`, `apps/mobile/app/(guide)/requests.tsx`_ |
| 7 | **Guest browsing before signup** | M | Every visitor must create an account before seeing a single guide — a conversion cliff for a layover-impulse product, and Apple discourages forced registration for non-account features. Fine to defer at invite scale.<br>_`apps/mobile/app/_layout.tsx`_ |
| 8 | **Deduplicate the three-way booking state machine (extract @detour/types + shared logic)** | L | The root architectural liability behind the cancellation drift; the parity test contains the bleeding, but the mobile TS / edge TS / plpgsql triplication should be collapsed together with the planned @detour/types extraction before the lifecycle changes again.<br>_`apps/mobile/lib/booking/stateMachine.ts`, `supabase/functions/_shared/stateMachine.ts`_ |
| 9 | **Chat attachments and location pins** | M | Text-only chat pushes meeting-point coordination (and payment risk) to WhatsApp; photos and a location pin are the minimum to keep conversations on-platform. Post-launch improvement.<br>_`apps/mobile/app/(shared)/messages/[bookingId].tsx`_ |
| 10 | **Guide availability calendar** | M | The binary accepting-bookings toggle forces students with class schedules to manually decline; blocked dates/hours reduce declines and dead inquiries. Valuable but not launch-gating at invite scale.<br>_`apps/mobile/app/(guide)/profile.tsx`_ |
| 11 | **Update CLAUDE.md and delete dead backend paths (create-booking-payment → 410, stale stub comments)** | S | Docs say push is deferred (built), memory says the legacy payment path was deleted (present), and in-code comments mislabel wired features as stubs — actively misleading for a two-person team moving fast.<br>_`CLAUDE.md`, `supabase/functions/create-booking-payment/index.ts`_ |

## 4. Feature matrix — built vs missing

### Traveler app

**Built:**
- ✅ Explore/Search/Saved/Trips tabs with skeletons, empty states, pull-to-refresh
- ✅ Spec-compliant booking form (guide hero, itinerary cards, price breakdown)
- ✅ FSM-gated trip detail with 15s polling and CTA routing
- ✅ Deposit + balance payment screens, cancellation flow with refund preview and receipts
- ✅ QR trip handoff with Realtime auto-advance
- ✅ Review flow with duplicate check
- ✅ 4-step onboarding wizard gating the app

**Missing / not wired:**
- ❌ Account deletion, legal/support links in profile
- ❌ Offline/error differentiation (network failure renders as empty marketplace)
- ❌ Vibe/skill search (name-only despite UI copy)
- ❌ Guest browsing before signup
- ❌ Soft path for <7h layovers (hard dead-end today)
- ❌ Share/video placeholders still tap-able

### Guide app

**Built:**
- ✅ Full Phase 1–4 lifecycle: requests inbox, agreement drafting with live financial snapshot, QR scan trip start, in-trip trip pot + top-ups, expense-proof upload, reconciliation receipts
- ✅ Itinerary CRUD with photo upload
- ✅ Rich profile editor with gallery and accepting-bookings toggle
- ✅ Payout VPA capture (via qr-scan error path)

**Missing / not wired:**
- ❌ Dashboard filters on defunct legacy statuses — permanently empty for real bookings
- ❌ Earnings/payout history (TDS is withheld; guides will ask)
- ❌ Payout VPA visible/editable in Profile
- ❌ Availability calendar / blocked dates
- ❌ Guide verification/KYC (core 'verified student' promise)
- ❌ Decline reason capture
- ❌ QR-scan manual fallback

### Booking lifecycle & state machine

**Built:**
- ✅ 25-state FSM (chat_open → rated, 6 cancelled_* variants) with guards and UI classifiers
- ✅ Server-side transitions via edge functions for signing/deposits/balance/cancel/QR/proofs
- ✅ pg_cron for T-72 late fee, T-12 no-pay cancel, deposit-window expiry, trip_ready promotion
- ✅ Cancellation economics RPC writing resolutions and payout dispatches

**Missing / not wired:**
- ❌ Server-side copy drifted: platform/system cancellations penalize the traveler (client fixed, server + DB RPC not)
- ❌ Parity test between the three state-machine copies (promised in code, never built)
- ❌ Sweep for stale chat_open/agreement_* inquiries
- ❌ Any resolution path out of 'disputed'
- ❌ Double-booking/availability guard at createBooking

### Payments — money in

**Built:**
- ✅ Server-side order creation with tamper-proof amounts (fixed ₹500 deposit, agreement-derived balance, top-up rows)
- ✅ HMAC-verified webhook + authenticated confirm-payment fallback with payment-id idempotency
- ✅ Financial tables service-role-write-only with DB CHECK invariants
- ✅ Early-access zero-fee mode with rates snapshotted onto agreements

**Missing / not wired:**
- ❌ Test-card hint card shown unconditionally on the payment screen
- ❌ Legacy full-pay path (client-writable payment_status, 410 backend) still in tree
- ❌ Commission rate decision (25% in code vs 15% in docs)
- ❌ Webhook silently 200s malformed payment notes

### Payouts & refunds — money out

**Built:**
- ✅ Complete API code for refunds/payouts/fund accounts, idempotency-keyed
- ✅ Stub seam: dispatches queue in payout_dispatches when RAZORPAY_LIVE_FEATURES_ENABLED is off
- ✅ replay-stubbed-payouts drain endpoint
- ✅ Admin Cancellations + Payouts pages with per-row retry

**Missing / not wired:**
- ❌ Live Razorpay KYC + RazorpayX onboarding — zero money can leave the platform today
- ❌ Ops runbook for the live flip + backlog drain
- ❌ VPA verification (penny-drop) before dispatching to a typed-in UPI ID

### Safety

**Built:**
- ✅ SOS writes real sos_alerts rows with location, duplicate-tap suppression
- ✅ Admin SOS page with Acknowledge/Resolve + Maps link
- ✅ Live-map screens (native maps + web fallback) subscribing to location_tracking

**Missing / not wired:**
- ❌ SOS delivery — no push/SMS/email fires; only consumer is a local-only console, while UI claims 'immediately notifies ops'
- ❌ Guide location publisher — nothing ever writes location_tracking, so the live map waits forever
- ❌ Block/report/moderation anywhere (Apple 1.2 UGC rejection risk)
- ❌ Google Maps API key wiring

### Messaging & notifications

**Built:**
- ✅ Realtime chat with lifecycle deep-link chips and quick replies
- ✅ Inbox merging all non-terminal bookings with unread counts
- ✅ Full push pipeline coded: tokens table, client registration, notifications table, cron drain, send-push edge fn with Expo API + tests

**Missing / not wired:**
- ❌ Push not live: needs EAS dev build (not Expo Go), prod cron + secrets
- ❌ SOS missing from push kinds
- ❌ In-app notification center (bell was replaced by sign-out)
- ❌ Chat attachments/location pins (conversations will migrate to WhatsApp)

### Auth & accounts

**Built:**
- ✅ Email/password signup with role selection and DB provisioning triggers
- ✅ Session bootstrap with stale-token recovery and role-based routing
- ✅ Traveler onboarding gate
- ✅ Dev-only design-preview bypass correctly __DEV__-gated

**Missing / not wired:**
- ❌ Password reset completion (no in-app screen, no PASSWORD_RECOVERY handler — every locked-out user is stranded)
- ❌ Account deletion (Apple 5.1.1(v))
- ❌ Google sign-in (dead 'Coming soon' button)
- ❌ emailRedirectTo/deep-link config; email-confirm settings unaudited
- ❌ Role sourced from client-writable user_metadata

### Backend schema, RLS & storage

**Built:**
- ✅ 26-table schema across 41 migrations covering the full financial lifecycle
- ✅ ~86 RLS policies, participant-scoped reads, service-role-only financial writes
- ✅ Realtime publication for all status-driven screens
- ✅ Storage buckets with private, booking-scoped expense proofs
- ✅ Auth-sync and guide-profile auto-create triggers

**Missing / not wired:**
- ❌ Bookings UPDATE policies have no WITH CHECK/column restriction — either party can rewrite status/amounts via anon-key PATCH
- ❌ itinerary-photos/avatars writable/deletable by any authenticated user (defacement vector)
- ❌ Seed data predates the financial lifecycle (no agreements/deposits rows — key flows untestable from seed)

### Admin & ops

**Built:**
- ✅ Eight working pages: Overview, Users, Bookings, Revenue, SOS ack/resolve, Cancellations with refund re-issue, Payouts with stuck-row retry, platform pricing Settings
- ✅ Deliberate local-only security model with prod-build guard

**Missing / not wired:**
- ❌ Guide verify/ban actions (is_verified read-only)
- ❌ Dispute workflow and chat/review inspection for safety reports
- ❌ Any audit trail of admin actions
- ❌ Ops chained to one laptop (acceptable week-one, needs the planned proxy before a second operator)

### Release engineering & observability

**Built:**
- ✅ Strong CI: typecheck/lint/Jest, Deno edge tests, admin build, fresh-DB migration check, manual-dispatch prod migrations with dry-run
- ✅ Jest coverage of state machine, CTAs, snapshots; Deno tests for webhook signature and deposit capture
- ✅ Permissions/usage strings declared; Maps-key config plugin

**Missing / not wired:**
- ❌ EAS projectId is a literal placeholder; no eas.json; Android release signed with the debug keystore — cannot submit to either store
- ❌ Crash reporting/analytics/ErrorBoundary (production crashes invisible)
- ❌ OTA updates (expo-updates absent — every JS fix needs store review)
- ❌ app.json/app.config.js drift
- ❌ Prod supabase client falls back to localhost origins and a placeholder URL
- ❌ Money-path test gaps: no parity, balance/top-up capture, or cancellation golden tests; test:edge runs --no-check

### Legal & compliance

**Built:**
- ✅ Signup mentions Terms/Privacy in plain text

**Missing / not wired:**
- ❌ No tappable Terms/Privacy links or legal screens/pages (Apple + Google both require)
- ❌ No account deletion (Apple 5.1.1(v))
- ❌ No report/block (Apple 1.2)
- ❌ GDPR posture for international travelers unaddressed

## 5. Subsystem detail

### traveler-ux

The traveler side is a surprisingly deep, mostly-wired flow: browse/search/saved/trips tabs, guide and itinerary detail, a spec-compliant booking form, a two-path payment screen (deposit-via-agreements plus legacy full-pay Razorpay), balance payment, FSM-driven trip detail, QR handoff, live tracking with SOS, cancellation with resolution preview and receipts, and review submission. Loading/empty states are consistently handled via shared Loading/EmptyState/skeleton components, and status gating is derived from the shared booking state machine. The launch blockers are not missing screens but launch hygiene: a permanent "Test Mode — Sample Cards" card on the payment screen, a hard >=7-hour-layover gate in onboarding that dead-ends short-layover users, live map dependent on the deferred Google Maps key, no account-deletion/legal/support surface in profile, and zero offline/error differentiation (network failures render as "No guides found").

**Implemented:**

| Status | Feature | Notes |
|--------|---------|-------|
| ✅ complete | Explore tab — browse guides with search bar, skill filter chips, interest-based ranking, layover time-fit chips, pull-to-refresh, skeleton loading | Client-side filtering only; filter chips hand-tuned to match seeded skill names. Header bell was replaced by a confirm-guarded sign-out button. `apps/mobile/app/(traveler)/(tabs)/index.tsx` |
| 🟡 partial | Search tab — guide search by name | Name-only search despite hero copy promising vibe search ('Try: street food · art walks'); searching those terms returns nothing. No catch on searchGuides — a network error is an unhandled rejection with stale results shown. `apps/mobile/app/(traveler)/(tabs)/search.tsx` |
| ✅ complete | Saved tab — hearted itineraries with Supabase-hydrated favorites store, unsave, empty state | N+1 fetch per favorite (acknowledged in-code as fine for <20). Failed fetches are silently dropped with no error surface. `apps/mobile/app/(traveler)/(tabs)/saved.tsx` |
| ✅ complete | Trips tab — upcoming/past partition via FSM state sets, unread message badges, pull-to-refresh | `apps/mobile/app/(traveler)/(tabs)/trips/index.tsx` |
| ✅ complete | Trip detail — status badge, agreement/deposit CTA block, FSM-gated chat/live/review/cancel actions, 15s status polling | Action visibility derived from canTransition/isActiveBookingState so UI stays in lock-step with the state machine. `apps/mobile/app/(traveler)/trips/[id].tsx` |
| ✅ complete | Booking flow (book/[guideId]) — hero, itinerary cards, arrival/departure/flight inputs, price breakdown, skeleton + inline errors | 964-line rewrite done per CLAUDE.md Task 1 (2026-04-14). `apps/mobile/app/(traveler)/book/[guideId].tsx` |
| 🟡 partial | Payment screen — deposit vs full-pay choice; deposit routes to Phase-2 agreements flow, full pay uses legacy Razorpay checkout | Full-pay path requires react-native-razorpay native bridge (fails in Expo Go, unsupported on web with clear errors). Permanent test-card hint card rendered unconditionally. `apps/mobile/app/(traveler)/book/payment/[bookingId].tsx`, `apps/mobile/lib/api/payments.ts` |
| ✅ complete | Balance payment (Phase 3) — pay remaining balance with webhook-less confirm fallback | `apps/mobile/app/(traveler)/trips/balance/[bookingId].tsx` |
| ✅ complete | Cancellation flow — resolution/refund preview, web-safe confirm, cancellation receipt screen | `apps/mobile/app/(traveler)/trips/cancel/[bookingId].tsx`, `apps/mobile/app/(traveler)/trips/cancellation-receipt/[bookingId].tsx` |
| ✅ complete | Trip QR handoff — renders trip_qr_token QR, auto-navigates to live screen on in_progress via Realtime | react-native-qrcode-svg is in package.json so the defensive 'install package' placeholder never fires. `apps/mobile/app/(traveler)/trips/qr/[bookingId].tsx` |
| 🟡 partial | Live trip tracking — native react-native-maps + Realtime location_tracking subscription; web iframe fallback; SafetyBar/SOS writing to sos_alerts | Both variants depend on the deferred EXPO_PUBLIC_GOOGLE_MAPS_API_KEY; web degrades to a 'Live map coming soon' placeholder with raw coordinates, native PROVIDER_GOOGLE needs key config. `apps/mobile/app/(traveler)/trips/live/[id].native.tsx`, `apps/mobile/app/(traveler)/trips/live/[id].tsx` |
| ✅ complete | Review flow — star rating with labels, 500-char comment, duplicate-review check, animated success view | `apps/mobile/app/(traveler)/trips/review/[id].tsx` |
| 🟡 partial | Traveler profile tab — edit profile, avatar upload, links to saved/trips/chats, sign out | No account deletion, no privacy policy/terms/support links, no notification preferences. `apps/mobile/app/(traveler)/(tabs)/profile.tsx` |
| ✅ complete | Onboarding — 4-step wizard (nationality/gender, layover window with IST-safe timestamps, interests), gates root routing until complete | Well-built but enforces >=7h layover as a hard requirement to advance (see gaps). `apps/mobile/app/(traveler)/onboarding.tsx` |

**Gaps:**

- **[P0] Test-mode sample credit cards displayed unconditionally on the payment screen** — The 'Test Mode — Sample Cards' Card (success/failure/3DS card numbers) renders for every user with no env gate (lines 352-362). Shipping this to production both looks broken and advertises that payments are in test mode; must be gated on a dev/test flag or removed. — `apps/mobile/app/(traveler)/book/payment/[bookingId].tsx`
- **[P0] Onboarding hard-blocks any traveler with a layover under 7 hours — unrecoverable dead end** — Step 2 requires isLayoverEligible (layoverHours >= 7, line 95/105) to advance, with no skip, no waitlist, and no exit; since the root layout gates the whole traveler app on onboarding completion, a 5-hour-layover user (or anyone not on a layover) can never enter the app. Needs a soft gate or an explicit ineligible path. — `apps/mobile/app/(traveler)/onboarding.tsx`
- **[P0] No account deletion or legal/support surface in the traveler profile** — Profile has edit/avatar/sign-out only — no delete-account (Apple App Store Guideline 5.1.1(v) requirement), no privacy policy, terms, or contact-support links. Blocks iOS App Store approval for a public release. — `apps/mobile/app/(traveler)/(tabs)/profile.tsx`
- **[P1] Live map is non-functional without the deferred Google Maps API key** — Native variant uses PROVIDER_GOOGLE (unconfigured key -> blank/crashing map on iOS) and the web variant explicitly renders a 'Live map coming soon' placeholder when EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is empty (lines 40-61). Live tracking is a headline safety feature of an in-trip product; key wiring should land before launch. — `apps/mobile/app/(traveler)/trips/live/[id].tsx`, `apps/mobile/app/(traveler)/trips/live/[id].native.tsx`
- **[P1] Network failures are indistinguishable from empty results across traveler screens** — Explore swallows load errors into the 'No guides found' empty state (index.tsx:57 'catch { // EmptyState handles the empty list }'); Saved silently drops failed fetches; Search has no catch at all (unhandled rejection). No NetInfo/offline detection anywhere in apps/mobile. Airport travelers on flaky roaming data will see a convincingly empty marketplace with no retry affordance. — `apps/mobile/app/(traveler)/(tabs)/index.tsx`, `apps/mobile/app/(traveler)/(tabs)/search.tsx`, `apps/mobile/app/(traveler)/(tabs)/saved.tsx`
- **[P1] Search depth is name-only while the UI promises vibe/experience search; Explore filters are shallow** — Search hero copy says 'Find a local by vibe' and suggests 'street food · art walks · architecture', but searchGuides matches names only, so every suggested query returns 'No guides found'. Explore filtering is client-side skill chips only — no price, duration, date/layover-fit, rating, or language filters for a marketplace browse. — `apps/mobile/app/(traveler)/(tabs)/search.tsx`, `apps/mobile/app/(traveler)/(tabs)/index.tsx`
- **[P1] No notifications surface for travelers** — Push infra exists in lib/push/* (token registration, channels, handler) but is deferred, and there is no in-app notification center; the Explore header bell was deliberately replaced with a sign-out button. Travelers only learn of guide replies/agreement updates via 15s polling on an open trip screen or unread badges on the Trips tab — bad for a time-critical layover product. — `apps/mobile/lib/push/registerPushToken.ts`, `apps/mobile/app/(traveler)/(tabs)/index.tsx`
- **[P2] Itinerary detail has two 'coming soon' dead-end taps: Share and video playback** — Share button fires Alert 'Share coming soon' (line 304) and the video tile fires 'Video playback coming soon — this is the prototype placeholder' (line 667). Either implement (expo Share API is trivial) or hide the affordances before launch. — `apps/mobile/app/(traveler)/itinerary/[id].tsx`
- **[P2] Trip-detail 'Booking not found' fallback is an unstyled bare screen with no way back** — Line 89 renders a raw <Text> in a plain View — no Header, no back button, no theming; a bad/stale booking id (e.g. from a push deep link later) strands the user. — `apps/mobile/app/(traveler)/trips/[id].tsx`
- **[P2] Legacy full-pay path bypasses the Phase-2 deposit/agreement lifecycle** — The 'Pay full' option still runs createRazorpayOrder + recordPaymentResult, which flips status straight to confirmed — the in-code comments themselves flag this as the pre-Phase-2 flow slated for retirement. Two coexisting payment state paths is a reconciliation risk once real money flows. — `apps/mobile/app/(traveler)/book/payment/[bookingId].tsx`, `apps/mobile/lib/api/payments.ts`
- **[P2] Trips tab and Explore never refresh on tab focus** — Both load once on mount; because tabs stay mounted, booking-status changes (guide accepts, deposit captured) don't appear until manual pull-to-refresh. A useFocusEffect reload would fix it cheaply. — `apps/mobile/app/(traveler)/(tabs)/trips/index.tsx`, `apps/mobile/app/(traveler)/(tabs)/index.tsx`

**Quality issues:**
- Search screen's handleSearch has try/finally with no catch — API failures become unhandled promise rejections (apps/mobile/app/(traveler)/(tabs)/search.tsx:35-40)
- Onboarding hardcodes IST offset arithmetic for layover timestamps (apps/mobile/app/(traveler)/onboarding.tsx:130-139) — correct for Mumbai-only but fragile if a second city ever ships
- Explore GuideCard passes a hardcoded shortestTourHours={3} assumption for time-fit chips instead of real per-guide tour data (apps/mobile/app/(traveler)/(tabs)/index.tsx:215)
- Trip detail polls fetchBookingById every 15s forever while mounted, even for terminal-state bookings (apps/mobile/app/(traveler)/trips/[id].tsx:53-58)
- Saved tab fetches favorites one request per id (acknowledged N+1 in apps/mobile/app/(traveler)/(tabs)/saved.tsx:25-27)
- Escrow copy on trip detail claims 'Held in escrow' for any non-captured payment_status including unpaid/failed (apps/mobile/app/(traveler)/trips/[id].tsx:184)

**Quick wins:**
- Gate or delete the test-card hint Card on the payment screen behind __DEV__ / an env flag (apps/mobile/app/(traveler)/book/payment/[bookingId].tsx:352)
- Implement Share on itinerary detail with React Native's built-in Share.share and remove the video placeholder tile (apps/mobile/app/(traveler)/itinerary/[id].tsx:304,667)
- Add catch + error EmptyState with a Retry action to Search and Explore load paths
- Style the trip-detail 'Booking not found' fallback with Header + back button (apps/mobile/app/(traveler)/trips/[id].tsx:89)
- Change Search placeholder/hero copy to match actual name-only behavior, or extend searchGuides to match skills/bio (it already falls back to skills in fetchActiveGuides)
- Add useFocusEffect refresh to the Trips tab so booking-status changes appear without pull-to-refresh

### guide-ux (guide-side mobile screens + shared chat)

The guide-side app is surprisingly deep: the full Phase 1-4 lifecycle is implemented end-to-end (requests → agreement drafting with live financial snapshot → QR-scan trip start → in-trip trip-pot + top-ups → expense-proof upload → reconciliation receipt), plus itinerary CRUD with photo upload and a rich profile editor with gallery. The critical defect is that the guide Dashboard still filters on the pre-Phase-1 status vocabulary ('pending'/'guide_accepted'/'confirmed') while all bookings are now created as 'chat_open' and flow through agreement_*/awaiting_*/trip_ready — so the dashboard's request badge, stats, and Upcoming Tours are permanently empty and a mid-lifecycle booking is reachable only via the chat inbox. The other launch-shaped holes are operational rather than code-stub: zero notifications (fatal for a 4-hour-notice layover product), no earnings/payout history surface, payout UPI setup hidden behind a QR-scan error path, and no availability calendar or guide verification/KYC.

**Implemented:**

| Status | Feature | Notes |
|--------|---------|-------|
| 🟡 partial | Guide dashboard (welcome hero, stats, upcoming tours, pending requests) | Renders fine but filters bookings on legacy statuses that no longer occur (see P0 gap) — for real bookings every section is empty and the earnings stat uses legacy total_price − commission math. `apps/mobile/app/(guide)/index.tsx` |
| ✅ complete | Requests inbox with Accept/Decline | Queries chat_open + agreement_sent; accept advances to agreement_drafting, decline → cancelled_pre_signing. Fee copy is stale (see gaps). `apps/mobile/app/(guide)/requests.tsx`, `apps/mobile/lib/api/bookings.ts` |
| ✅ complete | Agreement drafting (buddy fee, itinerary fund, auto 20% buffer, line items, live pricing preview, send) | Uses canonical computeAgreementSnapshot and dynamic getEffectiveRates; validated trip start ≥ now+4h. `apps/mobile/app/(guide)/bookings/agreement-draft/[bookingId].tsx`, `apps/mobile/lib/api/agreements.ts` |
| ✅ complete | Booking detail with status-driven lifecycle CTA | AgreementCtaBlock + cta.ts routes every state (draft → sign → scan QR → in-trip → upload proofs → receipt). Payout card uses legacy total_price − commission fields rather than the agreement snapshot. `apps/mobile/app/(guide)/bookings/[id].tsx`, `apps/mobile/lib/booking/cta.ts` |
| ✅ complete | QR-scan trip start | expo-camera permission flow, viewfinder overlay, vpa_missing → payout-vpa redirect, success → in-trip. Fallback when camera unavailable is a dead-end message (no manual code entry). `apps/mobile/app/(guide)/bookings/qr-scan/[bookingId].tsx` |
| ✅ complete | In-trip screen (trip pot, elapsed timer, top-up request, end trip) | Realtime via useTrip; TopUpRequestForm wired (in-file comment calling it a stub is stale). `apps/mobile/app/(guide)/bookings/in-trip/[bookingId].tsx` |
| ✅ complete | Expense-proof upload + submit for reconciliation | Per-expense category/amount/payment-screenshot (required)/bill (optional), camera or library, delete, deadline banner, submit → edge fn → receipt. `apps/mobile/app/(guide)/bookings/upload-proofs/[bookingId].tsx`, `apps/mobile/lib/api/expenseProofs.ts` |
| ✅ complete | Buddy receipt + cancellation receipt | §11 reconciliation breakdown (fee → platform fee → TDS → deposit → buffer clawback → net payout) with payout-dispatch status rows. `apps/mobile/app/(guide)/bookings/receipt/[bookingId].tsx`, `apps/mobile/app/(guide)/bookings/cancellation-receipt/[bookingId].tsx` |
| ✅ complete | Itineraries CRUD | Create/edit with cover-photo upload to Storage, category/city chips, stops editor, active toggle, soft delete. `apps/mobile/app/(guide)/itineraries/create.tsx`, `apps/mobile/app/(guide)/itineraries/[id].tsx`, `apps/mobile/app/(guide)/itineraries/index.tsx` |
| ✅ complete | Guide profile editor | Avatar + multi-photo gallery upload, bio/university/hometown/languages, editorial story prompts + pull quote, preview-as-traveler, accepting-bookings toggle, sign out. Self-heals a missing guide_profiles row. `apps/mobile/app/(guide)/profile.tsx` |
| 🟡 partial | Payout UPI (VPA) entry | Save-only form with basic regex validation; reached only via the qr-scan vpa_missing error. No way to view/edit VPA from Profile, no display of the saved value, no verification. `apps/mobile/app/(guide)/profile/payout-vpa.tsx` |
| ✅ complete | Shared inbox + realtime chat | Inbox merges all non-terminal bookings (already fixed for Phase 1+ states); conversation has realtime messages, lifecycle AgreementChip deep-link, and quick-reply chips. Text-only — no image attachments or location sharing. `apps/mobile/app/(shared)/messages/index.tsx`, `apps/mobile/app/(shared)/messages/[bookingId].tsx` |

**Gaps:**

- **[P0] Guide dashboard filters on defunct legacy statuses — permanently empty for real bookings** — createBooking inserts status 'chat_open' (apps/mobile/lib/api/bookings.ts:301) and the lifecycle proceeds through agreement_*/awaiting_*/balance_paid/trip_ready, but the dashboard filters pending='pending', upcoming=['guide_accepted','confirmed'], unread-count fetch=['guide_accepted','confirmed','in_progress'] (index.tsx:79,98-103). Result: the 'N new booking requests' badge, Pending stat, Upcoming Tours, and New Requests sections never populate, and a booking between acceptance and trip_ready is visible ONLY via the chat inbox — a guide can miss 'Scan traveler QR' on trip day entirely. Requests tab and cta.ts already use the new vocabulary, so this is a one-screen drift. — `apps/mobile/app/(guide)/index.tsx`, `apps/mobile/lib/api/bookings.ts`, `apps/mobile/lib/booking/stateMachine.ts`
- **[P0] No notifications of any kind (push, in-app, or badge)** — No expo-notifications usage anywhere in apps/mobile. Guides learn about new requests, agreement signings, balance payment, and trip_ready only by manually opening the app and pull-to-refresh. With a 4-hour minimum booking notice (MIN_BOOKING_NOTICE_HOURS), a layover request can expire before the guide ever sees it. Known-deferred per CLAUDE.md, but it is launch-blocking for the guide side of a time-critical marketplace. — `apps/mobile/app/(guide)/requests.tsx`, `packages/config/constants.ts`
- **[P1] No earnings/payout history surface** — There is no earnings screen at all. The only aggregate is the dashboard 'Earned' stat, which (a) never populates due to the legacy-status bug and (b) computes total_price − commission, ignoring TDS, platform-fee-down, deposit return, and buffer clawback that the reconciliation receipt uses. A guide cannot see payouts across trips, pending vs dispatched payouts, or download anything for tax purposes (TDS is being withheld under §194C, so they will ask). — `apps/mobile/app/(guide)/index.tsx`, `apps/mobile/lib/booking/reconciliationSnapshot.ts`
- **[P1] Payout UPI setup hidden behind a scan-failure path; not visible or editable in Profile** — payout-vpa.tsx is only reachable when qr-scan returns error='vpa_missing' — i.e., the guide discovers the requirement standing next to the traveler at the airport. Profile has no payout section, no display of the saved VPA, and no way to correct a typo'd VPA (a wrong VPA sends the trip pot to a stranger; validation is only a regex). Add a Profile row + prompt at onboarding/first-acceptance. — `apps/mobile/app/(guide)/profile/payout-vpa.tsx`, `apps/mobile/app/(guide)/profile.tsx`
- **[P1] No availability management** — The only control is the binary 'Accepting bookings' toggle (profile.tsx:488-526). No calendar, blocked dates, class-schedule hours, or max-bookings-per-day — students with lectures must decline manually, and every decline is a hard cancelled_pre_signing with no reason capture or suggest-another-time. — `apps/mobile/app/(guide)/profile.tsx`, `apps/mobile/app/(guide)/requests.tsx`
- **[P1] No guide verification/KYC anywhere** — Zero matches for verification/KYC/student-ID/Aadhaar across app, lib, and components. Guides auto-approve per product spec and self-declare university as free text. For a product whose core promise is 'verified Mumbai student guides' meeting foreign travelers alone, there is no student-ID upload, no admin review artifact, and no verified badge — a trust/safety gap for public launch. — `apps/mobile/app/(guide)/profile.tsx`
- **[P1] Fee copy hardcoded and contradicts the dynamic rate system** — requests.tsx:161 shows 'After 25% platform fee' and itineraries/create.tsx:252 shows "You'll receive 75% after platform fee", but the actual charge comes from getEffectiveRates — currently EARLY_ACCESS (0% everything), later 12.5% platform-down + 1% TDS (platformSettings.ts). The 'your payout' number on requests and booking detail (total_price − commission) will not match what the guide's own receipt later shows. Money-copy mismatch erodes guide trust and invites disputes. — `apps/mobile/app/(guide)/requests.tsx`, `apps/mobile/app/(guide)/itineraries/create.tsx`, `apps/mobile/lib/api/platformSettings.ts`
- **[P2] Chat is text-only** — messages/[bookingId].tsx supports only text content — no photo attachments (guides describing meeting points), no location pin, no read receipts beyond unread counts. Adequate for MVP but weak versus WhatsApp, where these conversations will otherwise migrate (and with them, off-platform payment risk). — `apps/mobile/app/(shared)/messages/[bookingId].tsx`
- **[P2] QR-scan has no manual fallback** — If expo-camera is unavailable or permission permanently denied, the screen dead-ends ('Install expo-camera' — developer-facing copy shown to users). No manual token entry or traveler-side alternative, so a broken camera blocks trip start and fund release at the airport. — `apps/mobile/app/(guide)/bookings/qr-scan/[bookingId].tsx`
- **[P2] Decline flow captures nothing** — declineBooking sets cancelled_pre_signing with cancelled_by='guide' but no reason, no message to the traveler, and no re-matching hook — the traveler just sees a dead booking. — `apps/mobile/lib/api/bookings.ts`, `apps/mobile/app/(guide)/requests.tsx`

**Quality issues:**
- apps/mobile/app/(guide)/index.tsx duplicates status vocabulary instead of reusing stateMachine.ts helpers (isActiveBookingState / PAST_STATES) that already exist and are correct
- apps/mobile/app/(guide)/profile.tsx:500-503 — the accepting-bookings toggle awaits updateGuideProfile with no try/catch; a failed write silently leaves UI state out of sync (and the optimistic setProfile runs even on failure)
- Direct client-side status writes for accept/decline (lib/api/bookings.ts:352-370) rely purely on RLS with no state-machine guard, unlike the edge-fn-guarded transitions later in the lifecycle
- apps/mobile/app/(guide)/bookings/in-trip/[bookingId].tsx header comment still says top-up is a 'stub alert' though TopUpRequestForm is wired — stale docs that will mislead the next editor
- No pagination or limits on fetchGuideBookings/fetchInbox — fine now, degrades with volume
- Mixed styling systems across guide screens (theme-token inline styles on Phase 0-1 screens vs StyleSheet on Phase 4 screens) — cosmetic inconsistency with the warm-editorial restyle

**Quick wins:**
- Fix dashboard filters: pending → ['chat_open','agreement_sent'], upcoming → isActiveBookingState minus in-trip, earnings → completed/rated; reuse stateMachine.ts groupings (apps/mobile/app/(guide)/index.tsx)
- Add a 'Payout UPI ID' row to the guide Profile that shows the saved payout_vpa and links to /(guide)/profile/payout-vpa
- Replace hardcoded '25% / 75%' fee copy in requests.tsx and itineraries/create.tsx with values from getEffectiveRates (which already caches)
- Surface the cta.ts action for each active booking as an 'action queue' list on the dashboard — the routing table already exists, only the list UI is missing
- Change qr-scan's 'Install expo-camera' copy to user-facing language and add a manual token-entry input as fallback
- Wrap the profile is_active toggle in try/catch with rollback on error

### auth-booking-core

Auth (email/password signup with role selection, session bootstrap with stale-token recovery, traveler onboarding gate) and the 25-state booking lifecycle are substantially built: a pure state-machine reducer shared conceptually between mobile and edge functions, server-side signing/deposit/balance/cancel/QR/proofs edge functions, pg_cron jobs for T-72/T-12/deposit-window expiry, and a stub seam that lets bookings advance before Razorpay live keys exist. The main launch blockers are not missing features but enforcement and platform-compliance gaps: bookings RLS lets either participant UPDATE any column (status, amounts) from the client with no column or transition check, and the client still ships legacy code paths that exploit exactly that (cancelBooking writing terminal 'cancelled' with no refund resolution); the password-reset flow has no in-app completion screen; and there is no account-deletion capability, which Apple requires for apps with account creation. Google sign-in is a "Coming soon" alert, there is no double-booking/availability guard, and chat_open inquiries never expire.

**Implemented:**

| Status | Feature | Notes |
|--------|---------|-------|
| ✅ complete | Email/password signup with traveler/guide role selection and DB user provisioning (sync_current_auth_user RPC) | `apps/mobile/app/(auth)/signup.tsx`, `apps/mobile/lib/auth.ts`, `supabase/migrations/20260426_auth_sync.sql` |
| ✅ complete | Session bootstrap + auth routing: stale-refresh-token recovery, 10s backend-unreachable timeout, role-based redirect (guide/traveler groups), traveler onboarding gate via traveler_profiles.onboarded_at | `apps/mobile/lib/hooks/useAuth.ts`, `apps/mobile/app/_layout.tsx` |
| ✅ complete | Dev-only design-preview auth bypass — gated by __DEV__ so it is stripped from release builds (prod-safe) | `apps/mobile/app/_layout.tsx` |
| ✅ complete | 25-state booking state machine (chat_open → rated, 6 cancelled_* variants) with guards, legacy-status shims, and UI classification helpers; test fixtures present | `apps/mobile/lib/booking/stateMachine.ts`, `apps/mobile/lib/booking/__tests__` |
| ✅ complete | Booking creation as inquiry (chat_open) with IST-anchored timestamps, group-size clamp, per-person pricing via platform_settings effective rates | `apps/mobile/lib/api/bookings.ts` |
| ✅ complete | Agreement drafting/sending (client) + server-side signing via sign-agreement edge function (single server-side transition() caller per sign) | `apps/mobile/lib/api/agreements.ts`, `apps/mobile/lib/api/agreementSign.ts`, `supabase/functions/sign-agreement` |
| ✅ complete | Deposit/balance/top-up order creation edge functions with authz, status guards, idempotent upserts; Razorpay webhook + confirm-payment | `supabase/functions/create-deposit-order/index.ts`, `supabase/functions/razorpay-webhook`, `supabase/functions/create-balance-order` |
| ✅ complete | Lifecycle automation via pg_cron: balance reminder, late-fee assess (T-72), no-pay cancel (T-12), deposit-window expiry, deposits_held sweep | `supabase/migrations/20260512100400_pg_cron_jobs.sql`, `supabase/migrations/20260613100000_deposits_held_sweep.sql` |
| ✅ complete | Razorpay stub seam: gated verbs (refund/payout/fund-account) throw when RAZORPAY_LIVE_FEATURES_ENABLED unset; payout_dispatches backlog + replay-stubbed-payouts drains it after live flip | `supabase/functions/_shared/razorpayClient.ts`, `supabase/functions/replay-stubbed-payouts` |
| ✅ complete | Server-side cancellation with refund-tier resolution (compute_cancellation_resolution_tx) + dedicated cancel screen | `supabase/migrations/20260512100300_cancellation_function.sql`, `apps/mobile/app/(traveler)/trips/cancel/[bookingId].tsx`, `apps/mobile/lib/booking/cancellationSnapshot.ts` |
| ✅ complete | Status×viewer CTA mapping covering the full lifecycle for both traveler and buddy screens | `apps/mobile/lib/booking/cta.ts` |
| ✅ complete | Time-fit computation (layover vs tour with transit/tour buffers) and interest-based guide ranking | `apps/mobile/lib/booking/timeFit.ts` |
| 🟡 partial | Password reset — request side only (resetPasswordForEmail); no completion path in-app | `apps/mobile/app/(auth)/forgot-password.tsx`, `apps/mobile/lib/auth.ts` |
| 🔴 stub | Google sign-in — button shows 'Coming soon' alert | `apps/mobile/app/(auth)/signup.tsx` |

**Gaps:**

- **[P0] Bookings RLS UPDATE policies allow either participant to write ANY column/status from the client** — 'Guides can update own bookings' / 'Travelers can update own bookings' (supabase/migrations/20260414100000_rls_fixes.sql:18-22) have USING but no WITH CHECK and no column restriction. A traveler with the anon key can set status='completed', zero out total_amount/platform_fee, or jump any state-machine transition via a raw PostgREST PATCH — the state machine is only enforced in edge functions, which this bypasses entirely. Money/data-integrity risk. Needs a column-level grant or trigger validating transitions server-side. — `supabase/migrations/20260414100000_rls_fixes.sql`, `apps/mobile/lib/api/bookings.ts`
- **[P0] Legacy client-side cancel path writes terminal 'cancelled' with no refund resolution, from any state** — cancelBooking() in apps/mobile/lib/api/bookings.ts:373 sets status='cancelled' directly (bypassing the FSM and compute_cancellation_resolution_tx) and is still wired into apps/mobile/app/(traveler)/trips/[id].tsx:78 and apps/mobile/app/(traveler)/book/payment/[bookingId].tsx:424. A traveler cancelling a balance_paid/trip_ready booking through this path gets no refund record and the guide gets no compensation resolution — while the proper flow exists at trips/cancel/[bookingId].tsx via lib/api/cancellation. Same issue for updateBookingPayment() (arbitrary status writes) and acceptBooking/declineBooking (direct status UPDATEs, though these match FSM semantics). — `apps/mobile/lib/api/bookings.ts`, `apps/mobile/app/(traveler)/trips/[id].tsx`
- **[P0] No account deletion anywhere — Apple App Store rejection risk** — Grep across apps/mobile and supabase/functions finds no delete-account UI, edge function, or admin.deleteUser call. Apple guideline 5.1.1(v) requires in-app account deletion for any app supporting account creation. Also a GDPR consideration given international travelers are the target users. — `apps/mobile/lib/auth.ts`
- **[P0] Password reset flow is broken end-to-end: no in-app screen to set the new password** — resetPassword() (apps/mobile/lib/auth.ts:62) calls resetPasswordForEmail with no redirectTo; the supabase client sets detectSessionInUrl:false (apps/mobile/lib/supabase.ts:202); there is no PASSWORD_RECOVERY handler and no screen calling auth.updateUser({password}) anywhere in the app. A user who taps the emailed link lands on the Supabase-hosted redirect with nowhere to complete the reset — every locked-out user hits this. — `apps/mobile/lib/auth.ts`, `apps/mobile/lib/supabase.ts`, `apps/mobile/app/(auth)/forgot-password.tsx`
- **[P1] No double-booking / availability enforcement for guides** — createBooking (apps/mobile/lib/api/bookings.ts:237) inserts with no check that the guide is free; no EXCLUDE/tstzrange constraint exists in any migration (grep across supabase/migrations). Two travelers can both reach balance_paid for the same guide at overlapping times; the conflict only surfaces on trip day. Also nothing prevents booking a past date at the createBooking layer (MIN_BOOKING_NOTICE_HOURS is only enforced at agreement time). — `apps/mobile/lib/api/bookings.ts`, `supabase/migrations/20260412110000_initial_schema.sql`
- **[P1] No email-change or session/device management, and email verification depends on unaudited Supabase dashboard config** — Signup tells users to 'check your email to confirm' (apps/mobile/app/(auth)/signup.tsx:59-67) but whether confirmation is actually required is a Supabase project setting not captured in the repo; signUp receives data.session immediately in auto-confirm mode and the copy becomes wrong. No emailRedirectTo is set, so the confirm link lands on the default Supabase site URL, not the app. Verify prod auth settings (confirm email ON, correct redirect URLs, deep-link scheme) before launch. — `apps/mobile/app/(auth)/signup.tsx`, `apps/mobile/lib/auth.ts`
- **[P1] Stale chat_open/agreement_* bookings never expire** — pg_cron covers deposit-window, late-fee, and no-pay expiry, but nothing sweeps bookings stuck in chat_open, agreement_drafting, agreement_sent, or half-signed states (supabase/migrations/20260512100400_pg_cron_jobs.sql schedules only balance/deposit-phase jobs). Guides' request queues (fetchPendingRequests queries chat_open+agreement_sent) will accumulate dead inquiries from departed travelers indefinitely. — `supabase/migrations/20260512100400_pg_cron_jobs.sql`, `apps/mobile/lib/api/bookings.ts`
- **[P2] Role determination is heuristic and changeable client-side** — getUserRole (apps/mobile/lib/auth.ts:71) falls back to user_metadata.role, which any authenticated user can rewrite via supabase.auth.updateUser({data:{role:'guide'}}) — user_metadata is client-writable in Supabase. Routing impact only (RLS gates real guide capabilities on guide_profiles), but a traveler could land in the guide UI shell. Prefer app_metadata or the public.users.role column as the source of truth. — `apps/mobile/lib/auth.ts`
- **[P2] Guest browsing does not exist — every visitor must create an account before seeing any guide** — apps/mobile/app/_layout.tsx:105-108 redirects all unauthenticated users to login with no browse-as-guest path (the line-90 bypass is __DEV__-only design-preview). For a layover-impulse product this is a conversion cliff, and Apple 5.1.1 discourages forcing registration before non-account features like browsing. — `apps/mobile/app/_layout.tsx`

**Quality issues:**
- Booking state-machine logic is duplicated between apps/mobile/lib/booking/ and supabase/functions/_shared/ (acknowledged in CLAUDE.md); divergence risk on every lifecycle change.
- normalizeBookingStatus (apps/mobile/lib/api/bookings.ts:122) silently coerces unknown DB statuses to 'chat_open', which could show a paid booking as a fresh inquiry if the enum ever grows ahead of the app.
- sendAgreement is the sole client-side transition() caller (apps/mobile/lib/api/agreements.ts header) — combined with the permissive bookings UPDATE RLS this write is trusted to the client, unlike every other transition.
- getUserRole + probeOnboarding run 2-3 sequential DB round-trips on every auth state change (apps/mobile/lib/hooks/useAuth.ts:144-161), adding cold-start latency.
- toIsoOrNull comment block (apps/mobile/lib/api/bookings.ts:69-94) documents dead reasoning: the localMs Date.parse result is computed then discarded in favor of the Date.UTC path.
- apps/mobile/app/(traveler)/book/payment/[bookingId].tsx still exists and is wired to the legacy cancel/payment path despite memory notes saying the legacy payment path was deleted — confirm reachability and remove.

**Quick wins:**
- Delete/rewire legacy cancelBooking() and updateBookingPayment() in apps/mobile/lib/api/bookings.ts to the cancel-booking edge function used by trips/cancel/[bookingId].tsx.
- Add WITH CHECK (or a status-transition trigger) to the two bookings UPDATE policies in a new migration — a BEFORE UPDATE trigger validating allowed column changes for non-service-role writers.
- Hide the 'Continue with Google' stub button behind a feature flag or remove it for launch (apps/mobile/app/(auth)/signup.tsx:131-141) — a dead social-login button looks unfinished in review.
- Add a pg_cron sweep that expires chat_open/agreement_sent bookings older than the traveler's departure_time (or N days).
- Pass emailRedirectTo/redirectTo deep links in signUp and resetPassword calls in apps/mobile/lib/auth.ts once the app scheme is registered.

### backend (Supabase: schema, RLS, edge functions, cron, storage, realtime)

The backend is far more mature than the CLAUDE.md "Razorpay deferred" note suggests: 41 migrations build a 26-table schema with the full 25-state financial booking lifecycle, ~86 RLS policies, pg_cron timers for every time-based transition, a signature-verified Razorpay webhook with idempotent capture handlers, and a deliberate "stub seam" (RAZORPAY_LIVE_FEATURES_ENABLED) that lets bookings advance while payouts/refunds queue in payout_dispatches for replay-stubbed-payouts to drain once live keys exist. The main launch blocker is drift in cancellation economics: the mobile state machine routes platform/system cancellations to cancelled_force_majeure (full refunds), but both the edge-function copy of the state machine and the DB compute_cancellation_resolution RPC still treat system cancellations as traveler-voluntary (deposit forfeiture) or reject them outright — and the server is what actually moves money. Secondary risks are permissive storage policies (any authenticated user can overwrite/delete any itinerary photo or avatar) and thin edge-function test coverage (4 Deno test files; no parity test for the two state machines despite the code comment demanding one).

**Implemented:**

| Status | Feature | Notes |
|--------|---------|-------|
| ✅ complete | Schema: 26 tables covering users/guide_profiles/traveler_profiles, itineraries+stops, bookings, messages, reviews, favorites, agreements, cost_line_items, deposits, payment_events, payouts, payout_dispatches, expense_proofs, top_up_requests, notifications, user_push_tokens, sos_alerts, flight/location_tracking, platform_settings | Initial schema (842 lines) plus financial core, phase 3/4 columns, agreement invariants, onboarding fields, hinge prompts, guide gallery. Legacy booking statuses migrated (pending→agreement_sent etc.). `supabase/migrations/20260412110000_initial_schema.sql`, `supabase/migrations/20260503100000_financial_core.sql`, `supabase/migrations/20260503110100_bookings_status_data_migration.sql` |
| ✅ complete | RLS coverage | ~86 policies across all app-queried tables (verified against .from() usage in apps/mobile: bookings, agreements, deposits, cost_line_items, expense_proofs, payout_dispatches, top_up_requests, user_push_tokens, favorites, platform_settings, sos_alerts, location_tracking all have participant-scoped read policies; writes to financial tables are service-role-only by design). Includes fixes for recursion, booking INSERT, favorites admin read. `supabase/migrations/20260418121000_rls_policy_coverage.sql`, `supabase/migrations/20260503120000_financial_rls.sql` |
| ✅ complete | Razorpay webhook + client-confirm fallback | razorpay-webhook: HMAC signature verify (timing-safe), verify_jwt=false in config.toml, dispatches deposit/balance/top_up captured+failed to shared handlers; idempotency via payment_id dedup in capture handlers. confirm-payment verifies the checkout signature and reuses the same handlers so webhook-less local/KYC-pending flows settle identically. `supabase/functions/razorpay-webhook/index.ts`, `supabase/functions/confirm-payment/index.ts`, `supabase/functions/_shared/razorpayClient.ts` |
| ✅ complete | Edge functions (16) with sane auth models | User-JWT + party-check: sign-agreement, create-deposit-order, create-balance-order, create-topup-order, request-top-up, decide-top-up, cancel-booking, qr-scan, end-trip, submit-proofs, confirm-payment. Service-role-only (timing-safe key compare): issue-refund, replay-stubbed-payouts, send-push. create-booking-payment is a deprecated 39-line tombstone. `supabase/functions/sign-agreement/index.ts`, `supabase/functions/cancel-booking/index.ts` |
| ✅ complete | Payout/refund stub seam for pre-live launch | createRefund/createPayout/createFundAccount gate on RAZORPAY_LIVE_FEATURES_ENABLED; when off they throw and handlers persist payout_dispatches rows with failed_reason='razorpay_live_not_configured' so state transitions proceed; replay-stubbed-payouts drains the backlog with deterministic ≤40-char idempotency keys. Orders API (deposits/balance/top-up) works on test keys today. `supabase/functions/_shared/razorpayClient.ts`, `supabase/functions/replay-stubbed-payouts/index.ts` |
| ✅ complete | pg_cron time-based transitions | Hourly crons: balance reminder, late-fee assess (T-72), no-pay cancel (T-12), trip_ready promotion, deposit-window expiry, proofs-overdue, rating-link send (5-min), pending-push drain, and a deposits_held stuck-state sweep fixing the known two-write race in depositCapture. `supabase/migrations/20260512100400_pg_cron_jobs.sql`, `supabase/migrations/20260613100000_deposits_held_sweep.sql`, `supabase/migrations/20260520100200_cron_send_pending_pushes.sql` |
| ✅ complete | Cancellation economics engine (DB RPC) | compute_cancellation_resolution_tx (470-line migration) computes refunds/forfeitures per actor+state, writes cancelled_resolution_jsonb, transitions status, creates payout_dispatches; cancel-booking edge fn then dispatches via razorpayClient with stub fallback. `supabase/migrations/20260512100300_cancellation_function.sql`, `supabase/functions/cancel-booking/index.ts` |
| ✅ complete | Realtime publication for live UI | bookings, agreements, deposits, messages, expense_proofs, location_tracking, payout_dispatches added to supabase_realtime (idempotent); notifications and top_up_requests published earlier — chat and status-driven screens get row events. `supabase/migrations/20260522000000_realtime_publication.sql` |
| ✅ complete | Storage buckets | itinerary-photos and avatars (public read), expense-proofs (private; buddy-insert scoped to own booking folder, party-scoped read). See gaps for the permissive update/delete policies on the public buckets. `supabase/migrations/20260414103000_storage_buckets.sql`, `supabase/migrations/20260512100200_reconciliation_function.sql` |
| ✅ complete | Push notifications pipeline | user_push_tokens table with own-row RLS, notifications push columns, send-push edge fn (Expo push, service-role-gated, invalid-token invalidation) plus cron drain — contradicts CLAUDE.md 'push deferred'. `supabase/functions/send-push/index.ts`, `supabase/migrations/20260520100000_user_push_tokens.sql` |
| ✅ complete | Auth sync + guide profile auto-create | Triggers keep auth.users ↔ public.users in sync and auto-create guide_profiles rows (guides auto-approve per spec). `supabase/migrations/20260426_auth_sync.sql`, `supabase/migrations/20260429000000_guide_profile_auto_create.sql` |
| 🟡 partial | Seed data | 515-line seed with auth.users (login-ready, Test1234!), 5 guides, itineraries, bookings, reviews, messages — but bookings use only legacy statuses ('pending','completed') and there are zero agreements/deposits/payment_events rows, so the entire financial lifecycle is untestable from seed alone. `supabase/seed.sql` |
| 🟡 partial | Edge function tests | 4 Deno test files only: depositCaptureFlow, webhook-signature, sendPush, pushCopy. No tests for balanceCapture, topupCapture, cancellation RPC, reconciliation, qr-scan, or state-machine parity. npm run test:edge runs with --no-check (type errors not caught). `supabase/functions/__tests__/`, `package.json` |

**Gaps:**

- **[P0] State-machine drift: platform/system cancellations penalize the traveler on the server** — apps/mobile/lib/booking/stateMachine.ts (lines 199-204, 222-227, 244-249, 266-274) routes cancel{actor: platform|system} from awaiting_balance/late_fee_due/balance_paid/trip_ready to cancelled_force_majeure (full refunds, per APP_REVIEW §1.2 fix). The edge copy supabase/functions/_shared/stateMachine.ts has NO platform/system cancel rule in awaiting_balance/late_fee_due/balance_paid (illegal_transition) and at trip_ready (lines 142-144) routes platform|system to cancelled_traveler_voluntary — deposit forfeiture for a platform decision. Worse, the DB RPC that actually moves money agrees with the stale server copy: 20260512100300_cancellation_function.sql line 178 maps p_actor IN ('traveler','system') → cancelled_traveler_voluntary and accepts no 'platform' actor at all (line 188 raises). The client-side fix never landed server-side. Header comment in the edge copy says files MUST stay in sync and asks for a diff/parity check that was never built. — `supabase/functions/_shared/stateMachine.ts`, `apps/mobile/lib/booking/stateMachine.ts`, `supabase/migrations/20260512100300_cancellation_function.sql`
- **[P1] Any authenticated user can overwrite/delete any itinerary photo or avatar** — Storage policies on itinerary-photos (UPDATE/DELETE) and avatars (INSERT/UPDATE) check only auth.uid() IS NOT NULL with no path-ownership constraint (unlike expense-proofs, which scopes by booking folder). Any signed-up user can replace another guide's profile photo or gallery image — defacement/abuse vector once public. avatars also lacks a DELETE policy entirely. — `supabase/migrations/20260414103000_storage_buckets.sql`
- **[P1] Live money movement not yet enabled — payout/refund backlog is launch-mode by design but needs an ops plan** — createRefund/createPayout/createFundAccount throw until RAZORPAY_LIVE_FEATURES_ENABLED is set; refunds owed to travelers (including cancellation refunds) queue as failed payout_dispatches. Fine for a soft launch only if someone runs replay-stubbed-payouts promptly after RazorpayX/KYC go-live; publicly releasing while this is off means real users' refunds silently queue. Also requires prod secrets: RAZORPAY_KEY_ID/SECRET, RAZORPAY_WEBHOOK_SECRET, RAZORPAY_X_ACCOUNT_NUMBER, app.settings.service_role_key for the push cron. — `supabase/functions/_shared/razorpayClient.ts`, `supabase/functions/replay-stubbed-payouts/index.ts`
- **[P1] No state-machine parity guard or tests for the money paths** — The drift above happened exactly because the promised DRY/diff check (stateMachine.ts edge-copy header, lines 14-16) was never built. No Deno tests cover balanceCapture, topupCapture, cancellation resolution amounts, or reconciliation; test:edge runs --no-check. A single parity test (import both tables, assert deep-equal transitions) plus golden tests on compute_cancellation_resolution would have caught the P0. — `supabase/functions/_shared/stateMachine.ts`, `supabase/functions/__tests__/`, `package.json`
- **[P2] Webhook returns 200 for malformed payment notes — silent money-event drops** — razorpay-webhook returns ok:true 'ignored: malformed_deposit_notes/malformed_balance_notes' when notes fail validation, so Razorpay never retries and no payment_events row records the anomaly. A notes-schema regression in order creation would silently strand captured payments. Consider logging to payment_events or alerting instead of swallowing. — `supabase/functions/razorpay-webhook/index.ts`
- **[P2] Seed data predates the financial lifecycle** — seed.sql bookings use legacy 'pending'/'completed' statuses with no agreements, deposits, cost_line_items, or payment_events rows — local devs cannot exercise sign→deposit→balance→trip→reconcile without manual SQL. Slows QA of exactly the flows that gate launch. — `supabase/seed.sql`
- **[P2] Dead function create-booking-payment still deployed** — 39-line deprecated tombstone kept for routing; harmless but should return 410 and eventually be deleted so the mobile app cannot accidentally call a legacy path. — `supabase/functions/create-booking-payment/index.ts`
- **[P2] disputed is a terminal dead-end with no resolution path** — Both state machines list 'disputed' with zero outgoing transitions and there is no admin edge function or RPC to resolve a dispute (issue-refund exists but doesn't transition the booking). First real dispute post-launch requires manual SQL. — `supabase/functions/_shared/stateMachine.ts`, `supabase/functions/issue-refund/index.ts`

**Quality issues:**
- The three-way state duplication (mobile TS, edge TS, plpgsql RPC) is the root architectural liability — CLAUDE.md already flags de-duplicating it alongside the @detour/types extraction.
- cron bodies were rewritten twice (20260512100500 then dropped and restored in 20260512100700 after a payout-dispatch conflict fix) — final cron behavior is only reconstructable by reading three migrations in sequence.
- deposit webhook writes deposits_held then awaiting_balance as two separate UPDATEs; the stuck-state sweep (20260613100000) papers over the race rather than making the transition atomic.
- confirm-payment recomputes the Razorpay checkout HMAC with the key secret — correct, but it duplicates the signature logic in razorpaySignature.ts for the webhook variant; one seam would be safer.
- admin console reads platform_settings/payout_dispatches with the service-role key in a browser (apps/admin) — acceptable local-only, but the backend has no defense if that .env leaks.

**Quick wins:**
- Port the platform/system→cancelled_force_majeure cancel rules from apps/mobile/lib/booking/stateMachine.ts into supabase/functions/_shared/stateMachine.ts (4 small rule additions) and patch 20260512100300's actor mapping in a new migration — this is the P0 and is <100 lines total.
- Add a Deno parity test that imports both transition tables and asserts identical results across every (state,event,ctx) combination — prevents recurrence permanently.
- Tighten storage policies: scope itinerary-photos/avatars UPDATE/DELETE to owner folder ((storage.foldername(name))[1] = auth.uid()::text) in one migration.
- Make create-booking-payment return 410 Gone.
- Extend seed.sql with one booking per key lifecycle state (awaiting_deposits, awaiting_balance, trip_ready, awaiting_proofs) plus matching agreements/deposits rows.
- Drop --no-check from npm run test:edge so type drift in edge functions fails CI.

### money-and-safety

Money-in is genuinely production-shaped: all Razorpay order creation is server-side with amounts derived from DB rows (fixed ₹500 deposit, agreement-computed balance, top-up request rows), captures settle only via HMAC-verified webhook or the authenticated confirm-payment fallback, and financial tables are service-role-write-only. Money-out is deliberately stubbed: refunds, payouts, and fund-account creation all throw behind RAZORPAY_LIVE_FEATURES_ENABLED, persisting payout_dispatches rows to be drained later by replay-stubbed-payouts — so at launch the platform can take money but cannot return or disburse it without live keys + RazorpayX. Safety is the weaker half: SOS writes a real DB row but its only consumer is the local-only admin console (no push/SMS/email to ops), the traveler live-map subscribes to a location_tracking table nothing ever writes to, and there is no block/report/moderation feature at all (an App Store UGC-guideline rejection risk). A lingering permissive bookings UPDATE RLS policy also lets either party rewrite booking status/payment fields directly from the client.

**Implemented:**

| Status | Feature | Notes |
|--------|---------|-------|
| ✅ complete | Server-side Razorpay order creation (deposit/balance/top-up) with tamper-proof amounts | Deposit is fixed DEPOSIT_PAISE (₹500), balance is computed from the signed agreement row, top-up from the top_up_requests row — the client never supplies an amount. The old client-amount vuln in create-booking-payment was explicitly closed: it is now a 410 Gone stub. `supabase/functions/create-deposit-order/index.ts`, `supabase/functions/create-balance-order/index.ts`, `supabase/functions/create-booking-payment/index.ts` |
| ✅ complete | Razorpay webhook + client-confirm fallback (capture settlement) | razorpay-webhook verifies X-Razorpay-Signature HMAC on raw bytes then dispatches to deposit/balance/top-up capture handlers with payment-id dedup idempotency. confirm-payment is an authenticated (getUserFromRequest) fallback that verifies the SDK signature server-side and runs the same handlers — covers local dev / webhook outages. Tests exist (webhook-signature, depositCaptureFlow). `supabase/functions/razorpay-webhook/index.ts`, `supabase/functions/confirm-payment/index.ts`, `apps/mobile/lib/api/confirmPayment.ts` |
| 🔴 stub | Refunds / payouts / fund accounts (money-out) | createRefund/createPayout/createFundAccount in razorpayClient.ts throw RazorpayLiveNotConfiguredError unless RAZORPAY_LIVE_FEATURES_ENABLED=true; handlers persist payout_dispatches rows with failed_reason='razorpay_live_not_configured' and continue the state machine. replay-stubbed-payouts (service-role, timing-safe auth) drains the backlog once live keys + RAZORPAY_X_ACCOUNT_NUMBER (RazorpayX) exist. Real API code is written and idempotency-keyed, but zero money can leave the platform today. `supabase/functions/_shared/razorpayClient.ts`, `supabase/functions/replay-stubbed-payouts/index.ts`, `supabase/functions/issue-refund/index.ts` |
| ✅ complete | Cancellation flow with receipts | cancel-booking edge fn verifies caller is a booking party, validates cancellable status, runs compute_cancellation_resolution_tx() RPC (writes resolution, transitions status, creates payout_dispatches), then dispatches refunds/payouts (stubbing gracefully). Mobile has trips/cancel and trips/cancellation-receipt screens plus cancellationSnapshot lib with tests. `supabase/functions/cancel-booking/index.ts`, `supabase/migrations/20260512100300_cancellation_function.sql`, `apps/mobile/lib/booking/cancellationSnapshot.ts` |
| ✅ complete | Guide payout VPA collection | Guide screen validates and stores users.payout_vpa; qr-scan routes guides here on error='vpa_missing'. Fund-account registration against the VPA is gated behind the live flag; fund_account_id is cached on users.razorpay_fund_account_id. `apps/mobile/app/(guide)/profile/payout-vpa.tsx` |
| ✅ complete | Commission / rates with early-access free mode | get_effective_rates() Postgres RPC zeroes all platform charges (commission, platform up/down fees, GST, TDS, late fee) while platform_settings.early_access_mode is on; client falls back to EARLY_ACCESS_RATES (all-zero) when offline — fails toward under-charging. Agreements snapshot rates at draft time so existing agreements are immune to flips. COMMISSION_RATE=0.25 in constants with an unresolved note that docs say 15%. `apps/mobile/lib/api/platformSettings.ts`, `packages/config/constants.ts`, `supabase/migrations/20260611100000_platform_settings.sql` |
| ✅ complete | Financial-table RLS hardening | deposits/payment_events/payout_dispatches/agreements amounts are service-role write-only (no authenticated INSERT/UPDATE policies); agreement update limited to the drafting buddy pre-signing; ₹500 deposit and 20% buffer enforced by DB CHECK constraints; all money in integer paise. `supabase/migrations/20260503120000_financial_rls.sql`, `supabase/migrations/20260510100000_agreement_invariants.sql` |
| 🟡 partial | SOS alert (traveler + guide) | SafetyBar captures device location (falls back to guide's last position / central Mumbai), triggerSos inserts a real sos_alerts row under RLS (participants-only, triggered_by=auth.uid()), with duplicate-tap suppression. Admin console has an SOS page with Acknowledge/Resolve and a Google Maps link. But delivery ends there — see gaps. `apps/mobile/lib/api/sos.ts`, `apps/mobile/components/bookings/SafetyBar.tsx`, `apps/admin/src/pages/SOS.tsx` |
| 🟡 partial | Push notifications pipeline | Full chain exists: user_push_tokens table, client registerPushToken + notification channels/handler, notifications table with push columns, pg_cron job calling send-push (service-role, timing-safe auth) which drains to the Expo Push API, with tests. Needs a dev/EAS build (not Expo Go), prod cron + secrets configured, and SOS is not among the push kinds. `apps/mobile/lib/push/registerPushToken.ts`, `supabase/functions/send-push/index.ts`, `supabase/migrations/20260520100200_cron_send_pending_pushes.sql` |
| 🟡 partial | Traveler live trip map | Native screen renders react-native-maps with itinerary stops and subscribes to realtime inserts on location_tracking for the guide's position, with a 'Waiting for guide to share location…' overlay. But nothing publishes to location_tracking (see gaps), so the overlay never clears. `apps/mobile/app/(traveler)/trips/live/[id].native.tsx` |
| 🔴 stub | Legacy single-shot payment path | apps/mobile/app/(traveler)/book/payment/[bookingId].tsx and lib/api/payments.ts createRazorpayOrder/recordPaymentResult still exist; the backing edge fn returns 410, so the screen errors if ever reached. Nothing navigates to it, but recordPaymentResult (direct client write of bookings.payment_status/status) is still exported and importable. `apps/mobile/lib/api/payments.ts`, `apps/mobile/app/(traveler)/book/payment/[bookingId].tsx` |

**Gaps:**

- **[P0] SOS alerts reach no one in real time** — triggerSos only inserts a sos_alerts row; the sole consumer is the SOS page of the admin console, which is a local-only, never-deployed Vite app (service-role key, 'never deploy as-is'). No push, SMS, email, or webhook fires on insert — pushCopy.ts has no SOS kind. Yet the mobile UI tells the user 'This immediately notifies the Detour ops team with your location.' A real emergency during a trip goes unseen unless someone happens to have the console open. Wire sos_alerts inserts to an immediate ops channel (Twilio/WhatsApp/email + push) before any public trip runs. — `apps/mobile/components/bookings/SafetyBar.tsx`, `apps/admin/src/pages/SOS.tsx`, `supabase/functions/_shared/pushCopy.ts`
- **[P0] Money can come in but cannot go out (refunds/payouts stubbed)** — With live/test Razorpay keys, deposits and balances are genuinely captured, but createRefund/createPayout/createFundAccount all throw unless RAZORPAY_LIVE_FEATURES_ENABLED=true, and payouts additionally require a RazorpayX account (RAZORPAY_X_ACCOUNT_NUMBER). Cancellation receipts will show refunds that are actually parked in payout_dispatches with failed_reason='razorpay_live_not_configured', and guides earn nothing until replay-stubbed-payouts is run manually. Public launch requires completing Razorpay live KYC + RazorpayX onboarding, flipping the flag, and running the replay runbook — or keeping early-access free mode and not capturing money at all. — `supabase/functions/_shared/razorpayClient.ts`, `supabase/functions/replay-stubbed-payouts/index.ts`
- **[P0] Bookings UPDATE RLS lets either party rewrite status/payment fields from the client** — The 20260414 policies ('Guides/Travelers can update own bookings') are USING(auth.uid()=party) with no WITH CHECK and no column-level restrictions, and no transition-enforcing trigger exists. A traveler can PATCH their booking to status='trip_ready'/'completed' or set payment_status='captured' via the anon-key REST API without paying, potentially tricking downstream cron/edge flows and receipts. Financial tables are protected, but the booking state machine — the spine everything reads — is client-tamperable. Add column-restricted policies or a status-transition trigger, and delete recordPaymentResult which depends on this hole. — `supabase/migrations/20260414100000_rls_fixes.sql`, `apps/mobile/lib/api/payments.ts`
- **[P0] No block/report/moderation anywhere** — Grep finds no user-blocking, user-reporting, or content-moderation code in mobile, admin, or the schema. This is an in-person-meeting marketplace with chat; beyond the trust/safety exposure, Apple App Review guideline 1.2 requires a mechanism to report/block abusive users in UGC apps — this alone can block the public App Store release. — `apps/mobile/lib/api`, `apps/admin/src/pages`
- **[P1] Guide live-location sharing has no publisher** — The traveler live map subscribes to realtime inserts on location_tracking, but no code anywhere (guide app included) writes to that table. The 'Waiting for guide to share location…' state is permanent, and SOS's 'guide's last shared location' fallback can never exist. Either build a guide-side foreground location publisher for in-progress trips or remove the promise from the UI. — `apps/mobile/app/(traveler)/trips/live/[id].native.tsx`, `apps/mobile/app/(guide)`
- **[P1] Payout/refund ops depend on manual service-role endpoints with no admin UI** — issue-refund and replay-stubbed-payouts are service-role curl endpoints; the admin console has no payout-dispatch queue view, so stuck refunds (e.g., failed_reason rows after the live flip) are invisible to ops. At minimum add a payout_dispatches page to the admin console before real money flows. — `supabase/functions/issue-refund/index.ts`, `apps/admin/src/pages`
- **[P1] Push delivery unproven in production configuration** — The pipeline (tokens → notifications → pg_cron → send-push → Expo Push API) is coded and tested at unit level, but requires an EAS build, prod cron jobs, and SUPABASE_SERVICE_ROLE_KEY/pg_net secrets configured; Razorpay checkout is likewise dev-build-only (react-native-razorpay, explicit Expo Go error strings). Balance-due reminders and top-up expiry (15-min decision window) depend on push actually arriving. — `supabase/functions/_shared/sendPush.ts`, `supabase/migrations/20260520100200_cron_send_pending_pushes.sql`, `apps/mobile/lib/api/payments.ts`
- **[P2] Commission rate unresolved: 25% in code vs 15% in docs** — packages/config/constants.ts hardcodes COMMISSION_RATE=0.25 with a note that NEXT_TASKS.md says 15% pending founder sign-off. Moot while early_access_mode zeroes it, but must be settled before monetisation flips on, since agreements snapshot the rate at draft time. — `packages/config/constants.ts`
- **[P2] Legacy payment screen/module still in tree** — book/payment/[bookingId].tsx + the createRazorpayOrder/recordPaymentResult exports target the deprecated 410 endpoint. Unreachable via navigation today, but it is a foot-gun (recordPaymentResult writes payment fields client-side) and dead weight — delete it as part of the RLS fix. — `apps/mobile/app/(traveler)/book/payment/[bookingId].tsx`, `apps/mobile/lib/api/payments.ts`

**Quality issues:**
- Booking state-machine logic is duplicated between apps/mobile/lib/booking/stateMachine.ts and supabase/functions/_shared/stateMachine.ts (acknowledged in CLAUDE.md) — drift risk on every lifecycle change
- SOS UI copy overpromises ('immediately notifies the Detour ops team') relative to actual delivery (unmonitored DB row)
- SafetyBar silently falls back to 'central Mumbai' coordinates when no fix is available — an SOS with fabricated coordinates could misdirect responders; better to send null-island-style sentinel or flag approximate
- confirm-payment trusts Razorpay signature to prove authenticity but relies on notes round-tripping from server-created orders — correct today, fragile if anyone ever adds a client-notes path
- payout-vpa screen writes users.payout_vpa via direct client update — fine under users RLS but no VPA verification (penny-drop) before payouts are sent to it

**Quick wins:**
- Add an SOS ops alert: DB trigger or edge hook on sos_alerts insert that sends email/WhatsApp to the founder's phone — a few hours of work, removes the worst safety gap
- Tighten bookings UPDATE policies with WITH CHECK clauses that freeze status/payment columns for authenticated roles (single migration)
- Delete apps/mobile/app/(traveler)/book/payment/[bookingId].tsx and recordPaymentResult/createRazorpayOrder from payments.ts
- Change 'Waiting for guide to share location…' copy (or hide the map layer) until a location publisher exists
- Add a payout_dispatches queue page to the admin console reusing the SOS page pattern
- Add an in-app 'Report user' action that inserts to a reports table surfaced in admin — minimal path to App Store UGC compliance

### ops-and-release

The admin console is further along than CLAUDE.md suggests: eight working pages including Cancellations (refund re-issue), Payouts (retry stuck dispatches via the issue-refund edge fn), SOS ack/resolve, and platform pricing Settings, with a well-reasoned but deliberately local-only security model (service-role key in the client bundle, sessionStorage password gate, and a prod-build guard that throws). CI is genuinely good (typecheck/lint/Jest, Deno edge tests, admin build, migration apply-check, manual-dispatch prod migrations with dry-run). Mobile release readiness is the weak side: EAS projectId is still a literal placeholder with no eas.json, the Android release buildType is signed with the debug keystore at versionCode 1, there is no crash reporting/analytics/OTA, no in-app Terms/Privacy links or account-deletion flow (App Store rejection risks), and Razorpay remains a stub seam so no real money moves. Ops tooling also lacks guide verification/ban actions, dispute handling, and content moderation.

**Implemented:**

| Status | Feature | Notes |
|--------|---------|-------|
| ✅ complete | Admin console core ops pages (Overview, Users, Bookings, Revenue, SOS) | Users has role filter + is_verified badge (read-only); Bookings has status filter + joined names; Revenue has 7d/30d/90d/all windows; SOS has Acknowledge/Resolve writing to sos_alerts plus Maps link. `apps/admin/src/pages/Users.tsx`, `apps/admin/src/pages/SOS.tsx`, `apps/admin/src/pages/Revenue.tsx` |
| ✅ complete | Refund/cancellation ops | Cancellations page shows cancelled_* bookings with trigger tier, refund summary, payout dispatch status, and a Re-issue button invoking the issue-refund edge function; Payouts page flags stuck rows (pending >1h or failed) with per-row Retry. `apps/admin/src/pages/Cancellations.tsx`, `apps/admin/src/pages/Payouts.tsx` |
| ✅ complete | Platform pricing settings | Edits the single platform_settings row (early-access zero-fee switch, platform/commission/GST/TDS/late-fee rates) with a worked pricing example; rates snapshot onto agreements at draft time. `apps/admin/src/pages/Settings.tsx` |
| 🟡 partial | Admin security posture (local-only by design) | Service-role key is inlined into the Vite client bundle; mitigations are a sessionStorage password gate and a hard throw on production builds unless VITE_ADMIN_LOCAL_BUILD=1. Sound for a solo founder on localhost, but ops is chained to one laptop and there is no per-action audit trail. `apps/admin/src/lib/supabase.ts`, `apps/admin/src/lib/auth.ts` |
| ✅ complete | CI pipeline | ci.yml runs mobile typecheck/lint/Jest, admin production build, Deno edge-function tests, marketing static-site validation, and a fresh-DB migration apply check; least-privilege GITHUB_TOKEN. deploy-migrations.yml is manual-dispatch with dry-run default for prod DB pushes. `.github/workflows/ci.yml`, `.github/workflows/deploy-migrations.yml` |
| ✅ complete | Unit test coverage for money/booking logic | Jest suites cover booking state machine, CTA mapping, late fees, cancellation/reconciliation/agreement snapshots, and push-token registration; Deno tests cover webhook signatures, deposit capture, push send. `apps/mobile/lib/booking/__tests__`, `supabase/functions/__tests__` |
| ✅ complete | App permissions & config declarations | iOS infoPlist usage strings and Android permissions (location, camera, storage) are declared; a custom config plugin force-injects the Google Maps API key meta-data into AndroidManifest; secrets read from EXPO_PUBLIC_* env, none hardcoded. `apps/mobile/app.config.js`, `apps/mobile/app.json` |
| 🔴 stub | Payout/refund rails behind stub seam | razorpayClient.ts is an explicit Phase 3+4 stub seam; payouts queue as stubbed dispatches and replay-stubbed-payouts drains the backlog after the live flip. Architecture is ready but no real money moves. `supabase/functions/_shared/razorpayClient.ts`, `supabase/functions/replay-stubbed-payouts` |

**Gaps:**

- **[P0] No store-build pipeline: EAS projectId is a placeholder, no eas.json, Android release signed with debug keystore** — Both app.json and app.config.js contain extra.eas.projectId='PLACEHOLDER_RUN_EAS_INIT_TO_GENERATE'; there is no eas.json (no build profiles/credentials); android/app/build.gradle's release buildType uses signingConfigs.debug (debug.keystore, androiddebugkey) at versionCode 1. The app literally cannot be submitted to either store today. — `apps/mobile/app.config.js`, `apps/mobile/android/app/build.gradle`
- **[P0] No Terms/Privacy links or screens, and no account-deletion flow — App Store rejection risks** — Signup shows plain text 'By joining you agree to our Terms of Service & Privacy Policy' with no tappable links, no legal screens exist in the app, and grep finds no account-deletion flow anywhere. Apple requires a privacy policy URL and in-app account deletion for apps with sign-up; Google requires a privacy policy for apps requesting location. — `apps/mobile/app/(auth)/signup.tsx`
- **[P0] Payments/payouts still in stub mode — no real money movement** — razorpayClient.ts is a stub seam; deposits/balances/refunds/payouts record dispatches without hitting Razorpay. Known-deferred, but it is the single hard blocker for a real marketplace launch; the replay-stubbed-payouts flip path exists but is untested against live keys. — `supabase/functions/_shared/razorpayClient.ts`
- **[P0] No crash reporting, no analytics, no error boundary** — No Sentry/Crashlytics/PostHog/Amplitude anywhere in apps/mobile (package.json or source), and no ErrorBoundary component in app/ or components/. A public release means production crashes during live trips (SOS, payments) are invisible and unrecoverable except by force-quit. — `apps/mobile/package.json`
- **[P1] No guide verification, ban/suspend, or dispute/moderation tooling in admin** — Users page renders is_verified read-only with no toggle; there is no action to suspend a bad actor, no chat/review moderation view, and no dispute workflow (only cancellation-tier refunds). For a marketplace putting travelers with strangers, ops needs at minimum a verify/ban switch and a way to inspect a booking's messages when a dispute or safety report comes in. — `apps/admin/src/pages/Users.tsx`, `apps/admin/src/pages/Bookings.tsx`
- **[P1] Dev localhost fallback logic ships in production Supabase client** — lib/supabase.ts silently falls back to 'https://placeholder.supabase.co' when env is missing, and its multi-origin retry (127.0.0.1 / Metro LAN IP / localhost) is not __DEV__-gated — a prod build with a transient network error will retry against localhost origins. Should hard-fail on missing env and gate the origin fallback to dev. — `apps/mobile/lib/supabase.ts`
- **[P1] No OTA update channel (expo-updates absent)** — expo-updates is not installed or configured, so any post-launch JS bug requires a full store review cycle to fix — painful for a time-sensitive layover product. Set up EAS Update alongside eas.json. — `apps/mobile/package.json`, `apps/mobile/app.config.js`
- **[P1] app.json and app.config.js coexist and have drifted** — app.config.js states it supersedes app.json and tells you to delete it, but app.json remains; notification colors already differ (#F97316 vs #C8542A). Risk of tooling reading the wrong file at build time. Delete app.json. — `apps/mobile/app.json`, `apps/mobile/app.config.js`
- **[P2] Admin ops chained to one laptop with no audit trail** — By-design local-only console means refund re-issues, SOS resolution, and rate changes can only happen from the founder's machine, and no admin action is logged anywhere. Fine for week one; plan the server-side proxy the code comments already describe before adding a second operator. — `apps/admin/src/lib/supabase.ts`
- **[P2] No mobile build validation in CI and no UI/component tests** — CI never runs expo prebuild or an EAS build, so native-config regressions (like the placeholder projectId) are invisible; Jest coverage is logic-only with zero component/screen tests. — `.github/workflows/ci.yml`

**Quality issues:**
- Admin password check is a plain string comparison against a Vite-inlined env var with no rate limiting (apps/admin/src/lib/auth.ts) — acceptable only while local-only
- apps/mobile/lib/supabase.ts logs the Supabase URL to console in dev and carries ~180 lines of web-lock/refresh-token workaround code that should be revisited before release
- Payouts page duplicates the issue-refund invoke logic present in Cancellations (apps/admin/src/pages/Payouts.tsx vs Cancellations.tsx)
- app.json still carries the old saffron notification color while app.config.js uses the newer terracotta #C8542A — config drift symptom

**Quick wins:**
- Delete apps/mobile/app.json (app.config.js supersedes it per its own header comment)
- Run `eas init` + commit eas.json with dev/preview/production profiles to replace the placeholder projectId
- Make the Terms/Privacy text in apps/mobile/app/(auth)/signup.tsx tappable links to detourtrips.com legal pages (and create those static pages in apps/marketing/)
- Add `@sentry/react-native` via the Expo config plugin — one dependency + one wizard run gets crash reporting before launch
- Gate the localhost/Metro origin fallback in apps/mobile/lib/supabase.ts behind __DEV__ and throw on missing EXPO_PUBLIC_SUPABASE_URL in production
- Add a verify/unverify toggle to apps/admin/src/pages/Users.tsx (the is_verified column and service-role client already exist)

## 6. Findings from live verification (2026-07-05/06)

Observed first-hand while driving the app on a device/web during this audit cycle:

- **Guide profile intermittently hangs on first navigation until refresh** — the three profile queries never reach the network; the in-code 12s timeout masks it with a “Slow connection — please retry” alert. Pre-existing (the workaround comment is in `apps/mobile/app/(traveler)/guide/[id].tsx`); reproduced on web. Worth a root-cause fix before release.
- **Push registration warns on every launch without FCM credentials** (`[push] registration failed: Default FirebaseApp is not initialized`) — consistent with the P0 “turn on push end-to-end” item; needs the EAS dev build + FCM setup rather than Expo Go.
- **Fixed in this branch during the same session:** duplicate Message/“Plan with X” CTA on the guide profile (removed Message; itinerary screen had already made the same call), hero gallery now auto-advances every 4 s with pause-on-touch and loop, and the Explore greeting now truly collapses (height reclaimed via hysteresis + `withTiming`, no dead gap).

---
_Audit artifacts: raw per-subsystem maps and synthesis JSON retained in the session workspace; regenerate by re-running the `detour-release-audit-sequential` workflow._
