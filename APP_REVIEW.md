# Detour App Review — Code, Lifecycle & Design

**Date:** 10 June 2026 · **Scope:** `/mobile/` (45 screens/components read or audited), booking state machine, CTA map, APIs, types, theme, both role flows.

First, credit where due: this codebase is far stronger than CLAUDE.md suggests. The 25-state booking machine is a pure, tested reducer with legacy shims; CTAs are centralized per state×role; money is in integer paise with DB-enforced invariants; there are snapshot tests for agreements, cancellation and reconciliation. That's rare discipline for a pre-launch startup. The issues below are mostly *edges* of that machine, not its core.

---

## 1. Bugs & contradictions found in the code (fix before launch)

**1.1 `deposits_held` means two different things in two files.**
`stateMachine.ts` is unambiguous: first deposit self-loops in `awaiting_deposits`, second deposit → `deposits_held` (both held). But `cta.ts` says the opposite in its comment ("reached as soon as the first deposit lands — the other side still owes their ₹500") and gives the buddy a **"Pay ₹500 deposit"** CTA in that state — a button for a payment that's already been made. One of the two models is wrong; if the screen's `canPayDeposit` check saves you, the CTA label still lies. Decide the semantics, fix the other file, and add a test asserting it.

**1.2 Platform/system cancellations are recorded as traveler-voluntary.**
In `trip_ready`, a `cancel` by `platform` or `system` lands in `cancelled_traveler_voluntary`. If your cancellation-receipt math penalizes voluntary traveler cancellations (deposit forfeiture?), a platform-initiated cancellation will charge the traveler for your decision. Add `cancelled_platform` (or route to `cancelled_force_majeure`) and check the same actor-mapping in `awaiting_balance`/`late_fee_due`/`balance_paid`.

**1.3 Stuck states with no exit:**
- `deposits_held` has zero outgoing events by design (webhook writes `awaiting_balance`). If the webhook fails once, the booking is frozen forever with no cancel, no retry, no timer. Add a reconciliation sweep or an admin-only transition.
- `awaiting_proofs` — `PROOFS_DUE_HOURS = 24` exists in constants but there is **no `proofs_overdue` event**. A buddy who never uploads proofs strands the traveler's settlement indefinitely.
- `reconciling` — only exit is `reconciliation_complete`. No failure path, no dispute path from here.
- `disputed` is terminal. A dispute can never be *resolved* — no path back to completed/refunded. Fine for v1 if admin handles it manually, but the admin console has no dispute-resolution action either.
- **No-show:** if the QR is never scanned (traveler misses the meet, buddy doesn't show), `trip_ready` persists forever. You need a `no_show` event at T+2h with its own money outcome — this WILL happen in week one.

**1.4 No dispute window after completion.** `completed → rated` is the only transition. A traveler who disagrees with the receipt (top-up they didn't approve, expense that looks wrong) has no recourse in-app. Even a 48-hour `dispute_raised` window from `completed` would do.

**1.5 Where do the crons live?** The machine depends on `t_minus_72_reached`, `t_minus_12_reached`, `deposit_window_expired`, balance reminders at 84/48/24/18h, rating link at T+3h, proofs due at 24h. I found no Supabase Edge Function / pg_cron in the repo that fires these. If they don't exist yet, the lifecycle literally cannot advance past `awaiting_balance` in production. This is the single biggest missing piece.

**1.6 Push tokens are registered but nothing sends.** Client-side `registerPushToken` is wired into auth, channels are set up, tap-routing exists — but there's no server-side sender for booking events. Until an Edge Function sends "Your buddy signed the agreement," the entire notification investment is dormant.

**1.7 The commission question is still open.** `COMMISSION_RATE = 0.25` with a note "Task 7 says 15% — confirm with Gaurav." That's been unresolved since April. Also note the stack: 25% commission + 12.5% platform-down + 12.5% platform-up + 1% TDS is a hefty take rate — model a sample ₹2,000 trip end-to-end and sanity-check what the buddy actually receives vs. what the traveler pays.

**1.8 Marketing site vs. app pricing contradiction.** The website (FAQ + three sections) promises "completely free — no service fee at all" in early access. The app charges ₹500 deposits both sides, a ₹1,000 late fee, and platform fees in the agreement snapshot. A traveler coming from the site into this flow will feel baited. Either (a) add an `EARLY_ACCESS` flag that zeroes platform fees (keep deposits — they're refundable and behavioral), and say "₹500 refundable deposit" on the site FAQ, or (b) soften the website copy. **(a) is better — deposits are defensible; hidden fees are not.**

---

## 2. Lifecycle map — does everything connect?

**Traveler:** onboard → browse/search/save guides → view guide/itinerary → request booking → `chat_open` chat → review+sign agreement → ₹500 deposit → pay balance (T-72 late fee, T-12 cancel) → `trip_ready` show QR → live trip screen (map) → receipt → rate. **Mapped and routed end-to-end. Real gaps:** no visa checklist anywhere (your #1 real-world blocker — a traveler who can't clear immigration kills the whole funnel; add a T-7d "visa ready?" step/reminder), no flight-number/delay awareness in the trip object despite the marketing promise "we track your flight," no live-location share with family (also promised on the site), and no in-trip SOS (the admin console has an SOS events page, but nothing in the app ever creates an SOS event — I checked; every "SOS" grep hit was `toISOString`).

**Buddy/student:** signup (role=guide) → profile + payout VPA → create itineraries → see requests → chat → draft agreement → sign → deposit → scan QR → in-trip → end trip → upload proofs → payout receipt. **Mapped and routed. Real gaps:** *there is no guide verification flow* — `is_verified` is a bare boolean with no college-ID upload, no selfie check, no admin approval queue (auto-approve per spec). The site promises "strict background verification" and "vetted students of Mumbai's top colleges." Before a journalist or a traveler asks, build at least: college email/ID capture at signup + manual admin toggle. Also missing for the student: earnings dashboard (total earned, pending payouts), availability calendar (nothing stops double-booking the same time window — check if any DB constraint covers overlapping bookings; I didn't find one), and buddy→traveler ratings (reviews are one-directional; guides deserve a record of no-show or difficult travelers).

**Cross-cutting:** chat exists per booking (good), but there's no notification of new messages without the server-side sender (1.6). And nothing closes the loop back to marketing: a completed trip should trigger "share a photo / leave a Google review" — that's the founding-traveler flywheel from the marketing plan.

---

## 3. What to add — prioritized

**P0 (lifecycle can't run without these):** cron/Edge Functions for the timed events · push-sender for state changes · no-show event + money rule · fix 1.1/1.2 · early-access pricing flag to match the site.
**P1 (first 25 trips will hit these):** dispute window post-completion · proofs-overdue path · guide verification capture · visa checklist + reminders · SOS button on the live screen writing to the admin's `sos_events` · earnings tab for guides.
**P2 (growth):** buddy→traveler ratings · availability calendar · flight-status integration (AviationStack free tier) · live-location share link · post-trip shared photo album (feeds Instagram/marketing) · referral codes.

---

## 4. Design review & free-thinking ideas

**State of play:** the v3 "Warm Editorial" port is genuinely good — paper/ink/terracotta tokens 1:1 with the marketing site, real font registration with splash held until loaded, a `design-preview` gallery, haptics, and delights like `BoardingPassReveal`. The app and site finally feel like one brand. CLAUDE.md still documents the old saffron system — update it, it will mislead every future session.

**Polish-level improvements:**
- **Empty states as zine pages.** You have `EmptyState`; give each one a hand-drawn Mumbai doodle + mono caption ("No trips yet · the sea wall is patient"). Cheap, massive personality.
- **Skeletons over spinners** for guide cards and trip lists (you have `Loading` — extend it with shimmer placeholders shaped like cards).
- **Map style:** the default Google map will visually shatter the paper aesthetic on the live screen. Use a custom map style JSON (cream landmass, ink roads, sea-blue water) — 30 minutes, huge coherence win.
- **Accessibility:** ink-mute `#445169` on paper `#F4EDDD` is ~5.5:1 (fine), but `inkSoft #7C8597` on paper is borderline for small text — audit where it's used; bump sizes or darken. Also test dynamic type / font scaling — Bricolage at 800 weight truncates badly when scaled.
- **Status copy system:** states like `reconciling` ("Settling up…") are good; make every waiting state say *what happens next and when* ("Settling up — usually under 3 hours").

**Bigger swings (think-freely list):**
1. **The boarding-pass is your design soul — lean all the way in.** Agreement = ticket; QR screen = gate pass with perforated edge; receipt = stamped stub; cancellations = "VOID" stamp. You already built `BoardingPassReveal`; make it the visual grammar of the whole lifecycle.
2. **Passport stamps.** Every completed detour earns a stamp (route-themed: Postcard, Hyper-local, Old Bombay). Travelers collect them; guides earn "conductor badges" (10 trips, 5-star streak, dawn trip, monsoon trip). Gamification that fits the brand instead of fighting it.
3. **Trip-day Live Activity (iOS) / ongoing notification (Android):** countdown to meet, buddy name + photo, "back at airport by 19:30" — the trip-day anxiety killer, visible from the lock screen.
4. **Offline trip card:** travelers are on airport Wi-Fi and dead SIMs. Cache the full trip (route, buddy contact, agreement, QR) for offline; QR check-in must work with zero connectivity on the traveler side.
5. **Phrasebook + price card in-trip:** five Hindi/Marathi phrases and the ticker prices ("vada pav ₹20") inside the live screen — turns the app into the companion, not just the transaction.
6. **"Meet your buddy" moment:** after matching, a full-screen card — photo, college, favorite corner of Mumbai, voice note ("I'll be in the blue kurta"). The product IS this human moment; currently it's a row in a list.
7. **Night mode as "Mumbai after dark":** ink background, paper text, taxi-yellow accents — not a generic dark mode, a branded one.
8. **Post-trip shared album:** both sides drop 5 photos; app composes a stamped recap card sized for Instagram stories — your UGC engine, built into the lifecycle.

---

## 5. Housekeeping

CLAUDE.md is a release behind reality (says Razorpay/payments deferred, maps broken, old color system, 23 screens — there are 45+ files and a full financial model). Update it; it misleads anyone (including AI sessions) touching the repo. Also `mobile/lib/node_modules/` has a vendored `@expo/ngrok` checked in — looks accidental; it bloats the repo and should likely be gitignored.
