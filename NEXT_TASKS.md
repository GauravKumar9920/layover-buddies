# Mumbai Buddies — Next Tasks for Claude Code

This document contains the next set of tasks to execute in priority order. Each task is self-contained with context, acceptance criteria, and technical details. Work through them sequentially — each depends on the previous task working correctly.

**Prerequisites already completed:**
- Schema/query mismatch fixed across all `mobile/lib/api/` files
- Seed data added via `supabase/seed.sql` (5 guides, itineraries, bookings, reviews, messages)
- Row Level Security policies applied to all tables
- `.gitignore` in place

**Reference files to always consult:**
- `/Users/gaurav/Desktop/mumbai-buddies/CLAUDE.md` — project overview, stack, conventions
- `/Users/gaurav/Desktop/mumbai-buddies/design/brand/design-system.md` — colors, typography, spacing
- `/Users/gaurav/Desktop/mumbai-buddies/design/brand/design-handoff-spec.md` — component specs
- `/Users/gaurav/Desktop/mumbai-buddies/mobile/config/theme.ts` — design tokens in code
- `/Users/gaurav/Desktop/mumbai-buddies/mobile/types/index.ts` — all TypeScript data models
- `/Users/gaurav/Desktop/mumbai-buddies/schema.sql` — database schema

---

## Task 0 — Smoke Test (Do This First)

**Goal:** Verify the foundational work (schema fix, seed data, RLS policies) actually works end-to-end before building new features.

**Steps:**
1. Start the Expo dev server: `npm --prefix /Users/gaurav/Desktop/mumbai-buddies/mobile run start`
2. Open iOS Simulator and press `i` in the Expo terminal
3. Walk through the following flows and document what breaks:
   - Signup as a traveler → verify user record created in Supabase
   - Login as the seeded traveler
   - Browse guides screen loads with seeded guides
   - Tap a guide → view their profile with itineraries and reviews
   - Attempt to navigate to the book screen
   - Log out, sign up as a guide, verify you see guide-side routes

**Acceptance criteria:**
- No 400/401/403 errors in the Metro/Expo logs
- All seeded data is visible in the correct screens
- RLS policies don't block legitimate reads
- A markdown file `SMOKE_TEST_RESULTS.md` is created at the project root documenting what works and what fails

**If issues are found:** fix them before moving to Task 1. Common issues will be RLS policies being too strict, missing joins, or seed data not matching expected field names.

---

## Task 1 — Complete the Booking Flow UI

**Goal:** Enable a traveler to complete a full booking from picking a guide to creating a booking record.

**Files to modify:**
- `mobile/app/(traveler)/book/[guideId].tsx` — main booking screen (currently scaffolded/incomplete)
- `mobile/lib/api/bookings.ts` — verify `createBooking` function handles all needed fields
- `mobile/app/(traveler)/trips/[id].tsx` — destination after successful booking

**What the booking screen must do:**
1. On mount, fetch the guide's profile and their itineraries using existing API functions
2. Display the guide's name, avatar, rating, and a header matching the design system (hero gradient: Deep Teal `#0D7377` to Dark Charcoal `#1A1A2E`)
3. Show a horizontal scroll of itinerary cards (288dp wide, 16:9 aspect ratio) — user selects one
4. Below, show flight details inputs:
   - Arrival date/time picker
   - Departure date/time picker
   - Flight number (optional)
   - Number of travelers (default 1)
5. Show a price breakdown card:
   - Buddy fee (from selected itinerary)
   - Estimated expenses (flat or percentage — use 30% of buddy fee as placeholder)
   - Platform commission (15% of buddy fee — this is the business logic, configurable via `config/constants.ts`)
   - Total
6. At the bottom, a fixed "Confirm Booking" button (Warm Coral `#FF6B6B`, rounded 16px, h-14)
7. On tap: call `createBooking()` from the API layer with status `pending`
8. On success: navigate to `/(traveler)/trips/[id]` showing the new booking
9. On error: show an error message inline (use the Input/error pattern from the design handoff spec)

**Animation & UX requirements:**
- Button press scale: 0.96 with spring (damping: 15, stiffness: 150)
- Haptic feedback on button press (already configured in `lib/haptics.ts`)
- Loading state on the button while API call is in flight
- Skeleton loading for the guide info while fetching

**Acceptance criteria:**
- A new booking record appears in the Supabase `bookings` table with status `pending`
- The traveler is redirected to the trip details screen after booking
- The trips list at `/(traveler)/trips` shows the new booking
- Guide can see the pending request (verify via Supabase studio or by switching accounts)

---

## Task 2 — Razorpay Test Mode Integration

**Goal:** Wire up payment processing using Razorpay's test mode. No real money moves; use dummy cards.

**Before coding:**
1. Ask the user (Gaurav) to sign up at https://razorpay.com with gaurav.og.9920@gmail.com
2. Instruct him to navigate to Settings → API Keys → Generate Test Key
3. He provides the `rzp_test_xxxxx` key ID and secret

**Files to modify/create:**
- `mobile/.env.local` — add `EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx`
- `mobile/.env.local.example` — add the variable name as reference
- `mobile/lib/api/payments.ts` — implement `createPaymentOrder()` and `verifyPayment()`
- `mobile/app/(traveler)/book/[guideId].tsx` — trigger payment after booking creation
- Potentially a new screen `mobile/app/(traveler)/book/payment/[bookingId].tsx` if payment needs its own screen

**Implementation approach:**
1. When booking is created (Task 1), the booking row starts in `payment_pending` status
2. Immediately call Razorpay to create an order for the booking total
3. Open the Razorpay checkout UI (use `react-native-razorpay` or the web checkout for Expo)
4. On successful payment callback, update booking status to `payment_completed` and guide status changes to `awaiting_confirmation`
5. On failure, keep booking as `payment_pending` with a retry option

**Test cards to document in the README:**
- Success: `4111 1111 1111 1111`, any future expiry, any CVV
- Failure: `5104 0600 0000 0008`
- 3D Secure: `5104 0155 5555 5558`

**Acceptance criteria:**
- Full booking + payment flow works end-to-end in test mode
- Razorpay dashboard shows test transactions
- Booking records correctly reflect payment status
- User can retry a failed payment

---

## Task 3 — Guide-Side Core Screens

**Goal:** Make the guide role functional so seeded guides (and future real guides) can operate on the platform.

**Files to build:**
- `mobile/app/(guide)/index.tsx` — guide dashboard
- `mobile/app/(guide)/requests.tsx` — incoming booking requests with accept/decline
- `mobile/app/(guide)/profile.tsx` — edit own profile (already scaffolded, needs completion)
- `mobile/app/(guide)/itineraries/index.tsx` — list of guide's itineraries
- `mobile/app/(guide)/itineraries/create.tsx` — create new itinerary form
- `mobile/app/(guide)/itineraries/[id].tsx` — edit existing itinerary

**Dashboard (`(guide)/index.tsx`):**
- Greeting ("Good morning, Priya 👋")
- Today's bookings count + upcoming bookings list
- Pending requests count with badge
- Earnings this week/month (sum from completed bookings)
- Quick-action cards: "New itinerary," "View requests," "Edit profile"
- Pull-to-refresh

**Requests screen (`(guide)/requests.tsx`):**
- List of bookings where this guide is assigned and status is `pending` or `payment_completed`
- Each request card shows: traveler name, flight timing, selected itinerary, total amount (guide's portion)
- Accept button → updates booking to `guide_accepted`, triggers notification to traveler
- Decline button → updates booking to `declined` with optional reason

**Create itinerary (`(guide)/itineraries/create.tsx`):**
- Form fields: title, description, duration (hours), price, meeting point, category tags, photo uploads (max 5)
- Photo uploads go to Supabase Storage under `itinerary-photos/` bucket
- On submit: create record in `itineraries` table with `is_published = false` initially
- Toggle to publish/unpublish from the list view

**Acceptance criteria:**
- Login as a seeded guide shows the dashboard with their data
- Guide can accept a pending booking → traveler sees status update
- Guide can create a new itinerary that appears in their profile immediately
- Photo uploads work to Supabase Storage

---

## Task 4 — Messaging UI

**Goal:** Let travelers and guides message each other within a booking context.

**Files to modify:**
- `mobile/app/(shared)/messages/[bookingId].tsx` — main messaging screen
- `mobile/lib/hooks/useMessages.ts` — verify real-time subscription works
- `mobile/lib/api/messages.ts` — verify send/fetch functions

**Screen requirements:**
- Header showing the other party's name and avatar (use Header component)
- Message list with inverted FlatList (newest at bottom)
- Message bubbles: own messages right-aligned in Teal, other party left-aligned in light gray
- Timestamps shown on hover or as subtle text below bubbles
- Text input at bottom with send button
- Real-time updates via Supabase subscription (messages from other party appear without refresh)
- Auto-scroll to bottom on new message
- Empty state when no messages yet

**Navigation:**
- Messages screen reachable from booking details for both traveler and guide
- Unread message indicator on the booking card

**Acceptance criteria:**
- Two test accounts (one traveler, one guide) can exchange messages in real-time
- Messages persist in the database
- Opening a booking shows the message thread
- RLS policies allow only the booking's traveler and guide to see messages

---

## Task 5 — Review Submission Flow

**Goal:** After a trip is completed, the traveler can leave a review for the guide.

**File to build:**
- `mobile/app/(traveler)/trips/review/[id].tsx`

**Requirements:**
- Accessible only when booking status is `completed`
- Star rating component (1-5 stars, use existing `StarRating.tsx`)
- Optional comment text area (min 0, max 500 chars)
- Optional photo attachments
- Submit button creates a record in `reviews` table
- After submission, redirect back to trip details with the review displayed
- Prevent double reviews (check if review already exists for this booking)

**Acceptance criteria:**
- Review appears on guide's profile immediately after submission
- Guide's aggregate rating updates
- Traveler cannot submit a second review for the same booking

---

## Task 6 — Admin Panel (Optional — Can Use Retool Instead)

**Goal:** Give Gaurav oversight of the entire platform.

**Two options — discuss with user before starting:**

**Option A — Retool/Appsmith (fastest, 1 day):**
- Sign up at retool.com with gaurav.og.9920@gmail.com
- Connect Supabase as a data source
- Build dashboard screens: users list, bookings list, guide approval queue, revenue summary
- No code needed — drag-and-drop UI
- Result: a hosted admin panel Gaurav can access from any browser

**Option B — Custom React admin (slower, 3-5 days):**
- Create `/admin/` directory at project root
- Vite + React + Tailwind (same stack as marketing site)
- Use Supabase service role key (never expose to client — keep in admin app only)
- Build routes: `/admin/users`, `/admin/bookings`, `/admin/guides`, `/admin/analytics`
- Protect with a simple password or Supabase admin auth

**Recommendation:** Go with Retool. Saves weeks of work, Gaurav can focus on the mobile app.

---

## Task 7 — Cross-Cutting: Platform Commission & Business Logic

**Goal:** Centralize business rules so they can be tuned in one place.

**File to modify:**
- `mobile/config/constants.ts`

**Add constants:**
```typescript
export const PLATFORM_COMMISSION_PERCENT = 15; // 15% of buddy fee
export const ESTIMATED_EXPENSES_PERCENT = 30; // 30% of buddy fee as starter estimate
export const MIN_BOOKING_NOTICE_HOURS = 4; // can't book less than 4 hours before arrival
export const MAX_BOOKING_ADVANCE_DAYS = 90; // can't book more than 90 days ahead
export const SUPPORTED_CITIES = ['Mumbai']; // for now
export const CURRENCY = 'INR';
export const CURRENCY_SYMBOL = '₹';
```

These values are used across the booking flow, payment calculations, and validation. Ask the user to confirm the commission percentage before hardcoding.

---

## Order of Execution

Do tasks in this order, completing each before starting the next:

1. **Task 0 — Smoke Test** (blocking; verify foundation)
2. **Task 7 — Business logic constants** (quick; unblocks Task 1)
3. **Task 1 — Booking flow UI**
4. **Task 2 — Razorpay integration** (requires Task 1)
5. **Task 5 — Review flow** (easier; do it while Razorpay is being set up)
6. **Task 3 — Guide-side screens** (can be partially parallel with 1-2)
7. **Task 4 — Messaging UI**
8. **Task 6 — Admin panel** (last, after flows work)

---

## What NOT to do yet

These are intentionally deferred — do not work on them:

- Cosmetic rework of existing screens (will be done holistically later)
- Marketing website color/font alignment (deferred to Week 4)
- Google Maps live tracking (deferred until basic flows work)
- Push notifications (deferred)
- SMS/WhatsApp notifications (deferred)
- Production deployment, domain purchase, app store submission

---

## After Each Task

After completing a task, update `CLAUDE.md`:
- Mark the TODO as done
- Note any architectural decisions made
- Flag any new TODOs discovered during implementation
- Update `SMOKE_TEST_RESULTS.md` with any new issues found

Commit frequently with clear messages (e.g., `feat(booking): complete booking flow UI`, `fix(rls): loosen guide profile read policy`).
