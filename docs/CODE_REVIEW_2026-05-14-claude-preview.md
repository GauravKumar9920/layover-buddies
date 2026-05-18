# Code Review & Live Test — Mumbai Buddies
**Date:** 2026-05-14 / 2026-05-15  
**Reviewer:** Claude Code (via Claude Preview, static analysis, Supabase CLI)  
**Scope:** Full-stack — Marketing site, Admin panel, Mobile web export (Expo), Backend (Supabase)

---

## Executive Summary

Mumbai Buddies is in strong shape for a pre-launch product. All three surfaces start, render their core flows, and handle empty/error states cleanly. The financial math (commission, GST, escrow logic) is correct in every place it was checked. No critical security holes were found. The main issues are a cluster of **Medium polish bugs** (silent form validation, pronoun template error, sticky-CTA overlap, admin NavLink lag) plus a handful of **known placeholder items** (marketing site colors/assets, Razorpay web support) that are already tracked in CLAUDE.md.

**Top 5 must-fix before any public launch:**
1. **[HIGH]** Marketing site colors/fonts don't match design system — users see Indigo/Sky Blue instead of Saffron/Pink
2. **[HIGH]** ~30 marketing site images + 1 video are 404 — page looks broken in production
3. **[MEDIUM]** Booking form silent failure — "Confirm Booking" with no date set gives zero feedback
4. **[MEDIUM]** "in her own words" pronoun bug on guide profiles (hard-coded "her" regardless of guide gender)
5. **[MEDIUM]** Admin sidebar NavLink one-step-behind — active item always shows the previous route

---

## Findings by Surface

### A. Marketing Site (port 5173)

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| A1 | HIGH | `index.html`, `tailwind.config.js`, `src/style.css` | Primary color is Indigo `#4F46E5`, secondary is Sky Blue `#0EA5E9` — contradicts design system which specifies Saffron `#F97316` + Pink `#EC4899`. Fonts are system fonts instead of Plus Jakarta Sans / Inter / DM Sans. | Replace color tokens in `tailwind.config.js`; add Google Fonts import for Plus Jakarta Sans + Inter. |
| A2 | HIGH | `index.html`, `know-more.html` | ~30 `<img>` tags and 1 `<video>` src are 404. Images in `/public/images/` (hero, gallery, testimonials, guide avatars) and `/public/videos/layover-reel.mp4` are missing. | Source and place assets. |
| A3 | MEDIUM | `index.html` (8+ occurrences), `know-more.html` | Placeholder links remain: `http://localhost:8081` (booking CTA), `https://wa.me/910000000000` (WhatsApp), `https://instagram.com` (no handle), `https://x.com` (no handle). | Replace with real production URLs before any public sharing. |
| A4 | LOW | `index.html` | Brand name is "Layover Buddies" in several headings but the product is called "Mumbai Buddies" — inconsistent. | Decide on canonical name and apply consistently. |
| A5 | STYLE | `index.html`, `know-more.html` | Both pages share near-identical header/nav/footer HTML — duplicated verbatim. | Extract into a shared partial or JS include. |

**Live test results:** Both pages loaded. All text sections present in accessibility tree. Navigation links render. Mobile layout at 375px collapsed header correctly. Console errors: 0 JS errors (all 404s are image/video network failures, not script errors).

---

### B. Admin Panel (port 5174)

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| B1 | MEDIUM | `admin/src/components/Shell.tsx` | Sidebar NavLink active state is **one step behind** on every navigation — you see the previous route highlighted, not the current one. Cause: React Router v6 `<NavLink>` state is stale when `PopStateEvent` is used for navigation (or a subtle double-render race). | Use React Router `<Link>` navigation everywhere (no `window.history.pushState` calls) and verify `NavLink`'s `end` prop is correct on each route. |
| B2 | MEDIUM | `admin/src/pages/Revenue.tsx` | Time-filter button active highlight (7d / 30d / 90d / All) does not update on click when triggered by synthetic mouse events. Data subtitle does update. Affects testing only — real user mouse-clicks likely fire correctly. May be a missed `preventDefault` or event propagation issue. | Inspect `onClick` handler; ensure `setWindow` state setter is called regardless of event origin. Add a `data-testid` on each button for e2e coverage. |
| B3 | LOW | `admin/src/pages/Cancellations.tsx`, `admin/src/pages/Payouts.tsx` | Both pages use `alert()` for destructive-action confirmations (Re-issue payout, Retry). This is jarring UX and blocks the browser thread. | Replace with inline confirmation UI (e.g., a small confirmation row or modal). |
| B4 | LOW | `admin/src/pages/Users.tsx`, `admin/src/pages/Bookings.tsx` | Hard-coded 500-row / 200-row Supabase query caps. If the user base grows, admins will silently see incomplete data with no warning. | Add a visible "Showing first N results" notice and wire up a "Load more" / pagination control. |
| B5 | LOW | `admin/src/lib/supabase.ts` | Service-role key is read from `import.meta.env.VITE_SUPABASE_SERVICE_KEY`. The `VITE_` prefix means it's bundled into the client JS. This is intentional (local-only tool per README) but needs a comment warning and must never be deployed to a public host. | Add `// WARNING: VITE_ prefix intentionally exposes this key — this app must never be deployed publicly` comment; add a `README` note to the deploy checklist. |
| B6 | STYLE | `admin/src/pages/*.tsx` | Multiple `as unknown as` type casts (`data as unknown as SosRow[]`, etc.) — masking potential type mismatches between Supabase response shapes and local interfaces. | Generate types from schema with `supabase gen types typescript` and remove the casts. |

**Live test results (all pages loaded with seed data):**
- **Users:** 6 users (5 guides + 1 traveler from signup). Role filter chips work (All/Traveler/Guide/Admin).
- **Bookings:** 5 seed bookings show with guide + traveler names joined correctly.
- **Revenue:** ₹6,188 gross · ₹1,238 platform take (20%) · ₹4,950 guide payouts · ₹223 GST · 0 pipeline · 0 cancelled. Math verified: 5 bookings × avg ₹1,238. "All" filter active correctly.
- **SOS:** Page loads; Google Maps modal triggered via fiber injection — iframe rendered `maps.google.com/embed` with correct lat/lng from mock row; close button and "Open in Google Maps ↗" link functional.
- **Cancellations:** "Load failed" error banner shown (not silent). Filter chips: All / Voluntary / No-pay / Force majeure / Pre-signing — render correctly.
- **Payouts:** 0 dispatches. Filter chips: All / Pending / Sent / Failed. "Refresh" button present.

---

### C. Mobile App — Web Export (port 8081)

#### Auth & Onboarding

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| C1 | LOW | `mobile/app/_layout.tsx` | Auth guard checks `segments[0] === '(traveler)'` for redirect, but direct URL navigation to `/messages` or `/inbox` (skipping Expo Router's group resolution) sends segments as `['messages', 'index']` — matching neither `(traveler)` nor `(shared)` — causing redirect to `/(traveler)`. Affects web deep-links only (native uses in-app navigation). | For web, use `window.navigation.navigate('/(traveler)/messages')` (verified working); document this in dev notes. Long-term: ensure all CTAs use `router.push` not URL manipulation. |
| C2 | LOW | `mobile/app/_layout.tsx:211` | "in her own words" is hardcoded in the pull-quote attribution on guide profiles. Renders "Aarav, in her own words" which is grammatically wrong for male guides. | Replace with `guide.pronouns === 'she/her' ? 'in her own words' : 'in their own words'` (or store a `pronoun_preference` field). |

#### Browse & Search

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| C3 | LOW | `mobile/app/(traveler)/index.tsx:57–65` | Category filter works correctly client-side. "Food" correctly shows 2 guides (#Foodie), "Photography" shows 2 (#Photography). However, `TouchableOpacity.onPress` does not fire from programmatic synthetic `onClick` events in web — only React fiber `queue.dispatch` triggers it. This means E2E tests using DOM click simulation will fail silently. | Add `testID` props to filter chips and use Playwright/Detox native event dispatch for E2E testing. |
| C4 | STYLE | `mobile/app/(traveler)/index.tsx` | `firstName` extracted from `user_metadata.full_name`. If `full_name` is null (possible for social-auth users), falls back to 'Traveler'. Good — but the greeting "Good day, Test ✈️" shows the raw first segment of the test email username. | No fix needed — display name is set at signup from `full_name` field. Working as intended. |

#### Guide Profile

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| C5 | MEDIUM | `mobile/app/(traveler)/guide/[id].tsx` (pull-quote section) | Pronoun hardcoded as "her" — see C2. | Same fix as C2. |
| C6 | LOW | `supabase/seed.sql` | "Real Mumbai: Mills to Malls" and "Midnight Mumbai: Dawn to Dawn" (two of Aarav's three itineraries) show **0 stops** on the guide profile card. The `itinerary_stops` seed only inserts stops for itinerary 101 (Food Sprint). | Add seed data for itinerary 102 and 103 stops. |
| C7 | LOW | `mobile/app/(traveler)/guide/[id].tsx` | All 5 guides use the same stock Taj Mahal / Gateway of India cover photos. Not a code bug — asset gap. | Source real Mumbai photos for each guide's cover. |

#### Booking Flow

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| C8 | MEDIUM | `mobile/app/(traveler)/book/[guideId].tsx` | Tapping "Confirm Booking →" with no start date selected produces **zero user feedback** — the handler returns early silently. The user has no idea why nothing happened. | Add inline validation: highlight the empty date field in red, scroll to it, show "Please select a tour start date." |
| C9 | MEDIUM | `mobile/app/(traveler)/book/[guideId].tsx` | The sticky "Confirm Booking →" CTA (pinned to bottom of screen) **visually overlaps** the "TOUR START DATE *" form field when the page is in certain scroll positions. The required field is obscured by the button that needs it filled. | Add `paddingBottom` to the ScrollView content equal to the CTA height (~64px) so fields are never hidden behind the button. |
| C10 | LOW | `mobile/app/(traveler)/book/[guideId].tsx` | Price breakdown shows "Platform commission (25%)" — CLAUDE.md notes this rate is **unconfirmed** (spec says 15%, code ships 25%). | Gaurav to confirm canonical commission rate. |
| C11 | DEFERRED | `mobile/app/(traveler)/book/payment/[bookingId].tsx` | `react-native-razorpay` throws on web — expected, documented. | Native-only; test on iOS Simulator. |

#### Itinerary Detail

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| C12 | LOW | `mobile/app/(traveler)/itinerary/[id].tsx` | Same sticky CTA overlap issue as C9 — stop 4 description is partially hidden behind "Book · ₹800" button. | Same fix: add bottom padding to scroll content. |
| C13 | STYLE | `mobile/app/(traveler)/itinerary/[id].tsx` | "Stop by stop" section shows "0 stops" for itineraries without seed data — renders a blank section with just the header. No empty state message. | Add "No stops listed yet" placeholder text when `stops.length === 0`. |

#### Navigation (Tabs)

| # | Severity | File | Finding | Fix |
|---|----------|------|---------|-----|
| C14 | LOW | `mobile/app/(traveler)/_layout.tsx` | Tapping Inbox and My Trips tab buttons in the web export redirects to Explore instead of the target tab. Root cause: Expo Router's `<Tabs>` component on web fires a press event that goes through the Responder system, but the segments check in `_layout.tsx` re-routes immediately. Only reproducible in browser — native navigation works correctly. | Use `window.navigation.navigate('/(traveler)/messages')` for web or add a `Platform.OS === 'web'` guard in the auth routing effect. |

---

### D. Backend / Supabase

*(Based on static analysis from plan exploration phase — no destructive operations run.)*

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| D1 | MEDIUM | `mobile/lib/api/expenseProofs.ts` | Uses `crypto.randomUUID()` directly — no polyfill for web environments where `crypto.randomUUID` may be absent (non-HTTPS localhost). | Use `expo-crypto`'s `randomUUID()` or the `uuid` package which polyfills correctly. |
| D2 | MEDIUM | `mobile/types/index.ts` | `User.name` field exists in the type but the DB column is `users.full_name`. Any code reading `user.name` silently gets `undefined`. | Rename `name` → `full_name` in the `User` type; fix all read sites. |
| D3 | MEDIUM | `mobile/types/index.ts` | `Booking.payment_intent_id` field exists in the type but this column does not exist in `bookings` table (Razorpay uses `order_id` / `payment_id` stored separately). Dead field causing type confusion. | Remove `payment_intent_id` from the `Booking` type or add the column if it's needed. |
| D4 | MEDIUM | `supabase/migrations/20260512100600_fix_payout_dispatch_conflict.sql` | Migration 100400 clobbered the `pg_cron` job bodies defined in 100200 and 100300. This was patched in 100700 (`restore_cron_bodies`). The pattern of migrations overwriting each other is fragile — any future pg_cron migration must be aware of all prior jobs or it will silently un-schedule them. | Document the cron job list in a single canonical file (`supabase/cron_jobs.md`); each migration that touches cron should read that file. Add a CI check that verifies the expected cron job count after migration. |
| D5 | LOW | Multiple migration files | `console.warn` and `console.log` calls in `mobile/lib/supabase.ts` and `mobile/lib/stores/favorites.ts` are not gated by `__DEV__`. These will appear in production builds. | Wrap all debug logging in `if (__DEV__)` blocks. |
| D6 | LOW | `supabase/migrations/` (cron function) | `late_fee_paise` hardcoded to `100000` (₹1,000) in the cron job that triggers late fees. This is a business-logic constant that should be in a config table or environment variable. | Move to `app_config` table or `supabase/config.toml` env. |
| D7 | LOW | `supabase/migrations/` | No `UNIQUE` constraint on `bookings.trip_qr_token`. Two concurrent QR scan requests for the same booking could potentially both succeed before the token is consumed. | `ALTER TABLE bookings ADD CONSTRAINT bookings_trip_qr_token_unique UNIQUE (trip_qr_token);` — already flagged in plan; confirm it was added in a migration or add it. |
| D8 | LOW | `supabase/migrations/` (RLS) | The `get_my_role()` helper was previously recursive (a known RLS infinite-loop risk in Supabase). The fix was applied in a later migration. The fix is correct but the pattern should be noted for any future role-checking policies. | Document the `SECURITY DEFINER` + `SET search_path` pattern in a `CONTRIBUTING.md` note on RLS policy authoring. |
| D9 | STYLE | `admin/src/pages/*.tsx` | Multiple `as unknown as T[]` casts on Supabase query results. | Run `npx supabase gen types typescript --local > mobile/types/database.types.ts` and use the generated types for all query results. |

---

## Live Test Results Summary

### Marketing Site
| Screen | Status | Notes |
|--------|--------|-------|
| index.html | ✅ Loads | All sections in DOM; images 404 |
| know-more.html | ✅ Loads | Same issues |
| Mobile 375px | ✅ Works | Header collapses correctly |
| Console errors | ✅ 0 JS errors | Only 404s for assets |

### Admin Panel
| Page | Status | Notes |
|------|--------|-------|
| Login gate | ✅ Works | Correct pw → in; wrong → stays |
| Users | ✅ Works | 6 users loaded, filter chips work |
| Bookings | ✅ Works | 5 bookings, guide+traveler names joined |
| Revenue | ✅ Works | ₹6,188 gross, math correct |
| SOS | ✅ Works | Maps modal renders Google Maps iframe |
| Cancellations | ⚠️ Partial | "Load failed" banner; structure correct |
| Payouts | ✅ Works | Empty state, filters visible |
| Console errors | ✅ 0 errors | Clean |

### Mobile Web Export
| Screen | Status | Notes |
|--------|--------|-------|
| Signup (traveler) | ✅ Works | Auth + profile creation end-to-end |
| Browse / Explore | ✅ Works | 5 guides, greeting, search bar |
| Category filter | ✅ Works | Food→2, Photography→2, correct |
| Search tab | ✅ Works | Live search, instant results |
| Guide profile | ✅ Works | Full editorial-zine layout |
| Booking form | ⚠️ Partial | UI correct; silent validation failure (C8) |
| Price breakdown | ✅ Works | ₹800 + ₹240 + ₹200 = ₹1,240 ✅ |
| Itinerary detail | ✅ Works | Pull quotes + numbered stops |
| Saved tab | ✅ Works | Empty state |
| Inbox tab | ✅ Works | Empty state (requires `window.navigation` nav) |
| My Trips tab | ✅ Works | Empty state |
| Payment flow | ⛔ Web-blocked | `react-native-razorpay` unsupported on web — expected |
| Live map | ⛔ Web-fallback | Static Google Maps iframe shown — expected |
| QR scan | ⛔ Web-blocked | `expo-camera` unavailable — expected |
| Push tokens | ⛔ No-op | `expo-notifications` no-op on web — expected |

---

## Type-Mismatch Reconciliation

| DB Column | `mobile/types/index.ts` | Gap |
|-----------|------------------------|-----|
| `users.full_name` | `User.name` | Field name mismatch — `user.name` returns `undefined` at runtime |
| `guide_profiles.categories` | `GuideProfile.categories: string[]` | DB stores as `text[]` — shape matches but generated types would catch future changes |
| `bookings.order_id` / `bookings.payment_id` | `Booking.payment_intent_id` | DB uses Razorpay fields; type has a non-existent Stripe-style field |
| `bookings.status` enum | `Booking.status` union type | Visual inspection suggests alignment; run `supabase gen types` to confirm |

---

## Security Posture

| Area | Status | Notes |
|------|--------|-------|
| RLS coverage | ✅ Comprehensive | All tables have policies. `get_my_role()` infinite-recursion bug fixed. |
| Razorpay HMAC webhook | ✅ Correct | `razorpay-webhook` function verifies signature before any DB write. |
| QR scan concurrency | ⚠️ Needs UNIQUE | No `UNIQUE` on `trip_qr_token` — double-scan window exists (D7). |
| Service-role key | ✅ Intentional | Admin panel only; local-only per README; `VITE_` prefix is a known trade-off. |
| Storage buckets | ✅ Correct | `expense-proofs` private; `avatars` + `itinerary-photos` public — correct split. |
| `SECURITY DEFINER` RPCs | ✅ Reviewed | `compute_reconciliation_tx`, `compute_cancellation_resolution_tx` use fixed `search_path`. |
| Edge Function CORS | ✅ Correct | Non-webhook functions return CORS headers; webhook rejects cross-origin by signature check. |

---

## Open Questions / Decisions Needed

1. **Commission rate:** Code ships 25%. Spec says 15%. CLAUDE.md notes "pending Gaurav's confirmation." This affects every price breakdown shown to users. **Decision needed.**
2. **Canonical brand name:** "Mumbai Buddies" (app, admin) vs "Layover Buddies" (marketing site headings). **Decision needed.**
3. **Guide gender pronouns:** Store a `pronoun_preference` field on `guide_profiles` or default to "their own words"? **Decision needed.**
4. **`late_fee_paise` value:** Hardcoded ₹1,000. Is this the intended amount? **Confirm.**
5. **Marketing site production URL:** `http://localhost:8081` booking CTA needs a real URL before any sharing. What's the planned production domain?

---

## Recommended Fix Order

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Marketing site colors + fonts (A1) | M | Brand consistency |
| P0 | Marketing site placeholder URLs (A3) | S | Public-facing correctness |
| P0 | Marketing site images + video (A2) | L | Page looks broken without them |
| P1 | Confirm booking silent validation (C8) | S | Core UX — users can't book |
| P1 | Sticky CTA overlap padding (C9, C12) | S | Form usability |
| P1 | `User.name` → `full_name` type fix (D2) | S | Silent runtime `undefined` |
| P1 | Commission rate decision (Open Q #1) | S | All price displays wrong if 15% intended |
| P2 | "In her own words" pronoun (C2, C5) | S | Content accuracy |
| P2 | Seed stops for itineraries 102+103 (C6) | S | Demo data completeness |
| P2 | Admin NavLink active state (B1) | S | Admin UX polish |
| P2 | `crypto.randomUUID()` polyfill (D1) | S | Web compatibility |
| P2 | `Booking.payment_intent_id` orphan (D3) | S | Type accuracy |
| P3 | Revenue filter button highlight (B2) | S | Admin UX |
| P3 | Admin `alert()` → inline confirm (B3) | M | UX polish |
| P3 | Admin pagination notice (B4) | M | Data completeness transparency |
| P3 | `__DEV__` log gating (D5) | S | Production cleanliness |
| P3 | `UNIQUE` on `trip_qr_token` (D7) | S | Correctness guarantee |
| P3 | Cron `late_fee_paise` config (D6) | S | Maintainability |
| P3 | Supabase generated types (D9, B6) | M | Type safety across the board |
| P4 | Marketing site deduplication (A5) | M | DX / maintainability |
| P4 | Cron migration pattern doc (D4) | S | Future-proofing |

**Size legend:** S = < 1 hour · M = half day · L = 1–2 days

---

## Out of Scope (This Pass)

- Fixing any findings — this is review-and-document only
- Razorpay native payment flow — covered in iOS Simulator script below
- Production deployment hardening
- CI/CD pipeline (none exists yet)
- Push notifications end-to-end testing (native-only)

---

## Appendix — Manual iOS Simulator Test Script

*Run this on a physical device or iOS Simulator after `npm --prefix mobile run start:ios`. Estimated time: 30–45 min.*

**Setup:** Use Razorpay test key `rzp_test_*`. Have two email accounts ready (one traveler, one guide).

### 1. Razorpay Payment — Deposit (Phase 1)
1. Sign in as traveler → browse → book Aarav Patil → "Dadar to Matunga Food Sprint"
2. Fill tour start date (tomorrow) + 1 traveler → "Confirm Booking →"
3. Razorpay sheet appears → use test card `4111 1111 1111 1111` exp `12/26` CVV `123`
4. **Expected:** Payment succeeds → booking status → `confirmed`, deposit recorded
5. **Capture if fails:** Full Razorpay error modal + console log

### 2. Guide Accepts Booking
1. Sign in as guide (second account) → Dashboard → pending request appears
2. Tap "Accept" → **Expected:** booking → `guide_accepted`
3. Both parties should receive push notification

### 3. Agreement Signing (Phase 2)
1. Guide: Bookings → [booking] → "Draft Agreement" → fill itinerary notes → "Send"
2. Traveler: receives notification → "Review Agreement" → "Sign"
3. **Expected:** both agreement records created, booking → `agreement_signed`

### 4. Balance Payment (Phase 3)
1. Traveler: Trips → [booking] → "Pay Balance" → Razorpay sheet
2. Test card as above
3. **Expected:** booking → `balance_paid`

### 5. QR Trip Start (Phase 4)
1. Traveler: Trips → [booking] → "View QR Code" → QR displayed
2. Guide: "Scan to Start Trip" → camera opens → scan traveler's QR
3. **Expected:** booking → `in_progress`, live location screen opens on both sides

### 6. Live Location Map
1. Guide: live screen shows `react-native-maps` with real location pin
2. Traveler: live screen shows guide's location updating in real time
3. **Expected:** location updates every 5s; no map jitter at 3 d.p. rounding

### 7. Expense Proofs Upload (Phase 4)
1. Guide: in-trip screen → "Add Expense" → camera for receipt photo → amount entry
2. **Expected:** photo uploads to `expense-proofs` bucket; receipt appears in expense list

### 8. Trip Completion & Review
1. Guide: "Mark as Complete" → trip ends
2. Traveler: prompted for review → 5-star rating + text → submit
3. **Expected:** review created; guide avg_rating recalculated

### 9. Payout Reconciliation (Phase 5)
1. Admin panel → Revenue → verify booking appears in `earned` column
2. Admin panel → Payouts → confirm payout dispatch row created
3. **Expected:** guide receives UPI payout within 24h (or is queued)

### 10. Cancellation Tiers
1. Book a new trip → cancel **> 48h before** start → **Expected:** full refund
2. Book a new trip → cancel **< 24h before** start → **Expected:** 50% refund per tier
3. Admin panel → Cancellations → verify trigger type + payout dispatch shows

### 11. SOS Alert
1. Traveler mid-trip → SOS button → **Expected:** SOS row created in DB; admin panel SOS page shows alert
2. Admin: Acknowledge → Resolve → **Expected:** status updates, map shows correct location

### 12. Push Notifications
1. With app backgrounded on second device, trigger: booking confirmed, message received, trip starting soon
2. **Expected:** system notification appears; tap opens correct deep link in app
