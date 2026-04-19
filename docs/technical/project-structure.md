# Mumbai Buddies - Expo Universal App Project Structure

## Overview

This document describes the folder structure and organization for the Mumbai Buddies mobile + web app built with Expo and expo-router. This structure balances simplicity (for MVP) with scalability (for future growth).

**Key principles:**
- File-based routing via `expo-router` (like Next.js)
- Separation of concerns: routes → components → business logic → types
- Platform-specific code isolated to layout files
- Single source of truth for types, auth, and API calls

---

## Project Structure

```
mumbai-buddies-app/
├── app/                          # expo-router file-based routing
│   ├── (auth)/                   # Auth group (not shown in tab bar)
│   │   ├── _layout.tsx           # Auth navigation (screens overlap tabs)
│   │   ├── login.tsx             # Login screen
│   │   ├── signup.tsx            # Signup screen
│   │   └── forgot-password.tsx   # Password reset (Phase 2)
│   │
│   ├── (traveler)/               # Traveler-only section (tabs)
│   │   ├── _layout.tsx           # Tab navigator (Home, Trips, Messages, Profile)
│   │   ├── index.tsx             # Home: Browse guides by city
│   │   ├── search.tsx            # Search/filter guides
│   │   ├── guide/[id].tsx        # Guide detail page (full profile, itinerary)
│   │   ├── book/[id].tsx         # Booking flow (flight details → payment)
│   │   ├── trips/
│   │   │   ├── index.tsx         # My trips list
│   │   │   ├── [id].tsx          # Trip details (date, guide, expenses)
│   │   │   ├── live/[id].tsx     # Live tour view (GPS, chat, timeline)
│   │   │   └── review/[id].tsx   # Post-tour review form
│   │   ├── messages.tsx          # Inbox (list of conversations)
│   │   ├── profile.tsx           # Traveler profile settings
│   │   └── help.tsx              # FAQ, support (Phase 2)
│   │
│   ├── (guide)/                  # Guide-only section (tabs)
│   │   ├── _layout.tsx           # Tab navigator (Dashboard, Calendar, Earnings, Profile)
│   │   ├── index.tsx             # Dashboard: overview, stats
│   │   ├── requests.tsx          # Incoming match requests (accept/decline)
│   │   ├── bookings/
│   │   │   ├── index.tsx         # All guide's bookings
│   │   │   └── [id].tsx          # Booking detail (traveler info, messaging)
│   │   ├── itineraries/
│   │   │   ├── index.tsx         # List of guide's itineraries
│   │   │   ├── create.tsx        # Create new itinerary
│   │   │   └── [id].tsx          # Edit existing itinerary
│   │   ├── calendar.tsx          # Availability calendar (Phase 2)
│   │   ├── earnings.tsx          # Earnings dashboard + payouts
│   │   ├── profile.tsx           # Guide profile (edit, photos, rating)
│   │   └── help.tsx              # FAQ, support (Phase 2)
│   │
│   ├── (shared)/                 # Shared screens (accessible to both)
│   │   ├── messages/[bookingId].tsx  # Chat for a specific booking
│   │   ├── settings.tsx               # App settings (language, notifications)
│   │   ├── notifications.tsx          # Notification center (Phase 2)
│   │   └── help.tsx                   # General help page
│   │
│   ├── index.tsx                 # Splash/welcome screen (first load, before auth)
│   ├── _layout.tsx               # Root layout (auth check, theme provider, error boundary)
│   ├── +not-found.tsx            # 404 screen (web)
│   └── +html.tsx                 # Root HTML wrapper (web only)
│
├── components/                   # Reusable UI components
│   ├── ui/                       # Base design system components
│   │   ├── Button.tsx            # Primary, secondary, danger variants
│   │   ├── Card.tsx              # Elevation, padding, border radius
│   │   ├── Input.tsx             # Text input, password, email, number
│   │   ├── Badge.tsx             # Status badges (pending, confirmed, completed)
│   │   ├── Modal.tsx             # Modal/dialog
│   │   ├── Loading.tsx           # Spinner, skeleton loader
│   │   ├── EmptyState.tsx        # Empty state placeholder
│   │   └── ErrorBoundary.tsx     # Error boundary wrapper
│   │
│   ├── guide/                    # Guide-specific components
│   │   ├── GuideCard.tsx         # Compact guide card (name, rating, price)
│   │   ├── GuideDetail.tsx       # Full guide profile (photos, bio, itinerary)
│   │   ├── ItineraryCard.tsx     # Itinerary preview (stops, duration, price)
│   │   ├── ItineraryEditor.tsx   # Edit itinerary form
│   │   └── ReviewCard.tsx        # Review display (traveler name, rating, text)
│   │
│   ├── booking/                  # Booking-specific components
│   │   ├── FlightInput.tsx       # Flight number + date picker
│   │   ├── PriceBreakdown.tsx    # Cost breakdown (trip cost, buddy fee, tax)
│   │   ├── PaymentForm.tsx       # Razorpay payment button
│   │   ├── BookingTimeline.tsx   # Status timeline (pending → confirmed → completed)
│   │   └── ExpenseForm.tsx       # Add/edit trip expense
│   │
│   ├── maps/                     # Map components
│   │   ├── TourMap.tsx           # Live tour map with markers
│   │   ├── LocationTracker.tsx   # GPS indicator + permission handling
│   │   └── MapMarker.tsx         # Reusable map marker
│   │
│   ├── layout/                   # Layout components
│   │   ├── Header.tsx            # Top navigation bar
│   │   ├── TabBar.tsx            # Custom bottom tab navigator
│   │   ├── Sidebar.tsx           # Web-only sidebar navigation
│   │   └── BottomSheet.tsx       # Modal bottom sheet
│   │
│   └── modals/                   # Modal/dialog content
│       ├── ConfirmModal.tsx      # Yes/no confirmation
│       ├── SuccessModal.tsx      # Success message + dismiss
│       └── ErrorModal.tsx        # Error message + retry
│
├── lib/                          # Core business logic & utilities
│   ├── supabase.ts               # Supabase client singleton
│   │                              # (handles auth, connection pooling)
│   │
│   ├── auth.ts                   # Authentication helpers
│   │   ├── signUp()
│   │   ├── signIn()
│   │   ├── signInWithGoogle()
│   │   ├── signOut()
│   │   ├── getSession()
│   │   └── updateProfile()
│   │
│   ├── api/                      # API functions (call Supabase + Edge Functions)
│   │   ├── guides.ts             # Guide operations
│   │   │   ├── fetchGuides()     # Browse guides by city
│   │   │   ├── fetchGuideDetail()
│   │   │   ├── updateGuideProfile()
│   │   │   ├── fetchGuideRating()
│   │   │   └── getActiveGuides()
│   │   │
│   │   ├── bookings.ts           # Booking operations
│   │   │   ├── createBooking()   # Initiate booking + payment
│   │   │   ├── fetchBooking()
│   │   │   ├── updateBookingStatus()
│   │   │   ├── cancelBooking()
│   │   │   └── getMyBookings()
│   │   │
│   │   ├── matching.ts           # Matching algorithm (Phase 2)
│   │   │   ├── findMatches()     # Get 3 matched guides
│   │   │   └── calculateMatch()  # Scoring logic
│   │   │
│   │   ├── flights.ts            # Flight tracking (Phase 2)
│   │   │   ├── fetchFlightStatus()
│   │   │   └── trackFlights()
│   │   │
│   │   ├── payments.ts           # Payment operations
│   │   │   ├── createRazorpayOrder()
│   │   │   ├── verifyPayment()
│   │   │   └── refundPayment()
│   │   │
│   │   ├── reviews.ts            # Review operations
│   │   │   ├── submitReview()
│   │   │   ├── fetchReviews()
│   │   │   └── calculateRating()
│   │   │
│   │   ├── messages.ts           # Chat operations
│   │   │   ├── sendMessage()
│   │   │   ├── fetchMessages()
│   │   │   └── subscribeToMessages() # Realtime
│   │   │
│   │   ├── earnings.ts           # Guide earnings (Phase 2)
│   │   │   ├── calculateEarnings()
│   │   │   ├── fetchPayoutHistory()
│   │   │   └── requestPayout()
│   │   │
│   │   ├── itineraries.ts        # Itinerary operations
│   │   │   ├── createItinerary()
│   │   │   ├── updateItinerary()
│   │   │   ├── deleteItinerary()
│   │   │   └── fetchItineraries()
│   │   │
│   │   └── locations.ts          # Location operations
│   │       ├── trackLocation()    # Send GPS updates
│   │       ├── fetchGuideLocation()
│   │       └── createSOSAlert()
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts            # Current user, sign in/out
│   │   ├── useAuthGuard.ts       # Redirect if not logged in
│   │   ├── useRoleGuard.ts       # Redirect if not right role
│   │   ├── useBooking.ts         # Fetch + watch booking
│   │   ├── useGuideProfile.ts    # Fetch + watch guide profile
│   │   ├── useFlightTracking.ts  # Poll flight status
│   │   ├── useLocationTracking.ts # Send & receive location updates
│   │   ├── useRealtime.ts        # Subscribe to Supabase Realtime
│   │   └── useForm.ts            # Form state management (Phase 2)
│   │
│   ├── utils/                    # Utility functions
│   │   ├── formatters.ts         # Currency, date, time formatting
│   │   │   ├── formatCurrency()  # INR formatting
│   │   │   ├── formatDate()      # DD-MM-YYYY format
│   │   │   ├── formatTime()      # HH:MM format
│   │   │   └── formatDuration()  # "2h 30m"
│   │   │
│   │   ├── validators.ts         # Input validation
│   │   │   ├── isValidEmail()
│   │   │   ├── isValidPhone()
│   │   │   ├── isValidFlightNumber()
│   │   │   └── validateBooking()
│   │   │
│   │   ├── constants.ts          # App-wide constants
│   │   │   ├── CITIES              # ["Mumbai", "Delhi", "Bangalore"]
│   │   │   ├── PRICE_RANGE         # Min/max buddy cost
│   │   │   ├── COMMISSION_RATE     # 0.25 (25%)
│   │   │   ├── LANGUAGES           # Supported languages
│   │   │   └── PAYMENT_GATEWAY     # Razorpay keys
│   │   │
│   │   ├── geometry.ts           # Geo calculations (Phase 2)
│   │   │   ├── calculateDistance()
│   │   │   └── isWithinRadius()
│   │   │
│   │   └── storage.ts            # AsyncStorage helpers
│   │       ├── getStoredValue()
│   │       ├── setStoredValue()
│   │       └── clearStorage()
│
├── assets/                       # Static assets
│   ├── images/
│   │   ├── logo.png              # App logo
│   │   ├── splash.png            # Splash screen
│   │   ├── placeholder-guide.png
│   │   ├── placeholder-avatar.png
│   │   └── icons/                # Unicons, Feather Icons
│   │
│   ├── fonts/                    # Custom fonts
│   │   ├── Poppins-Regular.ttf
│   │   ├── Poppins-Bold.ttf
│   │   └── Roboto-Regular.ttf
│   │
│   └── animations/               # Lottie animations
│       ├── loading.json
│       ├── success.json
│       └── error.json
│
├── supabase/                     # Supabase configuration
│   ├── migrations/               # Database migrations (Phase 1+)
│   │   ├── 001_init.sql          # Initial schema
│   │   ├── 002_add_rls.sql       # RLS policies
│   │   └── 003_add_indexes.sql   # Performance indexes
│   │
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── match-guides/         # Matching algorithm
│   │   │   └── index.ts
│   │   ├── create-booking/       # Booking + payment orchestration
│   │   │   └── index.ts
│   │   ├── razorpay-webhook/     # Payment confirmation
│   │   │   └── index.ts
│   │   ├── track-flights/        # Flight status polling
│   │   │   └── index.ts
│   │   ├── calculate-payout/     # Guide earnings calculation
│   │   │   └── index.ts
│   │   ├── sos-alert/            # Emergency alert broadcast
│   │   │   └── index.ts
│   │   └── crons/                # Scheduled jobs
│   │       └── track-flights-cron.ts
│   │
│   └── seed.sql                  # Test data for development

├── types/                        # TypeScript type definitions
│   ├── database.ts               # Auto-generated from Supabase schema
│   │   ├── User
│   │   ├── GuideProfile
│   │   ├── TravelerProfile
│   │   ├── Booking
│   │   ├── Review
│   │   ├── Message
│   │   ├── Expense
│   │   ├── Itinerary
│   │   ├── LocationTracking
│   │   └── ...
│   │
│   ├── api.ts                    # API request/response types
│   │   ├── CreateBookingRequest
│   │   ├── BookingResponse
│   │   ├── GuideSearchQuery
│   │   ├── MatchResult
│   │   └── ...
│   │
│   └── navigation.ts             # Route parameter types
│       ├── GuideDetailParams { id: string }
│       ├── BookingParams { id: string; step: "flight" | "confirm" | "pay" }
│       └── ...
│
├── config/                       # App configuration
│   ├── theme.ts                  # Design tokens (colors, typography, spacing)
│   │   ├── colors: { primary, secondary, accent, background, text, ... }
│   │   ├── fonts: { regular, bold, heading, ... }
│   │   ├── spacing: { xs, sm, md, lg, xl, ... }
│   │   └── borderRadius: { sm, md, lg, pill, ... }
│   │
│   ├── env.ts                    # Environment variables (with defaults)
│   │   ├── SUPABASE_URL
│   │   ├── SUPABASE_ANON_KEY
│   │   ├── RAZORPAY_KEY_ID
│   │   ├── GOOGLE_MAPS_API_KEY
│   │   └── __DEV__
│   │
│   └── constants.ts              # Feature flags, limits
│       ├── MAX_GUIDES_PER_SEARCH = 3
│       ├── MIN_GUIDE_RATING = 4.0
│       ├── COMMISSION_RATE = 0.25
│       ├── PAYMENT_HOLD_DAYS = 1
│       └── FEATURE_FLAGS: { enableFlightTracking: false, ... }
│
├── app.json                      # Expo config (name, version, plugins, etc.)
├── eas.json                      # EAS Build config (Android, iOS build settings)
├── tsconfig.json                 # TypeScript config (strict mode)
├── tailwind.config.js            # NativeWind config
├── package.json                  # Dependencies
├── .env.local                    # Environment variables (gitignored)
├── .gitignore
├── README.md
└── index.js                      # Entry point

```

---

## Directory Guide

### `app/` - Routes & Screens

**What goes here:** Every `.tsx` file is a route. File structure = URL structure.

**Why this structure:**
- `(auth)` group: Auth screens don't show tabs, don't appear in nav
- `(traveler)` group: Traveler-only screens with bottom tab bar
- `(guide)` group: Guide-only screens with different tab bar
- `(shared)` group: Accessible to both (e.g., messages, settings)

**Connection to other parts:**
- Screens import components from `components/`
- Screens call API functions from `lib/api/`
- Screens use hooks from `lib/hooks/`
- Screens use types from `types/`

**Priority (MVP first):**
🔴 Auth: `login.tsx`, `signup.tsx`
🔴 Traveler: `index.tsx` (browse guides), `guide/[id].tsx`, `book/[id].tsx`, `trips/live/[id].tsx`
🔴 Guide: `index.tsx` (dashboard), `requests.tsx`, `itineraries/` (all)
🔴 Shared: `messages/[bookingId].tsx`
🟡 Phase 2: Calendar, notifications, password reset
🟢 Phase 3: Advanced search, flight tracking UI, earnings payouts

---

### `components/` - Reusable UI

**What goes here:** Every component is tested independently and reusable.

**Why this structure:**
- `ui/`: Design system (Button, Card, Input, etc.). Used everywhere.
- `guide/`: Guide-specific (GuideCard, ReviewCard). Only used in guide screens.
- `booking/`: Booking-specific (PriceBreakdown, PaymentForm). Only in booking flows.
- `maps/`: Map-related (TourMap, LocationTracker).
- `layout/`: Layout wrappers (Header, TabBar).
- `modals/`: Dialog/modal content.

**Connection to other parts:**
- Components import types from `types/`
- Components don't import screens
- Components call utilities from `lib/utils/`
- High-level components use hooks from `lib/hooks/`

**Priority (MVP first):**
🔴 `ui/`: Button, Card, Input, Badge, Modal, Loading, ErrorBoundary
🔴 `booking/`: FlightInput, PriceBreakdown, PaymentForm, BookingTimeline
🔴 `guide/`: GuideCard, GuideDetail, ItineraryCard
🔴 `layout/`: Header, TabBar
🟡 `maps/`: TourMap, LocationTracker (Phase 2)
🟢 `modals/`: All optional, build as needed

---

### `lib/` - Business Logic

**What goes here:** No UI. Pure logic: API calls, auth, hooks, utilities.

**Why this structure:**
- `supabase.ts`: Single instance. All API calls use this.
- `auth.ts`: Auth-specific helpers. Encapsulates Supabase Auth.
- `api/`: Organized by domain (guides, bookings, payments, etc.).
  - Each file exports functions that call Supabase or Edge Functions
  - Returns strongly-typed responses
  - Handles errors gracefully
- `hooks/`: Custom React hooks using API functions + local state
- `utils/`: Pure functions (no side effects). Formatters, validators, constants.

**Connection to other parts:**
- Screens call `lib/api/` → `lib/hooks/` → `lib/utils/`
- Components may call `lib/utils/` but not `lib/api/`
- All use types from `types/`

**Example call chain:**
```
Screen (guide/[id].tsx)
  ↓
  useGuideProfile() [lib/hooks/]
    ↓
    fetchGuideDetail() [lib/api/guides.ts]
      ↓
      supabase.from('guide_profiles').select()
      ↓
      Response typed as GuideProfile [types/database.ts]
      ↓
    useGuideProfile() returns { data, loading, error }
  ↓
GuideDetail component [components/guide/]
  ↓
  formatCurrency() [lib/utils/formatters.ts]
```

**Priority (MVP first):**
🔴 `supabase.ts` - Set up immediately
🔴 `auth.ts` - Email + Google sign-in
🔴 `api/guides.ts` - Browse guides
🔴 `api/bookings.ts` - Create, read, update bookings
🔴 `api/payments.ts` - Razorpay integration
🔴 `hooks/useAuth.ts`, `useBooking.ts`, `useGuideProfile.ts`
🔴 `utils/formatters.ts`, `utils/validators.ts`, `utils/constants.ts`
🟡 `api/matching.ts`, `api/flights.ts` (Phase 2)
🟢 `api/earnings.ts`, `api/locations.ts` (Phase 3)

---

### `types/` - TypeScript Definitions

**What goes here:** Type definitions only. No runtime code.

**Why this structure:**
- `database.ts`: Generated from Supabase schema. Copy-paste from Supabase dashboard.
- `api.ts`: Request/response types for your APIs
- `navigation.ts`: Route parameters (e.g., `guide?id=123` → `{ id: string }`)

**Connection to other parts:**
- Everything imports from `types/`
- Enables strict TypeScript checking
- Single source of truth for data shapes

**Example:**
```typescript
// types/database.ts
export type GuideProfile = {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string;
  avg_rating: number;
  is_active: boolean;
  created_at: string;
}

// lib/api/guides.ts
async function fetchGuideDetail(id: string): Promise<GuideProfile> {
  const { data } = await supabase
    .from('guide_profiles')
    .select()
    .eq('id', id)
    .single();
  return data as GuideProfile;
}

// components/guide/GuideDetail.tsx
export interface GuideDetailProps {
  guide: GuideProfile;
}
```

**Priority (MVP first):**
🔴 Generate `database.ts` from Supabase
🔴 Create `api.ts` with CreateBookingRequest, PaymentResponse, etc.
🔴 Create `navigation.ts` with route parameters

---

### `supabase/` - Backend

**What goes here:** Database migrations, Edge Functions, seed data.

**Why this structure:**
- `migrations/`: Version control for database schema
- `functions/`: Serverless logic (Deno)
- `seed.sql`: Test data

**Connection to other parts:**
- Edge Functions called from `lib/api/` via `supabase.functions.invoke()`
- Database schema defined here, types in `types/database.ts`

**Priority (MVP first):**
🔴 `migrations/001_init.sql` - Create tables (copy from schema.sql)
🔴 `functions/create-booking/index.ts` - Booking + payment orchestration
🔴 `functions/razorpay-webhook/index.ts` - Payment confirmation
🟡 `functions/match-guides/index.ts` (Phase 2)
🟢 `functions/track-flights/index.ts`, `functions/calculate-payout/` (Phase 3)

---

### `assets/` - Static Files

**What goes here:** Images, fonts, animations.

**Why this structure:**
- Organized by type (images, fonts, animations)
- One source for logo, placeholder images
- Fonts referenced in `config/theme.ts`

**Priority (MVP first):**
🔴 `images/logo.png`, `images/splash.png`
🔴 `images/placeholder-guide.png`, `images/placeholder-avatar.png`
🟡 `images/icons/` (use Feather Icons from npm instead)
🟢 `animations/` (use Lottie only if needed)

---

### `config/` - App Configuration

**What goes here:** Theme, environment variables, feature flags.

**Why this structure:**
- `theme.ts`: Centralized design tokens (colors, spacing, fonts)
- `env.ts`: Environment variables with type safety
- `constants.ts`: Business logic constants (prices, limits, flags)

**Connection to other parts:**
- Components import colors/spacing from `config/theme.ts`
- All files import env vars from `config/env.ts`
- Constants used in `lib/api/` and `lib/utils/`

**Example:**
```typescript
// config/theme.ts
export const colors = {
  primary: '#0D7377',
  secondary: '#FF6B6B',
  background: '#F8F5F0',
  text: '#1A1A2E',
};

// components/ui/Button.tsx
import { colors } from '@/config/theme';
<Pressable style={{ backgroundColor: colors.primary }} />

// config/constants.ts
export const COMMISSION_RATE = 0.25;
export const MAX_GUIDES_PER_SEARCH = 3;

// lib/api/bookings.ts
const totalCommission = buddyCost * COMMISSION_RATE;
```

**Priority (MVP first):**
🔴 `theme.ts` - Define colors, spacing, fonts
🔴 `env.ts` - SUPABASE_URL, SUPABASE_ANON_KEY, RAZORPAY_KEY, etc.
🔴 `constants.ts` - COMMISSION_RATE, MAX_GUIDES, MIN_RATING, etc.

---

## Deployment Pipeline

### 1. Web Deployment (Vercel)

```bash
# Local development
npx expo start --web

# Build for web
npx expo export:web

# Deploy to Vercel (automated via Git)
vercel
```

**Flow:**
1. Push to `main` branch
2. Vercel detects `expo export:web`
3. Builds static HTML/JS
4. Deploys to https://mumbai-buddies.vercel.app
5. Takes ~2 minutes

---

### 2. iOS Deployment (App Store)

```bash
# Create EAS Build
eas build --platform ios --auto-submit

# Build
- Runs on Expo's macOS servers
- Takes ~10 minutes
- Uploads to TestFlight

# Submit to App Store
- Automatic if --auto-submit
- Or manual via App Store Connect
- Takes ~24-48 hours for review
```

**Flow:**
1. Update version in `app.json`
2. Commit to `main`
3. Run `eas build --platform ios --auto-submit`
4. Expo builds on their servers
5. Uploads to TestFlight for internal testing
6. When ready: submit to App Store Connect
7. Apple reviews (24-48 hours)
8. Published to App Store

---

### 3. Android Deployment (Play Store)

```bash
# Similar to iOS
eas build --platform android --auto-submit
```

**Flow:**
1. Update version in `app.json`
2. Commit to `main`
3. Run `eas build --platform android --auto-submit`
4. Expo builds APK/AAB
5. Uploads to Play Store internal testing track
6. When ready: promote to production
7. Google reviews (takes ~30 minutes - 2 hours)
8. Published to Play Store

---

### Complete Deploy Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  git push main  (one command)                               │
└────────┬────────────────────────────────────────────────────┘
         │
    ┌────┴────┬────────────────┬─────────────────┐
    │          │                │                 │
    ▼          ▼                ▼                 ▼
  WEB        iOS            ANDROID          BACKEND
  │           │                │               │
  ├─ Build    ├─ EAS Build     ├─ EAS Build    ├─ Auto-deploy
  ├─ Test     ├─ TestFlight    ├─ Play Store   │  Edge Functions
  └─ Deploy   └─ App Store     └─ Production   └─ DB migrations
    Vercel                                      (via Supabase CLI)
    (2 min)   (10 min)         (10 min)         (auto)
```

**Important:** All three platforms use the **same source code**. Only difference:
- Web: `expo export:web`
- Mobile: Native wrappers via EAS Build (handles Xcode, Gradle for you)

---

## MVP Build Priority

### Week 1-2: Foundation 🔴

- [ ] Set up Expo + expo-router
- [ ] Create auth screens (login, signup)
- [ ] Implement Supabase auth (email + Google)
- [ ] Create database schema
- [ ] Design system (colors, Button, Card components)

### Week 2-3: Core Flows 🔴

**Traveler:**
- [ ] Guide search/browse (list of guides)
- [ ] Guide detail view (profile, itinerary, reviews)
- [ ] Booking flow (flight → confirm → pay)
- [ ] Payment integration (Razorpay)
- [ ] My trips (list + detail)

**Guide:**
- [ ] Dashboard (stats overview)
- [ ] Create itinerary
- [ ] Manage requests (accept/decline)
- [ ] Profile edit

**Shared:**
- [ ] In-app chat (basic text messages)
- [ ] Review form (post-tour)

### Week 4: Polish & Deploy 🔴

- [ ] Error handling + edge cases
- [ ] Loading states, empty states
- [ ] Mobile UX testing
- [ ] Web responsive design
- [ ] Deploy to Vercel (web)
- [ ] Deploy to TestFlight + Play Store internal testing
- [ ] Bug fixes from testing

### Phase 2 (Weeks 5-8): Enhancement 🟡

- [ ] Live location tracking (tour map)
- [ ] Flight tracking API integration
- [ ] Calendar + availability management
- [ ] Advanced guide matching algorithm
- [ ] Notifications system
- [ ] Earnings dashboard

### Phase 3 (Weeks 9+): Scale 🟢

- [ ] Image CDN optimization
- [ ] Database indexing + query optimization
- [ ] Invite system
- [ ] Guest reviews
- [ ] Analytics
- [ ] Admin dashboard

---

## File Naming Conventions

- **Files:** `kebab-case.tsx` (e.g., `guide-card.tsx`)
- **Components:** `PascalCase` (e.g., `GuideCard`)
- **Functions:** `camelCase` (e.g., `fetchGuideDetail()`)
- **Types:** `PascalCase` (e.g., `GuideProfile`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_GUIDES_PER_SEARCH`)
- **Routes:** `kebab-case` (e.g., `guide/[id].tsx`)

---

## References

- [Expo Documentation](https://docs.expo.dev)
- [expo-router Routing](https://docs.expo.dev/routing/introduction/)
- [NativeWind Styling](https://www.nativewind.dev)
- [Supabase React Client](https://supabase.com/docs/reference/javascript)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
