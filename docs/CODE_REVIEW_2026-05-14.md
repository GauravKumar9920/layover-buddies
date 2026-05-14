# Mumbai Buddies — Code Review & Live Test Report
**Date:** 2026-05-14
**Scope:** Marketing site, Mobile app, Admin panel, Supabase backend (29 migrations, 15 Edge Functions, pg_cron)
**Method:** 3 parallel review agents + live Claude Preview testing + read-only psql/curl smoke against local Supabase

---

## Executive Summary

Mumbai Buddies has shipped an impressive amount of architecture: a 25-state booking FSM (Phase 1–5), Razorpay deposit/balance/top-up flows, atomic reconciliation/cancellation RPCs, pg_cron lifecycle automation, push notifications, and an editorial-zine UI that actually looks like a real product. The bones are strong.

The review found **210 numbered findings** across the surfaces. The top issues are concentrated, not diffuse — fixing roughly a dozen items would move the project from "demo-ready" to "ready for a real beta cohort." Three findings are existential and should be fixed before any external user touches the system:

**Top 5 must-fix before beta:**

1. **Admin panel ships the Supabase `service_role` key in the client bundle.** Any deploy of `admin/` (even by accident) hands god-mode DB access to anyone with the URL. The `VITE_*` prefix means Vite inlines it at build time — there is no "local only" enforcement in code. Move to a server-side proxy or refuse `vite build` when `NODE_ENV=production`. *(Admin #1)*
2. **`create-booking-payment` Edge Function has no JWT check and trusts a client-supplied amount.** Anyone with a valid `booking_id` can mint Razorpay orders for arbitrary amounts on the project's account. Either delete (it's superseded by `create-balance-order`/`create-deposit-order`) or add `getUserFromRequest()` + server-side amount lookup. *(Backend #1)*
3. **Mobile booking flow routes new bookings to the legacy single-shot payment screen**, short-circuiting the entire agreement → sign → deposit → balance lifecycle. Travelers end up in a `confirmed` state with no signed agreement. Remove the route at [book/[guideId].tsx:565](mobile/app/(traveler)/book/[guideId].tsx) and land on the trip detail instead. *(Mobile #9)*
4. **Admin Cancellations page is 100% broken** — fails with PostgREST `42883: operator does not exist: booking_status ~~ unknown` because `.like('status', 'cancelled%')` runs against an enum column. Cast to text or use `.in(...)`. Confirmed live in Claude Preview. *(Admin #4 / live)*
5. **Admin Revenue page shows ₹0 for everything** — filters on `payment_status='paid'` but Phase 2 extended the enum to `captured`. Confirmed live: 6 completed+captured bookings exist but Revenue reports zero. *(Admin #11 / live)*

After those, the next tier is concentrated in: (a) **TS/DB schema drift** (`User.name`, `GuideProfile.categories`, `Booking.payment_intent_id` all reference fields that don't exist on the DB or have different names), (b) **legacy-status filters** in mobile that hide all Phase 1+ bookings from My Trips / Inbox / cancel CTAs, and (c) **non-atomic two-step writes** in deposit/balance capture handlers that can leave bookings stuck mid-state.

Overall health: **B-**. The financial-state logic is unusually careful (FSM, atomic RPCs, payment idempotency keys). The seams between phases (legacy status filters, `as unknown as` casts, admin schema drift) are the weak spots.

---

## Findings by Surface

### Mobile App (100 findings — 10 critical, 25 high)

Full agent report archived in conversation history. Highest-priority items:

**CRITICAL**

| # | File | Issue |
|---|---|---|
| 1 | [mobile/lib/api/expenseProofs.ts:44,58](mobile/lib/api/expenseProofs.ts) | `crypto.randomUUID()` not in Hermes; throws on first proof upload. Add polyfill or `nanoid/non-secure`. |
| 2 | [mobile/lib/api/expenseProofs.ts:59](mobile/lib/api/expenseProofs.ts) | Bill upload `.upload()` is unawaited → on failure, DB row gets 404 URL. |
| 3 | [mobile/lib/api/payments.ts:77](mobile/lib/api/payments.ts) | `assertRazorpayCheckoutAvailable()` only called in legacy `book/payment`; balance/deposit/top-up flows surface raw `require()` failures. |
| 4 | [mobile/app/(shared)/agreements/[bookingId].tsx:241](mobile/app/(shared)/agreements/[bookingId].tsx) | "Buddy fee" pricing label mis-derived for non-zero GST — viewer shows a number that doesn't match what the buddy entered. |
| 5 | [mobile/lib/api/itineraries.ts:97-101](mobile/lib/api/itineraries.ts) | Compensating delete on stop-insert failure is racy + hard-deletes (bypasses soft-delete invariant). |
| 6 | [mobile/app/(traveler)/trips/[id].tsx:54-62](mobile/app/(traveler)/trips/[id].tsx) | 15s polling fights Realtime; unhandled promise rejection on network blip. |
| 7 | [mobile/lib/api/bookings.ts:308](mobile/lib/api/bookings.ts) | `declineBooking` / `cancelBooking` bypass the state machine and write legacy enum values. |
| 8 | [mobile/types/index.ts:6-11](mobile/types/index.ts) | `User.name`, `GuideProfile.categories`, `Booking.payment_intent_id` don't exist on DB — fallback strings ("Guide", "Traveler") render silently. |
| 9 | [mobile/app/(traveler)/book/[guideId].tsx:565-569](mobile/app/(traveler)/book/[guideId].tsx) | New bookings route into legacy single-shot payment screen, skipping agreement/sign/deposit lifecycle. |
| 10 | [mobile/lib/api/agreements.ts:269-369](mobile/lib/api/agreements.ts) | `sendAgreement` rollback is best-effort; mid-flight DB error leaves agreement `sent` while booking still `agreement_drafting`. |

**HIGH (selected)**

- [#11–14] `as unknown as TripBooking` cast hides shape drift; client-side trip-start time check is bypassable; no agreement-expiry check before signing; realtime channels show error banners but never auto-reconnect.
- [#15] `fetchActiveGuides(city)` and `searchGuides(city)` ignore the `city` argument — Mumbai is hardcoded.
- [#16] Unknown booking_status normalised to `chat_open` — manual ops fixes get silently misrepresented.
- [#18] **`signOut` doesn't invalidate push token** despite `invalidateOwnPushTokenOnLogout` existing. Shared phone leaks notifications.
- **[#19–21] CONFIRMED LIVE: Legacy status filter excludes Phase 1+ bookings from My Trips upcoming, Inbox, and cancel CTAs.** Tested in Claude Preview: "4 total · 0 upcoming" but only 3 cards visible; 1 booking in `chat_open` state invisible to the user.
- [#22, 23] No pagination on `fetchTravelerBookings`, `fetchActiveGuides` (hardcoded limit 30 — 31st+ guide invisible).
- [#24] Avg rating recompute is client-side and racy.
- [#28] In-trip elapsed timer re-renders entire screen every 1 second.

**MEDIUM/LOW (selected)**

- Console statements ungated by `__DEV__` in [favorites.ts:71,115](mobile/lib/stores/favorites.ts), [registerPushToken.ts:103,138](mobile/lib/push/registerPushToken.ts).
- [book/[guideId].tsx](mobile/app/(traveler)/book/[guideId].tsx) is 861 lines — needs splitting; traveler count captured but never sent to `createBooking`; past-date validation uses UTC midnight on `parseISO` (IST edge-of-day rejections).
- [app.json:76](mobile/app.json) EAS `projectId: "PLACEHOLDER_RUN_EAS_INIT_TO_GENERATE"` — push token registration will fail in production builds.
- Unused deps: `axios`, possibly `ajv`. ~20 KB gzipped each.
- Pronoun bug spotted live: guide profile says "Rohan, in **her** own words" — hardcoded copy, should be neutral.

---

### Admin Panel (50 findings — 3 critical, 6 high)

**CRITICAL**

1. **`VITE_SUPABASE_SERVICE_KEY` is inlined into the client bundle by Vite.** A single accidental deploy leaks read/write to every row. Move to a server-side proxy; at minimum add a top-of-file `throw if (import.meta.env.PROD)` guard. [admin/src/lib/supabase.ts:9](admin/src/lib/supabase.ts)
2. **Empty-password bypass**: `VITE_ADMIN_PASSWORD=` (empty after `=`) is parsed by Vite as `""`, and `password === ""` matches. [admin/src/lib/auth.ts:18-34](admin/src/lib/auth.ts) — require length ≥ 8.
3. **No schema validation** on Supabase responses; `as unknown as BookingRow[]` casts everywhere hide PostgREST nested-relation shape mismatches. Once schema drifts, location links render `https://maps.google.com/?q=undefined,undefined`.

**HIGH**

- **[#4 confirmed live] `.like('status', 'cancelled%')` on enum column** — Cancellations page returns `42883: operator does not exist: booking_status ~~ unknown`. Cast to text: `.like('status::text', 'cancelled%')` or use `.in('status', ['cancelled_voluntary', 'cancelled_no_pay', ...])`.
- **[#11 confirmed live] Revenue page shows ₹0** for all metrics because it filters `payment_status='paid'` but the Phase-2 enum value is `captured`. Live data has 6 completed+captured bookings totaling >₹7000 that aren't counted.
- **PostgREST nested-relation drift trap** in Bookings/SOS/Cancellations/Payouts — `traveler: b.traveler?.full_name` works today only because PostgREST flattens single-row joins; if any join becomes multi-row, every name silently renders "—".
- **`alert()` modals** for Cancellations re-issue / Payouts retry. Replace with toasts; `await load()` on success (Cancellations currently tells the user to manually refresh).
- **SOS optimistic update never reloads** — divergence risk with DB triggers; `acknowledged_at` (server timestamp) silently missing.
- **Revenue date filter uses local-time `.toISOString()`** — IST admins see numbers shift by up to ±1 day depending on what hour they load the page.
- **`SOS.tsx:114` `r.latitude.toFixed(4)`** — no null guard; one bad row crashes the entire SOS table render.

**MEDIUM/LOW (selected)**

- Silent pagination caps: 500 rows on most pages, 200 on Cancellations. Only Users + Bookings surface "(cap 500)" in subtitle.
- Cross-tab signout via `storage` event **does not fire for `sessionStorage`** — the listener at [App.tsx:18-22](admin/src/App.tsx) is dead code. Comment is misleading.
- `Window` type shadows global `window` in Revenue.tsx — rename to `TimeWindow`.
- React Router future flags set for v7, but `package.json` pins `^6.26.0` — confirm intent.
- Missing `lint` / `typecheck` scripts in `admin/package.json`.
- Sidebar nav active-state appears to accumulate previous selections (live observation) — likely a NavLink `end` flag missing.

---

### Backend / Supabase (60 findings — 7 critical, 15 high)

**CRITICAL**

1. **`create-booking-payment` accepts unauthenticated calls + client-supplied amount.** Delete or harden. [supabase/functions/create-booking-payment/index.ts](supabase/functions/create-booking-payment/index.ts)
2. **Service-role bearer checks use non-timing-safe `===`** in `issue-refund`, `send-push`, `replay-stubbed-payouts`. The `_shared/razorpaySignature.ts:timingSafeEqual` helper already exists — reuse it.
3. **Migration order fragility** in `compute_reconciliation_tx` / `compute_cancellation_resolution_tx`: `ON CONFLICT (booking_id, kind, recipient_user_id)` references a unique constraint added later (migration 100600). Partial-migrate states throw 42P10. Also, 100300 duplicates `CREATE TABLE IF NOT EXISTS payout_dispatches` with a `CHECK (status IN ('pending','sent','failed','cancelled'))` that contradicts the real `payout_dispatch_status` enum.
4. **`notifications` table schema mutation** (migration 100400) drops NOT NULL on `user_id`, `type`, `title` so Phase-1 and Phase-3 schemas coexist. Phase-1 RLS filters by `user_id` while Phase-3 rows have `user_id IS NULL` and use `recipient_user_id` — two read paths over the same table are not coherent.
5. **Hardcoded `late_fee_paise = 100000`** duplicated in SQL cron body, TS edge fn, mobile constants. No single source of truth.
6. **Concurrent webhook race in `depositCapture.ts:80-184` and `balanceCapture.ts:52-136`** — idempotency check + write not wrapped in a transaction, no `FOR UPDATE` lock. Two retried webhooks for the same payment can both proceed, leaving booking stuck in `deposits_held` if the mid-write `awaiting_balance` update fails (the TODO comment at line 167-168 acknowledges this).
7. **Lossy data migration in 20260503110100** rewrites pre-Phase-1 bookings to Phase-1 states without backfilling required `agreements` rows. Cron jobs silently skip these orphans; `cron_deposit_window_expire` may throw on missing agreement.

**HIGH (selected)**

- **`USING (true)` on `public.users` for authenticated SELECT** — defense-in-depth only via column-level GRANT; one wrong future migration re-exposes email/phone/role/banned_reason/payout_vpa to every logged-in user.
- **Storage policies for `itinerary-photos` and `avatars` only check `auth.uid() IS NOT NULL`** — any authenticated user can overwrite anyone's avatar or itinerary photos. Fix with `(storage.foldername(name))[1] = auth.uid()::text`.
- **`bookings.trip_qr_token` has no UNIQUE constraint** — only a partial index. Confirmed live: only `idx_bookings_qr_token` exists. Add `UNIQUE` or partial unique constraint.
- **`cron_send_pending_pushes` silently returns on missing `app.settings.supabase_url`** — notifications stop with zero observability.
- **`payment_events` lacks GRANTs for Phase-3 columns** (`is_late_fee_component`, `idempotency_key`) — authenticated clients reading those columns will fail or get nulls.
- **`issue-refund` routes all deposit refunds against the EARLIEST captured payment** — a `buddy_deposit_refund` is dispatched against the traveler's payment_id.
- **`qr-scan` returns 200 with `error: 'vpa_missing'` in body** — naive clients treat as success; trip starts, payout silently fails.
- **`balanceCapture.ts` best-effort T-12h jump swallows errors** — booking can be stuck in `balance_paid` past the 24h stale guard in cron.

**MEDIUM/LOW (selected)**

- `top_up_requests_insert_buddy` has no max bound on `requested_paise` — buddy can request ₹10,000,000 and hope the traveler taps Approve.
- `cost_line_items.estimated_paise` has no `CHECK (estimated_paise >= 0)`.
- Auth-trigger `backfill_public_users_from_auth()` runs in a single transaction at migration time — multi-minute on large databases.
- `active_guides` VIEW doesn't have `WITH (security_invoker = true)` — column-level GRANT on `public.users` doesn't protect view consumers.

---

### Marketing Site

Tested live in Claude Preview at `http://localhost:5173`. Both `index.html` and `know-more.html` load cleanly:

- **No 404s, no console errors, no failed requests.** 19 images all load (the "missing images" TODO in `CLAUDE.md` is out of date — all images are present).
- **Brand colors are aligned with the design system** — hero is saffron→coral, not Indigo/Sky Blue. The pre-flagged design-system mismatch has been resolved.
- **Placeholder URLs replaced:** Instagram (`instagram.com/mumbaibuddies`), X (`x.com/mumbaibuddies`), and no `localhost:8081` placeholders remain.

Real findings (still open):

- **Design-system fonts NOT loaded.** `h1` computed `font-family` is `ui-sans-serif, system-ui, sans-serif` — Plus Jakarta Sans / Inter / DM Sans (the design tokens) are not referenced or loaded from a CDN. Mobile uses them via NativeWind; marketing site falls back to system fonts.
- **WhatsApp link absent entirely** (`waLinks` returns `[]`). If WhatsApp is the intended contact channel per `CLAUDE.md` (replacing `wa.me/910000000000`), the real link needs to be added.
- **Gray gradient placeholders below the hero on `know-more.html`** — likely intentional CSS gradients in lieu of images, but visually read as "broken" on first impression.

---

## Live-Test Results Summary

| Surface | Outcome | Findings confirmed live |
|---|---|---|
| Marketing site (Vite, :5173) | ✅ All sections render, no errors | Fonts not loaded; WhatsApp link missing |
| Admin login (Vite, :5174) | ✅ Password gate works | Session-storage `storage` listener is dead |
| Admin Users page | ✅ 8 users displayed (3 travelers, 5 guides) | None |
| Admin Bookings page | ✅ 8 bookings with joined names | Status `chat_open` rendered as "Chat Open" — confirms Phase-2 flow created bookings |
| Admin Revenue page | ❌ **All ₹0** — filters on `payment_status='paid'` excludes Phase-2 `captured` | Confirmed Admin #11 |
| Admin SOS page | ✅ "No open SOS — all clear" | None |
| Admin Cancellations page | ❌ **"Load failed" banner** — PostgREST 42883: LIKE on enum column | Confirmed Admin #4 (real root cause found via curl) |
| Admin Payouts page | ✅ Empty state renders | None |
| Mobile Explore (Web export) | ✅ 5 guides render with images, ratings, categories | Favorites query 403 (RLS — seeded user has no auth.users) |
| Mobile Guide profile | ✅ Editorial-zine layout renders | **Pronoun bug**: "Rohan, in *her* own words" |
| Mobile My Trips | ❌ "4 total · 0 upcoming" but only 3 cards | Confirms Mobile #20 (legacy status filter) |
| Mobile Inbox | ❌ "3 conversations" — same 4th booking missing | Confirms Mobile #21 (`fetchInbox` legacy filter) |
| Supabase health (psql) | ✅ All containers healthy | None |
| Cron jobs | ✅ 8 jobs scheduled, last 10 runs all succeeded | None |
| Edge Functions reachability | ✅ All return 401 (JWT-protected) | None |
| Storage buckets | ✅ 3 buckets exist (avatars + itinerary-photos public, expense-proofs private) | None |
| RLS policy coverage | ✅ 25 tables with policies, 67 policies total | None |
| `trip_qr_token` UNIQUE | ❌ Only partial index, no UNIQUE constraint | Confirms Backend #11 |

---

## Type-Mismatch Reconciliation (TS ↔ DB)

| TS field | DB column | Status | Fix |
|---|---|---|---|
| `User.name` | `users.full_name` | Drift — TS field absent; normalizer falls back to `'Guide'`/`'Traveler'` | Add `full_name` to TS type; remove the fallback string defaults |
| `GuideProfile.categories: string[]` | (no column) | Missing | Either add `categories` column or read from `itineraries.category` aggregation |
| `Booking.payment_intent_id` | `bookings.payment_id` | Renamed (legacy Stripe field name) | Rename TS field to `payment_id` |
| `Booking.itinerary_id: string` | `bookings.itinerary_id` (nullable per FK ON DELETE SET NULL) | Type too narrow | Make `string \| null` |
| `payment_status='paid'` | enum: `pending\|authorized\|captured\|released\|failed\|refunded` | Legacy value | Update Revenue page filter to include `captured` |
| `BookingStatus` (mobile constants) | enum: 27 values | Mobile uses 7-value subset | Centralize via `stateMachine.ts` |

---

## Security Posture

**Strong:**
- Razorpay webhook HMAC signature verification uses timing-safe compare (`_shared/razorpaySignature.ts`).
- Financial RPCs (`sign_agreement_tx`, `compute_reconciliation_tx`, `compute_cancellation_resolution_tx`) are SECURITY DEFINER, EXECUTE-REVOKED from authenticated, called only from Edge Functions with service-role.
- Column-level GRANTs restrict `razorpay_*` fields to service_role.
- `expense-proofs` bucket is private; storage RLS keyed by booking party.
- Phase-1 RLS policy coverage is comprehensive (67 policies across 25 tables).

**Weak (security debt):**
- Admin panel service-role key in client bundle (the existential risk).
- `create-booking-payment` unauthenticated.
- Service-role bearer checks not timing-safe.
- `public.users` `USING (true)` SELECT policy + column-GRANT pattern — defense-in-depth only.
- Public buckets (`avatars`, `itinerary-photos`) allow any authenticated user to overwrite anyone's file.
- `set_top_up_status` has no max-amount bound — social-engineering surface.

---

## Open Questions / Product Decisions Needed

These are not bugs — they need a product call:

1. **Commission rate**: code uses 25% (`COMMISSION_RATE=0.25`), spec mentions 15%. Confirmed by `mobile/config/constants.ts` comment "stays at 25% pending Gaurav's confirmation". Decide and update.
2. **Late fee amount**: ₹1,000 hardcoded in 3 places. Should it vary by booking tier? Once decided, move to a config table.
3. **Top-up max amount**: no cap today. What's the policy? Per request? Per trip? Per day?
4. **Buddy ban policy**: `buddy_cancel` triggers `is_banned=true` permanently. Should there be an appeal / time-decay?
5. **WhatsApp contact**: marketing site has no WhatsApp link. Is the team going to publish one?
6. **Multi-city expansion**: `PRIMARY_CITY='Mumbai'` is hardcoded. When and how do we add a second city?
7. **Pronoun handling**: editorial zine says "Rohan, in *her* own words" — gendered copy. Add a `pronoun` field to guide profile, or always use neutral.

---

## Recommended Fix Order

### Tier 1 — Before any external user touches it (S = small, M = medium, L = large)

1. **[S]** Add `throw` guard at admin/src/lib/supabase.ts top: refuse `import.meta.env.PROD` build without explicit override. Or move to server-side proxy [L]. *(Admin #1)*
2. **[S]** Delete `supabase/functions/create-booking-payment` OR add JWT auth + server-side amount. *(Backend #1)*
3. **[S]** Mobile: remove the route `/(traveler)/book/payment/[bookingId]` and have booking creation land on trip detail. *(Mobile #9)*
4. **[XS]** Admin Cancellations: change `.like('status', 'cancelled%')` to `.in('status', [..six cancelled_* enum values..])`. *(Admin #4)*
5. **[XS]** Admin Revenue: change `payment_status='paid'` filter to `payment_status IN ('paid', 'captured')`. *(Admin #11)*

### Tier 2 — Before beta users

6. **[S]** Mobile: replace legacy-status filter in `messages.ts:fetchInbox`, `trips/index.tsx`, `trips/[id].tsx`. Centralize through `cta.ts`/`stateMachine.ts`. *(Mobile #19–21)*
7. **[S]** Mobile: add `crypto.randomUUID` polyfill (or use `nanoid/non-secure`). *(Mobile #1)*
8. **[S]** Mobile: await the bill upload in `expenseProofs.ts`. *(Mobile #2)*
9. **[S]** Mobile: hoist `assertRazorpayCheckoutAvailable()` into `openRazorpayCheckout`. *(Mobile #3)*
10. **[S]** Mobile: `signOut` should call `invalidateOwnPushTokenOnLogout`. *(Mobile #18)*
11. **[M]** Mobile: fix the 4 schema-drift TS types (`User`, `GuideProfile.categories`, `Booking.payment_intent_id`, `Booking.itinerary_id`). *(Mobile #8 / Backend #10)*
12. **[M]** Backend: timing-safe service-role bearer check across `issue-refund`, `send-push`, `replay-stubbed-payouts`. *(Backend #2)*
13. **[S]** Backend: add `UNIQUE(trip_qr_token)` constraint. *(Backend #11)*
14. **[M]** Backend: wrap deposit/balance capture handlers in transactional RPCs. *(Backend #6)*

### Tier 3 — Quality / polish

15. Mobile pronoun bug + EAS projectId placeholder + unused `axios` dep.
16. Marketing site: load Plus Jakarta Sans / Inter / DM Sans; add WhatsApp link.
17. Admin: replace `alert()` with toast, surface pagination caps consistently, fix sidebar active-state.
18. Backend: storage policies for `avatars` / `itinerary-photos` keyed by `(storage.foldername)[1] = auth.uid()`.
19. State-machine drift detector: CI step that imports the TS `transitions` and the SQL functions and compares.

---

## Out Of Scope (Tested or Documented Elsewhere)

- **Native iOS / Android flows** — Razorpay native checkout, react-native-maps, expo-camera, expo-location, expo-haptics, expo-notifications. Manual test script written at [docs/manual-ios-test.md](docs/manual-ios-test.md) for a future iOS Simulator pass.
- **Production Razorpay live keys** — local test keys only. Switch when launching.
- **CI/CD pipeline** — none exists. Out of scope for this review.
- **Load testing** — not done.

---

## Appendix A — Tools Used

- **3 parallel review agents:** `reviewer` (Mobile), `reviewer` (Admin), `security-auditor` (Backend). Each given the Phase-1 inventory + an explicit findings template.
- **Claude Preview** for live browser testing: marketing, admin, mobile-web sequentially.
- **Read-only psql via `docker exec`** for schema/RLS/cron/data spot-checks.
- **`curl`** to confirm Edge Function reachability and replay the failing Admin Cancellations query.

## Appendix B — Findings Inventory

- Mobile: 100 numbered findings (10 CRITICAL, 25 HIGH, 27 MEDIUM, 19 LOW, 19 STYLE)
- Admin: 50 numbered findings (3 CRITICAL, 6 HIGH, 17 MEDIUM, 19 LOW, 5 STYLE)
- Backend: 60 numbered findings (7 CRITICAL, 15 HIGH, 17 MEDIUM, 7 LOW, 14 STYLE)
- Live-test findings: 8 distinct issues, all confirming agent findings except the Cancellations 42883 root cause (newly identified live)

Full agent reports are archived in the review-session transcript. Re-run the agents at any time via the planning prompt at [.claude/plans/hey-okkay-so-shiny-dusk.md](.claude/plans/hey-okkay-so-shiny-dusk.md).
