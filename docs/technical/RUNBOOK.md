# Detour — Developer Runbook

> Last updated: 2026-08-09
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
| Marketing website (Astro) | ✅ Working | `http://127.0.0.1:8791` |
| Mobile app (iOS Simulator) | ✅ Working | Expo Go on simulator |
| Mobile app (Android Emulator) | ✅ Working | Expo Go on emulator |
| Mobile app (Web) | ✅ Working | `http://localhost:8081` |
| Admin 2.0 (Auth + MFA + RBAC) | ✅ Working | `http://127.0.0.1:5174` |
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
| Admin: Action Centre | ✅ Working | Owner, age, SLA, next action, fail-closed source health |
| Admin: Operations + marketplace | ✅ Working | Leads, inquiries, booking timeline, profiles, reviews |
| Admin: Money | ✅ Working | Payment/refund/payout ledgers and reconciliation |
| Admin: Trust & Safety | ✅ Working | Realtime SOS, reports, disputes and audited commands |
| Admin: Growth & Content | ✅ Working | GA4/GSC reports, funnel, tracking health and deployments |
| Sanity Studio | ✅ Working | Structured drafts, preview, revision and publishing workflow |
| Seed data | ✅ Present | 7 guides, 15 itineraries, 6 bookings, 5 reviews |

---

## Prerequisites

Install these once:

```bash
# Node.js 22.12+ (check with: node -v)
# npm 10+ (check with: npm -v)

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

### Mobile App (`apps/mobile/.env.local`)

Copy the example and fill in values:

```bash
cp apps/mobile/.env.local.example apps/mobile/.env.local
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

### Admin Console (`apps/admin/.env.local`)

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from `npx supabase status`>
```

Never put a service-role key, Google credential, or deployment token in a
`VITE_*` variable. The hosted console authenticates administrators with
Supabase Auth and TOTP MFA; privileged reads and commands execute inside Edge
Functions after membership and role checks.

### Server integrations (`supabase/.env.local`)

Copy `supabase/.env.local.example` for local Edge Function work. It documents
the server-only GA4, Search Console, Resend, Sanity and Vercel values. In a
hosted project, configure the same names with `supabase secrets set`; never put
them in Admin, Marketing or Studio browser variables.

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

Paste the public `anon key` into both `apps/mobile/.env.local` and
`apps/admin/.env.local`. Keep the `service_role` key server-side; local
Supabase supplies it directly to Edge Functions.

**To stop Supabase:**
```bash
npx supabase stop
```

---

## Launching the Marketing Website

Astro generates the public site as complete static HTML while preserving the
clean production URLs.

```bash
cd /Users/gaurav/Desktop/mumbai-buddies
npm install
npm run dev --workspace @detour/marketing
```

Open **http://127.0.0.1:8791**. A production-parity check is:

```bash
npm run build --workspace @detour/marketing
npm test --workspace @detour/marketing
npm run preview --workspace @detour/marketing
```

The checked-in content is a deterministic fallback. Configure Sanity only when
testing editorial publishing; see `apps/studio/docs/publishing.md`.

The Studio has an isolated React 19 dependency graph:

```bash
npm install --prefix apps/studio
npm run studio
# verification
npm run studio:test
npm run studio:build
```

---

## Launching the Mobile App

The app is React Native + Expo 52 with Expo Router 4 for file-based navigation.

```bash
cd /Users/gaurav/Desktop/mumbai-buddies
npm install        # first time only, installs all root workspaces
```

### iOS Simulator

1. Open Xcode and start a simulator:
   ```bash
   open -a Simulator
   ```
   (Or launch from Xcode → Window → Devices and Simulators)

2. Start the app:
   ```bash
   npm run mobile:ios
   # equivalent to: expo start --ios
   ```

3. The app will bundle (~6s) and launch in the simulator automatically.

**One-liner from the repo root:**
```bash
npm run mobile:ios
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
   cd /Users/gaurav/Desktop/mumbai-buddies
   npm run mobile:android
   # equivalent to: expo start --android
   ```

**One-liner from the repo root:**
```bash
npm run mobile:android
```

---

### Web Browser

Runs the app as a web app — useful for fast iteration and preview tools.

```bash
cd /Users/gaurav/Desktop/mumbai-buddies
npm run start:web --workspace @detour/mobile
# equivalent to: expo start --web
```

Open: **http://localhost:8081**

The viewport defaults to desktop. For an iPhone-sized view, resize your browser to 390×844 or use Chrome DevTools device emulation.

**One-liner from the repo root:**
```bash
npm run start:web --workspace @detour/mobile
```

---

## Launching the Admin Console

The Vite browser app has only the public anon key. Supabase Auth, MFA, active
membership, operation-specific roles, validated commands, and the append-only
audit log protect privileged work.

```bash
cd /Users/gaurav/Desktop/mumbai-buddies
cp apps/admin/.env.local.example apps/admin/.env.local
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run admin
```

Open **http://127.0.0.1:5174**, sign in with an Auth user that has an active
`admin_memberships` record, and enrol/verify an authenticator when prompted.
Local seeded owner details are documented beside the seed once the backend has
been reset.

Before any hosted release:

```bash
npm run build --workspace @detour/admin
npm test --workspace @detour/admin
npm run security:admin-bundle
```

The final command must pass; it rejects service credentials, private keys, and
privileged environment markers in downloadable assets.

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
| Razorpay payments | 🔜 Stubbed | `apps/mobile/lib/api/payments.ts` exists; needs real key + company registration |
| Google Maps live tour | 🔜 Stubbed | `.native.tsx` variant exists; needs `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `app.json` |
| Push notifications | ✅ Done (PR #6) | Expo Push token registration, Edge fn delivery, cron polling, deep-link tap routing |
| Google OAuth | 🔜 UI exists | Button is on login screen; Supabase provider not configured |
| GA4 + Search Console live data | 🔜 Needs access | Configure the numeric property ID, domain property and read-only service account |
| Sanity production publishing | 🔜 Needs access | Configure project/dataset, signed relay secret and Vercel deployment callbacks |
| CI/CD pipeline | ✅ Done | Mobile, Admin, Edge, Marketing, Studio and fresh migration checks |
| EAS / production build | 🔜 Needs setup | Run `eas init` in `apps/mobile/` to replace the placeholder projectId in `app.json` |

---

## Business Rules

These are enforced in `apps/mobile/config/constants.ts`. **Do not change without founder sign-off.**

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
