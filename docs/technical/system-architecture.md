# Mumbai Buddies - System Architecture

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Component Breakdown](#component-breakdown)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [API Design](#api-design)
5. [Security & RLS](#security--rls)
6. [Deployment & Hosting](#deployment--hosting)
7. [MVP Scope & Phases](#mvp-scope--phases)
8. [Learning Path for Gaurav](#learning-path-for-gaurav)

---

## Architecture Overview

Mumbai Buddies is a two-sided marketplace connecting international travelers with local college student guides. The architecture is designed for **scalability**, **safety**, and **beginner-friendly code**.

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────┐         ┌──────────────────────────────┐   │
│   │   Next.js Web App        │         │  React Native / Expo Mobile  │   │
│   │  (Vercel Hosting)        │         │   (iOS & Android)            │   │
│   │                          │         │                              │   │
│   │ - Landing pages (SSR)    │         │ - Traveler booking flow      │   │
│   │ - Guide browsing         │         │ - Live GPS tracking          │   │
│   │ - Booking flow           │         │ - Real-time notifications    │   │
│   │ - Dashboard              │         │ - Expense logging            │   │
│   │ - Admin panel            │         │ - SOS alerts                 │   │
│   └──────────────────────────┘         └──────────────────────────────┘   │
│                                                                              │
│        All communicate via HTTPS with REST APIs & Realtime WebSockets       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Supabase)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Supabase Auth (PostgreSQL + Auth Service)                          │  │
│  │  - Email/password, Google OAuth, Apple Sign-In                      │  │
│  │  - Session management, JWT tokens                                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  PostgREST (Auto-generated REST APIs)                               │  │
│  │  - GET /rest/v1/guides                                              │  │
│  │  - POST /rest/v1/bookings                                           │  │
│  │  - Automatic filtering, pagination, RLS enforcement                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Edge Functions (Custom Server Logic)                               │  │
│  │  - POST /functions/match (matching algorithm)                       │  │
│  │  - POST /functions/create-booking (booking + payment)               │  │
│  │  - POST /functions/razorpay-webhook (payment confirmation)          │  │
│  │  - GET /functions/track-flight (flight status from FlightAware)    │  │
│  │  - POST /functions/sos-alert (emergency alert)                      │  │
│  │  - POST /functions/calculate-payout (earnings calculation)          │  │
│  │  - CRON: track-flights (every 15 min for active bookings)          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Realtime (WebSocket for live updates)                              │  │
│  │  - Chat messages (real-time sync)                                   │  │
│  │  - Location tracking (guide GPS live)                               │  │
│  │  - Notifications (push to users)                                    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Storage (File uploads)                                              │  │
│  │  - /guide_intros (video introductions)                               │  │
│  │  - /guide_photos (profile pictures)                                 │  │
│  │  - /receipts (expense receipt images)                               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER (Supabase PostgreSQL)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PostgreSQL Database with 16 tables:                                        │
│  - users, guide_profiles, traveler_profiles                                 │
│  - bookings, match_requests, itineraries, itinerary_stops                   │
│  - expenses, reviews, flight_tracking, location_tracking                    │
│  - invite_codes, messages, payouts, notifications, sos_alerts               │
│                                                                              │
│  Features:                                                                   │
│  - Row Level Security (RLS) policies for access control                      │
│  - Indexes on frequently queried columns                                     │
│  - Triggers for auto-updating timestamps                                    │
│  - Foreign key constraints for data integrity                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Razorpay       │  │   FlightAware    │  │   Google Maps    │
│   Payment API    │  │   AeroAPI        │  │   Platform       │
│                  │  │                  │  │                  │
│ - Process cards  │  │ - Flight status  │  │ - Maps display   │
│ - UPI payments   │  │ - Delay tracking │  │ - Directions     │
│ - Webhooks       │  │ - ETA updates    │  │ - Distance calc  │
│ - Refunds        │  │ - Polling every  │  │ - Route planning │
│                  │  │   15 minutes     │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘

                    ┌──────────────────┐
                    │  Firebase Cloud  │
                    │  Messaging (FCM) │
                    │                  │
                    │ - Push notif.    │
                    │ - Mobile alerts  │
                    └──────────────────┘
```

---

## Component Breakdown

### 1. **Next.js Web App** (Frontend - Browser)

**What it does:**
- Serves the website (SEO-friendly landing page + authentication pages)
- Guide profile browsing interface for travelers
- Booking flow (flight info → browse guides → pay)
- Dashboard for guides (see requests, manage bookings, earnings)
- Admin dashboard (for Gaurav to manage guides, disputes, payouts)

**Why we chose it:**
- Server-side rendering (SSR) for SEO (important for marketing)
- Client-side rendering for interactive app pages
- Built on React (popular, many developers know it)
- Vercel hosting is free for small projects
- Automatic deployments from GitHub

**How it connects:**
- Supabase Client library for auth & database queries
- REST API calls to Supabase for data
- Realtime subscriptions for live chat & location tracking
- Razorpay SDK for payment processing

**Key folders:**
```
web/
├── pages/              # Routes (landing, guides, booking, dashboard)
├── components/         # UI components (GuideCard, BookingFlow, etc)
├── lib/               # Supabase client, utilities, API helpers
├── public/            # Images, fonts
└── styles/            # CSS/Tailwind
```

**Beginner tips:**
- `pages/` = URL routes. `pages/guides.js` → yoursite.com/guides
- Use `useEffect` to fetch data from Supabase
- Use Supabase client for auth: `supabase.auth.signIn()`

---

### 2. **React Native / Expo Mobile App** (Frontend - Mobile)

**What it does:**
- Native iOS & Android apps for travelers and guides
- Traveler: Browse guides, book, track tour in real-time, log expenses
- Guide: Receive requests, accept/decline, track location, log expenses, get paid

**Why we chose it:**
- **Single codebase**: Write once, runs on iOS & Android
- **Expo managed workflow**: No native code needed (for MVP)
- Easy to ship to App Store & Play Store
- Good performance, native feel

**How it connects:**
- Same Supabase client (JavaScript SDK)
- Same backend, same data
- Realtime subscriptions for live updates
- Firebase Cloud Messaging for push notifications

**Key libraries:**
```
expo-router          # Navigation (like Next.js pages)
react-native-maps   # Maps display & GPS tracking
supabase-js         # Database client
expo-notifications  # Push notifications
razorpay-react-native # Payment processing
```

**Beginner tips:**
- Expo handles iOS/Android complexity (no Xcode/Android Studio needed)
- `expo start` to test on phone (scan QR code)
- Use `expo-location` for GPS tracking with user permission

---

### 3. **Supabase** (Backend - All-in-One)

Supabase is a "backend-as-a-service" that includes everything:

#### **3.1 Authentication**
- Users sign up with email or Google/Apple
- Automatic email verification
- Session management (JWT tokens)
- RLS (Row Level Security) for access control

```typescript
// Web/Mobile signup example
const { data, error } = await supabase.auth.signUp({
  email: 'traveler@example.com',
  password: 'securepassword'
});

// Sign in
const { data, error } = await supabase.auth.signIn({
  email: 'traveler@example.com',
  password: 'securepassword'
});
```

#### **3.2 Database (PostgreSQL)**
- 16 tables (see schema.sql)
- All queries go through PostgREST API
- Automatic CRUD endpoints

```typescript
// Fetch guides (auto-filtered by RLS & published status)
const { data, error } = await supabase
  .from('guide_profiles')
  .select('*, users(full_name, avatar_url)')
  .eq('is_active', true)
  .order('avg_rating', { ascending: false });

// Create a booking
const { data, error } = await supabase
  .from('bookings')
  .insert([{
    traveler_id: currentUser.id,
    guide_id: selectedGuide.id,
    itinerary_id: null, // custom request
    status: 'pending',
    buddy_cost: 2000,
    total_amount: 2500 // includes platform fee + GST
  }]);
```

#### **3.3 Edge Functions (Server-side Code)**
Custom Node.js functions for complex logic (matching, payments, flight tracking).

```typescript
// Edge Function: /functions/create-booking
// Triggered when traveler clicks "Book Now"
// Job: Create booking + Initiate Razorpay payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { traveler_id, guide_id, itinerary_id, buddy_cost } = await req.json();

  // Step 1: Create booking in database
  const { data: booking, error: dbError } = await supabase
    .from('bookings')
    .insert([{
      traveler_id,
      guide_id,
      itinerary_id,
      status: 'pending',
      buddy_cost
    }])
    .select()
    .single();

  if (dbError) return new Response(JSON.stringify({ error: dbError }), { status: 400 });

  // Step 2: Call Razorpay API to initiate payment
  const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(RAZORPAY_KEY + ':' + RAZORPAY_SECRET)}`
    },
    body: JSON.stringify({
      amount: (booking.total_amount * 100).toFixed(0), // Razorpay wants amount in paise
      currency: 'INR',
      receipt: booking.id,
      notes: { booking_id: booking.id }
    })
  });

  const razorpayOrder = await razorpayResponse.json();

  // Step 3: Return order details to frontend
  return new Response(JSON.stringify({
    booking_id: booking.id,
    razorpay_order_id: razorpayOrder.id
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

#### **3.4 Realtime (WebSocket)**
Live updates without polling:

```typescript
// Chat: Listen for new messages in real-time
const subscription = supabase
  .from(`messages:booking_id=eq.${bookingId}`)
  .on('*', (payload) => {
    console.log('New message:', payload.new);
    setMessages([...messages, payload.new]);
  })
  .subscribe();

// GPS: Listen for location updates
const locationSubscription = supabase
  .from(`location_tracking:booking_id=eq.${bookingId}`)
  .on('*', (payload) => {
    console.log('Guide location updated:', payload.new);
    updateMapMarker(payload.new.latitude, payload.new.longitude);
  })
  .subscribe();
```

#### **3.5 Storage (File Uploads)**
For images, videos, receipts:

```typescript
// Guide uploading profile photo
const { data, error } = await supabase
  .storage
  .from('guide_photos')
  .upload(`${guideId}/avatar.jpg`, imageFile);

const publicUrl = supabase
  .storage
  .from('guide_photos')
  .getPublicUrl(`${guideId}/avatar.jpg`).publicUrl;

// Later: Save publicUrl to database
await supabase
  .from('users')
  .update({ avatar_url: publicUrl })
  .eq('id', guideId);
```

---

### 4. **Razorpay** (Payment Processing)

Handles all payments securely.

**Why Razorpay:**
- Works in India (MasterCard, Visa, UPI, Netbanking)
- International cards supported
- Simple API & webhooks
- Compliant with Indian financial regulations

**Flow:**
1. Frontend calls Edge Function `/create-booking` with booking details
2. Edge Function creates Razorpay order
3. Frontend opens Razorpay payment modal (traveler enters card/UPI)
4. Razorpay processes payment securely
5. Razorpay sends webhook to `/functions/razorpay-webhook`
6. Edge Function verifies payment & updates booking status
7. Both traveler & guide get notified

```typescript
// Frontend: Razorpay integration
import RazorpayCheckout from 'react-razorpay';

const handlePayment = async () => {
  // Get Razorpay order from backend
  const response = await fetch('/api/create-booking', {
    method: 'POST',
    body: JSON.stringify({ guide_id, itinerary_id })
  });
  const { razorpay_order_id, booking_id } = await response.json();

  // Open Razorpay payment form
  const options = {
    key: RAZORPAY_KEY_ID,
    amount: totalAmount * 100, // in paise
    currency: 'INR',
    order_id: razorpay_order_id,
    handler: function(response) {
      console.log('Payment successful:', response.razorpay_payment_id);
      // Verify payment on backend
    }
  };
  
  const rzp = new window.Razorpay(options);
  rzp.open();
};
```

---

### 5. **FlightAware AeroAPI** (Flight Tracking)

Real-time flight status for on-time arrivals & departure coordination.

**What it does:**
- Fetch flight status every 15 minutes (via Supabase cron job)
- Detect delays & notify guide
- Help guide coordinate meet time

**How it's called:**
Edge Function `track-flights` runs on cron schedule (every 15 min).

```typescript
// Edge Function: /functions/track-flights (scheduled every 15 min)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // Get all active bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, arrival_flight_number, flight_tracking(id)')
    .eq('status', 'confirmed');

  for (const booking of bookings) {
    // Call FlightAware API
    const flightData = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/flights/${booking.arrival_flight_number}`,
      {
        headers: { 'Authorization': `Bearer ${FLIGHTAWARE_API_KEY}` }
      }
    ).then(r => r.json());

    // Update database
    await supabase
      .from('flight_tracking')
      .update({
        status: flightData.status,
        estimated_time: flightData.estimated_arrival_time,
        delay_minutes: flightData.delay || 0
      })
      .eq('booking_id', booking.id);

    // If delayed > 30 min, notify guide
    if (flightData.delay > 30) {
      await supabase
        .from('notifications')
        .insert([{
          user_id: booking.guide_id,
          type: 'flight_delayed',
          title: 'Flight Delayed',
          body: `Traveler's flight delayed by ${flightData.delay} minutes`,
          data: { booking_id: booking.id, delay_minutes: flightData.delay }
        }]);
    }
  }

  return new Response('OK', { status: 200 });
});
```

---

### 6. **Google Maps Platform** (Location & Navigation)

**Used for:**
- Maps display on booking/tour pages
- GPS tracking during tour
- Route planning (showing guide's itinerary on map)
- Distance Matrix API (travel time estimates)

```typescript
// Web: Display map with stops
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';

export function ItineraryMap({ stops, guideLiveLocation }) {
  return (
    <GoogleMap defaultZoom={14} defaultCenter={{ lat: 19.0760, lng: 72.8777 }}>
      {/* Itinerary stops */}
      {stops.map((stop) => (
        <Marker
          key={stop.id}
          position={{ lat: stop.location_lat, lng: stop.location_lng }}
          title={stop.name}
        />
      ))}

      {/* Guide's live location */}
      {guideLiveLocation && (
        <Marker
          position={{ lat: guideLiveLocation.lat, lng: guideLiveLocation.lng }}
          title="Guide's Location"
          icon={customIconUrl}
        />
      )}

      {/* Route line connecting stops */}
      <Polyline
        path={stops.map(s => ({ lat: s.location_lat, lng: s.location_lng }))}
        options={{ strokeColor: '#FF0000' }}
      />
    </GoogleMap>
  );
}
```

```typescript
// Mobile: Track guide's GPS
import * as Location from 'expo-location';

const trackGuideLocation = async () => {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  while (tourIsActive) {
    const location = await Location.getCurrentPositionAsync();
    
    // Upload to database
    await supabase
      .from('location_tracking')
      .insert([{
        booking_id: bookingId,
        user_id: currentUser.id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        recorded_at: new Date()
      }]);

    // Wait 30 seconds before next update
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
};
```

---

### 7. **Firebase Cloud Messaging (FCM)** (Push Notifications)

Send push notifications to mobile apps.

```typescript
// Backend: Send notification when booking confirmed
await admin.messaging().sendMulticast({
  tokens: [guideDeviceToken], // Device token stored in database
  notification: {
    title: 'New Booking!',
    body: `${travelerName} booked your ${itineraryTitle} tour`
  },
  data: {
    booking_id: bookingId,
    screen: 'booking_details' // Where to navigate when tapped
  }
});

// Frontend: Listen for incoming notifications
import * as Notifications from 'expo-notifications';

Notifications.addNotificationResponseReceivedListener(response => {
  const bookingId = response.notification.request.content.data.booking_id;
  navigation.navigate('BookingDetails', { bookingId });
});
```

---

## Data Flow Diagrams

### Flow 1: Traveler Booking a Guide

```
┌─────────────────────────────────────────────────────────────────┐
│ TRAVELER BOOKING FLOW (Happy Path)                              │
└─────────────────────────────────────────────────────────────────┘

1. BROWSE
   Traveler visits guides page
   → Web app calls: GET /guides?published=true&active=true
   → Database returns list of guides with ratings
   → Traveler sees: cards with photo, rating, price, category

2. VIEW GUIDE PROFILE
   Traveler clicks on guide
   → Web app calls: GET /guides/{id}/itineraries
   → Shows guide's itineraries (tours they offer)

3. SELECT ITINERARY & SEND REQUEST
   Traveler selects an itinerary
   → Fills form: arrival flight, departure flight, date
   → Clicks "Request This Guide"
   → Web app calls: POST /match-request
   → Creates match_request with status='sent'
   → Guide gets notification: "New booking request!"

4. GUIDE REVIEWS REQUEST (24-hour window)
   Guide receives notification
   → Opens mobile app
   → Sees request details (traveler profile, flight times, etc.)
   → Can accept, decline, or propose different price
   → If accept: match_request.status = 'accepted'

5. TRAVELER CONFIRMS & PAYS
   Traveler sees: "Guide accepted! Ready to book?"
   → Traveler clicks "Confirm Booking"
   → Web app calls: POST /create-booking (Edge Function)
   → Edge Function:
       a) Creates booking record (status='guide_accepted')
       b) Calls Razorpay API to create payment order
       c) Returns order ID to frontend
   → Frontend opens Razorpay payment modal
   → Traveler enters card/UPI details
   → Razorpay processes payment securely

6. PAYMENT CONFIRMATION
   Razorpay sends webhook to: POST /razorpay-webhook
   → Edge Function receives payment_id & verifies
   → If success:
       a) Updates booking.status = 'confirmed'
       b) Updates booking.payment_status = 'paid'
       c) Sends notification to guide: "Booking confirmed!"
       d) Sends notification to traveler: "Booking confirmed!"

7. PRE-TOUR MESSAGING
   Guide & traveler message via in-app chat
   → "What should I wear?"
   → "Where will we meet?"
   → Chat stored in messages table
   → Realtime updates via WebSocket

8. TOUR STARTS
   Guide & traveler meet
   → Guide starts tour in app: "Start Tour"
   → booking.status = 'in_progress'
   → GPS tracking begins

9. DURING TOUR
   → Guide logs expenses: lunch, Uber, museum entry
   → Traveler sees expenses in real-time
   → Guide's location updated every 30 sec
   → Traveler can see guide on map

10. TOUR ENDS
    Guide clicks "End Tour"
    → booking.status = 'completed'
    → GPS tracking stops
    → Expense finalization

11. BOTH REVIEW & RATE
    Guide rates traveler: 4 stars + comment
    → review table: reviewee_id=traveler, reviewer_id=guide
    Traveler rates guide: 5 stars + comment
    → review table: reviewee_id=guide, reviewer_id=traveler
    → guide_profiles.avg_rating recalculated

12. PAYMENT SETTLEMENT
    Nightly job calculates payouts:
    → Guide earned: buddy_cost - platform_fee(25%) - GST
    → Money transferred to guide's bank account
    → payout record created: status='completed'
```

### Flow 2: Guide Onboarding

```
┌──────────────────────────────────────────────────────────────┐
│ GUIDE ONBOARDING FLOW                                        │
└──────────────────────────────────────────────────────────────┘

1. SIGN UP
   Guide visits website: "Become a Guide"
   → Sign up with email or Google
   → Create account (user.role = 'guide')

2. FILL GUIDE PROFILE
   Guide fills form:
   → University, year of study, course
   → Bio, video introduction
   → Languages spoken, skills
   → Photos for profile
   → Created guide_profiles record

3. VERIFICATION (Automated + Manual)
   a) Aadhaar verification (government ID)
      → Integrate with Aadhaar API (or manual review)
      → guide_profiles.aadhaar_verified = true

   b) College verification
      → Check student email domain
      → Manual review: Gaurav checks college ID photo
      → guide_profiles.college_verified = true

   c) Interview (manual)
      → Gaurav calls guide on video/phone
      → Asks about experience, safety, commitment
      → guide_profiles.interview_passed = true

   d) Police verification (optional, Phase 2+)
      → For legal compliance if needed

4. ACTIVATE PROFILE
   Once all verifications pass:
   → guide_profiles.is_active = true
   → Profile appears in search results
   → Can start receiving booking requests

5. CREATE ITINERARIES
   Guide creates tours:
   → Title: "Street Food Walking Tour"
   → Duration: 3 hours
   → Price: Rs. 2000 per person
   → Category: food
   → Stops: Market → Street stall 1 → Stall 2 → Dessert place
   → Cover photo
   → Publish: itineraries.is_published = true

6. EARN REPUTATION
   After tours:
   → Travelers leave reviews
   → guide_profiles.avg_rating updates
   → guide_profiles.total_trips increases
   → Higher rating = more visibility in search

7. REFERRAL BONUS
   After 5 successful tours:
   → invite_codes_available += 1
   → Can give code to friend
   → Friend uses code during signup: referred_by = this guide
   → Both guides get bonus credit (implement later)
```

### Flow 3: Real-Time Location Tracking During Tour

```
┌──────────────────────────────────────────────────────────────┐
│ LIVE LOCATION TRACKING DURING TOUR                           │
└──────────────────────────────────────────────────────────────┘

1. TOUR STARTS
   Guide taps "Start Tour" in app
   → booking.status = 'in_progress'
   → Mobile app requests location permission
   → GPS tracking begins (every 30 seconds)

2. GUIDE'S LOCATION UPDATES
   Mobile app (background task):
   
   Every 30 seconds:
   ├─ Fetch current GPS position via GPS
   ├─ Upload to database:
   │  location_tracking table
   │  {booking_id, user_id, latitude, longitude, recorded_at}
   └─ Realtime broadcast via WebSocket

3. TRAVELER SEES LIVE LOCATION
   Traveler's app (web/mobile):
   
   ├─ Subscribed to location_tracking via Realtime
   ├─ Receives update every 30 seconds
   ├─ Updates map marker with new coordinates
   ├─ Blue dot = guide's current position
   └─ Shows ETA to next stop via Google Maps API

4. WHAT IF TRAVELER GETS LOST?
   Traveler in app: "I'm lost, where are you?"
   → Message sent in real-time
   → Guide sees notification
   → Guide shares live location link
   → Traveler navigates using map

5. SOS ALERT (EMERGENCY)
   If traveler feels unsafe:
   ├─ Tap "SOS" button
   ├─ Captures current location
   ├─ Creates sos_alerts record
   ├─ Alert sent to guide & Gaurav (admin)
   ├─ Status: 'triggered' → 'acknowledged' → 'resolved'
   └─ Important: Police can be contacted if needed

6. TOUR ENDS
   Guide taps "End Tour"
   ├─ GPS tracking stops
   ├─ Last location recorded
   ├─ booking.status = 'completed'
   └─ location_tracking data kept for reference
```

### Flow 4: Flight Delay Detection & Notification

```
┌──────────────────────────────────────────────────────────────┐
│ FLIGHT TRACKING & NOTIFICATION                               │
└──────────────────────────────────────────────────────────────┘

1. BOOKING CREATED
   booking.arrival_flight_number = "AI-101"
   booking.arrival_time = "2024-05-20 14:00 UTC"
   
   flight_tracking record created:
   {
     booking_id,
     flight_number: "AI-101",
     flight_type: "arrival",
     scheduled_time: "2024-05-20 14:00",
     status: "scheduled"
   }

2. CRON JOB RUNS (Every 15 minutes)
   Edge Function: /functions/track-flights
   
   For each active booking:
   ├─ Call FlightAware API:
   │  GET /aeroapi/flights/AI-101
   │  Response: {status: "delayed", delay: 45 minutes, eta: "14:45"}
   │
   ├─ Update flight_tracking record:
   │  {
   │    estimated_time: "2024-05-20 14:45",
   │    delay_minutes: 45,
   │    last_checked_at: now()
   │  }
   │
   └─ If delay > 30 minutes AND hasn't notified yet:
      ├─ Create notification for guide
      ├─ Send push via FCM
      ├─ Message: "Traveler's flight delayed by 45 min. New ETA: 14:45"
      └─ Guide can adjust meet time accordingly

3. GUIDE RECEIVES NOTIFICATION
   Mobile push notification:
   "Flight Update: AI-101 delayed by 45 min"
   
   Guide taps notification:
   ├─ Sees updated arrival time
   ├─ Messages traveler: "No worries, I'll see you at 14:45"
   ├─ Adjusts own schedule
   └─ Both parties stay synced

4. FLIGHT LANDS
   FlightAware API shows: status = "landed", actual_time = "14:45"
   
   flight_tracking updated:
   {
     status: "landed",
     actual_time: "2024-05-20 14:45",
     delay_minutes: 45
   }
   
   Guide gets final notification: "Traveler's flight has landed!"

5. DATA FOR FUTURE
   flight_tracking data kept for:
   ├─ Analytics (how often are flights delayed?)
   ├─ Debugging (if tour had issues, check flight status)
   └─ Reporting (traveler can see delay history)
```

---

## API Design

### Supabase Auto-Generated REST APIs

Most CRUD operations go through PostgREST (auto-generated from database schema):

```
GET    /rest/v1/guide_profiles              # List all guides
GET    /rest/v1/guide_profiles?id=eq.{id}   # Get one guide
POST   /rest/v1/guide_profiles              # Create guide profile
PATCH  /rest/v1/guide_profiles?id=eq.{id}  # Update guide profile
DELETE /rest/v1/guide_profiles?id=eq.{id}  # Delete guide profile

GET    /rest/v1/bookings?traveler_id=eq.{id} # Get traveler's bookings
POST   /rest/v1/bookings                     # Create booking
```

All requests include headers:
```
Authorization: Bearer {jwt_token}  # Supabase auth token
apikey: {supabase_anon_key}       # Supabase anonymous key
```

Example:
```typescript
const { data, error } = await supabase
  .from('bookings')
  .select('*, guides:guide_id(full_name, avatar_url)')
  .eq('traveler_id', currentUser.id)
  .order('created_at', { ascending: false });
```

### Custom Edge Functions

For complex logic, we write Edge Functions (TypeScript/JavaScript):

#### 1. **POST /functions/match**
Find 3 best guide matches for a traveler.

```typescript
// Request
POST /functions/match
Body: {
  traveler_id: "uuid",
  arrival_time: "2024-05-20T14:00Z",
  departure_time: "2024-05-21T08:00Z",
  preferred_categories: ["food", "history"],
  budget_min: 1000,
  budget_max: 5000
}

// Response
{
  matches: [
    {
      guide_id: "uuid",
      guide_name: "Ravi",
      avatar_url: "...",
      avg_rating: 4.8,
      total_trips: 25,
      match_score: 95, // 0-100
      reason: "5-star rated, speaks your preferred language, available"
    },
    { ... },
    { ... }
  ]
}

// Algorithm (simplified):
// 1. Filter: guides.is_active = true, has itineraries in category
// 2. Score based on:
//    - Distance (guides close to airport score higher)
//    - Rating (higher = better)
//    - Availability (schedule matches traveler's window)
//    - Language match
//    - Reviews mentioning safety/punctuality
// 3. Return top 3
```

#### 2. **POST /functions/create-booking**
Create booking and initiate payment.

```typescript
// Request
POST /functions/create-booking
Body: {
  traveler_id: "uuid",
  guide_id: "uuid",
  itinerary_id: "uuid",
  buddy_cost: 2000,
  estimated_expenses: 500
}

// Response
{
  booking_id: "uuid",
  razorpay_order_id: "order_xxx",
  total_amount: 2625 // buddy_cost + platform_fee(25%) + GST(18%)
}

// What happens:
// 1. Create bookings record
// 2. Call Razorpay API
// 3. Return order ID to frontend for payment modal
```

#### 3. **POST /functions/razorpay-webhook**
Handle Razorpay payment success/failure.

```typescript
// Razorpay calls this webhook with payment details
POST /functions/razorpay-webhook
Body: {
  event: "payment.authorized",
  payload: {
    payment: {
      entity: "payment",
      id: "pay_xxxxx",
      amount: 262500, // in paise
      notes: { booking_id: "uuid" }
    }
  }
}

// What happens:
// 1. Verify signature (Razorpay → backend secret)
// 2. Update booking.payment_status = 'paid'
// 3. Update booking.status = 'confirmed'
// 4. Send notifications to guide & traveler
// 5. Start flight tracking cron job
```

#### 4. **GET /functions/track-flight/:booking_id**
Get live flight status from FlightAware.

```typescript
// Request
GET /functions/track-flight/booking_uuid

// Response
{
  flight_number: "AI-101",
  scheduled_time: "2024-05-20T14:00Z",
  estimated_time: "2024-05-20T14:45Z",
  status: "delayed",
  delay_minutes: 45,
  last_checked_at: "2024-05-20T13:50Z"
}
```

#### 5. **POST /functions/sos-alert**
Trigger emergency alert.

```typescript
// Request
POST /functions/sos-alert
Body: {
  booking_id: "uuid",
  latitude: 19.0760,
  longitude: 72.8777,
  message: "I feel unsafe"
}

// What happens:
// 1. Create sos_alerts record with status='triggered'
// 2. Send notification to guide: "Traveler sent SOS"
// 3. Send notification to admin (Gaurav): "SOS triggered"
// 4. Include location so admin can see where they are
```

#### 6. **POST /functions/calculate-payout**
Calculate guide earnings after tour completes.

```typescript
// Request
POST /functions/calculate-payout
Body: {
  booking_id: "uuid"
}

// Response
{
  buddy_cost: 2000,
  platform_fee: 500, // 25%
  gst: 90, // 18% of platform fee
  actual_expenses: 350,
  guide_earnings: 1450, // buddy_cost - platform_fee
  traveler_pays: 2625
}
```

---

## Security & RLS

### Authentication Flow

1. **Frontend** (Web or Mobile)
   ```typescript
   const { data, error } = await supabase.auth.signUp({
     email: 'user@example.com',
     password: 'securepassword'
   });
   // Returns: user object + JWT token
   ```

2. **JWT Token** (stored in browser/mobile)
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Every API request** includes token
   ```typescript
   const { data } = await supabase
     .from('bookings')
     .select('*')
     .eq('traveler_id', currentUser.id);
   // Token is auto-attached by Supabase client
   ```

4. **Backend verifies token** (Supabase handles this)
   - Checks signature
   - Checks expiration
   - Passes `auth.uid()` to RLS policies

### Row Level Security (RLS) Examples

```sql
-- Only travelers can see their own bookings
CREATE POLICY "Travelers see own bookings" ON bookings FOR SELECT
  USING (auth.uid() = traveler_id);

-- Only guides can see their own bookings
CREATE POLICY "Guides see own bookings" ON bookings FOR SELECT
  USING (auth.uid() = guide_id);

-- Only guides can update their own profile
CREATE POLICY "Guides update own profile" ON guide_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Everyone can see published guide profiles (for browsing)
CREATE POLICY "Published guides visible" ON guide_profiles FOR SELECT
  USING (true);
```

### Data Encryption

- **In transit**: All APIs use HTTPS (encrypted)
- **At rest**: Supabase PostgreSQL has encryption by default
- **Sensitive data** (bank details, Aadhaar): Use Supabase Vault (encrypt at app level)

```typescript
// Example: Encrypt sensitive guide data before storing
import { encrypt } from 'libsodium.js';

const encryptedBankDetails = encrypt(
  bankDetails,
  encryptionKey
);

await supabase
  .from('payouts')
  .update({ bank_details_encrypted: encryptedBankDetails })
  .eq('id', payoutId);
```

---

## Deployment & Hosting

### Frontend Hosting

**Next.js Web App: Vercel**
- Free tier (up to 100 deployments/month)
- Auto-deploys on GitHub push
- Custom domain support
- Serverless functions for Edge Functions

```bash
# Deploy
git push origin main
# Vercel auto-deploys

# Set environment variables in Vercel dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
```

**React Native: Expo EAS Build**
- Free tier for testing
- `eas build --platform ios` → builds iOS app
- `eas build --platform android` → builds Android app
- Submits to App Store & Play Store

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build
eas build --platform ios
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### Backend Hosting

**Supabase**
- Free tier: 50K monthly active users, 500MB database, 1GB storage
- Paid tier: $25/month → 200K users, 8GB database, 100GB storage
- Hosted on AWS regions globally

**Cost estimate at launch:**
```
Free tier:
├─ Database: 500MB (plenty for MVP)
├─ Storage: 1GB (for guide photos/videos)
├─ Edge Functions: 500K invocations/month free
├─ Auth: unlimited users
└─ Total: $0/month

Growing phase (Phase 2-3):
├─ Database grows → upgrade to Pro ($25/month)
├─ Edge Function invocations increase
└─ Total: ~$50-100/month at scale
```

### Domain & DNS

```
Domain: mumbaibuddies.com (or layoverbuddies.com)

DNS Setup:
├─ Point A record to Vercel
├─ Set CNAME for subdomains
├─ Use Supabase custom domain for API
└─ Set up email via SendGrid for transactional emails
```

---

## MVP Scope & Phases

### Phase 1: Web App MVP (Weeks 1-4)

**What's included:**
- Landing page (marketing + features)
- Guide sign-up & profile creation
- Traveler sign-up & browsing
- Basic booking (select guide → pay → done)
- Guide dashboard (see requests, accept/decline)
- Payment via Razorpay
- Admin panel (Gaurav only): manage guides, see payouts

**What's NOT included:**
- Mobile app
- Real-time GPS tracking
- Matching algorithm (manual matching in dashboard)
- Expense tracking
- Detailed reviews
- Flight tracking

**Why this scope:**
- Launch fast with 5-10 guides (college friends)
- Test product-market fit
- Get real feedback from users
- Iteratively improve

**Launch checklist:**
```
☑ Database schema deployed to Supabase
☑ Authentication working (email + Google)
☑ Guide profiles complete and verified
☑ 5-10 test bookings completed successfully
☑ Razorpay payment tested (sandbox mode)
☑ Email notifications working
☑ Landing page SEO-optimized
☑ Privacy policy & terms of service
```

### Phase 2: Core Features (Weeks 5-8)

**Add:**
- Matching algorithm (auto-match 3 guides based on algorithm)
- In-app chat between traveler & guide
- Expense tracking during tour
- Review & rating system
- Flight tracking & delay notifications
- More detailed guide profiles

**Why now:**
- MVP proved concept works
- Guides comfortable with platform
- Need automation for scaling

### Phase 3: Mobile + Scale (Weeks 9-16)

**Add:**
- React Native mobile app for iOS & Android
- Real-time GPS tracking during tours
- Push notifications via FCM
- SOS alerts
- Guide invite/referral system
- Payout system (auto-transfer guide earnings)

**Why last:**
- Web MVP works first
- Mobile is complex, needs stable backend
- Referral system only makes sense once guides love product

---

## Learning Path for Gaurav

Since you're learning as you build, here's a recommended learning order:

### Week 1: Next.js Fundamentals
**Goal:** Understand how Next.js works (routing, components, data fetching)

**Resources:**
- [Next.js Tutorial: From Zero to Deploy](https://nextjs.org/learn) (official, free, 2-3 hours)
- Key concepts:
  - File-based routing (`pages/` folder)
  - React components
  - `getStaticProps` vs `getServerSideProps`
  - API routes (`pages/api/`)

**Hands-on:**
- Create a basic page at `/guides` that lists guides (mock data)
- Create a page at `/guides/[id]` that shows one guide
- Add a button that logs "clicked" to console

### Week 2: React Basics
**Goal:** Solid React fundamentals (components, hooks, state management)

**Resources:**
- [React Official Tutorial](https://react.dev/learn) (free, interactive)
- Key concepts:
  - Functional components
  - `useState` hook
  - `useEffect` hook
  - Props & lifting state up

**Hands-on:**
- Create a GuideCard component (reusable)
- Create a GuideList component with map()
- Add filter by category

### Week 3: Supabase Fundamentals
**Goal:** Connect to real database, understand authentication, RLS

**Resources:**
- [Supabase Getting Started](https://supabase.com/docs/guides/getting-started) (free)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- Key concepts:
  - Creating tables in Supabase dashboard
  - Supabase client setup
  - `supabase.from().select()`, `.insert()`, `.update()`
  - User authentication flow
  - RLS policies

**Hands-on:**
- Deploy `schema.sql` to Supabase
- Sign up as a guide in your app
- Fetch guides from database (not mock data)
- Display real guide ratings

### Week 4: Payment Integration
**Goal:** Understand Razorpay integration

**Resources:**
- [Razorpay Documentation](https://razorpay.com/docs/payments/) (excellent, with code samples)
- [Razorpay React Integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/integrate-checkout/)
- Key concepts:
  - Creating payment orders on backend
  - Opening payment modal on frontend
  - Webhook handling (payment confirmation)

**Hands-on:**
- Test Razorpay in sandbox mode
- Complete a booking → payment flow
- Verify booking status updates after successful payment

### Weeks 5-6: Supabase Edge Functions
**Goal:** Write custom server logic (matching, webhooks, cron jobs)

**Resources:**
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) (docs)
- [Deno Documentation](https://deno.land/manual) (Edge Functions run on Deno)
- Key concepts:
  - TypeScript/JavaScript on server
  - HTTP requests
  - Database queries from server
  - Environment variables (secrets)

**Hands-on:**
- Write `/functions/create-booking` (create booking + call Razorpay)
- Write `/functions/razorpay-webhook` (handle payment confirmation)
- Test locally with `supabase functions serve`

### Weeks 7-8: Realtime & Chat
**Goal:** Live updates without page refresh

**Resources:**
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- Key concepts:
  - WebSocket subscriptions
  - Listening for database changes
  - Broadcasting messages

**Hands-on:**
- Implement in-app chat (messages table)
- Both users see messages in real-time
- Notification badge updates when new message arrives

### Weeks 9-10: React Native & Expo
**Goal:** Mobile app for iOS/Android

**Resources:**
- [Expo Getting Started](https://docs.expo.dev/get-started/introduction/) (free, comprehensive)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- Key concepts:
  - Expo managed workflow
  - React Native components (View, Text, ScrollView)
  - Navigation (React Navigation)
  - Permissions (location, camera, etc.)

**Hands-on:**
- Create a simple "Browse Guides" screen
- Add Google Maps with marker for guide's itinerary
- Connect to same Supabase backend as web app

### Weeks 11-12: Advanced Features
- GPS tracking during tours (expo-location)
- Push notifications (FCM + expo-notifications)
- Flight tracking (call FlightAware API)
- SOS alerts

**Final Tips:**
1. **Start with Next.js, not React Native.** Web is simpler to test & deploy.
2. **Use Supabase dashboard** to inspect data while developing. Check that RLS policies work.
3. **Test Razorpay in sandbox mode** before going live.
4. **Don't build the matching algorithm first.** Start with manual matching in admin dashboard.
5. **Deploy MVP to Vercel early.** Get feedback from real guides & travelers.
6. **Use TypeScript** even if you don't know it yet. It catches bugs & helps you learn.
7. **Read Supabase docs** whenever confused. They're very good.

---

## Tech Stack Summary

| Layer | Technology | Why | Cost |
|-------|-----------|-----|------|
| **Web Frontend** | Next.js (React) | SSR for SEO, easy deployment | Free |
| **Mobile Frontend** | React Native / Expo | Single codebase, native feel | Free |
| **Backend** | Supabase (PostgreSQL) | All-in-one (auth, DB, realtime, storage) | Free tier → $25/mo |
| **API** | PostgREST + Edge Functions | Auto-generated + custom logic | Included in Supabase |
| **Authentication** | Supabase Auth | Email, Google, Apple sign-in | Free |
| **Payments** | Razorpay | Cards, UPI, easy webhooks | 2% transaction fee |
| **Flight Tracking** | FlightAware AeroAPI | Real-time flight data | $30-50/month |
| **Maps** | Google Maps Platform | Display, routing, distance | Free tier → $7/1000 requests |
| **Push Notifications** | Firebase Cloud Messaging | Mobile push alerts | Free |
| **Hosting (Web)** | Vercel | Serverless, auto-deploy from GitHub | Free tier → $20/mo |
| **Domain** | Namecheap / Google Domains | Domain registration | $10-15/year |
| **Email** | SendGrid (or Supabase built-in) | Transactional emails | Free tier (100/day) → paid |

**Total estimated cost at launch: $0-50/month (all free tiers)**

---

## FAQ for Gaurav

**Q: Should I learn TypeScript?**
A: Yes. It catches bugs early & makes code more readable. Supabase docs have good TypeScript examples.

**Q: Can I use different tech stack?**
A: Sure, but Supabase really is the best choice for MVP (auth + DB + realtime + storage in one place).

**Q: How do I handle concurrent bookings (two travelers booking same guide)?**
A: Database constraints & RLS. A booking is locked to guide_id + status. Once guide accepts, they can't accept another until first completes.

**Q: What if payment fails mid-booking?**
A: Razorpay webhook confirms payment. If no webhook after 30 min, booking auto-cancels (cleanup job). Traveler can retry.

**Q: How do I prevent guide abuse (unsafe behavior)?**
A: Reviews & ratings. Low-rated guides disappear from search. Also, SOS alerts go to admin (you) for immediate action.

**Q: How do I scale to 1000 guides?**
A: Supabase Pro tier handles it. After that, consider sharding by city or migrating to managed PostgreSQL.

**Q: When should I hire developers?**
A: After MVP proves concept. Then you can focus on product/growth, not code.

---

**Last updated:** April 2024 | Designed for Mumbai Buddies MVP
