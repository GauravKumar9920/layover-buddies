# Mumbai Buddies — Review Backlog (Deferred Findings)

**Source:** docs/CODE_REVIEW_2026-05-14.md (review pass on 2026-05-14)
**Status legend:** 🔴 in this pass · 🟡 next pass · ⚪ later · ❓ needs decision

This backlog tracks the **~190 findings NOT being fixed in the current pass** (Tier 1 + Tier 2 = ~14 items being addressed). Items are grouped by surface; each line is actionable. Cross-reference the original review doc for full context.

---

## Tier 3 — Mobile (~70 items deferred)

### Code quality / refactor
- ⚪ [book/[guideId].tsx](mobile/app/(traveler)/book/[guideId].tsx) is 861 lines — split CalendarPicker, TimeInput, DayOverview, ItinCard, LabeledInput, PriceRow into `mobile/components/booking/`
- ⚪ Three near-identical `normalizeItinerary` implementations ([bookings.ts:106](mobile/lib/api/bookings.ts), [itineraries.ts:19](mobile/lib/api/itineraries.ts), [guides.ts:148](mobile/lib/api/guides.ts)) — centralize into `lib/api/_normalize.ts`
- ⚪ Three identical `openXxxCheckout` wrappers ([payments.ts](mobile/lib/api/payments.ts), [deposits.ts:64](mobile/lib/api/deposits.ts), [topUp.ts:118](mobile/lib/api/topUp.ts)) — single helper with `tourName` override
- ⚪ Two duplicate `PHOTOS`/`LAYOUT`/`FloatingPhoto` blocks in [login.tsx](mobile/app/(auth)/login.tsx) and [signup.tsx](mobile/app/(auth)/signup.tsx) — extract to `components/auth/FloatingMumbai.tsx`
- ⚪ [book/[guideId].tsx:524-526](mobile/app/(traveler)/book/[guideId].tsx) — wrap `buddyCost`/`estimatedExpenses`/`commission` in `useMemo`
- ⚪ [in-trip/[bookingId].tsx:51-71](mobile/app/(guide)/bookings/in-trip/[bookingId].tsx) — elapsed timer ticks every 1s, re-renders entire screen. Use Reanimated `useDerivedValue` or update every minute
- ⚪ `path as never` cast repeated 19 times across codebase despite `typedRoutes: true` in app.json — use typed `Href<...>` from expo-router
- ⚪ Inconsistent `(err: unknown)` vs `(err)` in catch blocks — ESLint rule `@typescript-eslint/use-unknown-in-catch-callback-variable`

### UX / correctness
- ⚪ [book/[guideId].tsx:539-541](mobile/app/(traveler)/book/[guideId].tsx) — past-date validation uses `parseISO` (UTC midnight) which mis-rejects late-evening IST bookings
- ⚪ [book/[guideId].tsx:548-551](mobile/app/(traveler)/book/[guideId].tsx) — `numTravelers` validated but never sent to `createBooking`
- ⚪ [trips/balance/[bookingId].tsx:126-128](mobile/app/(traveler)/trips/balance/[bookingId].tsx) — cancellation detection uses string-match (`err.message.includes('cancelled')`) — locale-fragile
- ⚪ Loading skeletons in [book/[guideId].tsx:599-655](mobile/app/(traveler)/book/[guideId].tsx) duplicate the real header tree — collapse via opacity fade
- ⚪ [book/payment/[bookingId].tsx:303](mobile/app/(traveler)/book/payment/[bookingId].tsx) — "Cancel" destructive button just navigates home; doesn't actually cancel the booking
- ⚪ [trips/[id].tsx:54-62](mobile/app/(traveler)/trips/[id].tsx) — 15s polling fights Realtime + unhandled promise rejection on network blip
- ⚪ [shared/messages/[bookingId].tsx:198-204](mobile/app/(shared)/messages/[bookingId].tsx) — `markMessagesRead` fires on every `messages.length` change; debounce or fire only on focus
- ⚪ [shared/agreements/[bookingId].tsx:141-153](mobile/app/(shared)/agreements/[bookingId].tsx) — 30-second poll for deposit confirmation; redundant with Realtime channel
- ⚪ Reviews avg-rating recompute is client-side and racy ([reviews.ts:40-52](mobile/lib/api/reviews.ts))
- ⚪ No pagination on `fetchTravelerBookings` ([bookings.ts:251-261](mobile/lib/api/bookings.ts)) or `fetchActiveGuides` (hardcoded limit 30)
- ⚪ Realtime channels show error banners but don't auto-reconnect ([useMessages.ts:57-67](mobile/lib/hooks/useMessages.ts), [useTrip.ts:132-172](mobile/lib/hooks/useTrip.ts), [useAgreement.ts:108-116](mobile/lib/hooks/useAgreement.ts))
- ⚪ Client-side trip-start time check ([agreements.ts:295-302](mobile/lib/api/agreements.ts)) — bypassable via device clock
- ⚪ No agreement-expiry check before signing ([shared/agreements/[bookingId].tsx:91-160](mobile/app/(shared)/agreements/[bookingId].tsx))
- ⚪ `fetchActiveGuides(city)` and `searchGuides(city)` ignore `city` argument ([guides.ts:208-210](mobile/lib/api/guides.ts))
- ⚪ Unknown booking_status silently normalised to `chat_open` ([bookings.ts:97-104](mobile/lib/api/bookings.ts))
- ⚪ Notification tap-routing subscribes on every router change ([_layout.tsx:38-42](mobile/app/_layout.tsx))
- ⚪ `declineBooking`/`cancelBooking` bypass state machine ([bookings.ts:308,314](mobile/lib/api/bookings.ts)) — should go through `cancel-booking` Edge fn
- ⚪ `sendAgreement` rollback not atomic on mid-flight DB error ([agreements.ts:269-369](mobile/lib/api/agreements.ts))
- ⚪ Compensating delete in `createItinerary` is racy + bypasses soft-delete ([itineraries.ts:97-101](mobile/lib/api/itineraries.ts))
- ⚪ Buddy fee in agreement viewer mis-derived for non-zero GST ([shared/agreements/[bookingId].tsx:241](mobile/app/(shared)/agreements/[bookingId].tsx))

### Pronoun / copy / branding
- 🟡 Hardcoded "Rohan, in **her** own words" in editorial-zine guide profile — confirmed live. Add `pronoun` field to guide profile or use neutral copy.
- ⚪ Marketing site: design-system fonts (Plus Jakarta Sans / Inter / DM Sans) not loaded — falls back to `ui-sans-serif`
- ⚪ Marketing site: WhatsApp contact link absent (empty `waLinks` array)
- ⚪ Marketing site: gray gradient placeholders below know-more.html hero — confirm intentional

### Performance
- ⚪ [saved.tsx:44-49](mobile/app/(traveler)/saved.tsx) — N round-trips for favorite itineraries; add `fetchItinerariesByIds(ids[])` with `.in('id', ids)`
- ⚪ [reviews.ts](mobile/lib/api/reviews.ts) — avg-rating client recompute is racy under concurrent submits

### Type / schema drift (NOT covered by Batch C — these are remaining ones)
- ⚪ Many `as unknown as TripBooking`-style casts hide drift ([useTrip.ts:116](mobile/lib/hooks/useTrip.ts))

### Tests / tooling
- ⚪ State machine has no automated drift detector vs SQL `compute_*` functions
- ⚪ Reconciliation/cancellation: TS and SQL formulas drift independently — add CI step running both on canonical fixtures
- ⚪ Razorpay webhook signature test coverage is "admittedly thin"

### Dependency hygiene
- ⚪ Unused `axios` (~20 KB gzipped) in `mobile/package.json`
- ⚪ Possibly unused `ajv` — audit
- 🟡 [app.json:76](mobile/app.json) — EAS `projectId: "PLACEHOLDER_RUN_EAS_INIT_TO_GENERATE"` — push token registration fails in production builds

---

## Tier 3 — Admin Panel (~30 items deferred)

### Security debt (defense-in-depth — service-role guard is the main fix in Batch A)
- 🟡 Add eslint config so `eslint-disable-next-line no-console` comments mean something ([supabase.ts:12](admin/src/lib/supabase.ts))
- ⚪ Document password gate weakness more loudly in README

### Schema drift trap
- 🟡 `as unknown as BookingRow[]` casts everywhere — bypass runtime validation. Generate types via `supabase gen types typescript` or add zod schemas
- ⚪ PostgREST nested-relation flatten trap (works today, brittle) — use `!inner` hint or post-process

### UX
- ⚪ Replace `alert()` with toast component ([Cancellations.tsx:98,100](admin/src/pages/Cancellations.tsx), [Payouts.tsx:86](admin/src/pages/Payouts.tsx))
- ⚪ Add 30s auto-refresh on SOS + Payouts pages (or Supabase Realtime subscriptions)
- ⚪ SOS optimistic update doesn't reload — divergence risk with DB triggers
- ⚪ `windowToSince()` in Revenue uses local-time `.toISOString()` — IST timezone-fragile ([Revenue.tsx:19-25](admin/src/pages/Revenue.tsx))
- ⚪ Silent pagination caps (500/200) — surface "cap" subtitle on all pages, not just Users/Bookings
- ⚪ `Window` type shadows global ([Revenue.tsx:17](admin/src/pages/Revenue.tsx)) — rename to `TimeWindow`
- ⚪ Cross-tab signout via `storage` event is dead for sessionStorage ([App.tsx:18-22](admin/src/App.tsx))
- ⚪ Login: no `name` on password input, no `setPassword('')` on success, no disabled state on submit
- ⚪ Sidebar nav active-state accumulates previous selections — confirmed live; likely missing NavLink `end` prop
- ⚪ No 404 page — unknown routes silently redirect to `/users`

### Data correctness
- ⚪ `SOS.tsx:114` — `r.latitude.toFixed(4)` no null guard; bad row crashes whole table
- ⚪ `formatINR` rounds with `maximumFractionDigits: 0` — silently floors paise; add `formatINRPrecise` for accounting contexts
- ⚪ `relative()` Math.round inconsistency at boundary (29s → "just now", 31s → "1m ago")
- ⚪ Cancellations Re-issue button doesn't `await load()` like Payouts does

### Style / code organization
- ⚪ Mixed Tailwind raw colors (`bg-red-50`) vs semantic tokens (`bg-danger/10`) across pages
- ⚪ Inconsistent comment banners (box-drawn vs `//`)
- ⚪ Magic strings: `'issue-refund'` repeated in 2 places, `'razorpay_live_not_configured'` repeated in 2 places — centralize
- ⚪ Cancellations `tierLabel` defaults to raw underscore string for unknown triggers
- ⚪ `Payouts.tsx` Refresh button is mis-placed semantically (anchor-styled button in flex row)
- ⚪ Mixed `p-6` outer + `PageHeader px-8` padding nesting on Cancellations/Payouts
- ⚪ Filter chips hard-coded for `cancellation_trigger_event` — compute from rows instead
- ⚪ `Shell` `navigate('/', ...)` after `onSignOut()` is a no-op (component already unmounting)
- ⚪ Emoji-only sidebar nav — consider Heroicons for screenshots
- ⚪ No `lint`/`typecheck` scripts in [admin/package.json:7-11](admin/package.json)
- ⚪ Action buttons in SOS/Payouts/Cancellations lack `aria-label`
- ⚪ DataTable lacks `<caption>` and `scope="col"` for a11y
- ⚪ `StatusBadge` doesn't cover all booking statuses (e.g. `cancelled_voluntary`, `cancelled_no_pay`, etc.) — falls through to neutral

---

## Tier 3 — Backend / Supabase (~45 items deferred)

### Migration / schema hygiene
- 🟡 Migration order fragility (the 100400 clobber pattern, fixed retroactively in 100700) — convert cron bodies to a single-source-of-truth pattern
- 🟡 `notifications` table schema mutation (migration 100400 drops NOT NULL on `user_id`, `type`, `title`) — fully migrate legacy schema or split into two tables
- 🟡 Lossy data migration in `20260503110100_bookings_status_data_migration.sql` — pre-Phase-1 bookings rewritten without backfilling `agreements` rows
- 🟡 Hardcoded `late_fee_paise = 100000` duplicated in 3 places (SQL cron, TS Edge fn, mobile constants) — move to config table
- ⚪ `agreements` constraint `agreements_total_matches_formula` hardcodes 50000 (DEPOSIT_PAISE)
- ⚪ Two payout-like tables (`payouts` + `payout_dispatches`) — `payouts` appears unused; document or delete
- ⚪ `favorites` lacks `updated_at` column / moddatetime trigger
- ⚪ `university DROP NOT NULL` (migration 20260429000000) — active_guides view still GROUP BYs `gp.university`
- ⚪ Migration `backfill_public_users_from_auth()` runs in a single transaction at migration time — multi-minute on large databases

### RLS / Security
- 🟡 `USING (true)` on `public.users` SELECT for authenticated — column-level GRANTs are the only defense
- 🟡 Storage policies for `itinerary-photos` and `avatars` only check `auth.uid() IS NOT NULL` — any user can overwrite any avatar/itinerary photo
- ⚪ `cron_send_pending_pushes` silently returns on missing `app.settings.supabase_url` — add heartbeat row to `cron_health` table
- ⚪ `payment_events` lacks GRANTs for Phase-3 columns (`is_late_fee_component`, `idempotency_key`)
- ⚪ `flight_tracking` has no INSERT policy; `location_tracking` is one-sided (buddy only)
- ⚪ `active_guides` and `guide_earnings_summary` VIEWs lack `WITH (security_invoker = true)`
- ⚪ Favorites admin-read policy nests `EXISTS users WHERE role='admin'` instead of using `get_my_role()` helper
- ⚪ `payouts` table lacks UPDATE policy (admin tooling must use service-role)
- ⚪ `top_up_requests` has no max-bound on `requested_paise` — social-engineering surface
- ⚪ `cost_line_items` has no `CHECK (estimated_paise >= 0)`
- ⚪ `sign_agreement_tx` overloads — old 2-arg signature lingers alongside new 3-arg

### Edge Function correctness
- 🟡 Concurrent webhook race in `depositCapture.ts:80-184` and `balanceCapture.ts:52-136` (Tier 2 covers the deposit one; balance is deferred)
- ⚪ `issue-refund` routes deposit refunds against earliest captured payment ([issue-refund/index.ts:101-109](supabase/functions/issue-refund/index.ts))
- ⚪ `qr-scan` returns 200 with `error: 'vpa_missing'` in body — naive clients treat as success
- ⚪ `balanceCapture.ts` best-effort T-12h jump swallows errors — bookings can stick in `balance_paid`
- ⚪ `create-topup-order` uses `.ilike()` for exact-match — use `.eq()`
- ⚪ `payment_events` idempotency key — `create-balance-order` INSERT without `ON CONFLICT` returns 500 on retries
- ⚪ Cron functions trap `WHEN OTHERS` and lose exception type — emit structured warnings with SQLSTATE
- ⚪ `topupCapture.ts:67-83` fallback INSERT path doesn't set `idempotency_key`
- ⚪ `set_top_up_status` uses `auth.role()` inside SECURITY DEFINER — fragile if called from non-Supabase context
- ⚪ Cancellation tier window edges (`lt_24h` vs `24_to_72h`) — verify TS mirror matches SQL boundaries exactly
- ⚪ `compute_cancellation_resolution_tx` computes `v_pg_fee` but never writes it to ledger — P&L blind spot
- ⚪ Ban re-applied silently on subsequent buddy_cancel — `banned_at` overwritten, history lost
- ⚪ `expense_proofs.payment_proof_url` has no MIME-type / size validation — buddy could upload 50 MiB binary

### Style
- ⚪ Inconsistent SQL casing across migrations
- ⚪ `razorpay-webhook` creates `adminClient()` per request — cold-start risk under retry storms
- ⚪ `CANCELLABLE_STATUSES` whitelist duplicated alongside `stateMachine.ts` — drive from state machine instead

---

## Product decisions needed (block fixes)

These are NOT bugs — they need an answer before fixes can land:

1. ❓ **Commission rate** — code uses 25%, spec suggests 15%. (`mobile/config/constants.ts` has a TODO.)
2. ❓ **Late fee amount** — ₹1,000 hardcoded. Tier-based?
3. ❓ **Top-up max bound** — no cap today. Per request? Per trip? Per day?
4. ❓ **Buddy ban policy** — `buddy_cancel` permanently bans. Appeals? Time-decay?
5. ❓ **WhatsApp contact** — marketing site has none. Number?
6. ❓ **Multi-city expansion** — when, where, and how to lift the `PRIMARY_CITY='Mumbai'` hardcode?
7. ❓ **Pronoun handling** — add `pronoun` field to guide profile or always use neutral copy?
8. ❓ **Admin signup deliverable** — should admin be moved server-side, or stay local-only with hardened guards?

---

## Live-confirmed bugs (from Phase B + gap-fill)

These were observed in the running app, not just in static review. **🔴 items below were fixed in the 2026-05-14 batched fix pass; the actual diffs are in the same-day commits.** The remaining 🟡/⚪ items are still open.

- ✅ **Booking invisible to its owner** — **FIXED**: centralised `isUpcomingBookingState` / `isActiveBookingState` in `stateMachine.ts`; rewired `(traveler)/trips/index.tsx`, `messages.ts:fetchInbox`, and `(traveler)/trips/[id].tsx` CTAs.
- ✅ **Admin Cancellations 100% broken** — **FIXED**: replaced `.like('status','cancelled%')` with `.in('status', [...7 enum values])` in `admin/src/pages/Cancellations.tsx`.
- ✅ **Admin Revenue under-reports** — **FIXED**: `Revenue.tsx` now counts `payment_status IN ('paid','captured','released')` and includes Phase 1+ pipeline states.
- ✅ **`trip_qr_token` UNIQUE missing** — **FIXED**: migration `20260514100000_trip_qr_token_unique.sql` replaces the partial index with a UNIQUE partial index; verified live (rejects duplicates).
- 🟡 **Pronoun bug** in editorial zine: "Rohan, in *her* own words" — still open
- ⚪ **`favorites` 403 for seeded user**: tested live; RLS policy may not match the user_id query pattern. Worth investigating.

## Pre-existing test failures (found during fix verification, NOT regressions)

These 20 failures predate the 2026-05-14 fix pass — verified by stashing all changes and rerunning. Promoted from "tests run cleanly" assumption to "known-flaky"; flag for a dedicated session.

- 🟡 `mobile/lib/booking/__tests__/cta.test.ts` — 20/42 failing. Pattern: `getBookingCta(state, role).variant` expectations don't match current `cta.ts` output (e.g. `'deposits_held' / 'traveler'` expected `'success'` but got `'info'`). Either tests are stale or `cta.ts` regressed; needs reconciliation against the design.

---

## How to use this backlog

- Items marked 🔴 are in the current fix pass (Batch A/B/C). Once those land, re-tag everything else.
- 🟡 items are next-pass candidates — pick 5–10 of these for the next session.
- ⚪ items are tracking; promote to 🟡 when relevant.
- ❓ items need a product decision before they can move.

When fixing, reference the source review doc at `docs/CODE_REVIEW_2026-05-14.md` for full context on each finding.
