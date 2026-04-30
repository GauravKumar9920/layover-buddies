-- Add hometown column to guide_profiles
-- =======================================
-- The traveler-facing editorial-zine profile (mobile/app/(traveler)/guide/[id].tsx)
-- references guide.hometown in 4 places — the "LAYOVER BUDDIES · {HOMETOWN}"
-- masthead cue, the hero subtitle, and two fallback-content generators.
--
-- Until this migration lands, the column did not exist: both the API
-- normalizer (mobile/lib/api/guides.ts:125) and the editor's mappedProfile
-- (mobile/app/(guide)/profile.tsx:100) hardcoded `hometown: null`, and the
-- traveler view fell back to the literal string "Mumbai".
--
-- After this migration the column exists, the editor exposes an input,
-- and guides can set their actual hometown. Empty values still fall back
-- gracefully in the traveler UI ("Mumbai" / "this city").

alter table guide_profiles
  add column if not exists hometown text;
