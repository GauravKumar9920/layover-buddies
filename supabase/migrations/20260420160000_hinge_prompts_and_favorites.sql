-- Hinge-style prompts + Editorial zine guide profile + Favorites
-- =============================================================
-- This migration supports the new dating-app-inspired UX:
--
-- 1. itineraries.prompts — 3 short Q/A pairs the guide answers about the
--    tour ("The moment on this walk I always remember is..."). Rendered as
--    interleaved prompt cards between photos on the Hinge-style detail page.
--
-- 2. guide_profiles.prompts — 3 Q/A pairs at the guide (not tour) level,
--    shown in the editorial-zine guide profile ("Three things about me").
--
-- 3. guide_profiles.pull_quote — a single italic serif quote displayed
--    large at the top of the zine-style guide profile.
--
-- 4. favorites — a saved/liked itinerary per user, toggled from the heart
--    button on the detail page. One row per (user_id, itinerary_id).
--
-- Legacy rows keep empty defaults; the apps fall back to placeholder
-- content until guides fill these fields in.

-- ---------------------------------------------------------------------------
-- 1. itinerary-level prompts (Hinge-style detail page)
-- ---------------------------------------------------------------------------
-- Shape: [{ "question": "string", "answer": "string" }, ...]
-- Typically length 3, but not strictly enforced at the DB layer so guides
-- can add fewer during drafting.
alter table itineraries
  add column if not exists prompts jsonb default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2 & 3. guide-level prompts + pull quote (Editorial zine guide profile)
-- ---------------------------------------------------------------------------
alter table guide_profiles
  add column if not exists prompts jsonb default '[]'::jsonb,
  add column if not exists pull_quote text;

-- ---------------------------------------------------------------------------
-- 4. favorites
-- ---------------------------------------------------------------------------
-- Composite primary key (user_id, itinerary_id) gives us UPSERT semantics
-- for free: inserting the same pair twice is idempotent via ON CONFLICT.
create table if not exists favorites (
  user_id       uuid not null references users(id) on delete cascade,
  itinerary_id  uuid not null references itineraries(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, itinerary_id)
);

create index if not exists idx_favorites_user_id
  on favorites(user_id);
create index if not exists idx_favorites_itinerary_id
  on favorites(itinerary_id);
create index if not exists idx_favorites_created_at
  on favorites(created_at desc);

-- ---------------------------------------------------------------------------
-- RLS for favorites
-- ---------------------------------------------------------------------------
alter table favorites enable row level security;

-- Users can read their own favorites.
drop policy if exists "favorites_select_own" on favorites;
create policy "favorites_select_own"
  on favorites
  for select
  using (auth.uid() = user_id);

-- Users can insert a favorite for themselves.
drop policy if exists "favorites_insert_own" on favorites;
create policy "favorites_insert_own"
  on favorites
  for insert
  with check (auth.uid() = user_id);

-- Users can delete their own favorites (toggle off).
drop policy if exists "favorites_delete_own" on favorites;
create policy "favorites_delete_own"
  on favorites
  for delete
  using (auth.uid() = user_id);

-- Admins can read everything (matches pattern used elsewhere in schema).
drop policy if exists "favorites_admin_read_all" on favorites;
create policy "favorites_admin_read_all"
  on favorites
  for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
