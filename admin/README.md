# Detour — Admin

Local-only admin console for the Detour marketplace. Runs as a separate Vite + React + Tailwind app on `127.0.0.1:5174`. Uses the Supabase service-role key and bypasses RLS, so it's gated by a password and is **not** meant to be deployed publicly in its current form.

## Day-1 screens

| Route | Purpose |
| --- | --- |
| `/users` | List travelers, guides, admins. Filter by role. |
| `/bookings` | List bookings joined with traveler/guide names. Filter by status. |
| `/revenue` | Gross revenue, platform take, GST, guide payouts, pipeline. 7d / 30d / 90d / all-time. |
| `/sos` | SOS events with map link, Acknowledge / Resolve actions. |

No guide-approval queue — guides auto-approve on signup per current product spec.

## Setup

```bash
cd admin
npm install
cp .env.local.example .env.local
# edit .env.local — fill in VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY, VITE_ADMIN_PASSWORD
npm run dev
# open http://127.0.0.1:5174
```

### Required env vars

- `VITE_SUPABASE_URL` — same project URL the mobile app points at
- `VITE_SUPABASE_SERVICE_KEY` — **service role** key (not the anon key). Find at Supabase Dashboard → Project Settings → API → `service_role`.
- `VITE_ADMIN_PASSWORD` — password for the gate screen. Plain string; change it from the default.

## Security notes

- The service key bypasses Row Level Security. Anyone with access to this bundle can read and write any row in the project.
- Vite binds the dev server to `127.0.0.1` only — it is not reachable from other machines on the network.
- The password lives in `sessionStorage`; closing the tab signs you out.
- Do **not** deploy this bundle as-is to a public URL. If you ever need remote access, introduce a server-side proxy that keeps the service key on the backend and authenticates admins with Supabase Auth + an `admin` role check.
- `.env.local` is gitignored — never commit it.

## Tables it reads / writes

Reads: `users`, `bookings` (+ joined `users`), `sos_alerts` (+ joined `users`, `bookings`).
Writes: `sos_alerts.status` and `sos_alerts.resolved_at` (from the Acknowledge / Resolve buttons).
