# Mumbai Buddies — Developer Runbook

> Last updated: 2026-04-26  
> Everything in this file reflects the actual working state of the repo.

---

## Table of Contents

1. [What's Built](#whats-built)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Launching the Backend (Supabase)](#launching-the-backend-supabase)
5. [Launching the Marketing Website](#launching-the-marketing-website)
6. [Launching the Mobile App](#launching-the-mobile-app)
   - [iOS Simulator](#ios-simulator)
   - [Android Emulator](#android-emulator)
   - [Web Browser](#web-browser)
7. [Launching the Admin Panel](#launching-the-admin-panel)
8. [Test Accounts](#test-accounts)
9. [Screen Map](#screen-map)
10. [What's Not Yet Built](#whats-not-yet-built)
11. [Business Rules](#business-rules)

---

## What's Built

| Surface | Status | URL / Port |
|---|---|---|
| Marketing website | ✅ Working | `http://localhost:5173` |
| Mobile app (iOS Simulator) | ✅ Working | Expo Go on simulator |
| Mobile app (Android Emulator) | ✅ Working | Expo Go on emulator |
| Mobile app (Web) | ✅ Working | `http://localhost:8081` |
| Admin panel | ✅ Working | `http://localhost:5174` |
| Local Supabase backend | ✅ Working | `http://localhost:54321` |
| Auth (email + password) | ✅ Working | Shared login for guides & travelers |
| Role-based routing | ✅ Working | Guides → guide area, travelers → traveler area |
| Guide browsing + profiles | ✅ Working | Magazine-style layout with reviews |
| Itinerary detail | ✅ Working | Stops, guide quote, booking CTA |
| Booking flow | ✅ Working | Itinerary selection, dates, traveler count, price breakdown |
| Trips list | ✅ Working | Traveler's booked trips |
| Guide dashboard | ✅ Working | Incoming requests, accept / decline |
| Messaging | ✅ Working | Per-booking chat thread |
| Saved / Favorites | ✅ Working | Heart guides, persisted per user |
| Admin: Users table | ✅ Working | View all users, role, join date |
| Admin: Bookings table | ✅ Working | All bookings with status badges |
| Admin: Revenue dashboard | ✅ Working | Total revenue, 7d / 30d / all-time toggle |
| Admin: SOS alerts | ✅ Working | Acknowledge + resolve safety flags |
| Seed data | ✅ Present | 7 guides, 15 itineraries, 6 bookings, 5 reviews |

---

## Prerequisites

Install these once:

```bash
# Node.js 18+ (check with: node -v)
# npm 9+ (check with: npm -v)

# Expo CLI
npm install -g expo-cli

# Supabase CLI (for local backend)
brew install supabase/tap/supabase   # macOS
# or: npm install -g supabase

# Docker Desktop (required for local Supabase)
# https://www.docker.com/products/docker-desktop/
```

For iOS:
- Xcode (from App Store) + iOS Simulator
- Expo Go app on the simulator (auto-installs on first `expo start --ios`)

For Android:
- Android Studio + Android SDK
- An emulator created in Android Studio → Device Manager

---

## Environment Setup

### Mobile App (`mobile/.env.local`)

Copy the example and fill in values:

```bash
cp mobile/.env.local.example mobile/.env.local
```

For **local development** use these values:

```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from `npx supabase status`>

# Leave blank for now (deferred):
EXPO_PUBLIC_RAZORPAY_KEY_ID=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

> ⚠️ Use `127.0.0.1` not a LAN IP — the LAN IP is unreachable from the simulator on newer macOS.

### Admin Panel (`admin/.env.local`)

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_SERVICE_KEY=<service_role key from `npx supabase status`>
VITE_ADMIN_PASSWORD=test-admin-123
```

---

## Launching the Backend (Supabase)

The mobile app and admin panel both need Supabase running locally.

```bash
# Make sure Docker Desktop is running first, then:
cd /Users/gaurav/Desktop/mumbai-buddies
npx supabase start
```

First run takes ~2 minutes to pull Docker images. Subsequent runs are fast.

Once running, get your keys:

```bash
npx supabase status
```

Output will show:
```
API URL: http://127.0.0.1:54321
anon key: sb_publishable_...
service_role key: sb_secret_...
Studio URL: http://127.0.0.1:54323   ← database browser UI
```

Paste the `anon key` into `mobile/.env.local` and the `service_role key` into `admin/.env.local`.

**To stop Supabase:**
```bash
npx supabase stop
```

---

## Launching the Marketing Website

The marketing site is a Vite + Tailwind static site at the repo root.

```bash
cd /Users/gaurav/Desktop/mumbai-buddies
npm install        # first time only
npm run dev
```

Open: **http://localhost:5173**

Pages:
- `/` → `index.html` — Main landing page
- `/know-more.html` → Deep-dive info page

**Build for production:**
```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

> 📝 **Known issues:** The site still uses placeholder URLs (`localhost:8081`, `wa.me/910000000000`) and missing images in `/public/images/`. See CLAUDE.md §5–7 for the full list.

---

## Launching the Mobile App

The app is React Native + Expo 52 with Expo Router 4 for file-based navigation.

```bash
cd /Users/gaurav/Desktop/mumbai-buddies/mobile
npm install        # first time only
```

### iOS Simulator

1. Open Xcode and start a simulator:
   ```bash
   open -a Simulator
   ```
   (Or launch from Xcode → Window → Devices and Simulators)

2. Start the app:
   ```bash
   npm run start:ios
   # equivalent to: expo start --ios
   ```

3. The app will bundle (~6s) and launch in the simulator automatically.

**One-liner from the repo root:**
```bash
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start:ios
```

---

### Android Emulator

1. Set up Android SDK paths (add to `~/.zshrc` or `~/.bashrc`):
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
   ```

2. Start an emulator from Android Studio → Device Manager (or via CLI):
   ```bash
   # List available emulators:
   emulator -list-avds
   # Start one:
   emulator -avd <avd_name>
   ```

3. Start the app:
   ```bash
   cd mobile
   npm run start:android
   # equivalent to: expo start --android
   ```

**One-liner from the repo root:**
```bash
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start:android
```

---

### Web Browser

Runs the app as a web app — useful for fast iteration and preview tools.

```bash
cd mobile
npm run start:web
# equivalent to: expo start --web
```

Open: **http://localhost:8081**

The viewport defaults to desktop. For an iPhone-sized view, resize your browser to 390×844 or use Chrome DevTools device emulation.

**One-liner from the repo root:**
```bash
npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start:web
```

---

## Launching the Admin Panel

The admin panel is a separate Vite + React app in `/admin/`. It uses the **Supabase service role key** (full DB access, no RLS), so it must **never** be deployed publicly.

```bash
cd /Users/gaurav/Desktop/mumbai-buddies/admin
npm install        # first time only
npm run dev
```

Open: **http://localhost:5174**

You'll be prompted for the admin password. Default for local dev: `test-admin-123` (set in `admin/.env.local`).

**One-liner from the repo root:**
```bash
npm run dev --prefix /Users/gaurav/Desktop/mumbai-buddies/admin
```

**Admin pages:**
| Page | Path | What it shows |
|---|---|---|
| Users | `/users` | All users, role, signup date, active status |
| Bookings | `/bookings` | All bookings with status badges and amounts |
| Revenue | `/revenue` | Total revenue, 7d / 30d / all-time breakdown |
| SOS Alerts | `/sos` | Safety flag queue — acknowledge and resolve |

---

## Test Accounts

All accounts are created automatically by `supabase db reset`. Every account uses password **`Test1234!`**.

### Travelers

| Email | Password | Character |
|---|---|---|
| `emma.wilson@gmail.com` | `Test1234!` | US traveler — has 2 completed tours with Aarav |
| `james.tanaka@outlook.com` | `Test1234!` | Japanese traveler — completed Bandra walk with Rohan |
| `sofia.mueller@proton.me` | `Test1234!` | German traveler — has a pending heritage tour with Priya |

### Guides

| Email | Password | Profile |
|---|---|---|
| `rohan.dsouza@xaviers.edu` | `Test1234!` | St. Xavier's · 4.9★ · culture & nightlife |
| `aarav.patil@vjti.ac.in` | `Test1234!` | VJTI · 4.8★ · food & history |
| `priya.sharma@iitb.ac.in` | `Test1234!` | IIT Bombay · 4.6★ · architecture & photography |
| `sneha.mehta@nmims.edu` | `Test1234!` | NMIMS · 4.5★ · business & photography |
| `kabir.joshi@mithibai.ac.in` | `Test1234!` | Mithibai · new (0 reviews) · hidden gems |

### Re-seeding after a db reset

`supabase db reset` wipes all auth users and public data, then re-applies migrations and re-runs `seed.sql` — so all accounts above are recreated automatically with the right UUIDs and passwords. Just reset and log straight in:

```bash
cd /Users/gaurav/Desktop/mumbai-buddies
npx supabase db reset
```

### If accounts still don't work after reset

The seed inserts into `auth.users` directly via SQL. If something went wrong you can re-create any account via the admin API (get your `service_role_key` from `npx supabase status`):

```bash
# Replace SERVICE_ROLE_KEY and adjust email/uuid as needed
SERVICE_ROLE_KEY="<paste key here>"

# Example: recreate Emma (traveler)
curl -s -X POST http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id":             "aaaaaaaa-0000-4000-a000-000000000011",
    "email":          "emma.wilson@gmail.com",
    "password":       "Test1234!",
    "email_confirm":  true
  }'
```

Or browse / reset any account in Supabase Studio:
1. Go to `http://127.0.0.1:54323`
2. Authentication → Users
3. Click a user → Edit → set a new password

---

## Screen Map

### Auth Routes (shared by all users)
```
/(auth)/login              Login — guides and travelers use the same screen
/(auth)/signup             Sign up with role selector (Traveler 🧳 / Guide 🎓)
/(auth)/forgot-password    Password reset
```

### Traveler Routes
```
/(traveler)/               Home — guide cards, category filters, search bar
/(traveler)/search         Full search with filters
/(traveler)/guide/[id]     Guide profile — magazine layout, itineraries, reviews
/(traveler)/itinerary/[id] Itinerary detail — stops, guide quote, Book CTA
/(traveler)/book/[guideId] Booking flow — select tour, dates, traveler count, price
/(traveler)/trips/         My Trips list
/(traveler)/trips/[id]     Trip detail — status, guide info, message button
/(traveler)/trips/live/[id] Live tour map (native only — needs Google Maps API key)
/(traveler)/trips/review/[id] Leave a review after tour
/(traveler)/saved          Saved / favorited guides
```

### Guide Routes
```
/(guide)/                  Dashboard — earnings summary, upcoming bookings
/(guide)/requests          Incoming booking requests — accept or decline
/(guide)/profile           Guide profile editor
/(guide)/itineraries/      My itineraries list
/(guide)/itineraries/create  Create new itinerary with stops
/(guide)/itineraries/[id]  Edit existing itinerary
```

### Shared Routes
```
/(shared)/messages/[bookingId]  Chat thread for a specific booking
```

---

## What's Not Yet Built

| Feature | Status | Notes |
|---|---|---|
| Razorpay payments | 🔜 Stubbed | `mobile/lib/api/payments.ts` exists; needs real key + company registration |
| Google Maps live tour | 🔜 Stubbed | `.native.tsx` variant exists; needs `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `app.json` |
| Push notifications | ✅ Done (PR #6) | Expo Push token registration, Edge fn delivery, cron polling, deep-link tap routing |
| Google OAuth | 🔜 UI exists | Button is on login screen; Supabase provider not configured |
| Marketing site real links | 🔜 Placeholder | Replace `localhost:8081`, WhatsApp, Instagram, Twitter/X URLs |
| Marketing site images | 🔜 Missing | ~30 images in `/public/images/` return 404 |
| Marketing site colors | 🔜 Off-brand | Uses indigo `#4F46E5`; should be saffron `#F97316` |
| CI/CD pipeline | ✅ Done | 5-job GitHub Actions suite (lint, typecheck, migrations, build, edge tests) |
| EAS / production build | 🔜 Needs setup | Run `eas init` in `mobile/` to replace the placeholder projectId in `app.json` |

---

## Business Rules

These are enforced in `mobile/config/constants.ts`. **Do not change without founder sign-off.**

| Rule | Value |
|---|---|
| Commission rate | 25% of buddy fee only (not applied to expenses) |
| Estimated expenses | 30% of buddy fee shown as placeholder in price breakdown |
| Min booking notice | 4 hours before arrival |
| Max booking advance | 90 days |
| Escrow auto-release | 24 hours after tour ends |
| Min guide rating (search) | 4.0★ (new guides with 0 reviews are exempt) |
| Currency | INR (₹) |
| Supported cities | Mumbai only (v1) |

> ⚠️ Commission rate: CLAUDE.md Task 7 spec suggests 15% but code is at 25%. Confirm with Gaurav before changing.
