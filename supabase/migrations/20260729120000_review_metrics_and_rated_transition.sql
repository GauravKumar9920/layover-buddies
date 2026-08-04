-- ============================================================================
-- REVIEW METRICS + COMPLETED -> RATED TRANSITION
-- ============================================================================
-- Review insertion is the authoritative event for two derived writes:
--   1. guide_profiles.avg_rating / total_reviews reflect valid traveler reviews;
--   2. the reviewed completed booking advances to rated.
--
-- Both writes belong in the database transaction that inserts the raw review.
-- A client-side read/average/update races concurrent reviewers, is blocked by
-- the guide-profile UPDATE lockdown, and can leave the booking stuck at
-- completed after a successful review.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.maintain_guide_review_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_old_reviewee uuid;
  v_new_reviewee uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_reviewee := OLD.reviewee_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_reviewee := NEW.reviewee_id;
  END IF;

  -- Serialize metric refreshes per affected guide. The aggregate runs in the
  -- following statement, after any competing review transaction holding this
  -- row commits, so concurrent inserts cannot leave a lost count/average.
  PERFORM gp.user_id
    FROM public.guide_profiles AS gp
   WHERE gp.user_id = v_old_reviewee
      OR gp.user_id = v_new_reviewee
   ORDER BY gp.user_id
   FOR UPDATE;

  -- Only traveler -> guide reviews that agree with their booking relationship
  -- contribute to guide reputation. This derives the denormalized values from
  -- raw reviews rather than trusting reviewee_id alone.
  UPDATE public.guide_profiles AS gp
     SET avg_rating = COALESCE(
           (
             SELECT round(avg(r.overall_rating)::numeric, 2)
               FROM public.reviews AS r
               JOIN public.bookings AS b
                 ON b.id = r.booking_id
                AND b.traveler_id = r.reviewer_id
                AND b.guide_id = r.reviewee_id
              WHERE r.reviewee_id = gp.user_id
           ),
           0
         )::numeric(3, 2),
         total_reviews = (
           SELECT count(*)::integer
             FROM public.reviews AS r
             JOIN public.bookings AS b
               ON b.id = r.booking_id
              AND b.traveler_id = r.reviewer_id
              AND b.guide_id = r.reviewee_id
            WHERE r.reviewee_id = gp.user_id
         )
   WHERE gp.user_id = v_old_reviewee
      OR gp.user_id = v_new_reviewee;

  -- The state machine permits completed -> rated for rating_submitted. Derive
  -- eligibility from the locked booking relationship instead of trusting
  -- client payload fields. SECURITY DEFINER is required because end-user
  -- booking UPDATEs are deliberately limited to pre-signing transitions.
  IF TG_OP <> 'DELETE' THEN
    UPDATE public.bookings AS b
       SET status = 'rated'
     WHERE b.id = NEW.booking_id
       AND b.status = 'completed'
       AND b.traveler_id = NEW.reviewer_id
       AND b.guide_id = NEW.reviewee_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.maintain_guide_review_state()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS maintain_guide_review_state ON public.reviews;
CREATE TRIGGER maintain_guide_review_state
  AFTER INSERT OR UPDATE OR DELETE
  ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_guide_review_state();

-- Repair denormalized metrics for reviews that predate the trigger.
UPDATE public.guide_profiles AS gp
   SET avg_rating = COALESCE(
         (
           SELECT round(avg(r.overall_rating)::numeric, 2)
             FROM public.reviews AS r
             JOIN public.bookings AS b
               ON b.id = r.booking_id
              AND b.traveler_id = r.reviewer_id
              AND b.guide_id = r.reviewee_id
            WHERE r.reviewee_id = gp.user_id
         ),
         0
       )::numeric(3, 2),
       total_reviews = (
         SELECT count(*)::integer
           FROM public.reviews AS r
           JOIN public.bookings AS b
             ON b.id = r.booking_id
            AND b.traveler_id = r.reviewer_id
            AND b.guide_id = r.reviewee_id
          WHERE r.reviewee_id = gp.user_id
       );

-- Repair completed bookings that already have the traveler's guide review.
UPDATE public.bookings AS b
   SET status = 'rated'
 WHERE b.status = 'completed'
   AND EXISTS (
     SELECT 1
       FROM public.reviews AS r
      WHERE r.booking_id = b.id
        AND r.reviewer_id = b.traveler_id
        AND r.reviewee_id = b.guide_id
   );
