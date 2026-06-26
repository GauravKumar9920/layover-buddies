# scripts/

One-off operational SQL/utility scripts that aren't part of the versioned
Supabase migration history. Run them manually against the database when needed.

## Contents

| File | Purpose |
|---|---|
| `auth_sync.sql` | Defines `public.handle_new_auth_user_sync(uuid)` — a `SECURITY DEFINER` function that backfills a `public.users` row (role, provider, name) from an existing `auth.users` record. Use to repair a user that exists in `auth.users` but is missing from `public.users`. |

## Notes

- The canonical, versioned database schema lives in [`supabase/migrations/`](../supabase/migrations/) and seed data in [`supabase/seed.sql`](../supabase/seed.sql) — **not** here. Add schema changes as a new migration, not a script in this folder.
- Scripts here are applied by hand (e.g. via the Supabase SQL editor or `psql`), so keep each one idempotent and safe to re-run.
