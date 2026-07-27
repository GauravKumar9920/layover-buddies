-- ============================================================================
-- STRUCTURED TRAVELER PROFILE
-- ============================================================================
-- Travelers do not need a public photo gallery. Guides need a concise trip
-- brief: who the traveler is, what kind of pace they enjoy, food/access needs,
-- and anything that will make the layover work better.
-- ============================================================================

ALTER TABLE public.traveler_profiles
  ADD COLUMN IF NOT EXISTS about_me text,
  ADD COLUMN IF NOT EXISTS travel_pace text,
  ADD COLUMN IF NOT EXISTS dietary_preferences text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS accessibility_notes text,
  ADD COLUMN IF NOT EXISTS onboarding_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz;

ALTER TABLE public.traveler_profiles
  DROP CONSTRAINT IF EXISTS traveler_profiles_travel_pace_check;
ALTER TABLE public.traveler_profiles
  ADD CONSTRAINT traveler_profiles_travel_pace_check
  CHECK (
    travel_pace IS NULL
    OR travel_pace IN ('relaxed', 'balanced', 'packed')
  );

ALTER TABLE public.traveler_profiles
  DROP CONSTRAINT IF EXISTS traveler_profiles_about_me_length;
ALTER TABLE public.traveler_profiles
  ADD CONSTRAINT traveler_profiles_about_me_length
  CHECK (about_me IS NULL OR char_length(about_me) <= 500);

ALTER TABLE public.traveler_profiles
  DROP CONSTRAINT IF EXISTS traveler_profiles_accessibility_notes_length;
ALTER TABLE public.traveler_profiles
  ADD CONSTRAINT traveler_profiles_accessibility_notes_length
  CHECK (
    accessibility_notes IS NULL
    OR char_length(accessibility_notes) <= 500
  );

COMMENT ON COLUMN public.traveler_profiles.about_me IS
  'A short note that helps a guide understand the person and the kind of layover they want.';
COMMENT ON COLUMN public.traveler_profiles.travel_pace IS
  'Preferred outing pace: relaxed, balanced, or packed.';
COMMENT ON COLUMN public.traveler_profiles.dietary_preferences IS
  'Structured food preferences used while planning; not part of a public profile.';
COMMENT ON COLUMN public.traveler_profiles.accessibility_notes IS
  'Optional mobility, sensory, or other access needs shared only where traveler-profile RLS permits.';

-- One traveler can return to Mumbai more than once. A layover is trip context,
-- not permanent identity, so it gets its own lifecycle instead of overwriting
-- profile history forever.
CREATE TABLE IF NOT EXISTS public.traveler_layovers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traveler_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  airport_code  varchar(3) NOT NULL DEFAULT 'BOM',
  arrival_at    timestamptz NOT NULL,
  departure_at  timestamptz NOT NULL,
  flight_in     varchar(20),
  flight_out    varchar(20),
  group_size    smallint NOT NULL DEFAULT 1
    CHECK (group_size BETWEEN 1 AND 3),
  status        text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (departure_at > arrival_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS traveler_layovers_one_active
  ON public.traveler_layovers(traveler_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS traveler_layovers_history
  ON public.traveler_layovers(traveler_id, created_at DESC);

DROP TRIGGER IF EXISTS update_traveler_layovers_updated_at
  ON public.traveler_layovers;
CREATE TRIGGER update_traveler_layovers_updated_at
  BEFORE UPDATE ON public.traveler_layovers
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.traveler_layovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travelers can read own layovers"
  ON public.traveler_layovers FOR SELECT TO authenticated
  USING (traveler_id = auth.uid());
CREATE POLICY "Travelers can create own layovers"
  ON public.traveler_layovers FOR INSERT TO authenticated
  WITH CHECK (
    traveler_id = auth.uid()
    AND public.account_is_active(auth.uid())
  );
CREATE POLICY "Travelers can update own layovers"
  ON public.traveler_layovers FOR UPDATE TO authenticated
  USING (
    traveler_id = auth.uid()
    AND public.account_is_active(auth.uid())
  )
  WITH CHECK (
    traveler_id = auth.uid()
    AND public.account_is_active(auth.uid())
  );
CREATE POLICY "Travelers can delete own layovers"
  ON public.traveler_layovers FOR DELETE TO authenticated
  USING (
    traveler_id = auth.uid()
    AND public.account_is_active(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traveler_layovers TO authenticated;

-- Safety data has a stricter boundary than profile/preferences. A Buddy can
-- read it only while a booked trip is genuinely in progress/ready.
CREATE TABLE IF NOT EXISTS public.traveler_safety_profiles (
  traveler_id             uuid PRIMARY KEY
    REFERENCES public.users(id) ON DELETE CASCADE,
  gender                  text,
  emergency_contact_name  varchar(255),
  emergency_contact_phone varchar(20),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (
    gender IS NULL
    OR gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say')
  )
);

DROP TRIGGER IF EXISTS update_traveler_safety_profiles_updated_at
  ON public.traveler_safety_profiles;
CREATE TRIGGER update_traveler_safety_profiles_updated_at
  BEFORE UPDATE ON public.traveler_safety_profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.traveler_safety_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travelers can read own safety profile"
  ON public.traveler_safety_profiles FOR SELECT TO authenticated
  USING (traveler_id = auth.uid());
CREATE POLICY "Guides can read safety profile during active trip"
  ON public.traveler_safety_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.traveler_id = traveler_safety_profiles.traveler_id
        AND b.guide_id = auth.uid()
        AND b.status IN ('trip_ready', 'in_progress')
    )
  );
CREATE POLICY "Travelers can create own safety profile"
  ON public.traveler_safety_profiles FOR INSERT TO authenticated
  WITH CHECK (
    traveler_id = auth.uid()
    AND public.account_is_active(auth.uid())
  );
CREATE POLICY "Travelers can update own safety profile"
  ON public.traveler_safety_profiles FOR UPDATE TO authenticated
  USING (
    traveler_id = auth.uid()
    AND public.account_is_active(auth.uid())
  )
  WITH CHECK (
    traveler_id = auth.uid()
    AND public.account_is_active(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.traveler_safety_profiles TO authenticated;

-- Migrate the existing single layover and safety fields, then clear their old
-- locations so the broad traveler_profiles booking policy cannot expose an
-- emergency contact outside an active trip.
INSERT INTO public.traveler_layovers (
  traveler_id,
  arrival_at,
  departure_at,
  flight_in,
  flight_out,
  status
)
SELECT
  user_id,
  arrival_at,
  departure_at,
  flight_in,
  flight_out,
  'active'
FROM public.traveler_profiles
WHERE arrival_at IS NOT NULL
  AND departure_at IS NOT NULL
  AND departure_at > arrival_at
ON CONFLICT DO NOTHING;

INSERT INTO public.traveler_safety_profiles (
  traveler_id,
  gender,
  emergency_contact_name,
  emergency_contact_phone
)
SELECT
  user_id,
  gender,
  emergency_contact_name,
  emergency_contact_phone
FROM public.traveler_profiles
WHERE gender IS NOT NULL
   OR emergency_contact_name IS NOT NULL
   OR emergency_contact_phone IS NOT NULL
ON CONFLICT (traveler_id) DO UPDATE
SET gender = EXCLUDED.gender,
    emergency_contact_name = EXCLUDED.emergency_contact_name,
    emergency_contact_phone = EXCLUDED.emergency_contact_phone;

UPDATE public.traveler_profiles
SET arrival_at = NULL,
    departure_at = NULL,
    flight_in = NULL,
    flight_out = NULL,
    gender = NULL,
    emergency_contact_name = NULL,
    emergency_contact_phone = NULL;

-- The account-deletion function predates these fields and the guide photo
-- table. Scrub them when that function marks users.deleted_at, without
-- rewriting the larger financial-history-preserving deletion transaction.
CREATE OR REPLACE FUNCTION public.scrub_structured_profiles_on_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.traveler_profiles
       SET about_me = NULL,
           travel_pace = NULL,
           dietary_preferences = ARRAY[]::text[],
           accessibility_notes = NULL
     WHERE user_id = NEW.id;

    DELETE FROM public.traveler_layovers
     WHERE traveler_id = NEW.id;

    DELETE FROM public.traveler_safety_profiles
     WHERE traveler_id = NEW.id;

    DELETE FROM public.guide_profile_photos photos
    USING public.guide_profiles gp
    WHERE photos.guide_profile_id = gp.id
      AND gp.user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.scrub_structured_profiles_on_deletion() FROM PUBLIC;

DROP TRIGGER IF EXISTS scrub_structured_profiles_on_deletion
  ON public.users;
CREATE TRIGGER scrub_structured_profiles_on_deletion
  AFTER UPDATE OF deleted_at ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.scrub_structured_profiles_on_deletion();
