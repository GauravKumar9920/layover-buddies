-- ============================================================================
-- MUMBAI BUDDIES — SEED DATA
-- ============================================================================
-- Realistic demo data for local development.
-- Run with: supabase db reset   (applies migrations then this seed)
-- Or manually: psql < supabase/seed.sql
-- ============================================================================

-- Use fixed UUIDs so foreign keys are deterministic and re-runnable.
-- Pattern: aaaaaaaa-0000-4000-a000-{table}{row} (easy to grep/debug)

-- ============================================================================
-- 0. AUTH ACCOUNTS
-- ============================================================================
-- Creates Supabase Auth entries for every seeded user so they can log in
-- immediately after `supabase db reset`.  All accounts use password: Test1234!
-- These must be inserted before the public.users rows (FK order).
-- ============================================================================

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, instance_id,
  -- GoTrue's Go model scans these as non-pointer strings; NULL panics the scan.
  -- Set them all to '' so GoTrue can deserialize the row cleanly.
  confirmation_token, recovery_token,
  email_change, email_change_token_new
) VALUES
-- Guides
('aaaaaaaa-0000-4000-a000-000000000001', 'authenticated', 'authenticated',
 'aarav.patil@vjti.ac.in',     crypt('Test1234!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Aarav Patil","role":"guide"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', ''),
('aaaaaaaa-0000-4000-a000-000000000002', 'authenticated', 'authenticated',
 'priya.sharma@iitb.ac.in',    crypt('Test1234!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Priya Sharma","role":"guide"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', ''),
('aaaaaaaa-0000-4000-a000-000000000003', 'authenticated', 'authenticated',
 'rohan.dsouza@xaviers.edu',   crypt('Test1234!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Rohan D''Souza","role":"guide"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', ''),
('aaaaaaaa-0000-4000-a000-000000000004', 'authenticated', 'authenticated',
 'sneha.mehta@nmims.edu',      crypt('Test1234!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sneha Mehta","role":"guide"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', ''),
('aaaaaaaa-0000-4000-a000-000000000005', 'authenticated', 'authenticated',
 'kabir.joshi@mithibai.ac.in', crypt('Test1234!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Kabir Joshi","role":"guide"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', ''),
-- Travelers
('aaaaaaaa-0000-4000-a000-000000000011', 'authenticated', 'authenticated',
 'emma.wilson@gmail.com',      crypt('Test1234!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Emma Wilson","role":"traveler"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', ''),
('aaaaaaaa-0000-4000-a000-000000000012', 'authenticated', 'authenticated',
 'james.tanaka@outlook.com',   crypt('Test1234!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"James Tanaka","role":"traveler"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', ''),
('aaaaaaaa-0000-4000-a000-000000000013', 'authenticated', 'authenticated',
 'sofia.mueller@proton.me',    crypt('Test1234!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sofia Mueller","role":"traveler"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', ''),
-- Hosted Admin 2.0 owner. First sign-in is AAL1; the console requires TOTP
-- enrollment/challenge before any operation other than session.get.
('aaaaaaaa-0000-4000-a000-000000000099', 'authenticated', 'authenticated',
 'admin@detour.local',         crypt('DetourAdmin123!', gen_salt('bf')),
 now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Detour Owner","role":"admin"}'::jsonb, false, '00000000-0000-0000-0000-000000000000',
 '', '', '', '')
ON CONFLICT (id) DO UPDATE SET
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = now();

-- Auth identities (required so the email+password flow resolves the user)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
) VALUES
('aaaaaaaa-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000001","email":"aarav.patil@vjti.ac.in","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'aarav.patil@vjti.ac.in'),
('aaaaaaaa-0000-4000-a000-000000000002', 'aaaaaaaa-0000-4000-a000-000000000002',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000002","email":"priya.sharma@iitb.ac.in","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'priya.sharma@iitb.ac.in'),
('aaaaaaaa-0000-4000-a000-000000000003', 'aaaaaaaa-0000-4000-a000-000000000003',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000003","email":"rohan.dsouza@xaviers.edu","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'rohan.dsouza@xaviers.edu'),
('aaaaaaaa-0000-4000-a000-000000000004', 'aaaaaaaa-0000-4000-a000-000000000004',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000004","email":"sneha.mehta@nmims.edu","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'sneha.mehta@nmims.edu'),
('aaaaaaaa-0000-4000-a000-000000000005', 'aaaaaaaa-0000-4000-a000-000000000005',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000005","email":"kabir.joshi@mithibai.ac.in","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'kabir.joshi@mithibai.ac.in'),
('aaaaaaaa-0000-4000-a000-000000000011', 'aaaaaaaa-0000-4000-a000-000000000011',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000011","email":"emma.wilson@gmail.com","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'emma.wilson@gmail.com'),
('aaaaaaaa-0000-4000-a000-000000000012', 'aaaaaaaa-0000-4000-a000-000000000012',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000012","email":"james.tanaka@outlook.com","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'james.tanaka@outlook.com'),
('aaaaaaaa-0000-4000-a000-000000000013', 'aaaaaaaa-0000-4000-a000-000000000013',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000013","email":"sofia.mueller@proton.me","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'sofia.mueller@proton.me'),
('aaaaaaaa-0000-4000-a000-000000000099', 'aaaaaaaa-0000-4000-a000-000000000099',
 '{"sub":"aaaaaaaa-0000-4000-a000-000000000099","email":"admin@detour.local","email_verified":true}'::jsonb,
 'email', now(), now(), now(), 'admin@detour.local')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 1. USERS (5 guides + 3 travelers)
-- ============================================================================

-- The auth trigger (on_auth_user_created) already inserted skeleton rows into
-- public.users when auth.users was seeded above.  Use ON CONFLICT DO UPDATE to
-- fill in the full profile fields (phone, full_name, role, etc.) that the
-- trigger leaves blank.
INSERT INTO users (id, email, phone, full_name, role, avatar_url, is_verified, auth_provider) VALUES
-- Guides
('aaaaaaaa-0000-4000-a000-000000000001', 'aarav.patil@vjti.ac.in',       '+919876543201', 'Aarav Patil',     'guide',    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=480&h=480&q=85', TRUE,  'email'),
('aaaaaaaa-0000-4000-a000-000000000002', 'priya.sharma@iitb.ac.in',      '+919876543202', 'Priya Sharma',    'guide',    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=480&h=480&q=85', TRUE,  'google'),
('aaaaaaaa-0000-4000-a000-000000000003', 'rohan.dsouza@xaviers.edu',     '+919876543203', 'Rohan D''Souza',  'guide',    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=480&h=480&q=85', TRUE,  'email'),
('aaaaaaaa-0000-4000-a000-000000000004', 'sneha.mehta@nmims.edu',        '+919876543204', 'Sneha Mehta',     'guide',    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=480&h=480&q=85', TRUE,  'google'),
('aaaaaaaa-0000-4000-a000-000000000005', 'kabir.joshi@mithibai.ac.in',   '+919876543205', 'Kabir Joshi',     'guide',    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=480&h=480&q=85', FALSE, 'email'),
-- Travelers
('aaaaaaaa-0000-4000-a000-000000000011', 'emma.wilson@gmail.com',        '+14155551234',  'Emma Wilson',     'traveler', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=480&h=480&q=85', TRUE,  'google'),
('aaaaaaaa-0000-4000-a000-000000000012', 'james.tanaka@outlook.com',     '+81901234567',  'James Tanaka',    'traveler', 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=480&h=480&q=85', TRUE,  'email'),
('aaaaaaaa-0000-4000-a000-000000000013', 'sofia.mueller@proton.me',      '+491761234567', 'Sofia Mueller',   'traveler', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=480&h=480&q=85', TRUE,  'apple'),
('aaaaaaaa-0000-4000-a000-000000000099', 'admin@detour.local',           NULL,             'Detour Owner',    'admin',    NULL, TRUE, 'email')
ON CONFLICT (id) DO UPDATE SET
  phone        = EXCLUDED.phone,
  full_name    = EXCLUDED.full_name,
  role         = EXCLUDED.role,
  avatar_url   = EXCLUDED.avatar_url,
  is_verified  = EXCLUDED.is_verified,
  auth_provider = EXCLUDED.auth_provider;

INSERT INTO admin_memberships
  (user_id, role, is_active, invited_by, invited_at, accepted_at)
VALUES
  ('aaaaaaaa-0000-4000-a000-000000000099', 'owner', TRUE, NULL, now(), now())
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = TRUE,
  accepted_at = COALESCE(admin_memberships.accepted_at, now()),
  updated_at = now();

-- Keep re-runs compatible with older seeds whose auth metadata omitted role.
-- A user owns exactly one role-specific profile.
DELETE FROM traveler_profiles
WHERE user_id IN (
  'aaaaaaaa-0000-4000-a000-000000000001',
  'aaaaaaaa-0000-4000-a000-000000000002',
  'aaaaaaaa-0000-4000-a000-000000000003',
  'aaaaaaaa-0000-4000-a000-000000000004',
  'aaaaaaaa-0000-4000-a000-000000000005'
);

DELETE FROM guide_profiles
WHERE user_id IN (
  'aaaaaaaa-0000-4000-a000-000000000011',
  'aaaaaaaa-0000-4000-a000-000000000012',
  'aaaaaaaa-0000-4000-a000-000000000013'
);


-- ============================================================================
-- 2. GUIDE PROFILES
-- ============================================================================

INSERT INTO guide_profiles (
  id, user_id, university, year_of_study, course, bio,
  languages, skills,
  aadhaar_verified, college_verified, interview_passed, police_verified,
  avg_rating, total_reviews, total_trips, response_time_minutes, is_active,
  profile_status, profile_completed_at
) VALUES
(
  'bbbbbbbb-0000-4000-a000-000000000001',
  'aaaaaaaa-0000-4000-a000-000000000001',
  'Veermata Jijabai Technological Institute (VJTI)', '3rd Year', 'Mechanical Engineering',
  'Born and raised in Dadar — I know every galli and tapri in central Mumbai. I''ll take you to places even Google Maps hasn''t found. When I''m not in the workshop, I''m eating vada pav or exploring abandoned mill compounds.',
  '[{"language": "English", "proficiency": "fluent"}, {"language": "Hindi", "proficiency": "native"}, {"language": "Marathi", "proficiency": "native"}]'::jsonb,
  '[{"name": "Foodie", "emoji": "🍜"}, {"name": "History Buff", "emoji": "📚"}, {"name": "Street Smart", "emoji": "🏙️"}]'::jsonb,
  TRUE, TRUE, TRUE, TRUE,
  4.80, 3, 5, 8, TRUE, 'published', now()
),
(
  'bbbbbbbb-0000-4000-a000-000000000002',
  'aaaaaaaa-0000-4000-a000-000000000002',
  'Indian Institute of Technology Bombay (IIT Bombay)', '4th Year', 'Computer Science',
  'Powai kid who discovered Mumbai properly only after starting to guide travelers. I blend tech-nerd curiosity with local street cred — expect random trivia about everything from dabbawalas to Art Deco architecture.',
  '[{"language": "English", "proficiency": "fluent"}, {"language": "Hindi", "proficiency": "native"}, {"language": "Gujarati", "proficiency": "conversational"}]'::jsonb,
  '[{"name": "Architecture", "emoji": "🏛️"}, {"name": "Photography", "emoji": "📸"}, {"name": "Tech Nerd", "emoji": "💻"}]'::jsonb,
  TRUE, TRUE, TRUE, FALSE,
  4.60, 2, 3, 12, TRUE, 'published', now()
),
(
  'bbbbbbbb-0000-4000-a000-000000000003',
  'aaaaaaaa-0000-4000-a000-000000000003',
  'St. Xavier''s College, Mumbai', '2nd Year', 'Mass Media & Journalism',
  'Half-Goan, full-Mumbai. I grew up between Bandra''s chapel lanes and Colaba''s cafe scene. I tell stories for a living (journalism student), so expect your tour to feel like a documentary, minus the boring parts.',
  '[{"language": "English", "proficiency": "native"}, {"language": "Hindi", "proficiency": "fluent"}, {"language": "Konkani", "proficiency": "conversational"}, {"language": "Portuguese", "proficiency": "basic"}]'::jsonb,
  '[{"name": "Culture", "emoji": "🎭"}, {"name": "Nightlife", "emoji": "🌙"}, {"name": "Storyteller", "emoji": "📖"}]'::jsonb,
  TRUE, TRUE, TRUE, TRUE,
  4.90, 2, 4, 5, TRUE, 'published', now()
),
(
  'bbbbbbbb-0000-4000-a000-000000000004',
  'aaaaaaaa-0000-4000-a000-000000000004',
  'SVKM''s NMIMS University', '3rd Year', 'BBA',
  'SoBo girl who knows the business side of Mumbai — from Dalal Street traders to Dharavi entrepreneurs. I organize tours that show you how this city actually runs. Also an amateur photographer, so your Instagram will thank me.',
  '[{"language": "English", "proficiency": "native"}, {"language": "Hindi", "proficiency": "fluent"}, {"language": "Sindhi", "proficiency": "conversational"}]'::jsonb,
  '[{"name": "Business", "emoji": "💼"}, {"name": "Photography", "emoji": "📸"}, {"name": "Shopping", "emoji": "🛍️"}]'::jsonb,
  TRUE, TRUE, TRUE, FALSE,
  4.50, 1, 2, 15, TRUE, 'published', now()
),
(
  'bbbbbbbb-0000-4000-a000-000000000005',
  'aaaaaaaa-0000-4000-a000-000000000005',
  'Mithibai College', '2nd Year', 'B.Sc. Chemistry',
  'Vile Parle local with a thing for hidden temples, street food, and sunset spots. I''ve been mapping secret staircases and rooftop views across Mumbai since school. If you want the version of Mumbai that doesn''t show up in travel blogs, I''m your guy.',
  '[{"language": "English", "proficiency": "fluent"}, {"language": "Hindi", "proficiency": "native"}, {"language": "Marathi", "proficiency": "fluent"}]'::jsonb,
  '[{"name": "Adventure", "emoji": "🧗"}, {"name": "Foodie", "emoji": "🍜"}, {"name": "Hidden Gems", "emoji": "💎"}]'::jsonb,
  TRUE, TRUE, FALSE, FALSE,
  0, 0, 0, 0, TRUE, 'published', now()
) ON CONFLICT (user_id) DO UPDATE SET
  university = EXCLUDED.university,
  year_of_study = EXCLUDED.year_of_study,
  course = EXCLUDED.course,
  bio = EXCLUDED.bio,
  languages = EXCLUDED.languages,
  skills = EXCLUDED.skills,
  aadhaar_verified = EXCLUDED.aadhaar_verified,
  college_verified = EXCLUDED.college_verified,
  interview_passed = EXCLUDED.interview_passed,
  police_verified = EXCLUDED.police_verified,
  avg_rating = EXCLUDED.avg_rating,
  total_reviews = EXCLUDED.total_reviews,
  total_trips = EXCLUDED.total_trips,
  response_time_minutes = EXCLUDED.response_time_minutes;

-- Explicit profile-media placements for every demo guide. Each URL has one
-- job; these are intentionally not itinerary or stop images.
INSERT INTO guide_profile_photos (
  id, guide_profile_id, role, url, caption, position
)
SELECT
  media.id,
  guide.id,
  media.role,
  media.url,
  media.caption,
  media.position
FROM guide_profiles AS guide
CROSS JOIN (
  VALUES
    (
      'eeeeeeee-0000-4000-a000-000000000001'::uuid,
      'cover'::text,
      'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=1200&q=85'::text,
      NULL::text,
      0::smallint
    ),
    (
      'eeeeeeee-0000-4000-a000-000000000002'::uuid,
      'story'::text,
      'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=85'::text,
      NULL::text,
      0::smallint
    ),
    (
      'eeeeeeee-0000-4000-a000-000000000003'::uuid,
      'gallery'::text,
      'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=1000&q=85'::text,
      'South Mumbai before the streets fill up.'::text,
      0::smallint
    ),
    (
      'eeeeeeee-0000-4000-a000-000000000004'::uuid,
      'gallery'::text,
      'https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=1000&q=85'::text,
      'A market detour worth slowing down for.'::text,
      1::smallint
    )
) AS media(id, role, url, caption, position)
WHERE guide.user_id = 'aaaaaaaa-0000-4000-a000-000000000001'
ON CONFLICT DO NOTHING;

INSERT INTO guide_profile_photos (
  id, guide_profile_id, role, url, caption, position
)
SELECT
  media.id,
  guide.id,
  media.role,
  media.url,
  media.caption,
  media.position
FROM guide_profiles AS guide
JOIN (
  VALUES
    ('aaaaaaaa-0000-4000-a000-000000000002'::uuid, 'f2000000-0000-4000-a000-000000000001'::uuid, 'cover'::text,   'https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=85'::text, NULL::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000002'::uuid, 'f2000000-0000-4000-a000-000000000002'::uuid, 'story'::text,   'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=85'::text, NULL::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000002'::uuid, 'f2000000-0000-4000-a000-000000000003'::uuid, 'gallery'::text, 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1000&q=85'::text, 'Finding the geometry in Mumbai''s old facades.'::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000002'::uuid, 'f2000000-0000-4000-a000-000000000004'::uuid, 'gallery'::text, 'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=1000&q=85'::text, 'An unhurried afternoon around the city.'::text, 1::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000003'::uuid, 'f3000000-0000-4000-a000-000000000001'::uuid, 'cover'::text,   'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=1200&q=85'::text, NULL::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000003'::uuid, 'f3000000-0000-4000-a000-000000000002'::uuid, 'story'::text,   'https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=1200&q=85'::text, NULL::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000003'::uuid, 'f3000000-0000-4000-a000-000000000003'::uuid, 'gallery'::text, 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1000&q=85'::text, 'The stories hidden between Colaba''s landmarks.'::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000003'::uuid, 'f3000000-0000-4000-a000-000000000004'::uuid, 'gallery'::text, 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1000&q=85'::text, 'Bandra after the evening light changes.'::text, 1::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000004'::uuid, 'f4000000-0000-4000-a000-000000000001'::uuid, 'cover'::text,   'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=85'::text, NULL::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000004'::uuid, 'f4000000-0000-4000-a000-000000000002'::uuid, 'story'::text,   'https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&w=1200&q=85'::text, NULL::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000004'::uuid, 'f4000000-0000-4000-a000-000000000003'::uuid, 'gallery'::text, 'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=1000&q=85'::text, 'Following the city from heritage to hustle.'::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000004'::uuid, 'f4000000-0000-4000-a000-000000000004'::uuid, 'gallery'::text, 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?auto=format&fit=crop&w=1000&q=85'::text, 'A camera-ready pause in South Mumbai.'::text, 1::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000005'::uuid, 'f5000000-0000-4000-a000-000000000001'::uuid, 'cover'::text,   'https://images.unsplash.com/photo-1595658658481-d53d3f999875?auto=format&fit=crop&w=1200&q=85'::text, NULL::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000005'::uuid, 'f5000000-0000-4000-a000-000000000002'::uuid, 'story'::text,   'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=1200&q=85'::text, NULL::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000005'::uuid, 'f5000000-0000-4000-a000-000000000003'::uuid, 'gallery'::text, 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1000&q=85'::text, 'A sunset route away from the usual checklist.'::text, 0::smallint),
    ('aaaaaaaa-0000-4000-a000-000000000005'::uuid, 'f5000000-0000-4000-a000-000000000004'::uuid, 'gallery'::text, 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=1000&q=85'::text, 'Small streets, strong chai, no rush.'::text, 1::smallint)
) AS media(user_id, id, role, url, caption, position)
  ON guide.user_id = media.user_id
ON CONFLICT DO NOTHING;

-- The production insert trigger correctly forces every new guide into draft.
-- These five rows are explicit demo fixtures that replace the pre-migration
-- browseable catalogue, so grandfather them only after their inserts complete.
UPDATE guide_profiles
SET profile_status = 'published',
    profile_completed_at = COALESCE(profile_completed_at, now()),
    is_active = TRUE
WHERE user_id IN (
  'aaaaaaaa-0000-4000-a000-000000000001',
  'aaaaaaaa-0000-4000-a000-000000000002',
  'aaaaaaaa-0000-4000-a000-000000000003',
  'aaaaaaaa-0000-4000-a000-000000000004',
  'aaaaaaaa-0000-4000-a000-000000000005'
);


-- ============================================================================
-- 3. TRAVELER PROFILES
-- ============================================================================

-- Auth sync creates skeleton traveler_profiles only for traveler accounts.
-- Upsert the demo travelers to fill in their structured profile fields.
INSERT INTO traveler_profiles (
  id, user_id, nationality, preferred_language, interests, about_me,
  travel_pace, dietary_preferences, onboarded_at, setup_completed_at,
  onboarding_version
) VALUES
('cccccccc-0000-4000-a000-000000000011', 'aaaaaaaa-0000-4000-a000-000000000011', 'United States', 'English', ARRAY['food','history'], 'First time in Mumbai. I love local food and stories more than checklist sightseeing.', 'balanced', ARRAY['vegetarian'], now(), now(), 2),
('cccccccc-0000-4000-a000-000000000012', 'aaaaaaaa-0000-4000-a000-000000000012', 'Japan', 'English', ARRAY['photography','architecture'], 'I travel with a small camera and like unhurried neighbourhood walks.', 'relaxed', ARRAY[]::text[], now(), now(), 2),
('cccccccc-0000-4000-a000-000000000013', 'aaaaaaaa-0000-4000-a000-000000000013', 'Germany', 'English', ARRAY['culture','hidden gems'], 'Curious about everyday city life and contemporary art.', 'packed', ARRAY['vegan'], now(), now(), 2)
ON CONFLICT (user_id) DO UPDATE SET
  nationality              = EXCLUDED.nationality,
  preferred_language       = EXCLUDED.preferred_language,
  interests                = EXCLUDED.interests,
  about_me                 = EXCLUDED.about_me,
  travel_pace              = EXCLUDED.travel_pace,
  dietary_preferences      = EXCLUDED.dietary_preferences,
  onboarded_at             = EXCLUDED.onboarded_at,
  setup_completed_at       = EXCLUDED.setup_completed_at,
  onboarding_version       = EXCLUDED.onboarding_version;

INSERT INTO traveler_safety_profiles (
  traveler_id, gender, emergency_contact_name, emergency_contact_phone
) VALUES
('aaaaaaaa-0000-4000-a000-000000000011', 'female', 'Mark Wilson',  '+14155559876'),
('aaaaaaaa-0000-4000-a000-000000000012', 'male',   'Yuki Tanaka',   '+81901239876'),
('aaaaaaaa-0000-4000-a000-000000000013', 'female', 'Klaus Mueller', '+491769876543')
ON CONFLICT (traveler_id) DO UPDATE SET
  gender = EXCLUDED.gender,
  emergency_contact_name = EXCLUDED.emergency_contact_name,
  emergency_contact_phone = EXCLUDED.emergency_contact_phone;

INSERT INTO traveler_layovers (
  traveler_id, airport_code, arrival_at, departure_at, flight_in, flight_out,
  group_size, status
) VALUES
('aaaaaaaa-0000-4000-a000-000000000011', 'BOM', now() + interval '10 days', now() + interval '10 days 10 hours', 'AI102', 'AI101', 1, 'active'),
('aaaaaaaa-0000-4000-a000-000000000012', 'BOM', now() + interval '15 days', now() + interval '15 days 9 hours',  'JL50',  'JL49',  2, 'active'),
('aaaaaaaa-0000-4000-a000-000000000013', 'BOM', now() + interval '20 days', now() + interval '20 days 12 hours', 'LH756', 'LH757', 1, 'active')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 4. ITINERARIES  (3 per guide = 15 total)
--    Tier pattern: Quick Escape ~3hr, Real Mumbai ~6hr, Deep Dive 8hr+
-- ============================================================================

-- ── Guide 1: Aarav (VJTI) — food & history focus ──

INSERT INTO itineraries (id, guide_id, title, description, duration_hours, buddy_cost, estimated_expense, category, is_published, avg_rating, total_bookings) VALUES
('dddddddd-0000-4000-a000-000000000101',
 'aaaaaaaa-0000-4000-a000-000000000001',
 'Dadar to Matunga Food Sprint',
 'A 3-hour crash course in Mumbai''s best street food — from Aaswad''s misal pav to Cafe Madras'' filter coffee. We cover Dadar flower market, the hidden Shivaji Park stalls, and Matunga''s South Indian belt. Come hungry.',
 3.00, 800.00, 500.00, 'food', TRUE, 4.80, 2),

('dddddddd-0000-4000-a000-000000000102',
 'aaaaaaaa-0000-4000-a000-000000000001',
 'Real Mumbai: Mills to Malls',
 'Trace Mumbai''s transformation from textile capital to financial hub. We start at the old Girangaon mill districts, walk through the Phoenix Mills revival, hit Lower Parel''s skyscrapers, then loop back to Worli''s fishing village. Lunch included.',
 6.00, 1500.00, 900.00, 'history', TRUE, 4.70, 2),

('dddddddd-0000-4000-a000-000000000103',
 'aaaaaaaa-0000-4000-a000-000000000001',
 'Midnight Mumbai: Dawn to Dawn',
 'The full nocturnal experience — starts with sunset at Worli Sea Face, dinner at Mohammad Ali Road, late-night Marine Drive cruise, Haji Ali at 2 AM, and ends with sunrise chai at Sassoon Docks fish auction. Not for the faint-hearted.',
 10.00, 2500.00, 1500.00, 'adventure', TRUE, 0, 0);

-- ── Guide 2: Priya (IIT Bombay) — architecture & photography ──

INSERT INTO itineraries (id, guide_id, title, description, duration_hours, buddy_cost, estimated_expense, category, is_published, avg_rating, total_bookings) VALUES
('dddddddd-0000-4000-a000-000000000201',
 'aaaaaaaa-0000-4000-a000-000000000002',
 'Art Deco Gateway',
 'Mumbai has the world''s second-largest collection of Art Deco buildings after Miami. This 3-hour walking tour covers the Marine Drive ensemble, Oval Maidan''s cricket-with-a-backdrop scene, and the Regal Cinema lobby. Bring your camera.',
 3.00, 900.00, 300.00, 'photography', TRUE, 4.50, 1),

('dddddddd-0000-4000-a000-000000000202',
 'aaaaaaaa-0000-4000-a000-000000000002',
 'South Mumbai Heritage Circuit',
 'CST to Colaba in 6 hours — covering every major heritage structure along the way. Victoria Terminus interiors, Flora Fountain, Horniman Circle Gardens, Kala Ghoda galleries, and Gateway of India. Chai and vada pav breaks built in.',
 6.00, 1600.00, 700.00, 'culture', TRUE, 4.70, 1),

('dddddddd-0000-4000-a000-000000000203',
 'aaaaaaaa-0000-4000-a000-000000000002',
 'Campus to Coast: Full IIT + Powai + Sanjay Gandhi',
 'Start with breakfast at IIT''s lakeside canteen, explore Powai''s tech-park-meets-lake vibe, then head into Sanjay Gandhi National Park for the Kanheri Caves. Ends with sunset at Aarey Colony. Packed day.',
 9.00, 2200.00, 1200.00, 'adventure', TRUE, 0, 0);

-- ── Guide 3: Rohan (Xaviers) — culture & nightlife ──

INSERT INTO itineraries (id, guide_id, title, description, duration_hours, buddy_cost, estimated_expense, category, is_published, avg_rating, total_bookings) VALUES
('dddddddd-0000-4000-a000-000000000301',
 'aaaaaaaa-0000-4000-a000-000000000003',
 'Bandra Chapel Lane Walk',
 'The real Bandra — not the Instagram Bandra. Tiny 400-year-old chapels, Portuguese-era houses crumbling next to new cafes, street art in every alley. We end at Bandstand with the best cutting chai in the suburb. 3 hours, zero tourist traps.',
 3.00, 850.00, 400.00, 'culture', TRUE, 4.90, 2),

('dddddddd-0000-4000-a000-000000000302',
 'aaaaaaaa-0000-4000-a000-000000000003',
 'Colaba to Bandra: The Full Story',
 'Start at Leopold Cafe (yes, that one), walk through Colaba Causeway, ferry to Elephanta Caves for a couple of hours, come back and local-train it to Bandra for sunset and dinner at a hidden Bandra East kebab place.',
 6.50, 1700.00, 1100.00, 'culture', TRUE, 4.80, 1),

('dddddddd-0000-4000-a000-000000000303',
 'aaaaaaaa-0000-4000-a000-000000000003',
 'After Dark: Mumbai Nightlife Crawl',
 'Starts at 7 PM. Jazz at The Quarter, cocktails in Khar, rooftop drinks in Lower Parel, live music at Todi Mill, and street food at Carter Road at midnight. I know every bouncer and bartender. Trust.',
 8.00, 2000.00, 2500.00, 'nightlife', TRUE, 0, 0);

-- ── Guide 4: Sneha (NMIMS) — business & photography ──

INSERT INTO itineraries (id, guide_id, title, description, duration_hours, buddy_cost, estimated_expense, category, is_published, avg_rating, total_bookings) VALUES
('dddddddd-0000-4000-a000-000000000401',
 'aaaaaaaa-0000-4000-a000-000000000004',
 'Dalal Street to Crawford Market',
 'Mumbai''s money nerve: Bombay Stock Exchange exterior, Dalal Street chai-and-trades, Asiatic Library reading room, then the sensory overload of Crawford Market. Perfect 3-hour intro to how this city hustles.',
 3.00, 900.00, 350.00, 'culture', TRUE, 4.50, 1),

('dddddddd-0000-4000-a000-000000000402',
 'aaaaaaaa-0000-4000-a000-000000000004',
 'The Dharavi Experience',
 'A respectful, guided walk through Asia''s most productive square mile. Leather workshops, pottery colony, recycling district, and rooftop views. Ends with lunch cooked by a local family. This tour changes how you see cities.',
 5.50, 1400.00, 600.00, 'culture', TRUE, 0, 0),

('dddddddd-0000-4000-a000-000000000403',
 'aaaaaaaa-0000-4000-a000-000000000004',
 'Golden Hour Mumbai: All-Day Photo Tour',
 'Sunrise at Sassoon Docks, morning light at Mahalaxmi Dhobi Ghat, golden hour at Marine Drive, blue hour at Worli Sea Link. I carry a spare lens and know every angle. Your portfolio will triple.',
 10.00, 2800.00, 1000.00, 'photography', TRUE, 0, 0);

-- ── Guide 5: Kabir (Mithibai) — adventure & hidden gems ──

INSERT INTO itineraries (id, guide_id, title, description, duration_hours, buddy_cost, estimated_expense, category, is_published, avg_rating, total_bookings) VALUES
('dddddddd-0000-4000-a000-000000000501',
 'aaaaaaaa-0000-4000-a000-000000000005',
 'Vile Parle Hidden Temples',
 'Six temples in three hours — most of them tucked behind apartment buildings or under flyovers. Each one has a story the priests love telling if you know Marathi (I''ll translate). Ends with Parle''s best pani puri.',
 3.00, 700.00, 200.00, 'culture', TRUE, 0, 0),

('dddddddd-0000-4000-a000-000000000502',
 'aaaaaaaa-0000-4000-a000-000000000005',
 'Suburban Mumbai: The Real Residential Life',
 'Skip the tourist trail. Ride the local train, eat at a highway dhaba, explore Goregaon''s Film City gates, walk through Aarey''s tribal hamlets, and watch planes land from Juhu Beach at dusk. This is how 20 million people actually live.',
 6.00, 1200.00, 700.00, 'adventure', TRUE, 0, 0),

('dddddddd-0000-4000-a000-000000000503',
 'aaaaaaaa-0000-4000-a000-000000000005',
 'Monsoon Mumbai: Waterfalls & Chai Marathon',
 'Only runs June-September. We chase waterfalls in Sanjay Gandhi Park, wade through flooded streets (it''s a feature, not a bug), hit every tapri for masala chai, and end at a rooftop with rain views. Rain gear mandatory.',
 8.00, 1800.00, 600.00, 'adventure', FALSE, 0, 0);
-- ^ Not published — seasonal, Kabir enables it when monsoon starts


-- ============================================================================
-- 5. ITINERARY STOPS (selected itineraries, 3-5 stops each)
-- ============================================================================

-- Stops for: Dadar to Matunga Food Sprint (Guide 1, itinerary 101)
INSERT INTO itinerary_stops (itinerary_id, stop_order, name, description, location_lat, location_lng, estimated_duration_minutes, estimated_cost, category) VALUES
('dddddddd-0000-4000-a000-000000000101', 1, 'Aaswad Restaurant',          'Legendary misal pav and Maharashtrian breakfast. We start strong.',            19.017600, 72.843400, 30, 150.00, 'food'),
('dddddddd-0000-4000-a000-000000000101', 2, 'Dadar Flower Market',         'Walk through mountains of marigold and jasmine. Great photos at dawn.',        19.018500, 72.844200, 25,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000101', 3, 'Shivaji Park Stalls',         'Hidden vada pav and pav bhaji carts that locals swear by.',                    19.028300, 72.838600, 30, 120.00, 'food'),
('dddddddd-0000-4000-a000-000000000101', 4, 'Cafe Madras',                 'South Indian filter coffee and crispy dosa. The perfect end.',                 19.030800, 72.850200, 35, 200.00, 'food');

-- Stops for: Art Deco Gateway (Guide 2, itinerary 201)
INSERT INTO itinerary_stops (itinerary_id, stop_order, name, description, location_lat, location_lng, estimated_duration_minutes, estimated_cost, category) VALUES
('dddddddd-0000-4000-a000-000000000201', 1, 'Marine Drive Ensemble',       'The Queen''s Necklace curve — the largest Art Deco seafront in the world.',     18.943800, 72.823500, 30,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000201', 2, 'Oval Maidan',                 'Cricket matches backed by Gothic and Deco buildings. Peak Mumbai.',            18.932200, 72.829000, 25,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000201', 3, 'Eros Cinema (exterior)',       'One of the finest Deco cinemas in Asia. We''ll break down the facade details.', 18.936700, 72.827700, 20,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000201', 4, 'Regal Cinema Lobby',          'Step inside the restored lobby — original terrazzo floors and brass fixtures.',  18.921800, 72.831800, 25, 100.00, 'attraction');

-- Stops for: Bandra Chapel Lane Walk (Guide 3, itinerary 301)
INSERT INTO itinerary_stops (itinerary_id, stop_order, name, description, location_lat, location_lng, estimated_duration_minutes, estimated_cost, category) VALUES
('dddddddd-0000-4000-a000-000000000301', 1, 'Mount Mary Basilica',         '1760s hilltop church with sea views. We start with the stairs and the story.', 19.042300, 72.821000, 25,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000301', 2, 'Chapel Road Heritage Houses', 'Portuguese-era bungalows being swallowed by the city. Beautiful decay.',       19.044100, 72.823800, 30,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000301', 3, 'Ranwar Village',              'A hidden East Indian village inside Bandra. Colourful doors, narrow lanes.',   19.047500, 72.827100, 30,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000301', 4, 'Bandstand Promenade',         'Sea-facing walk with cutting chai from the best tapri in the suburb.',         19.049800, 72.816900, 25, 100.00, 'experience');

-- Stops for: Dalal Street to Crawford Market (Guide 4, itinerary 401)
INSERT INTO itinerary_stops (itinerary_id, stop_order, name, description, location_lat, location_lng, estimated_duration_minutes, estimated_cost, category) VALUES
('dddddddd-0000-4000-a000-000000000401', 1, 'Bombay Stock Exchange',       'The exterior and Dalal Street — where India''s money story started.',          18.930600, 72.833400, 20,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000401', 2, 'Asiatic Society Library',     'One of Mumbai''s quietest rooms. Grand reading hall, old maps on display.',     18.931200, 72.831400, 30,   0.00, 'attraction'),
('dddddddd-0000-4000-a000-000000000401', 3, 'Crawford Market',             'Sensory overload: fruits, spices, pets, sweets. Rudyard Kipling was born nearby.', 18.947200, 72.835600, 40, 200.00, 'shopping');


-- ============================================================================
-- 6. BOOKINGS (3 — pending, completed, confirmed)
-- ============================================================================

INSERT INTO bookings (
  id, traveler_id, guide_id, itinerary_id,
  status, arrival_flight_number, arrival_time, departure_time, available_window_minutes,
  tour_start_time, tour_end_time,
  buddy_cost, estimated_expenses, platform_fee, gst_amount, total_amount,
  payment_status, created_at
) VALUES
-- Booking 1: Emma + Aarav (completed food tour)
(
  'eeeeeeee-0000-4000-a000-000000000001',
  'aaaaaaaa-0000-4000-a000-000000000011',  -- Emma
  'aaaaaaaa-0000-4000-a000-000000000001',  -- Aarav
  'dddddddd-0000-4000-a000-000000000101',  -- Dadar to Matunga Food Sprint
  'completed',
  'EK504', '2026-03-20 06:30:00+05:30', '2026-03-20 23:45:00+05:30', 600,
  '2026-03-20 08:00:00+05:30', '2026-03-20 11:00:00+05:30',
  800.00, 500.00, 200.00, 36.00, 1000.00,
  'paid', '2026-03-18 14:00:00+05:30'
),
-- Booking 2: James + Rohan (completed Bandra walk)
(
  'eeeeeeee-0000-4000-a000-000000000002',
  'aaaaaaaa-0000-4000-a000-000000000012',  -- James
  'aaaaaaaa-0000-4000-a000-000000000003',  -- Rohan
  'dddddddd-0000-4000-a000-000000000301',  -- Bandra Chapel Lane Walk
  'completed',
  'NH830', '2026-03-25 09:00:00+05:30', '2026-03-26 02:30:00+05:30', 720,
  '2026-03-25 11:00:00+05:30', '2026-03-25 14:00:00+05:30',
  850.00, 400.00, 212.50, 38.25, 1062.50,
  'paid', '2026-03-23 10:30:00+05:30'
),
-- Booking 3: Sofia + Priya (pending heritage tour)
(
  'eeeeeeee-0000-4000-a000-000000000003',
  'aaaaaaaa-0000-4000-a000-000000000013',  -- Sofia
  'aaaaaaaa-0000-4000-a000-000000000002',  -- Priya
  'dddddddd-0000-4000-a000-000000000202',  -- South Mumbai Heritage Circuit
  'pending',
  'LH762', '2026-04-18 07:15:00+05:30', '2026-04-19 01:00:00+05:30', 720,
  NULL, NULL,
  1600.00, 700.00, 400.00, 72.00, 2000.00,
  'pending', '2026-04-10 18:00:00+05:30'
);


-- ============================================================================
-- 7. REVIEWS (5 — on the 2 completed bookings, plus 3 extras for other guides)
-- ============================================================================
-- We need more completed bookings to hang reviews on (reviews FK to bookings).
-- Add 3 additional completed bookings first.

INSERT INTO bookings (
  id, traveler_id, guide_id, itinerary_id,
  status, arrival_flight_number, arrival_time, departure_time,
  tour_start_time, tour_end_time,
  buddy_cost, platform_fee, gst_amount, total_amount,
  payment_status, created_at
) VALUES
(
  'eeeeeeee-0000-4000-a000-000000000004',
  'aaaaaaaa-0000-4000-a000-000000000011',  -- Emma
  'aaaaaaaa-0000-4000-a000-000000000001',  -- Aarav
  'dddddddd-0000-4000-a000-000000000102',  -- Real Mumbai: Mills to Malls
  'completed', 'EK504', '2026-03-28 06:30:00+05:30', '2026-03-28 23:45:00+05:30',
  '2026-03-28 09:00:00+05:30', '2026-03-28 15:00:00+05:30',
  1500.00, 375.00, 67.50, 1875.00, 'paid', '2026-03-26 09:00:00+05:30'
),
(
  'eeeeeeee-0000-4000-a000-000000000005',
  'aaaaaaaa-0000-4000-a000-000000000013',  -- Sofia
  'aaaaaaaa-0000-4000-a000-000000000002',  -- Priya
  'dddddddd-0000-4000-a000-000000000201',  -- Art Deco Gateway
  'completed', 'LH762', '2026-04-01 07:15:00+05:30', '2026-04-01 22:00:00+05:30',
  '2026-04-01 09:00:00+05:30', '2026-04-01 12:00:00+05:30',
  900.00, 225.00, 40.50, 1125.00, 'paid', '2026-03-30 11:00:00+05:30'
),
(
  'eeeeeeee-0000-4000-a000-000000000006',
  'aaaaaaaa-0000-4000-a000-000000000012',  -- James
  'aaaaaaaa-0000-4000-a000-000000000004',  -- Sneha
  'dddddddd-0000-4000-a000-000000000401',  -- Dalal Street to Crawford Market
  'completed', 'NH830', '2026-04-05 09:00:00+05:30', '2026-04-05 23:00:00+05:30',
  '2026-04-05 10:30:00+05:30', '2026-04-05 13:30:00+05:30',
  900.00, 225.00, 40.50, 1125.00, 'paid', '2026-04-03 08:00:00+05:30'
);

-- Now the 5 reviews (one per completed booking, using first 5)
INSERT INTO reviews (id, booking_id, reviewer_id, reviewee_id, overall_rating, value_for_money_rating, safety_rating, personality_rating, comment, created_at) VALUES
(
  'ffffffff-0000-4000-a000-000000000001',
  'eeeeeeee-0000-4000-a000-000000000001',  -- Emma + Aarav (Food Sprint)
  'aaaaaaaa-0000-4000-a000-000000000011',  -- Emma (reviewer)
  'aaaaaaaa-0000-4000-a000-000000000001',  -- Aarav (reviewee)
  5, 5, 5, 5,
  'Aarav knew every stall owner by name. The misal pav at Aaswad was life-changing and Cafe Madras was the perfect finish. I''ve done food tours in 12 countries — this was top 3.',
  '2026-03-20 18:00:00+05:30'
),
(
  'ffffffff-0000-4000-a000-000000000002',
  'eeeeeeee-0000-4000-a000-000000000002',  -- James + Rohan (Bandra)
  'aaaaaaaa-0000-4000-a000-000000000012',  -- James (reviewer)
  'aaaaaaaa-0000-4000-a000-000000000003',  -- Rohan (reviewee)
  5, 5, 5, 5,
  'Rohan is a natural storyteller. Every chapel, every crumbling house had a story. The chai at Bandstand was the best I''ve had in India. Already recommending him to friends with Mumbai layovers.',
  '2026-03-25 20:00:00+05:30'
),
(
  'ffffffff-0000-4000-a000-000000000003',
  'eeeeeeee-0000-4000-a000-000000000004',  -- Emma + Aarav (Mills to Malls)
  'aaaaaaaa-0000-4000-a000-000000000011',  -- Emma (reviewer)
  'aaaaaaaa-0000-4000-a000-000000000001',  -- Aarav (reviewee)
  5, 4, 5, 5,
  'Second tour with Aarav — this one blew my mind. Walking through the old mill compounds while he explained their history was incredible. Lunch at the Worli fishing village was an unexpected highlight.',
  '2026-03-28 20:00:00+05:30'
),
(
  'ffffffff-0000-4000-a000-000000000004',
  'eeeeeeee-0000-4000-a000-000000000005',  -- Sofia + Priya (Art Deco)
  'aaaaaaaa-0000-4000-a000-000000000013',  -- Sofia (reviewer)
  'aaaaaaaa-0000-4000-a000-000000000002',  -- Priya (reviewee)
  4, 4, 5, 5,
  'Priya clearly loves architecture — she pointed out details on buildings I''d walked past a hundred times without noticing. Great photography tips too. Only wish we had more time at Oval Maidan.',
  '2026-04-01 19:00:00+05:30'
),
(
  'ffffffff-0000-4000-a000-000000000005',
  'eeeeeeee-0000-4000-a000-000000000006',  -- James + Sneha (Dalal Street)
  'aaaaaaaa-0000-4000-a000-000000000012',  -- James (reviewer)
  'aaaaaaaa-0000-4000-a000-000000000004',  -- Sneha (reviewee)
  4, 5, 5, 4,
  'Crawford Market was sensory overload in the best way. Sneha explained Dalal Street like a business documentary. Very professional, clearly knows her stuff. Would book again.',
  '2026-04-05 19:30:00+05:30'
);


-- ============================================================================
-- 8. MESSAGES (conversation snippets on the pending booking)
-- ============================================================================

INSERT INTO messages (booking_id, sender_id, content, is_read, created_at) VALUES
-- Sofia ↔ Priya conversation about the upcoming heritage tour
('eeeeeeee-0000-4000-a000-000000000003', 'aaaaaaaa-0000-4000-a000-000000000013',
 'Hi Priya! I land early morning on the 18th. Is 9 AM too early to start the heritage tour?',
 TRUE, '2026-04-10 18:05:00+05:30'),

('eeeeeeee-0000-4000-a000-000000000003', 'aaaaaaaa-0000-4000-a000-000000000002',
 'Hey Sofia! 9 AM is actually perfect — the light at CST is gorgeous in the morning and it won''t be too crowded yet. I''ll meet you at the station entrance.',
 TRUE, '2026-04-10 18:20:00+05:30'),

('eeeeeeee-0000-4000-a000-000000000003', 'aaaaaaaa-0000-4000-a000-000000000013',
 'Amazing! Should I bring anything specific? Comfortable shoes I assume?',
 TRUE, '2026-04-10 18:25:00+05:30'),

('eeeeeeee-0000-4000-a000-000000000003', 'aaaaaaaa-0000-4000-a000-000000000002',
 'Yes, comfy walking shoes and a water bottle. I''ll carry a portable charger in case your phone dies from all the photos you''ll be taking 😄 See you on the 18th!',
 FALSE, '2026-04-10 18:32:00+05:30'),

-- Quick message on Emma + Aarav completed booking
('eeeeeeee-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000011',
 'Just landed! At arrivals now.',
 TRUE, '2026-03-20 06:45:00+05:30'),

('eeeeeeee-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001',
 'Welcome to Mumbai! I''m right outside with a sign. Look for the guy in the orange VJTI hoodie 🧡',
 TRUE, '2026-03-20 06:48:00+05:30');
