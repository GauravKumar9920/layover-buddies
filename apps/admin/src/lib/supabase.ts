import { createClient } from '@supabase/supabase-js';

// Admin-only client. Uses the SERVICE ROLE key so we bypass RLS — this is
// why the app is gated behind a password and runs locally only.
//
// Never deploy this bundle publicly. If we ever do, swap to a server-side
// proxy that keeps the service key on the backend.
//
// PRODUCTION-BUILD GUARD: Vite inlines VITE_* env vars into the client
// bundle at build time, so `npm run build` followed by any kind of deploy
// would ship the service-role key as plain text in the JS output. Refuse
// to import this module in a production build unless an explicit escape
// hatch is set, so an accidental `vercel --prod` (or similar) crashes
// loudly rather than silently leaking god-mode DB access.
const env = import.meta.env;
if (env.PROD && !env.VITE_ADMIN_LOCAL_BUILD) {
  throw new Error(
    '[admin] Refusing to run a production build. The admin panel embeds ' +
      'a Supabase service-role key (VITE_SUPABASE_SERVICE_KEY) in the ' +
      'client bundle. Deploying that publicly leaks read/write to every ' +
      'table. If you are intentionally building locally for static preview, ' +
      'set VITE_ADMIN_LOCAL_BUILD=1 in admin/.env.local. To deploy this for ' +
      'real, first move Supabase calls to a server-side proxy that keeps ' +
      'the service key server-only.',
  );
}

const url = env.VITE_SUPABASE_URL as string | undefined;
const serviceKey = env.VITE_SUPABASE_SERVICE_KEY as string | undefined;

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
