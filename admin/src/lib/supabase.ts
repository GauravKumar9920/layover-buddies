import { createClient } from '@supabase/supabase-js';

// Admin-only client. Uses the SERVICE ROLE key so we bypass RLS — this is
// why the app is gated behind a password and runs locally only.
//
// Never deploy this bundle publicly. If we ever do, swap to a server-side
// proxy that keeps the service key on the backend.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string | undefined;

if (!url || !serviceKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[admin] Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_KEY. ' +
      'Copy admin/.env.local.example to admin/.env.local and fill them in.',
  );
}

export const supabase = createClient(url ?? 'http://localhost:54321', serviceKey ?? 'missing-key', {
  auth: {
    // We're not using Supabase Auth inside the admin — the service key is
    // our bearer token. Don't persist anything.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export function isConfigured(): boolean {
  return Boolean(url && serviceKey);
}
