-- ============================================================================
-- REPORTS & BLOCKS — user safety / moderation (Apple Guideline 1.2, UGC)
-- ============================================================================
-- An in-person-meeting marketplace with chat had zero report/block/moderation.
-- This adds:
--   • reports        — a user reports another user (optionally tied to a booking)
--   • blocked_users  — a user blocks another user
--   • a messages BEFORE INSERT guard so a block actually stops contact
-- Reports are readable only by their author (clients) and the service role
-- (admin console); status transitions happen server-side / in admin.
-- ============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM ('harassment', 'safety', 'inappropriate', 'spam', 'scam', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'actioned', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── reports ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Optional context: which trip/chat this arose from.
  booking_id        UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reason            report_reason NOT NULL DEFAULT 'other',
  details           TEXT,
  status            report_status NOT NULL DEFAULT 'open',
  admin_notes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ,
  CONSTRAINT report_not_self CHECK (reporter_id <> reported_user_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_status         ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user  ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter       ON reports(reporter_id);

-- ── blocked_users ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT block_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT uniq_block UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users  ENABLE ROW LEVEL SECURITY;

-- reports: a user files their own reports and can see the ones they filed.
-- Nobody (client-side) can read reports filed against them, or edit any report —
-- triage happens in the admin console via the service role, which bypasses RLS.
DROP POLICY IF EXISTS "Users can file reports" ON reports;
CREATE POLICY "Users can file reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can read own filed reports" ON reports;
CREATE POLICY "Users can read own filed reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- blocked_users: a user fully manages their own block list.
DROP POLICY IF EXISTS "Users manage own blocks" ON blocked_users;
CREATE POLICY "Users manage own blocks" ON blocked_users
  FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- Column grants: authenticated users may write only the columns they own.
REVOKE ALL ON reports FROM anon;
REVOKE ALL ON blocked_users FROM anon;
GRANT SELECT, INSERT ON reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON blocked_users TO authenticated;

-- service_role (the admin console) bypasses RLS but Postgres privilege GRANTs
-- are a separate layer — without these, admin triage (list + update status)
-- fails with permission errors despite the bypass.
GRANT SELECT, UPDATE ON reports TO service_role;
GRANT SELECT ON blocked_users TO service_role;

-- ── Message block guard ──────────────────────────────────────────────────────
-- Stop a blocked pair from messaging in either direction. SECURITY DEFINER so it
-- can see blocks the CALLER can't (RLS only exposes a user's own blocks, so a
-- SECURITY INVOKER check couldn't detect "the other party blocked me").
CREATE OR REPLACE FUNCTION enforce_message_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other uuid;
BEGIN
  SELECT CASE WHEN b.traveler_id = NEW.sender_id THEN b.guide_id ELSE b.traveler_id END
    INTO v_other
    FROM bookings b
   WHERE b.id = NEW.booking_id;

  IF v_other IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM blocked_users
     WHERE (blocker_id = NEW.sender_id AND blocked_id = v_other)
        OR (blocker_id = v_other       AND blocked_id = NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'messaging_blocked'
      USING ERRCODE = 'check_violation',
            HINT = 'One of you has blocked the other; messaging is disabled.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_not_blocked ON messages;
CREATE TRIGGER trg_enforce_message_not_blocked
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_message_not_blocked();
