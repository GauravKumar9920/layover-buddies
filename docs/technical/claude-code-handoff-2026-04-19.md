# Mumbai Buddies — Claude Code Handoff (2026-04-19)

*Historical snapshot from April 19, 2026 — findings may since be fixed. See [../project/PROJECT-OVERVIEW.md](../project/PROJECT-OVERVIEW.md) for current state.*

**Purpose:** This document is a focused handoff for the changes that landed
in the 2026-04-17 → 2026-04-19 Claude-design session. It tells Claude Code
(a) what is already done and should just be verified, (b) what was fixed
and needs smoke-testing, (c) what was prototyped and now needs production
hardening, and (d) what decisions the user still owes.

**Owner:** Gaurav Sharma
**Continuation of:** `docs/technical/claude-code-handoff.md`

---

## 1. Verified already implemented (no work needed — just confirm)

The user flagged four items as "missing or removed." On inspection they
are all already in the codebase. Claude Code should spot-check these and
close the tickets if they pass.

### 1a. Role selector on signup
- **File:** `mobile/app/(auth)/signup.tsx` (approx. lines 204–236)
- **Behavior:** Two-button toggle with emoji (🧳 Traveler / 🎓 Guide).
  Selected state uses the primary accent border.
- **Note:** The *login* screen (`mobile/app/(auth)/login.tsx`) correctly
  does *not* have a selector — role is resolved from the user profile on
  login. No change needed there.
- **Acceptance:** Fresh install → signup → both role buttons appear and
  toggle correctly → creating a "Guide" account routes to the guide tab
  bar, "Traveler" routes to the traveler tab bar.

### 1b. Arrival / departure time + Day Overview
- **File:** `mobile/app/(traveler)/book/[guideId].tsx`
- **Components:** `TimeInput` (lines ~207–242) + `DayOverview` (~244–329).
- **Math:** `TRANSIT_BUFFER=90min`, `TOUR_BUFFER=30min`. Displays
  `hasEnoughTime` / `isTight` warnings based on the window between
  arrival and departure and the tour duration.
- **Acceptance:** On the booking screen, entering 10:00 arrival and
  18:00 departure for a 4h tour renders a "Your day" section listing
  arrival → transit → tour start → tour end → transit → departure with
  no warning. Tighten the window to a 2h tour and the overview must
  show a yellow "tight" warning.

### 1c. Multi-day calendar date picker
- **File:** `mobile/app/(traveler)/book/[guideId].tsx`
- **Component:** `CalendarPicker` (lines ~56–205) — bottom-sheet `Modal`
  with month navigation, uses `date-fns` (`startOfMonth`, `endOfMonth`,
  `eachDayOfInterval`, `format`, `addMonths`, `parseISO`).
- **State:** `tourStartDate` + `tourEndDate` (lines ~489–490) support
  multi-day tours.
- **Acceptance:** Tapping the date field opens a modal calendar. User
  can tap a start date then an end date; both populate the field in
  `MMM d` → `MMM d, yyyy` format. No typing required.

### 1d. Payments
- **Status:** Deferred per user request. `mobile/lib/api/payments.ts`
  stub exists; Razorpay wiring is out of scope for this handoff.

---

## 2. Fixes landed this session — please smoke-test

### 2a. Tailwind colors remapped to design-system palette
- **File:** `tailwind.config.js` — rewritten.
- **What changed:**
  - Added `primary` (Deep Teal `#0D7377` + full 50–950 scale) and
    `secondary` (Warm Coral `#FF6B6B` + full scale) tokens.
  - Added `cream`, `charcoal`, `gold`, `success`, `warning`, `mumbai`
    tokens matching `design/brand/design-system.md`.
  - **Transitional remap:** existing HTML still uses `orange-*` and
    `pink-*` utility classes from the prior saffron/pink palette. The
    config now aliases `orange` → TEAL scale and `pink` → CORAL scale
    so every existing class renders in the new colors without editing
    200+ class strings.
  - Added `fontFamily` (Plus Jakarta Sans heading / Inter body / DM Sans
    mono) and three `backgroundImage` gradients (`gradient-hero`,
    `gradient-sunset`, `gradient-mumbai`).
- **Follow-up work (nice-to-have, not blocking):** rename all
  `orange-*` → `primary-*` and `pink-*` → `secondary-*` across
  `index.html` and `know-more.html` for readability. The remap means
  this can be done incrementally with no visual change.
- **Acceptance:** `npm run dev` from project root → hero section,
  primary CTAs, and package cards render in teal + coral, not saffron
  + pink. No orange or hot-pink anywhere on the marketing site.

### 2b. Marketing CSS variables & gradients updated
- **File:** `src/style.css`
- `:root` now defines `--teal`, `--coral`, `--cream` (with `--saffron`
  and `--pink` aliased for backward compat).
- Body background gradients updated from `rgba(249,115,22,…)` /
  `rgba(236,72,153,…)` to teal / coral values.
- `hero-video-bg`, `hero-saffron-teal`, `hero-mobile-mesh`, and
  `package-overlay-*` utilities updated.
- **Acceptance:** No orange glow in the hero section. Package card
  overlays are teal/coral tinted.

### 2c. Placeholder URLs replaced in both HTML files
- **Files:** `index.html`, `know-more.html`
- Replacements (used `replace_all` — deterministic):
  - `http://localhost:8081` → `#waitlist`
  - `https://wa.me/910000000000` → `https://wa.me/919999999999`
  - `https://instagram.com` → `https://www.instagram.com/mumbaibuddies`
  - `https://x.com` → `https://x.com/mumbaibuddies`
- **Action for Claude Code:** once Gaurav provides real values, a
  second `replace_all` pass on the same strings swaps them in.
- **Acceptance:** `grep -rn "localhost:8081" index.html know-more.html`
  returns 0 hits. Same for `910000000000` and bare `instagram.com`.

---

## 3. New work landed this session — needs production hardening

### 3a. Package Detail Prototype (NEW SCREEN)
- **File:** `mobile/app/(traveler)/itinerary/[id].tsx`
- **Entry points:**
  - `mobile/app/(traveler)/guide/[id].tsx` — "Book This Tour" button
    renamed to "See the full story" and now routes to
    `/(traveler)/itinerary/[id]`.
  - The itinerary card itself is wrapped in `TouchableOpacity` so the
    whole card is tappable.
- **Structure (top to bottom):**
  1. Parallax hero with 360dp image, tag chip, title, meta row
     (`📍 city · ⏱ Xh · 👣 N stops`).
  2. Tagline + price anchor row.
  3. **Guide mini-strip** — avatar + name + rating, tap routes to the
     guide profile screen.
  4. **"The story"** — mixed story blocks (paragraph / pull-quote /
     highlight card with emoji). Currently fabricated per itinerary
     from the guide's first name + city. See §3b for the schema
     extension that makes this real.
  5. **Video block** — 16:9 thumbnail with a centered play button and
     duration pill. Currently an `Alert.alert` placeholder.
  6. **Photo gallery** — horizontal snap-scroll carousel (288×190
     tiles) with pagination dots. Falls back to a curated Unsplash set
     when stop images are missing.
  7. **Stop-by-stop plan** — numbered timeline rail built from
     `itinerary.stops`. Each stop shows duration, description, and an
     image if present.
  8. **What's included / Not included / Bring along** — three
     bordered cards.
  9. **Airport layover friendly** callout.
  10. **Sticky bottom CTA** — "Book this package" that routes to
      `/(traveler)/book/[guideId]?itineraryId=…`.

- **Palette:** all colors pulled from `theme.colors.*` / `theme.gradients.*`
  so the screen adopts whichever palette wins the drift decision in §4.
- **Acceptance:**
  1. Navigate from `/(traveler)/index` → any guide card → any
     itinerary card. The new screen opens with a smooth parallax
     hero.
  2. Scrolling shifts the hero 50% slower than the content, and the
     title overlay fades as you scroll.
  3. The sticky CTA at the bottom remains visible regardless of
     scroll position.
  4. Tapping it opens `/(traveler)/book/[guideId]` pre-selected with
     the right itinerary.
  5. Loading spinner appears briefly; "Package not found" empty
     state renders for a bogus id.

### 3b. Required schema extension (before story content goes live)
The prototype uses mock story content. To make it production-ready,
extend the `itineraries` table with three columns and expose them
through `normalizeItinerary` in `mobile/lib/api/guides.ts`:

```sql
-- supabase/migrations/20260420_itinerary_story_fields.sql
alter table itineraries
  add column if not exists story_blocks jsonb default '[]',
  add column if not exists gallery_urls text[] default '{}',
  add column if not exists video_url text,
  add column if not exists video_duration_seconds int;
```

**`story_blocks` JSON shape** (mirrors the `StoryBlock` union in the
prototype):
```ts
type StoryBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string; author?: string }
  | { kind: 'highlight'; emoji: string; title: string; body: string };
```

**Code changes needed:**
1. Extend `RawItineraryRow` in `mobile/lib/api/guides.ts` with the
   three new fields.
2. In `normalizeItinerary`, pass `story_blocks`, `gallery_urls`,
   `video_url`, `video_duration_seconds` through to the output.
3. Extend `Itinerary` type in `mobile/types/index.ts` with the same
   four fields (all optional).
4. In `mobile/app/(traveler)/itinerary/[id].tsx`, replace the
   `buildMockStory()` call site so that when real fields are present
   they take precedence over the fabricated fallback. Keep the mock
   path as graceful fallback for legacy rows.

### 3c. New API function — `fetchItineraryById`
The prototype currently does two round-trips (direct `supabase` call
then `fetchGuideItineraries`) because no single-fetch API exists. Add
this to `mobile/lib/api/guides.ts`:

```ts
export async function fetchItineraryById(id: string): Promise<Itinerary | null> {
  const { data, error } = await supabase
    .from('itineraries')
    .select('*, stops:itinerary_stops(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeItinerary(data as RawItineraryRow) : null;
}
```

Then replace the two-step load in `itinerary/[id].tsx`'s `useEffect`
with a single `fetchItineraryById(id)` call.

---

## 4. Decision the user still owes

### Palette drift: `mobile/config/theme.ts` vs. design-system.md

| Token          | `theme.ts` (current)        | `design-system.md`        |
| -------------- | --------------------------- | ------------------------- |
| `primary`      | `#F97316` (Saffron)         | `#0D7377` (Deep Teal)     |
| `accent`       | `#EC4899` (Bougainvillea)   | `#FF6B6B` (Warm Coral)    |
| `background`   | `#FFFAF5` (Warm cream)      | `#F8F5F0` (Off-white)     |
| gradient hero  | Navy deep `#0B1229`         | Teal → Charcoal           |

The mobile app currently renders in saffron/pink (`theme.ts` — labeled
"v2 City of Dreams"). The design system doc, the marketing site, and
`tailwind.config.js` say teal/coral. The booking screen already
hardcodes teal in a `LinearGradient` for the hero — so the app is in a
mixed state today.

**Options:**
- **A. Adopt teal/coral everywhere** (recommended — matches
  design-system.md, matches marketing site, matches what the user
  believed was live). Requires a one-file rewrite of `theme.ts`. All
  downstream screens read from the theme and will update automatically.
- **B. Keep saffron/pink in the mobile app** and update the design
  doc + marketing site to match.
- **C. Ship both palettes** via a `useColorScheme`-style toggle
  (overkill for now).

**Ask the user** which way to go before making any change to
`theme.ts`. Until then, the new package detail screen already uses
`theme.colors.*` tokens, so it will flip automatically once the
decision is made.

---

## 5. Test plan for Claude Code

### Web
```bash
npm run dev
# Verify:
# - hero background is teal, not saffron
# - primary CTAs are teal + coral
# - no orange or hot-pink anywhere
# - footer social links go to real @mumbaibuddies handles
# - no localhost:8081 anywhere (grep to be sure)
```

### iOS
```bash
open -a Simulator
npm --prefix mobile run start:ios
# Flow 1: Signup → verify two role buttons (🧳 Traveler / 🎓 Guide)
# Flow 2: Login as traveler → tap a guide → tap an itinerary card
#   → lands on new /itinerary/[id] screen
#   → scroll: parallax hero, gallery snap-scrolls, sticky CTA stays
#   → tap sticky CTA → booking screen with itinerary pre-selected
# Flow 3: On booking screen
#   → tap date field → calendar modal appears
#   → pick a range → field shows "Apr 21 → Apr 23, 2026"
#   → fill arrival/departure times → Day Overview renders
#   → tighten window → yellow "tight" warning appears
```

### Android
Same Flow 2 + Flow 3 as iOS, but via `start:android` and Android Studio
Device Manager. Confirm parallax and snap-scroll perform smoothly on
the cheaper emulator profile (Pixel 4a, API 33).

### Unit-adjacent checks
- `grep -rn "localhost:8081\|910000000000\|https://instagram.com\|https://x.com" index.html know-more.html` → expect 0 hits.
- `grep -rn "primary-" index.html know-more.html | wc -l` → currently 0; follow-up task will migrate.
- `npm --prefix mobile run typecheck` (if present) → no new errors.

---

## 6. Open follow-up tasks (non-blocking)

1. Rename `orange-*` / `pink-*` utility classes to `primary-*` /
   `secondary-*` across `index.html` + `know-more.html`. The Tailwind
   remap makes this purely cosmetic today — a pure find-and-replace.
2. Source real images / videos for `/public/images/` and
   `/public/videos/` (all paths are already wired in the HTML).
3. Confirm commission rate (25% in code vs. 15% in Task 7 spec —
   carried forward from the previous handoff).
4. Restore native map (`trips/live/[id].native.tsx`) once
   Google Maps API key is provisioned.
5. The user is also running Claude Design for frontend mocks — expect
   a round of visual revisions to land on top of the prototype in §3a.

---

## 7. Files touched this session

| File                                                    | Change                                              |
| ------------------------------------------------------- | --------------------------------------------------- |
| `tailwind.config.js`                                    | Rewrite — teal/coral design system + transitional remap |
| `src/style.css`                                         | CSS vars + gradients teal/coral                     |
| `index.html`                                            | Placeholder URLs replaced                           |
| `know-more.html`                                        | Placeholder URLs replaced                           |
| `mobile/app/(traveler)/itinerary/[id].tsx`              | **NEW** — package detail prototype                  |
| `mobile/app/(traveler)/guide/[id].tsx`                  | Route "Book This Tour" → new detail screen          |
| `docs/technical/claude-code-handoff-2026-04-19.md`      | **THIS DOC**                                        |

---

*End of handoff. Route questions about palette drift (§4) back to
Gaurav before editing `mobile/config/theme.ts`.*
