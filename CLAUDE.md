# Mumbai Buddies — Claude Context

## What This Project Is
A two-sided marketplace connecting international airport layover travelers with Mumbai student guides.
- **Marketing website**: Vite + Tailwind (root `index.html`, `know-more.html`)
- **Mobile app**: React Native + Expo 52, file-based routing via Expo Router (`/mobile/`)
- **Backend**: Supabase (auth + database + storage)
- **Design system**: `/design/brand/design-system.md` and `/design/brand/design-handoff-spec.md`

---

## How To Run The App

### iOS Simulator
```bash
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start
# then press `i` in the Expo terminal
# OR one-command:
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start:ios
```
Open iOS Simulator first from Xcode, or run: `open -a Simulator`

### Android Emulator
```bash
# First add SDK paths to shell:
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH

npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start
# then press `a` in the Expo terminal
# OR one-command:
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start:android
```
Start an emulator from Android Studio → Device Manager first.

---

## Immediate TODOs (Priority Order)

### 1. ✅ Fix API 400 Errors — Schema/Query Mismatch (DONE)
All queries in `mobile/lib/api/` are aligned to the schema. `is_published` used correctly.

### 2. ✅ Seed Mumbai Demo Data (DONE)
`supabase/seed.sql` has 5 guides, 15 itineraries, 6 bookings, 5 reviews, 6 messages.

### 3. ✅ End-to-End Smoke Test (DONE 2026-04-14)
See `SMOKE_TEST_RESULTS.md`. Five bugs found and fixed:
- **Fixed:** Missing `bookings` UPDATE RLS policy (guides/travelers can now update)
- **Fixed:** Missing `itinerary_stops` public read policy (travelers see stops)
- **Fixed:** `payment_status` enum extended for Razorpay lifecycle values
- **Fixed:** Guide names now resolved from `users.full_name` via JOIN
- **Fixed:** `review.rating` mapped from `overall_rating` DB column
Migration: `supabase/migrations/20260414_rls_fixes.sql`

### 3b. ✅ Task 7 — Business Logic Constants (DONE 2026-04-14)
Added to `mobile/config/constants.ts`: `ESTIMATED_EXPENSES_PERCENT=30`, `MIN_BOOKING_NOTICE_HOURS=4`, `MAX_BOOKING_ADVANCE_DAYS=90`, `CURRENCY='INR'`, `CURRENCY_SYMBOL='₹'`.
**NOTE:** `COMMISSION_RATE` stays at 25% pending Gaurav's confirmation (Task 7 spec says 15%).

### 3c. ✅ Task 1 — Booking Flow UI (DONE 2026-04-14)
Rewrote `mobile/app/(traveler)/book/[guideId].tsx` to match spec:
- Guide hero header (avatar, name, rating, teal→charcoal gradient)
- Horizontal FlatList of 288dp × 16:9 itinerary cards with selected state
- Arrival date + departure date + flight number + traveler count inputs
- Price breakdown: buddy fee + estimated expenses (30%) + platform fee (25%) + total
- Coral confirm button (h-56, rounded-16) with spring animation + haptics
- Skeleton loading while guide data fetches
- Inline error display; navigates to `/(traveler)/trips/[id]` on success

### 4. Restore Native Map Experience
- `mobile/app/(traveler)/trips/live/[id].tsx` has a `.native.tsx` variant for maps
- Ensure `react-native-maps` is properly configured for iOS (needs Google Maps API key in `app.json`)
- Keep web fallback working

### 5. Cosmetic Alignment — Marketing Site ↔ Design System
The website uses different colors than the app's design system. Needs alignment:

| Element | Website (current) | Design System (correct) |
|---|---|---|
| Primary color | Indigo `#4F46E5` | Deep Teal `#0D7377` |
| Secondary | Sky Blue `#0EA5E9` | Warm Coral `#FF6B6B` |
| Fonts | System fonts | Plus Jakarta Sans, Inter, DM Sans |

**Files to update:** `index.html`, `know-more.html`, `src/style.css`, `tailwind.config.js`

### 6. Fix Placeholder Values in Marketing Site
Replace across `index.html` AND `know-more.html`:
- `http://localhost:8081` → production booking URL (appears 8+ times)
- `https://wa.me/910000000000` → real WhatsApp business number
- `https://instagram.com` → real Instagram handle
- `https://x.com` → real X/Twitter handle

### 7. Add Missing Image & Video Assets
All images return 404. Need to source and place:
- ~30 images in `/public/images/` (hero, gallery, testimonials, guide avatars)
- 1 video in `/public/videos/layover-reel.mp4`
Reference `index.html` for all image paths needed.

### 8. Deferred (Do Later)
- Razorpay payment integration (`mobile/lib/api/payments.ts` stub exists)
- Google Maps API key wiring
- Push notifications setup
- CI/CD pipeline

---

## Project Structure
```
mumbai-buddies/
├── index.html                  # Marketing landing page
├── know-more.html              # Deep-dive info page
├── src/style.css               # Custom CSS + Tailwind directives
├── tailwind.config.js          # Tailwind config
├── vite.config.js              # Vite build config
├── mobile/                     # React Native + Expo app
│   ├── app/                    # Expo Router screens (23 screens)
│   │   ├── _layout.tsx         # Root auth routing logic
│   │   ├── (auth)/             # Login, signup, forgot-password
│   │   ├── (traveler)/         # Browse, search, book, trips, live map
│   │   ├── (guide)/            # Dashboard, requests, profile, itineraries
│   │   └── (shared)/           # Messages
│   ├── components/ui/          # Button, Card, Badge, Input, Loading, etc.
│   ├── components/guides/      # GuideCard
│   ├── components/bookings/    # BookingCard
│   ├── lib/api/                # guides.ts, bookings.ts, payments.ts, etc.
│   ├── lib/hooks/              # useAuth.ts, useMessages.ts
│   ├── config/theme.ts         # Design tokens (colors, spacing, shadows)
│   ├── config/constants.ts     # Business rules
│   ├── types/index.ts          # All TypeScript models
│   └── .env.local.example      # Required env vars
├── design/
│   ├── brand/design-system.md       # Color palette, typography, animation specs
│   ├── brand/design-handoff-spec.md # Component specs with copy-paste code
│   └── ui-mockups/                  # HTML prototypes (reference only)
└── CLAUDE.md                   # This file
```

---

## Design System Quick Reference

**Colors:**
- Primary: Deep Teal `#0D7377` / Dark `#095456`
- Secondary: Warm Coral `#FF6B6B` / Dark `#E55555`
- Background: Off-White `#F8F5F0`
- Text: Dark Charcoal `#1A1A2E`
- Gold (ratings): `#F5A623`
- Success: `#27AE60`
- Mumbai Purple (premium): `#6C5CE7`

**Fonts:**
- Headings: Plus Jakarta Sans
- Body: Inter
- Numbers/Prices: DM Sans

**Animation pattern (spring):**
- Button press: `scale(0.96)`, spring `damping: 15, stiffness: 150`
- Card tap: `scale(0.97)`, `translateY(-2px)` on press

**Key theme file:** `mobile/config/theme.ts`

---

## Environment Variables Needed
See `mobile/.env.local.example`. Create `mobile/.env.local` with:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_RAZORPAY_KEY_ID=       # deferred
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=   # deferred
```

---

## Tech Stack Summary
- **Web:** Vite 5, Tailwind CSS 3, Vanilla JS
- **Mobile:** React Native 0.76, Expo 52, Expo Router 4, TypeScript 5.3
- **Styling:** NativeWind 4 (Tailwind for RN)
- **Animations:** React Native Reanimated 3
- **State:** Zustand 4
- **Backend:** Supabase JS v2
- **Payments:** Razorpay (deferred)
- **Maps:** react-native-maps 1.18, expo-location
