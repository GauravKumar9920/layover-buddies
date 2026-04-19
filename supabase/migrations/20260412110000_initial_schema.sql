-- ============================================================================
-- MUMBAI BUDDIES DATABASE SCHEMA
-- PostgreSQL with Supabase RLS (Row Level Security)
-- ============================================================================
-- This schema defines the complete data model for Mumbai Buddies marketplace.
-- Clear comments and RLS policies make it beginner-friendly for Gaurav.
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "moddatetime"; -- For auto-updating updated_at timestamps

-- ============================================================================
-- ENUMS (Custom Types)
-- ============================================================================

-- User role in the system
CREATE TYPE user_role AS ENUM ('traveler', 'guide', 'admin');

-- Authentication provider (how they signed up)
CREATE TYPE auth_provider AS ENUM ('email', 'google', 'apple');

-- Booking status throughout its lifecycle
CREATE TYPE booking_status AS ENUM (
  'pending',           -- Traveler sent request to guide, awaiting response
  'guide_accepted',    -- Guide accepted but traveler hasn't confirmed yet
  'confirmed',         -- Payment done, booking confirmed
  'in_progress',       -- Tour is happening now
  'completed',         -- Tour finished
  'cancelled',         -- Booking was cancelled
  'disputed'           -- Dispute raised by traveler or guide
);

-- Payment status
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'partial_refund');

-- Match request status (3-at-a-time matching system)
CREATE TYPE match_status AS ENUM ('sent', 'viewed', 'accepted', 'declined', 'expired');

-- Itinerary category
CREATE TYPE itinerary_category AS ENUM ('food', 'culture', 'history', 'nightlife', 'photography', 'adventure', 'custom');

-- Stop category within an itinerary
CREATE TYPE stop_category AS ENUM ('food', 'attraction', 'transport', 'shopping', 'experience');

-- Expense category
CREATE TYPE expense_category AS ENUM ('food', 'transport', 'entry_fee', 'shopping', 'other');

-- Flight status
CREATE TYPE flight_status AS ENUM ('scheduled', 'delayed', 'landed', 'departed', 'cancelled');

-- Flight type (arrival or departure)
CREATE TYPE flight_type AS ENUM ('arrival', 'departure');

-- SOS alert status
CREATE TYPE sos_status AS ENUM ('triggered', 'acknowledged', 'resolved');

-- Payout status
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Payout method
CREATE TYPE payout_method AS ENUM ('bank_transfer', 'upi');

-- Notification type
CREATE TYPE notification_type AS ENUM (
  'match_request',
  'booking_confirmed',
  'flight_delayed',
  'tour_starting',
  'review_received',
  'payout_completed',
  'invite_earned',
  'sos_alert'
);

-- ============================================================================
-- USERS TABLE - Base table for all users (travelers, guides, admins)
-- ============================================================================
-- This is the core identity table. Every person in the system has a user record.
-- Authentication is handled by Supabase Auth, but we store extended info here.
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Email and phone are used for communication and verification
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  full_name VARCHAR(255) NOT NULL,

  -- Role determines what features they can access
  role user_role NOT NULL DEFAULT 'traveler',

  -- Avatar/profile picture stored in Supabase Storage
  avatar_url TEXT,

  -- Verification status
  is_verified BOOLEAN DEFAULT FALSE,

  -- How they signed up (affects verification process)
  auth_provider auth_provider NOT NULL DEFAULT 'email',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT email_valid CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Create index for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Add trigger to auto-update updated_at timestamp
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- ============================================================================
-- GUIDE_PROFILES TABLE - Extended info for guides (users with role='guide')
-- ============================================================================
-- Guides are the local college students offering tours.
-- This table contains their professional profile, verification status, and stats.
CREATE TABLE guide_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Education details
  university VARCHAR(255) NOT NULL,
  year_of_study VARCHAR(50), -- E.g., "3rd Year"
  course VARCHAR(255),       -- E.g., "Computer Science"

  -- Profile content
  bio TEXT,
  video_intro_url TEXT, -- URL to Supabase Storage for intro video

  -- Languages spoken (JSONB array for flexibility)
  -- Example: [{"language": "English", "proficiency": "fluent"},
  --           {"language": "Hindi", "proficiency": "native"}]
  languages JSONB DEFAULT '[]'::jsonb,

  -- Skills/specializations (JSONB array)
  -- Example: [{"name": "Foodie", "emoji": "🍜"}, {"name": "History Buff", "emoji": "📚"}]
  skills JSONB DEFAULT '[]'::jsonb,

  -- Verification flags (critical for trust)
  aadhaar_verified BOOLEAN DEFAULT FALSE,
  college_verified BOOLEAN DEFAULT FALSE,
  interview_passed BOOLEAN DEFAULT FALSE,  -- Manual interview by founder
  police_verified BOOLEAN DEFAULT FALSE,   -- Police verification (if required)

  -- Rating and review statistics (denormalized for fast queries)
  avg_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 stars
  total_reviews INT DEFAULT 0,
  total_trips INT DEFAULT 0,

  -- Response time (how fast they respond to booking requests)
  response_time_minutes INT DEFAULT 0,

  -- Can this guide receive new booking requests?
  is_active BOOLEAN DEFAULT TRUE,

  -- Invite code system for viral growth
  invite_codes_available INT DEFAULT 0,

  -- Who referred this guide? (Track who gets credit for referrals)
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Total earnings (denormalized, computed from payouts)
  earnings_total DECIMAL(12,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT avg_rating_valid CHECK (avg_rating >= 0 AND avg_rating <= 5),
  CONSTRAINT response_time_valid CHECK (response_time_minutes >= 0)
);

CREATE INDEX idx_guide_profiles_user_id ON guide_profiles(user_id);
CREATE INDEX idx_guide_profiles_avg_rating ON guide_profiles(avg_rating DESC);
CREATE INDEX idx_guide_profiles_is_active ON guide_profiles(is_active);
CREATE INDEX idx_guide_profiles_created_at ON guide_profiles(created_at DESC);
CREATE INDEX idx_guide_profiles_university ON guide_profiles(university);

CREATE TRIGGER update_guide_profiles_updated_at BEFORE UPDATE ON guide_profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- ============================================================================
-- TRAVELER_PROFILES TABLE - Extended info for travelers
-- ============================================================================
-- Travelers are international tourists looking for local guides.
CREATE TABLE traveler_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Travel info
  nationality VARCHAR(255), -- E.g., "United States"
  preferred_language VARCHAR(255), -- E.g., "English"

  -- Emergency contact info (safety critical)
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_traveler_profiles_user_id ON traveler_profiles(user_id);

-- ============================================================================
-- ITINERARIES TABLE - Tour plans created by guides
-- ============================================================================
-- Each guide can create multiple tour itineraries (e.g., "Street Food Tour", "Heritage Walk").
-- Travelers browse and book these itineraries.
CREATE TABLE itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guide_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic info
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Duration and cost
  duration_hours DECIMAL(5,2) NOT NULL, -- E.g., 3.5 hours
  buddy_cost DECIMAL(10,2) NOT NULL,    -- What guide charges per traveler
  estimated_expense DECIMAL(10,2),      -- Food, transport, entry fees, etc.

  -- Categorization
  category itinerary_category NOT NULL DEFAULT 'custom',

  -- Media
  cover_image_url TEXT, -- URL to Supabase Storage

  -- Availability
  is_published BOOLEAN DEFAULT FALSE, -- Only published itineraries appear in search

  -- Statistics (denormalized for fast queries)
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_bookings INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT cost_valid CHECK (buddy_cost > 0),
  CONSTRAINT duration_valid CHECK (duration_hours > 0),
  CONSTRAINT avg_rating_valid CHECK (avg_rating >= 0 AND avg_rating <= 5)
);

CREATE INDEX idx_itineraries_guide_id ON itineraries(guide_id);
CREATE INDEX idx_itineraries_is_published ON itineraries(is_published);
CREATE INDEX idx_itineraries_category ON itineraries(category);
CREATE INDEX idx_itineraries_avg_rating ON itineraries(avg_rating DESC);

CREATE TRIGGER update_itineraries_updated_at BEFORE UPDATE ON itineraries
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- ============================================================================
-- ITINERARY_STOPS TABLE - Individual stops within an itinerary
-- ============================================================================
-- An itinerary has multiple stops (e.g., "Street Market" -> "Local Eatery" -> "Photography Spot").
CREATE TABLE itinerary_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,

  -- Order matters (which stop comes first, second, etc.)
  stop_order INT NOT NULL,

  -- Stop details
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Location (GPS coordinates)
  location_lat DECIMAL(9,6),
  location_lng DECIMAL(9,6),

  -- Time and cost
  estimated_duration_minutes INT,
  estimated_cost DECIMAL(10,2),

  -- Category helps travelers understand what to expect
  category stop_category NOT NULL DEFAULT 'attraction',

  -- Media
  image_url TEXT,

  CONSTRAINT order_valid CHECK (stop_order > 0),
  CONSTRAINT cost_valid CHECK (estimated_cost >= 0),
  CONSTRAINT duration_valid CHECK (estimated_duration_minutes > 0)
);

CREATE INDEX idx_itinerary_stops_itinerary_id ON itinerary_stops(itinerary_id);
CREATE INDEX idx_itinerary_stops_stop_order ON itinerary_stops(itinerary_id, stop_order);

-- ============================================================================
-- BOOKINGS TABLE - Core transaction table (most important!)
-- ============================================================================
-- A booking represents a traveler hiring a guide for a specific arrival.
-- This is where money, trust, and safety come together.
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  traveler_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  guide_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL, -- Null if custom request

  -- Booking status (most important field for business logic)
  status booking_status NOT NULL DEFAULT 'pending',

  -- Flight info (critical for coordinating timing)
  arrival_flight_number VARCHAR(20),
  departure_flight_number VARCHAR(20),
  arrival_time TIMESTAMPTZ,      -- When traveler lands in Mumbai
  departure_time TIMESTAMPTZ,    -- When traveler leaves Mumbai
  available_window_minutes INT,  -- How much time between arrival and departure

  -- Tour timing
  tour_start_time TIMESTAMPTZ,
  tour_end_time TIMESTAMPTZ,

  -- Financial details (locked at booking time)
  buddy_cost DECIMAL(10,2) NOT NULL,           -- What guide earns (before platform fee)
  estimated_expenses DECIMAL(10,2),            -- Food, transport, etc. (estimate)
  actual_expenses DECIMAL(10,2),               -- Actual expenses (filled after tour)
  platform_fee DECIMAL(10,2),                  -- Platform takes 25% of buddy_cost
  gst_amount DECIMAL(10,2),                    -- GST on platform fee
  total_amount DECIMAL(10,2) NOT NULL,         -- Total paid by traveler

  -- Payment tracking
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_id VARCHAR(255),  -- Razorpay payment ID for dispute resolution

  -- Cancellation info
  cancellation_reason TEXT,
  cancelled_by VARCHAR(50), -- Which party cancelled? 'traveler', 'guide', 'platform'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT cost_valid CHECK (buddy_cost > 0),
  CONSTRAINT total_amount_valid CHECK (total_amount > 0)
);

CREATE INDEX idx_bookings_traveler_id ON bookings(traveler_id);
CREATE INDEX idx_bookings_guide_id ON bookings(guide_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_itinerary_id ON bookings(itinerary_id);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX idx_bookings_arrival_time ON bookings(arrival_time);

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- ============================================================================
-- MATCH_REQUESTS TABLE - The 3-at-a-time matching system
-- ============================================================================
-- When a traveler searches, we show 3 guide matches. Traveler can send requests.
-- Guides have 24 hours to respond (before request expires).
CREATE TABLE match_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  traveler_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Request lifecycle
  status match_status NOT NULL DEFAULT 'sent',

  -- Matching algorithm score (0-100)
  -- Score based on: language match, guide availability, guide rating, distance, etc.
  match_score DECIMAL(5,2),

  -- Timing
  sent_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),

  -- Guide's response (if they propose different terms)
  guide_proposed_cost DECIMAL(10,2),
  guide_message TEXT,

  CONSTRAINT match_score_valid CHECK (match_score >= 0 AND match_score <= 100)
);

CREATE INDEX idx_match_requests_traveler_id ON match_requests(traveler_id);
CREATE INDEX idx_match_requests_guide_id ON match_requests(guide_id);
CREATE INDEX idx_match_requests_status ON match_requests(status);
CREATE INDEX idx_match_requests_expires_at ON match_requests(expires_at);

-- ============================================================================
-- EXPENSES TABLE - Individual expense items logged during a tour
-- ============================================================================
-- Guide logs expenses as they happen (lunch cost, Uber fare, museum entry, etc.).
-- Used to split costs with traveler and track actual vs. estimated.
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- What was this expense for?
  category expense_category NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,

  -- Proof of expense
  receipt_image_url TEXT, -- URL to Supabase Storage (photo of receipt)

  -- Who logged it? (Always the guide)
  logged_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- When was it logged?
  logged_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT amount_valid CHECK (amount > 0)
);

CREATE INDEX idx_expenses_booking_id ON expenses(booking_id);
CREATE INDEX idx_expenses_logged_by ON expenses(logged_by);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ============================================================================
-- REVIEWS TABLE - Post-tour ratings and feedback
-- ============================================================================
-- After a tour completes, both traveler and guide can review each other.
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,

  -- Who wrote the review? Who are they reviewing?
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Multi-dimensional ratings (all 1-5 stars)
  overall_rating INT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  value_for_money_rating INT CHECK (value_for_money_rating >= 1 AND value_for_money_rating <= 5),
  safety_rating INT CHECK (safety_rating >= 1 AND safety_rating <= 5),
  personality_rating INT CHECK (personality_rating >= 1 AND personality_rating <= 5),

  -- Review comment (max 1000 chars)
  comment TEXT CHECK (char_length(comment) <= 1000),

  -- Reviews are public by default (helps guides build reputation)
  is_public BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);

-- ============================================================================
-- FLIGHT_TRACKING TABLE - Real-time flight data
-- ============================================================================
-- Synced from FlightAware API via Supabase Edge Function (polled every 15 min).
-- Used to notify guides of delays and coordinate meet times.
CREATE TABLE flight_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Flight info
  flight_number VARCHAR(20) NOT NULL,
  flight_type flight_type NOT NULL, -- Arrival or departure

  -- Scheduled vs. actual
  scheduled_time TIMESTAMPTZ NOT NULL,
  estimated_time TIMESTAMPTZ,  -- Updated by API (shows delays)
  actual_time TIMESTAMPTZ,     -- Filled once flight lands/departs

  -- Flight status
  status flight_status NOT NULL DEFAULT 'scheduled',
  delay_minutes INT DEFAULT 0,

  -- When was this data last synced from FlightAware?
  last_checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_flight_tracking_booking_id ON flight_tracking(booking_id);
CREATE INDEX idx_flight_tracking_flight_number ON flight_tracking(flight_number);
CREATE INDEX idx_flight_tracking_status ON flight_tracking(status);

-- ============================================================================
-- LOCATION_TRACKING TABLE - Real-time GPS during tours
-- ============================================================================
-- Guide's location is tracked during the tour (with consent).
-- This table has high volume — consider partitioning or setting a TTL in future.
-- (Note: For MVP, can simplify or use Supabase Realtime instead of polling this table)
CREATE TABLE location_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- GPS coordinates
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,

  -- When was this location recorded?
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_location_tracking_booking_id ON location_tracking(booking_id);
CREATE INDEX idx_location_tracking_user_id ON location_tracking(user_id);
CREATE INDEX idx_location_tracking_recorded_at ON location_tracking(recorded_at DESC);

-- ============================================================================
-- INVITE_CODES TABLE - Viral growth system for guides
-- ============================================================================
-- Successful guides get invite codes to recruit new guides (referral program).
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE NOT NULL, -- E.g., "GUIDE123"

  -- Who earned this code?
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Has it been used? If so, by whom?
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_used BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_created_by ON invite_codes(created_by);
CREATE INDEX idx_invite_codes_used_by ON invite_codes(used_by);
CREATE INDEX idx_invite_codes_is_used ON invite_codes(is_used);

-- ============================================================================
-- MESSAGES TABLE - In-app chat between traveler and guide
-- ============================================================================
-- Simple messaging system tied to bookings.
-- For MVP, this is basic. Can add threads, files, etc. later.
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Who sent this message?
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL,

  -- Has the recipient read it?
  is_read BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_booking_id ON messages(booking_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ============================================================================
-- PAYOUTS TABLE - Guide earnings and payout history
-- ============================================================================
-- Tracks when guides request payouts and when money is transferred.
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guide_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- How much are we paying out?
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),

  -- Payout status (pending -> processing -> completed)
  status payout_status NOT NULL DEFAULT 'pending',

  -- How to pay them?
  payment_method payout_method NOT NULL,

  -- Bank details (ENCRYPTED for security)
  -- In production, use Supabase Vault or similar for encryption
  bank_details_encrypted TEXT,

  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_payouts_guide_id ON payouts(guide_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- ============================================================================
-- NOTIFICATIONS TABLE - Push & in-app notifications
-- ============================================================================
-- Tracks all notifications sent to users.
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What type of notification?
  type notification_type NOT NULL,

  -- Notification content
  title VARCHAR(255) NOT NULL,
  body TEXT,

  -- Additional data (as JSON) — useful for app to know what to do when tapped
  -- E.g., {"booking_id": "xyz"} so app can navigate to that booking
  data JSONB DEFAULT '{}'::jsonb,

  -- Has user seen this?
  is_read BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============================================================================
-- SOS_ALERTS TABLE - Emergency alerts during tours
-- ============================================================================
-- If traveler or guide feels unsafe, they can trigger an SOS.
CREATE TABLE sos_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Who triggered the SOS?
  triggered_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Location of the SOS
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,

  -- Status (how has this been handled?)
  status sos_status NOT NULL DEFAULT 'triggered',

  -- Admin notes on how this was resolved
  resolution_notes TEXT,

  -- Timestamps
  triggered_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_sos_alerts_booking_id ON sos_alerts(booking_id);
CREATE INDEX idx_sos_alerts_triggered_by ON sos_alerts(triggered_by);
CREATE INDEX idx_sos_alerts_status ON sos_alerts(status);

-- ============================================================================
-- USEFUL VIEWS
-- ============================================================================

-- View: Active guides (high-quality, accepting bookings)
CREATE VIEW active_guides AS
SELECT
  gp.id,
  u.id as user_id,
  u.full_name,
  u.email,
  gp.university,
  gp.avg_rating,
  gp.total_reviews,
  gp.total_trips,
  gp.response_time_minutes,
  gp.is_active,
  COUNT(i.id) as itinerary_count
FROM guide_profiles gp
JOIN users u ON gp.user_id = u.id
LEFT JOIN itineraries i ON gp.user_id = i.guide_id AND i.is_published = TRUE
WHERE gp.is_active = TRUE
  AND gp.avg_rating >= 4.0
  AND gp.college_verified = TRUE
  AND gp.interview_passed = TRUE
GROUP BY gp.id, u.id, u.full_name, u.email, gp.university, gp.avg_rating,
         gp.total_reviews, gp.total_trips, gp.response_time_minutes, gp.is_active;

-- View: Pending bookings (need immediate attention)
CREATE VIEW pending_bookings AS
SELECT
  b.id,
  b.traveler_id,
  b.guide_id,
  t_user.full_name as traveler_name,
  g_user.full_name as guide_name,
  b.status,
  b.arrival_time,
  b.departure_time,
  b.total_amount,
  b.created_at
FROM bookings b
JOIN users t_user ON b.traveler_id = t_user.id
JOIN users g_user ON b.guide_id = g_user.id
WHERE b.status IN ('pending', 'guide_accepted')
ORDER BY b.created_at ASC;

-- View: Guide earnings summary (for dashboard)
CREATE VIEW guide_earnings_summary AS
SELECT
  b.guide_id,
  COUNT(DISTINCT b.id) as completed_tours,
  SUM(CASE WHEN b.status = 'completed' THEN b.buddy_cost ELSE 0 END) as earned_amount,
  SUM(CASE WHEN b.status = 'completed' THEN b.platform_fee ELSE 0 END) as platform_fees_paid,
  ROUND(
    SUM(CASE WHEN b.status = 'completed' THEN b.buddy_cost ELSE 0 END) /
    NULLIF(COUNT(DISTINCT b.id), 0)::numeric, 2
  ) as avg_tour_earnings
FROM bookings b
WHERE b.status = 'completed'
GROUP BY b.guide_id;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- RLS ensures users can only access data they're allowed to see.
-- This is critical for a multi-tenant app with sensitive data.

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE traveler_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

-- USERS table policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users FOR UPDATE
  USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "Admins can read all users" ON users FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- GUIDE_PROFILES table policies
-- Guides can read their own profile
CREATE POLICY "Guides can read own profile" ON guide_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Guides can update their own profile
CREATE POLICY "Guides can update own profile" ON guide_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Everyone can read published guide profiles (for browsing)
CREATE POLICY "Everyone can read published guide profiles" ON guide_profiles FOR SELECT
  USING (true);

-- BOOKINGS table policies
-- Travelers can read their own bookings
CREATE POLICY "Travelers can read own bookings" ON bookings FOR SELECT
  USING (auth.uid() = traveler_id);

-- Guides can read their own bookings
CREATE POLICY "Guides can read own bookings" ON bookings FOR SELECT
  USING (auth.uid() = guide_id);

-- Travelers can create bookings
CREATE POLICY "Travelers can create bookings" ON bookings FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'traveler'
    AND auth.uid() = traveler_id
  );

-- MESSAGES table policies
-- Users can read messages from their bookings
CREATE POLICY "Users can read own booking messages" ON messages FOR SELECT
  USING (
    auth.uid() IN (
      SELECT traveler_id FROM bookings WHERE id = booking_id
      UNION
      SELECT guide_id FROM bookings WHERE id = booking_id
    )
  );

-- Users can send messages in their bookings
CREATE POLICY "Users can send messages in own bookings" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND auth.uid() IN (
      SELECT traveler_id FROM bookings WHERE id = booking_id
      UNION
      SELECT guide_id FROM bookings WHERE id = booking_id
    )
  );

-- EXPENSES table policies
-- Guides can read expenses from their bookings
CREATE POLICY "Guides can read own booking expenses" ON expenses FOR SELECT
  USING (
    auth.uid() = (SELECT guide_id FROM bookings WHERE id = booking_id)
  );

-- Travelers can read expenses from their bookings
CREATE POLICY "Travelers can read own booking expenses" ON expenses FOR SELECT
  USING (
    auth.uid() = (SELECT traveler_id FROM bookings WHERE id = booking_id)
  );

-- Guides can create expenses for their bookings
CREATE POLICY "Guides can create expenses in own bookings" ON expenses FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT guide_id FROM bookings WHERE id = booking_id)
    AND auth.uid() = logged_by
  );

-- ============================================================================
-- FINAL NOTES FOR GAURAV
-- ============================================================================
-- 1. Foreign Keys: Using ON DELETE CASCADE/RESTRICT to maintain data integrity.
--    CASCADE = automatically delete child records (e.g., all itineraries when guide account deleted)
--    RESTRICT = prevent deletion if child records exist (e.g., can't delete user if they have bookings)
--
-- 2. Indexes: Created on frequently queried columns (status, user IDs, ratings, etc.)
--    These speed up queries significantly as data grows.
--
-- 3. JSONB columns (languages, skills, notification data): Flexible for storing semi-structured data.
--    Can add new language types or skills without schema migration.
--
-- 4. RLS Policies: Enforce access control at database level (not just in app code).
--    This prevents accidental data leaks.
--
-- 5. Denormalization: avg_rating, total_trips, etc. are stored in guide_profiles.
--    Faster queries, but must be updated when reviews change. Use triggers in future.
--
-- 6. Timestamps: Every table has created_at and updated_at (auto-managed by triggers).
--    Useful for auditing, debugging, and sorting.
--
-- Next steps:
--   - Create Supabase Storage buckets for: guide_videos, guide_photos, receipts, guide_intros
--   - Set up Supabase Auth with email + Google sign-in
--   - Create Edge Functions for: matching algorithm, payment webhook, flight tracking cron
--   - Seed with test data (sample guides, travelers, bookings)
-- ============================================================================
