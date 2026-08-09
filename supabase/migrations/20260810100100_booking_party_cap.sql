-- ============================================================================
-- BOOKINGS PARTY CAP 10 → 4
-- ============================================================================
-- Deliberately NOT VALID, and deliberately without a backfill.
--
-- bookings rows are financial snapshots: buddy_cost, estimated_expenses,
-- platform_fee and total_amount were all computed as perPerson × num_travelers
-- and locked at booking time. Clamping a historical num_travelers from 7 down
-- to 4 would leave the money at ×7 and the multiplier at ×4 — permanently
-- inconsistent — and lib/guide/metrics.ts sums this column as "travellers
-- hosted", so it would retroactively edit guides' lifetime stats.
--
-- An UPDATE here would also have to contend with the BEFORE UPDATE trigger
-- installed by 20260707110000_bookings_update_lockdown.sql. NOT VALID adds no
-- UPDATE at all: it enforces the cap on every new and updated row while
-- leaving history exactly as it was booked.
--
-- No local row currently violates the new cap, so an operator can promote this
-- once they have confirmed the same upstream:
--   ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_num_travelers_check;
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.bookings'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%num_travelers%'
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_num_travelers_check
  CHECK (num_travelers >= 1 AND num_travelers <= 4) NOT VALID;

COMMENT ON COLUMN public.bookings.num_travelers IS
  'Party-size SNAPSHOT taken at inquiry time from traveler_layovers.group_size. Pricing on bookings.total_amount already reflects this multiplier. The layover is the live input; this column is the immutable record — a traveler editing their layover later must not change what a past booking was priced on.';

NOTIFY pgrst, 'reload schema';
