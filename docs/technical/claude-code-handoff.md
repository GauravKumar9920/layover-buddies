# Mumbai Buddies - Claude Code Handoff Document

*Historical snapshot from April 12, 2026 — describes the pre-monorepo, pre-Admin-2.0 build. See [../project/PROJECT-OVERVIEW.md](../project/PROJECT-OVERVIEW.md) for current state.*

**Purpose:** This document contains EVERYTHING Claude Code needs to start building the Mumbai Buddies mobile + web app without asking questions about architecture or business logic.

**For:** Gaurav Sharma (Founder)  
**Date:** 2026-04-12  
**Status:** Ready for implementation

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Project Structure](#project-structure)
5. [MVP Scope (Weeks 1-4)](#mvp-scope-weeks-1-4)
6. [Key Business Rules](#key-business-rules)
7. [Design System](#design-system)
8. [Environment Variables](#environment-variables)
9. [Setup Instructions](#setup-instructions)
10. [What NOT to Do](#what-not-to-do)
11. [Scaling Considerations](#scaling-considerations)
12. [Critical Implementation Details](#critical-implementation-details)
13. [Files Already Created](#files-already-created)

---

## Project Overview

### What is Mumbai Buddies?

Mumbai Buddies is a two-sided marketplace connecting international travelers with local college student guides. Users can book a guide for a day trip in Indian cities (Mumbai, Delhi, Bangalore, etc.). Guides create itineraries; travelers book and pay; payment is held in escrow until after the tour.

### Architecture Decision

After evaluating three options (Expo, Monorepo with Next.js + React Native, and Flutter), we chose **Expo Universal with expo-router v4** because:
- Single codebase for web + iOS + Android
- Simplest for a solo founder learning as he builds
- Massive community (Shopify, Discord, Coinbase use Expo)
- First-class Supabase support
- Can eject to Option B later if needed

**Read:** `/docs/technical/ADR-001-unified-codebase.md` for full analysis.

### Tech Stack Summary

```
Frontend: Expo 52 + expo-router v4 + React Native + TypeScript + NativeWind
Backend: Supabase (PostgreSQL + Auth + Realtime + Edge Functions + Storage)
Payments: Razorpay (popular in India, supports INR)
Maps: Google Maps Platform
External APIs: FlightAware AeroAPI (Phase 2)
```

---

## Technology Stack

### Core Frameworks

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | `^52.0.0` | React Native + web compilation |
| `expo-router` | `^4.0.0` | File-based routing (like Next.js) |
| `react` | `^18.2.0` | Core framework |
| `react-native` | `^0.76.0` | Mobile platform |
| `typescript` | `^5.3.0` | Type safety (strict mode) |

### UI & Styling

| Package | Version | Purpose |
|---------|---------|---------|
| `nativewind` | `^4.0.0` | Tailwind CSS for React Native |
| `react-native-maps` | `^1.10.0` | Maps component (iOS, Android, web) |
| `expo-image` | `^1.10.0` | Optimized image component |
| `expo-camera` | `^15.0.0` | Camera access (Phase 2) |
| `expo-location` | `^17.0.0` | GPS/location tracking (Phase 2) |

### Backend & APIs

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | `^2.38.0` | Supabase client |
| `@supabase/auth-ui-react-native` | `^0.2.0` | Pre-built auth UI |
| `react-native-url-polyfill` | `^2.0.0` | URL support for Supabase |
| `react-native-razorpay` | `^2.1.0` | Razorpay payment SDK |

### State Management & Caching

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | `^4.4.0` | Light-weight state management (if needed) |
| `@tanstack/react-query` | `^5.0.0` | Server state + caching (Phase 2) |

### Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | `^1.6.0` | HTTP client for Edge Function calls |
| `date-fns` | `^2.30.0` | Date formatting |
| `lodash-es` | `^4.17.21` | Utility functions |
| `zod` | `^3.22.0` | Schema validation |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/react-native` | `^0.76.0` | TypeScript definitions |
| `eslint` | `^8.0.0` | Linting |
| `prettier` | `^3.0.0` | Code formatting |

### Package.json (Complete)

```json
{
  "name": "mumbai-buddies-app",
  "version": "0.1.0",
  "description": "Two-sided marketplace for travelers and local guides",
  "main": "index.js",
  "scripts": {
    "start": "expo start",
    "start:web": "expo start --web",
    "start:ios": "expo start --ios",
    "start:android": "expo start --android",
    "build:web": "expo export:web",
    "build:ios": "eas build --platform ios --auto-submit",
    "build:android": "eas build --platform android --auto-submit",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "format": "prettier --write ."
  },
  "dependencies": {
    "expo": "^52.0.0",
    "expo-router": "^4.0.0",
    "expo-constants": "^16.0.0",
    "expo-status-bar": "^1.11.0",
    "expo-camera": "^15.0.0",
    "expo-location": "^17.0.0",
    "expo-image": "^1.10.0",
    "expo-splash-screen": "^0.27.0",
    "expo-system-ui": "^3.0.0",
    "react": "^18.2.0",
    "react-native": "^0.76.0",
    "react-native-maps": "^1.10.0",
    "react-native-url-polyfill": "^2.0.0",
    "react-native-razorpay": "^2.1.0",
    "@supabase/supabase-js": "^2.38.0",
    "@supabase/auth-ui-react-native": "^0.2.0",
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "zustand": "^4.4.0",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "date-fns": "^2.30.0",
    "lodash-es": "^4.17.21",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-native": "^0.76.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "eslint": "^8.0.0",
    "eslint-config-expo": "^7.0.0",
    "prettier": "^3.0.0",
    "@babel/preset-typescript": "^7.23.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

---

## Database Schema

### Overview

The database is PostgreSQL hosted on Supabase. 16 tables with Row-Level Security (RLS) enabled.

### Full Schema

**Location:** `/Users/gaurav/Desktop/mumbai-buddies/data/schema.sql`

**How to set up:**
1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor
3. Copy the entire contents of `schema.sql`
4. Paste into the SQL editor
5. Click "Run"
6. Tables, RLS policies, and indexes are created

### Key Tables (High-Level)

```sql
-- Users (managed by Supabase Auth)
users (id, email, phone, created_at, updated_at)

-- Profiles
guide_profiles (id, user_id, name, bio, avatar_url, avg_rating, total_reviews, is_active, languages, hometown, created_at)
traveler_profiles (id, user_id, name, avatar_url, nationality, phone, created_at)

-- Core Business
bookings (id, traveler_id, guide_id, itinerary_id, flight_number, flight_date, start_date, end_date, total_price, commission, status, payment_intent_id, payment_status, created_at)
itineraries (id, guide_id, name, description, city, estimated_duration_hours, buddy_cost_inr, max_travelers, is_active, created_at)
itinerary_stops (id, itinerary_id, order, location, description, estimated_duration_minutes)

-- Reviews & Ratings
reviews (id, booking_id, reviewer_id, reviewee_id, rating, comment, created_at)

-- Messaging & Tracking
messages (id, booking_id, sender_id, content, created_at)
location_tracking (id, booking_id, guide_id, latitude, longitude, timestamp)
expenses (id, booking_id, description, amount_inr, receipt_url, created_at)

-- Flight Tracking
flight_tracking (id, booking_id, flight_number, current_status, estimated_arrival, last_updated)
```

### RLS Policies

Every table has RLS enabled. Users can only see/modify their own data:

```sql
-- Example: Users can only view their own guide profile
CREATE POLICY "guide_profiles_select" ON guide_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Example: Users can only update their own profile
CREATE POLICY "guide_profiles_update" ON guide_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Example: Messages are viewable only by participants
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT traveler_id FROM bookings WHERE id = messages.booking_id
      UNION
      SELECT guide_id FROM bookings WHERE id = messages.booking_id
    )
  );
```

### Important Indexes

```sql
-- Speed up guide searches
CREATE INDEX idx_guide_profiles_is_active ON guide_profiles(is_active);
CREATE INDEX idx_guide_profiles_city ON itineraries(city);
CREATE INDEX idx_guide_profiles_rating ON guide_profiles(avg_rating DESC);

-- Speed up booking queries
CREATE INDEX idx_bookings_traveler_id ON bookings(traveler_id);
CREATE INDEX idx_bookings_guide_id ON bookings(guide_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Speed up messages
CREATE INDEX idx_messages_booking_id ON messages(booking_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

### Data Types & Business Logic

**Booking Status Enum:**
```
pending → guide_accepted → confirmed → in_progress → completed
                       ↓
                  declined / cancelled
```

**Payment Status:**
```
pending → authorized → captured → released (to guide)
             ↓
          failed / refunded
```

**Guide Status:**
- `is_active`: Boolean. True if guide accepts new bookings.
- `avg_rating`: 0-5. Calculated from reviews table.
- `total_reviews`: Count of completed bookings with reviews.

---

## Project Structure

**Read:** `/Users/gaurav/Desktop/mumbai-buddies/docs/technical/project-structure.md`

This document has the complete folder structure with:
- What goes in each directory
- Why it's organized that way
- Connections between parts
- MVP priority (🔴 vs 🟡 vs 🟢)

**Key highlights:**
- `app/` = Routes (expo-router file-based routing)
- `components/` = Reusable UI components
- `lib/` = Business logic (API calls, hooks, utilities)
- `types/` = TypeScript definitions
- `supabase/` = Database migrations, Edge Functions
- `config/` = Theme, environment variables, constants

---

## MVP Scope (Weeks 1-4)

### What to Build (Phase 1)

**These are ONLY the features for MVP. No flight tracking, no matching algorithm, no gamification.**

#### 1. Authentication 🔴

- [ ] Email + password sign-up
- [ ] Email + password login
- [ ] Google OAuth sign-in (using Supabase Auth)
- [ ] Persistent sessions (AsyncStorage)
- [ ] Logout
- [ ] "Forgot password" link (email reset)

**Screens:**
- `app/(auth)/login.tsx`
- `app/(auth)/signup.tsx`

**Implementation:**
- Use Supabase Auth with email/password + Google provider
- Store session in AsyncStorage
- Redirect based on auth state in `app/_layout.tsx`

---

#### 2. Traveler Flow 🔴

**2a. Browse Guides**
- [ ] View list of active guides (all, no filtering yet)
- [ ] Sort by rating
- [ ] Search by guide name
- [ ] See guide cards (name, city, rating, price)

**Screens:**
- `app/(traveler)/index.tsx` (home/browse)
- `app/(traveler)/search.tsx` (search results)

**Implementation:**
- Fetch from `guide_profiles` where `is_active = true`
- Display as flat list
- Show only first 3 guides per city (pagination comes Phase 2)

---

**2b. Guide Detail**
- [ ] Full guide profile (name, bio, avatar, rating, reviews)
- [ ] List of itineraries (places they go, duration, cost)
- [ ] See reviews from past travelers
- [ ] "Book" button to start booking flow

**Screens:**
- `app/(traveler)/guide/[id].tsx`

**Implementation:**
- Fetch guide profile + itineraries + reviews
- Display in scrollable view
- Show list of past reviews

---

**2c. Booking Flow**
- [ ] Enter flight number + date
- [ ] Select an itinerary
- [ ] Review cost breakdown (buddy cost, commission, total)
- [ ] Proceed to payment

**Screens:**
- `app/(traveler)/book/[guideId].tsx`

**Implementation:**
- Step 1: Flight input form (flight number, date)
- Step 2: Itinerary selection
- Step 3: Price breakdown
- Step 4: Razorpay payment

---

**2d. Payment Integration**
- [ ] Razorpay payment form
- [ ] Payment authorization (hold money, don't capture yet)
- [ ] Handle payment success/failure
- [ ] Create booking record after payment success

**Implementation:**
- Use `react-native-razorpay` SDK
- Call `POST /functions/create-booking` to create order
- Receive payment intent ID from Edge Function
- Display Razorpay dialog
- Handle webhook confirmation

---

**2e. My Trips**
- [ ] List of all my bookings (upcoming + past)
- [ ] Show traveler's bookings with guide info, date, status
- [ ] Tap to see trip detail

**Screens:**
- `app/(traveler)/trips/index.tsx`
- `app/(traveler)/trips/[id].tsx` (trip detail)

**Implementation:**
- Fetch bookings where `traveler_id = current_user_id`
- Order by date descending
- Show booking details, guide info, messages link

---

**2f. Live Tour View**
- [ ] See guide's live location on map
- [ ] See itinerary timeline (where you've been, where you're going)
- [ ] Chat with guide
- [ ] SOS button (Phase 2 - not MVP)

**Screens:**
- `app/(traveler)/trips/live/[id].tsx`

**Implementation:**
- Subscribe to location_tracking via Supabase Realtime
- Display map with guide marker
- Show chat messages below
- Timeline of stops

---

**2g. Post-Tour Review**
- [ ] Rate guide 1-5 stars
- [ ] Write review text (optional)
- [ ] Submit review
- [ ] See confirmation

**Screens:**
- `app/(traveler)/trips/review/[id].tsx`

**Implementation:**
- Simple form: rating (stars) + text input
- Submit to reviews table
- Recalculate guide's avg_rating

---

#### 3. Guide Flow 🔴

**3a. Guide Dashboard**
- [ ] Overview of stats (total bookings, rating, earnings)
- [ ] Next upcoming tours
- [ ] Recent reviews

**Screens:**
- `app/(guide)/index.tsx`

**Implementation:**
- Query guide_profiles + bookings + reviews
- Show summary stats
- List next 3 tours

---

**3b. Manage Itineraries**
- [ ] List guide's itineraries
- [ ] Create new itinerary (name, description, city, duration, price, stops)
- [ ] Edit itinerary
- [ ] Toggle "active" status

**Screens:**
- `app/(guide)/itineraries/index.tsx`
- `app/(guide)/itineraries/create.tsx`
- `app/(guide)/itineraries/[id].tsx` (edit)

**Implementation:**
- Form: name, description, city, duration, buddy_cost, max_travelers
- Add stops: location, description, duration
- Save to itineraries + itinerary_stops tables

---

**3c. Incoming Requests**
- [ ] See list of pending booking requests
- [ ] Accept or decline
- [ ] See traveler info (name, nationality, review)

**Screens:**
- `app/(guide)/requests.tsx`

**Implementation:**
- Query bookings where `guide_id = current_user_id` and `status = pending`
- Buttons: "Accept" (update status → guide_accepted) or "Decline" (update status → declined)

---

**3d. Guide Profile**
- [ ] Edit name, bio, avatar, languages, hometown
- [ ] Upload/change profile photo
- [ ] See current rating

**Screens:**
- `app/(guide)/profile.tsx`

**Implementation:**
- Form inputs for bio, languages, hometown
- Image picker for avatar
- Save to guide_profiles table

---

#### 4. Messaging 🔴

- [ ] In-app chat between matched traveler and guide
- [ ] Real-time message sync (Supabase Realtime)
- [ ] Message history per booking
- [ ] See who's online

**Screens:**
- `app/(shared)/messages/[bookingId].tsx`

**Implementation:**
- Subscribe to messages via Supabase Realtime
- Send message: POST to messages table
- Display message list
- Auto-scroll to bottom on new message

---

#### 5. Base UI Components 🔴

```
Button.tsx          (primary, secondary, danger, sizes)
Card.tsx            (elevation, padding)
Input.tsx           (text, email, password, number)
Badge.tsx           (status colors)
Header.tsx          (title, back button)
TabBar.tsx          (bottom navigation)
Loading.tsx         (spinner)
EmptyState.tsx      (empty list message)
ErrorBoundary.tsx   (error UI)
```

---

### What NOT to Build in MVP

❌ Matching algorithm (show all guides, not filtered matches)  
❌ Flight tracking API integration  
❌ Location tracking (don't send guide's real GPS)  
❌ Calendar/availability management  
❌ Notifications system  
❌ Payouts/earnings dashboard  
❌ Admin panel  
❌ Advanced search/filters  
❌ Invite referral system  
❌ Guest reviews  
❌ Video/photo gallery from past tours  

These are **Phase 2 & 3**. Focus on core flow: sign up → browse → book → pay → chat → review.

---

## Key Business Rules

**These rules are CRITICAL. They affect database design and business logic. Don't deviate.**

### Pricing & Commission

```
Commission Rate: 25% of buddy_cost only (NOT on trip expenses)

Example:
  Itinerary buddy_cost = ₹2000
  Commission to Mumbai Buddies = ₹500 (25%)
  Guide payout = ₹1500

  If traveler also buys lunch (₹300 expense):
  Commission does NOT apply to lunch
  Guide still gets ₹1500, not ₹1425
```

**In code:**
```typescript
const commission = buddyCost * COMMISSION_RATE;  // 0.25
const guidePayout = buddyCost - commission;
const totalTravelerPrice = buddyCost + expenses; // Buddy cost + trip expenses
```

---

### Booking Status Flow

```
1. pending       → Guide hasn't responded yet
2. guide_accepted → Guide accepted (not yet confirmed by traveler)
3. confirmed     → Payment completed, booking confirmed
4. in_progress   → Tour is happening now
5. completed     → Tour finished, payment released to guide after 24h
6. declined      → Guide declined (from pending)
7. cancelled     → Traveler cancelled (from pending/guide_accepted)
```

**Implementation:**
```typescript
enum BookingStatus {
  pending = "pending",
  guide_accepted = "guide_accepted",
  confirmed = "confirmed",
  in_progress = "in_progress",
  completed = "completed",
  declined = "declined",
  cancelled = "cancelled",
}
```

---

### Payment Flow

```
1. Traveler initiates booking
2. Edge Function creates Razorpay order
3. Razorpay captures payment authorization (hold, don't charge card yet)
4. Create booking record with status "pending"
5. Guide accepts → status = "guide_accepted"
6. Traveler confirms → status = "confirmed", payment captured
7. Tour completes → status = "completed"
8. 24 hours pass (no disputes) → payment released to guide
```

**Important:** Payment is held in escrow, not immediately captured.

---

### Guide Visibility Rules

Guides appear in search ONLY if:
1. `is_active = true` (guide accepts bookings)
2. `avg_rating >= 4.0` (minimum 4-star rating)
3. No filters yet (MVP shows all matching guides)

**Exception:** Brand new guides (0 reviews) still show up but flagged as "New Guide."

---

### User Role Determination

On login:
1. Check if user has row in `guide_profiles` with `is_active = true` → **Guide**
2. Otherwise → **Traveler**

Don't store a role in the users table. Infer from guide_profiles existence.

---

### Session & Auth

- Use Supabase Auth (email/password + Google OAuth)
- Store session in AsyncStorage (auto-refreshes)
- JWT token expires in 1 hour (refreshed automatically)
- On sign out: clear AsyncStorage + clear Supabase session

---

## Design System

### Color Palette

```typescript
// config/theme.ts
export const colors = {
  // Primary (Teal)
  primary: '#0D7377',        // Main CTA, active states
  primaryLight: '#3FA796',   // Hover states
  primaryDark: '#051718',    // Text on primary background

  // Accent (Coral)
  accent: '#FF6B6B',         // Highlights, danger
  accentLight: '#FFB3B3',    // Hover states
  accentDark: '#E63946',     // Dark accent

  // Background
  background: '#F8F5F0',     // Main background
  surface: '#FFFFFF',        // Cards, modals
  surfaceAlt: '#F5F5F5',     // Subtle backgrounds

  // Text
  text: '#1A1A2E',           // Primary text
  textSecondary: '#6C757D',  // Secondary text, labels
  textTertiary: '#A9A9A9',   // Disabled text

  // Functional
  success: '#06A77D',        // Success states
  warning: '#FFA500',        // Warning states
  danger: '#E63946',         // Error states
  info: '#0D7377',           // Info states

  // Borders & Dividers
  border: '#E0E0E0',         // Light borders
  divider: '#D0D0D0',        // Dividing lines
};
```

### Typography

```typescript
export const typography = {
  fonts: {
    regular: 'System',      // iOS: San Francisco, Android: Roboto
    bold: 'System',
    mono: 'Courier New',
  },
  sizes: {
    xs: 10,                 // Captions
    sm: 12,                 // Small text
    base: 14,               // Body text
    lg: 16,                 // Larger body
    xl: 18,                 // Headings
    xxl: 24,                // Large headings
    xxxl: 32,               // Extra large headings
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};
```

### Spacing Scale

```typescript
export const spacing = {
  xs: 4,                    // Micro spacing
  sm: 8,                    // Buttons padding
  md: 12,                   // Card padding
  lg: 16,                   // Section padding
  xl: 24,                   // Page margins
  xxl: 32,                  // Large gaps
};
```

### Border Radius

```typescript
export const borderRadius = {
  sm: 4,                    // Subtle
  md: 8,                    // Default
  lg: 12,                   // Cards
  xl: 16,                   // Large rounded
  pill: 24,                 // Fully rounded
  full: 999,                // Circle (avatars)
};
```

### Shadow (Elevation)

```typescript
export const shadows = {
  none: 'none',
  sm: '0 1px 3px rgba(0,0,0,0.1)',
  md: '0 4px 6px rgba(0,0,0,0.1)',
  lg: '0 10px 15px rgba(0,0,0,0.1)',
  xl: '0 20px 25px rgba(0,0,0,0.1)',
};
```

### Component Examples

**Button:**
```
Primary Button:    Background #0D7377, Text white, Padding md
Secondary Button:  Background #F5F5F5, Text #1A1A2E, Border #E0E0E0
Danger Button:     Background #E63946, Text white
Disabled Button:   Background #F5F5F5, Text #A9A9A9
```

**Card:**
```
Padding: lg (16px)
Border Radius: lg (12px)
Background: white
Shadow: md
Border: 1px #E0E0E0
```

**Guide Card (Compact):**
```
Avatar: 48px, border-radius full
Name: 16px, bold, text #1A1A2E
City + Rating: 12px, secondary text
Price: 14px, bold, primary color #0D7377
```

---

## Environment Variables

### Needed for Development

```bash
# .env.local (gitignored)

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Razorpay
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...

# Google Maps (for maps component)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

# FlightAware (only for Edge Functions, Phase 2)
FLIGHTAWARE_API_KEY=your_key_here

# Razorpay Secret (only for Edge Functions)
RAZORPAY_KEY_SECRET=your_secret_here
```

### How to Get Each

**Supabase URL & Key:**
1. Create project at https://supabase.com
2. Go to Settings → API
3. Copy Project URL and `anon` key

**Razorpay Key ID:**
1. Create business account at https://razorpay.com
2. Go to Settings → API Keys
3. Copy Test Key ID (for MVP)

**Google Maps API Key:**
1. Go to https://cloud.google.com/maps-platform
2. Create project, enable Maps & Places APIs
3. Create API key (restrict to Android + iOS + Web)

**FlightAware API Key (Phase 2):**
1. Sign up at https://www.flightaware.com/commercial/aeroapi
2. Copy API key from dashboard

---

## Setup Instructions

### Step 1: Create Expo App

```bash
# Create new Expo project with TypeScript
npx create-expo-app@latest mumbai-buddies-app --template

# Navigate into project
cd mumbai-buddies-app

# Initialize git
git init
git add .
git commit -m "Initial Expo setup"
```

### Step 2: Install Dependencies

```bash
# Core dependencies
npx expo install expo-router expo-linking expo-constants
npx expo install expo-splash-screen expo-system-ui
npx expo install react-native-url-polyfill

# UI & Styling
npx expo install nativewind tailwindcss
npm install -D @types/tailwindcss

# Maps
npx expo install react-native-maps expo-location

# Camera & Image
npx expo install expo-image-picker expo-camera expo-image

# Supabase
npm install @supabase/supabase-js @supabase/auth-ui-react-native

# Payments
npm install react-native-razorpay

# Utilities
npm install axios date-fns lodash-es zod zustand

# Development
npm install -D typescript @types/react-native eslint prettier
```

### Step 3: Set Up Project Structure

```bash
# Create folder structure
mkdir -p app components lib types config assets supabase/functions

# Create essential files
touch .env.local
touch config/theme.ts
touch config/env.ts
touch config/constants.ts
touch lib/supabase.ts
touch lib/auth.ts
```

### Step 4: Configure Tailwind (NativeWind)

Create `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0D7377',
        accent: '#FF6B6B',
      },
    },
  },
  plugins: [],
};
```

### Step 5: Set Up TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "lib": ["ES2020"],
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### Step 6: Create Supabase Project

1. Go to https://supabase.com
2. Create new project
3. Wait for database to initialize
4. Go to SQL Editor
5. Copy entire contents of `/data/schema.sql`
6. Paste into SQL editor, click "Run"

### Step 7: Set Environment Variables

Create `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key
```

### Step 8: Start Development

```bash
# Start Expo dev server
npx expo start

# In terminal, press:
# i (open iOS simulator)
# a (open Android emulator)
# w (open web browser at localhost:8081)
```

### Step 9: Create First Route

Create `app/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
import { useAuth } from '@/lib/hooks/useAuth';

export default function RootLayout() {
  const { session, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack>
      {!session ? (
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(traveler)" options={{ headerShown: false }} />
      )}
    </Stack>
  );
}
```

### Step 10: Configure app.json

Update `app.json`:

```json
{
  "expo": {
    "name": "Mumbai Buddies",
    "slug": "mumbai-buddies",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": { "image": "./assets/splash.png" },
    "assetBundlePatterns": ["**/*"],
    "plugins": [
      ["expo-location", { "locationAlwaysAndWhenInUsePermissions": "$(PRODUCT_NAME) uses your location..." }],
      "expo-router"
    ],
    "web": { "favicon": "./assets/favicon.png" }
  }
}
```

---

## What NOT to Do

### Critical Mistakes to Avoid

❌ **Don't use localStorage**
- Use AsyncStorage for React Native persistence
- Use Supabase session management for auth
- Wrong: `localStorage.setItem('token', jwt)`
- Right: `supabase.auth.setSession(session)`

❌ **Don't build a custom backend**
- Use Supabase for everything (database, auth, storage, realtime)
- Use Edge Functions for server logic
- Don't spin up Node.js/Express server
- Wrong: "I'll build an API in Express"
- Right: "I'll create a Supabase Edge Function"

❌ **Don't use class components**
- Use functional components + hooks only
- React Native best practices = hooks
- Wrong: `class MyComponent extends React.Component`
- Right: `function MyComponent() { ... }`

❌ **Don't skip TypeScript**
- Use strict mode from day 1
- Every function must have param/return types
- Wrong: `const obj = {}; obj.name = 'x';`
- Right: `const obj: GuideProfile = { ... }`

❌ **Don't over-engineer Phase 1**
- No microservices, no complex state management
- No Redux, no custom middleware
- No event sourcing, CQRS, saga patterns
- Use React Context + Zustand for simple state
- Use Supabase Realtime for sync
- Wrong: "I need a message queue"
- Right: "Supabase Realtime handles this"

❌ **Don't use Redux**
- React Context + Zustand is simpler
- Supabase Realtime replaces Redux for server state
- Overkill for MVP
- Wrong: Create complex Redux store
- Right: Use Zustand for UI state, Supabase for data

❌ **Don't hardcode API URLs**
- Use environment variables from config/env.ts
- Wrong: `const url = "https://api.example.com"`
- Right: `const url = SUPABASE_URL`

❌ **Don't commit secrets**
- .env.local is gitignored
- Never commit API keys, secrets, tokens
- Wrong: `git add .env.local`
- Right: `.env.local` in .gitignore

❌ **Don't test on web-only**
- Test on actual iOS simulator and Android emulator
- Performance/UI differs between platforms
- Wrong: "It works on web, ship it"
- Right: Test iOS, Android, web before shipping

❌ **Don't ignore RLS**
- Row-Level Security is already set up in schema.sql
- Users can only see their own data
- Don't add bypass rules
- Wrong: `select * from guide_profiles` (without auth)
- Right: RLS policy enforces auth context

---

## Scaling Considerations

Build these in from the start to avoid rewrites:

### 1. Database

**Connection Pooling:**
- Supabase uses PgBouncer by default
- Good for up to 100 concurrent users
- At scale: Enable PgBouncer in Supabase settings

**Indexing:**
- Indexes already in schema.sql for common queries
- Add more if query performance degrades
- Example: `CREATE INDEX idx_bookings_status ON bookings(status);`

**PostGIS (Phase 3):**
- For geo queries (find guides near me)
- Already installed in Supabase PostgreSQL
- Use `ST_Distance()` for distance calculations

---

### 2. Storage

**Image Optimization:**
- Use Supabase Storage (not external S3)
- Set up CDN caching (Cloudflare)
- Use compression: ImageMagick or Sharp
- Sizes: 100px (thumbnail), 400px (card), 1000px (detail)

**Video Handling (Phase 3):**
- Transcode videos server-side (Edge Function)
- Store HLS stream
- Use HLS player on client

---

### 3. API Rate Limiting

**Implement in Edge Functions:**
```typescript
// supabase/functions/create-booking/index.ts
import { RateLimiter } from '@/lib/rateLimiter';

const limiter = new RateLimiter(100, 3600); // 100 requests/hour
if (!limiter.check(userId)) {
  return new Response('Rate limited', { status: 429 });
}
```

---

### 4. Realtime Limits

**Supabase Realtime limits:**
- 100 concurrent connections per project (free tier)
- Upgrade to paid for more
- Implement manual polling for high-frequency updates

---

### 5. Search & Filtering

**Simple (MVP):**
- SQL `WHERE` clauses + indexes

**Advanced (Phase 3):**
- Elasticsearch or Supabase Full Text Search (built-in)
- Create search index on guide bios, city, language
- Query with `to_tsquery()` in Supabase

---

### 6. Analytics

**Implement early:**
- Sentry for error tracking
- PostHog or Mixpanel for events
- Google Analytics for web

```typescript
// lib/analytics.ts
import * as Sentry from 'sentry-react-native';

Sentry.captureException(error);
analytics.track('booking_completed', { guide_id, amount });
```

---

### 7. Performance

**Bundle Size:**
- Web: Target < 2MB gzipped
- Mobile: Target < 50MB app size
- Use `expo build:web --analyze`

**Code Splitting:**
- Lazy load screens with `expo-router`
- Lazy load components with `React.lazy()`

**Caching:**
- Use React Query (Phase 2) for HTTP caching
- Cache frequently accessed data (guides, categories)

---

## Critical Implementation Details

### Authentication Flow

```typescript
// lib/auth.ts
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

// app/(auth)/signup.tsx
async function handleSignUp(email, password) {
  try {
    await signUp(email, password);
    // Navigate to login
  } catch (error) {
    showError(error.message);
  }
}
```

### Booking Payment Flow

```typescript
// lib/api/bookings.ts
export async function createBooking(bookingData: CreateBookingRequest) {
  // 1. Call Edge Function to create Razorpay order
  const { orderId } = await supabase.functions.invoke('create-booking', {
    body: bookingData,
  });

  // 2. Show Razorpay dialog
  const paymentResult = await RazorpayCheckout.open({
    key_id: RAZORPAY_KEY_ID,
    order_id: orderId,
    amount: bookingData.totalPrice,
    currency: 'INR',
  });

  // 3. Verify payment on backend
  const verified = await supabase.functions.invoke('verify-payment', {
    body: { orderId, paymentId: paymentResult.razorpay_payment_id },
  });

  return verified;
}
```

### Real-Time Chat

```typescript
// lib/hooks/useMessages.ts
export function useMessages(bookingId: string) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const subscription = supabase
      .from(`messages:booking_id=eq.${bookingId}`)
      .on('*', (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => supabase.removeSubscription(subscription);
  }, [bookingId]);

  return messages;
}
```

### Location Tracking (Phase 2)

```typescript
// lib/hooks/useLocationTracking.ts
export function useLocationTracking(bookingId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(async () => {
      const { coords } = await Location.getCurrentPositionAsync();
      await supabase.from('location_tracking').insert({
        booking_id: bookingId,
        guide_id: currentUserId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: new Date(),
      });
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [bookingId, enabled]);
}
```

### RLS in Action

```typescript
// On client, auth context is passed automatically
// This query will ONLY return the current user's guides
const { data: myGuides } = await supabase
  .from('guide_profiles')
  .select()
  .eq('user_id', supabase.auth.user()?.id);
  // RLS policy ensures this even if you don't add .eq()
```

---

## Files Already Created

**Don't recreate these. They're ready to use:**

### Documentation
- `/docs/technical/system-architecture.md` — Full architecture
- `/docs/technical/ADR-001-unified-codebase.md` — Architecture decision
- `/docs/technical/project-structure.md` — Folder organization
- `/docs/business/platform-features-and-business-model-v2.docx` — Business model
- `/docs/startup-research-report.docx` — Market research

### Database
- `/data/schema.sql` — Complete schema with RLS (copy-paste into Supabase)

### Design (CRITICAL — The app must look beautiful, animated, and intuitive)
- `/design/ui-mockups/app-prototype-v2.html` — Stunning interactive prototype (open in browser to see the vision)
- `/design/brand/design-system.md` — Complete design system: colors, typography, animations, components, illustrations, accessibility, dark mode
- `/design/brand/design-handoff-spec.md` — Exact implementation specs: theme.ts values, react-native-reanimated code snippets, NativeWind config, component layouts with pixel values, performance requirements, library versions

**READ ALL THREE DESIGN FILES BEFORE WRITING ANY UI CODE.** The founder specifically wants:
- Rich animations on EVERY interaction (spring physics, staggered reveals, parallax)
- Gradient-heavy design (hero gradients, sunset gradients, glass morphism)
- Skeleton loading screens (never spinners)
- Celebration animations on key moments (confetti on booking, star burst on reviews)
- 60fps minimum on all animations (use reanimated worklets, not setState)

---

## Quick Checklist Before Starting

- [ ] Supabase project created
- [ ] Database schema imported
- [ ] Environment variables set in .env.local
- [ ] Expo app scaffolded with TypeScript
- [ ] NativeWind configured (tailwind.config.js, tsconfig.json)
- [ ] Base color scheme in config/theme.ts
- [ ] Supabase client initialized in lib/supabase.ts
- [ ] Auth hooks created (useAuth, useAuthGuard)
- [ ] First route (auth) created
- [ ] App runs on web, iOS, Android without errors

---

## FAQ for Claude Code

**Q: Should I use Redux?**
A: No. Use Zustand (simple) or React Context. Supabase Realtime syncs data.

**Q: Should I use Apollo/GraphQL?**
A: No. Supabase PostgREST API is simpler. No extra abstraction needed.

**Q: Should I build a separate backend?**
A: No. Use Supabase Edge Functions. No Node.js server.

**Q: Should I use Microservices?**
A: No. Not for MVP. Monolith with Supabase is fine.

**Q: Should I build custom state management?**
A: No. Use Zustand or React Context + Supabase Realtime.

**Q: How do I handle offline?**
A: Phase 2+. Use AsyncStorage for draft states, sync when online.

**Q: Should I add push notifications?**
A: Phase 2. Use Expo Notifications with Supabase.

**Q: Should I implement image uploads from day 1?**
A: No. Phase 2. Use placeholder URLs first.

---

## Success Criteria

MVP is complete when:

1. ✅ Users can sign up (email) and sign in (email + Google)
2. ✅ Travelers can browse guides by city
3. ✅ Travelers can book a guide and pay with Razorpay
4. ✅ Guides can create itineraries
5. ✅ Guides can accept/decline booking requests
6. ✅ Travelers and guides can message in real-time
7. ✅ Travelers can review guides post-tour
8. ✅ App works on web (Vercel), iOS (TestFlight), Android (Play Store internal)
9. ✅ No critical bugs
10. ✅ Database RLS working correctly

---

## Final Notes

- **This is your compass.** When in doubt, refer back to this document.
- **Ask questions early.** If something is ambiguous, clarify before building.
- **Test on all platforms.** Web != iOS != Android. Test early and often.
- **Keep MVP scope tight.** Resist scope creep. Phase 2 & 3 wait.
- **Commit frequently.** Small, logical commits. Makes rollbacks easier.
- **Document as you go.** Update API docs, component props, business logic comments.

---

**You have everything you need. Start building.**

Good luck!
