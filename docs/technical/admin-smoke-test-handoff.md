# Mumbai Buddies — Admin Panel GUI Smoke-Test Handoff

**Purpose:** Step-by-step runbook for Claude Code to execute a live, browser-driven smoke test of the new local admin panel at `/admin/`. The panel was scaffolded in the Cowork session on 2026-04-25 and has been built + type-checked cleanly, but has not yet been exercised in a browser against a live Supabase project.

**Owner:** Gaurav Sharma
**Continuation of:** `docs/technical/claude-code-handoff-2026-04-19.md`
**Target:** `/Users/gaurav/Desktop/mumbai-buddies/admin/` (Vite + React + Tailwind, runs on `127.0.0.1:5174`)

---

## 0. What this admin panel is (one paragraph)

Local-only, password-gated React app for the solo admin. Uses the Supabase **service-role** key to bypass RLS. Four screens: Users (role filter), Bookings (status filter + joined names), Revenue (7d/30d/90d/all-time, earned vs pipeline), SOS events (Acknowledge/Resolve actions + Google Maps link). Full design notes + security posture in `admin/README.md`.

---

## 1. Pre-flight (do these first)

### 1a. Confirm the files you should be looking at

```
admin/
├── package.json
├── index.html
├── vite.config.ts        # binds to 127.0.0.1:5174
├── tailwind.config.js
├── tsconfig.json
├── .env.local.example    # rename to .env.local for runtime
└── src/
    ├── App.tsx           # router + auth gate
    ├── main.tsx
    ├── index.css
    ├── vite-env.d.ts     # typed import.meta.env
    ├── lib/
    │   ├── supabase.ts   # service-role client
    │   ├── auth.ts       # password gate (sessionStorage)
    │   └── format.ts     # formatINR, formatDate, relative
    ├── components/
    │   ├── Login.tsx
    │   ├── Shell.tsx
    │   ├── PageHeader.tsx
    │   ├── DataTable.tsx
    │   └── StatusBadge.tsx
    └── pages/
        ├── Users.tsx
        ├── Bookings.tsx
        ├── Revenue.tsx
        └── SOS.tsx
```

### 1b. Verify the static build still passes

```bash
cd /Users/gaurav/Desktop/mumbai-buddies/admin
npm install        # already run once from Cowork; re-run if node_modules is missing
npx tsc -b         # must exit cleanly (no TS errors)
npx vite build     # should complete in ~1–2s, output to dist/
```

**Acceptance:** `tsc -b` prints nothing (no errors); `vite build` reports `✓ built in <Xs>`. If anything errors, stop and fix before continuing.

### 1c. Set up `.env.local`

```bash
cd /Users/gaurav/Desktop/mumbai-buddies/admin
cp .env.local.example .env.local
```

Then edit `.env.local` and fill in:

| Var | Where to get it |
| --- | --- |
| `VITE_SUPABASE_URL` | Same as `mobile/.env.local` → `EXPO_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_SERVICE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` (secret). **Not** the anon key. |
| `VITE_ADMIN_PASSWORD` | Any string. Pick something Gaurav will remember. Suggest `test-admin-123` for the smoke test. |

If Gaurav hasn't provided the service key yet, pause and ask — without it the Supabase queries will fail and the smoke test is blocked past the login screen.

---

## 2. Start the dev server

```bash
cd /Users/gaurav/Desktop/mumbai-buddies/admin
npm run dev
```

Expected console output:

```
  VITE v5.x.x  ready in <N> ms

  ➜  Local:   http://127.0.0.1:5174/
```

**Acceptance:** Vite binds to `127.0.0.1:5174` specifically (not `localhost` or `0.0.0.0`). If it picks a different port (5175, 5176, …), another process is holding 5174 — either kill it or use the new port throughout.

Leave this terminal running. Open a **second** terminal for any follow-up bash commands.

---

## 3. GUI smoke test — the actual walkthrough

Open **http://127.0.0.1:5174** in Chrome (or drive it with Claude-in-Chrome / computer-use).

### Test A — Login screen renders

**Acceptance checklist:**
- [ ] Page loads without a blank screen or console error (check DevTools console).
- [ ] Gradient logo square renders in top-left (saffron → pink diagonal).
- [ ] "Mumbai Buddies · Admin — local only" heading present.
- [ ] Password input is focused on mount.
- [ ] "Unlock" button is saffron (`#F97316`) with hover → darker saffron.
- [ ] If Supabase env vars are missing, a yellow warning banner appears above the form.
- [ ] Typing the wrong password shows red "Wrong password." text below the input.

### Test B — Authentication

- [ ] Type the password from `VITE_ADMIN_PASSWORD` → click Unlock.
- [ ] Redirects to `/users` automatically.
- [ ] Sidebar shell renders: 4 nav items (Users, Bookings, Revenue, SOS) + "Sign out" at the bottom.
- [ ] Closing and reopening the tab should **re-prompt** for password (sessionStorage, not localStorage — this is intentional).

### Test C — Users page (`/users`)

- [ ] Table headers: Name, Role, Verified, Joined, ID.
- [ ] Row count in the subtitle matches rendered rows.
- [ ] Avatar initial circle renders left of each name.
- [ ] Role badges use color: `traveler` = neutral, `guide` = green, `admin` = pink/info.
- [ ] Filter pills "All / Travelers / Guides / Admins" switch the query and show live counts.
- [ ] Clicking a filter re-queries Supabase (check Network tab: filter should become an `eq.role` param).
- [ ] No JavaScript errors in the console.

**If empty:** the seed data from `supabase/seed.sql` has 5 guides + travelers — if you see zero rows, the env var may point at the wrong project, or RLS bypass isn't working (the service-role key is wrong).

### Test D — Bookings page (`/bookings`)

- [ ] Subtitle shows loaded count, capped at 500.
- [ ] Each row shows "T: <traveler name>" and "G: <guide name>" stacked — joined from `users` via `traveler_id` / `guide_id` foreign keys.
- [ ] Status badge colors: pending=warn, confirmed=success, in_progress=info, completed=success, cancelled=neutral, disputed=danger.
- [ ] Payment status badge renders alongside.
- [ ] Total column right-aligned with tabular-nums font (`DM Sans`), prefixed with `₹`.
- [ ] Arrival column shows formatted date + time.
- [ ] Filter pills: All / Active / pending / confirmed / in progress / completed / cancelled / disputed.
- [ ] "Active" filter matches `pending, guide_accepted, confirmed, in_progress`.

### Test E — Revenue page (`/revenue`)

- [ ] 7 metric cards: Gross / Platform take / Guide payouts / Avg booking (row 1), Pipeline / GST / Cancelled (row 2).
- [ ] All amounts prefixed with `₹` and use `en-IN` locale (commas at Indian positions, e.g. `₹1,23,456`).
- [ ] Time-window toggle (7d / 30d / 90d / All) changes the subtitle and re-queries.
- [ ] "Gross revenue" counts only bookings with `status='completed' AND payment_status='paid'`.
- [ ] "Pipeline" counts `confirmed`, `in_progress`, `guide_accepted` with `payment_status != 'refunded'`.
- [ ] Methodology footnote renders at the bottom.
- [ ] If the seed data has any completed bookings, the numbers should be non-zero.

### Test F — SOS events page (`/sos`)

- [ ] Default filter is "Open" — shows only `triggered` + `acknowledged`.
- [ ] Subtitle is "⚠ N open" when open items exist, else "No open SOS events right now."
- [ ] Location column is a clickable `maps.google.com/?q=lat,lng` link with primary color.
- [ ] For a `triggered` row: both "Ack" (warn) and "Resolve" (success) buttons visible.
- [ ] For an `acknowledged` row: only "Resolve" button visible.
- [ ] For a `resolved` row: no action buttons.
- [ ] **Write test:** Click "Ack" on a `triggered` row → badge optimistically flips to `acknowledged`, Ack button disappears. Refresh the page → the change persists (row still `acknowledged`).
- [ ] **Write test:** Click "Resolve" → badge flips to `resolved`, `resolved_at` is set. Verify in Supabase Studio: `select status, resolved_at from sos_alerts where id = '<row-id>'` shows the updated values.

**If no SOS rows exist** (likely — seed doesn't include them): create one manually in Supabase Studio:

```sql
insert into sos_alerts (booking_id, triggered_by, latitude, longitude, status)
select id, traveler_id, 19.0760, 72.8777, 'triggered'
from bookings limit 1;
```

Then refresh `/sos` and redo the write tests above.

### Test G — Sign out

- [ ] Click "Sign out" in sidebar footer → redirects to login screen.
- [ ] Hitting a protected route (`/users`) directly after sign-out → shows login, not protected content.

### Test H — Cross-cutting checks

- [ ] No `console.error` or `console.warn` anywhere during the walkthrough (except the intentional "missing env" warn from `supabase.ts` — only if env is missing, which shouldn't be the case if 1c was done right).
- [ ] Font loading works: headings use Plus Jakarta Sans, body Inter, numbers DM Sans (check in DevTools → Elements → Computed).
- [ ] Hover states work on nav items and filter pills.
- [ ] Resize to ~1280px wide — layout should still be usable. (Admin is desktop-first; mobile is not a target.)

---

## 4. Known non-issues (don't flag these)

- **EPERM warnings during `npm install`** on `node_modules/@esbuild/linux-*` and `fsevents` cleanup — macOS cross-platform binary install noise. Harmless.
- **`secondary-dark` utility class** — defined in `admin/tailwind.config.js` as `PINK[700]`. If something looks miscolored, confirm Tailwind is reading the admin config (not the root `tailwind.config.js`).
- **`bookings.gst_amount` may be null** on older seed rows. Revenue page's numeric coercion (`Number(r.gst_amount ?? 0)`) handles this.
- **`platform_fee` column** exists in the schema but the mobile booking flow uses a client-side 25% calculation — server-side value may be null until the Razorpay webhook is wired. Revenue will just undercount platform take for now; that's expected.

---

## 5. Things to report back

After the walkthrough, reply with:

1. **Pass/fail per test** (A through H above).
2. **Screenshots** of: login, users list, bookings list, revenue cards, SOS with at least one row.
3. **Any console errors** verbatim.
4. **Any visual bugs** — alignment, color, typography, hover states.
5. **Any Supabase query failures** — copy the error message and the failing request from the Network tab.
6. **Performance notes** — if any page takes > 1s to render after auth, flag it.

---

## 6. Stop conditions (don't push through these)

- TS or Vite build fails in step 1b → fix before proceeding.
- Supabase queries return 401/403 → the service-role key is wrong; stop and ask.
- Login screen doesn't render at all → check the browser console + terminal running `npm run dev` for errors. Likely a missing dependency or Vite config issue.
- Any write test (SOS Acknowledge/Resolve) fails to persist → **do not** retry blindly; it may be hitting an RLS policy we didn't account for. Inspect the Supabase response and report back.

---

## 7. Out of scope for this smoke test

- Mobile responsive design (admin is desktop-only by design).
- Dark mode (not implemented).
- Auth pages beyond the password gate.
- CSV export, bulk actions, search boxes (not in the day-1 scope).
- Guide approval queue (guides auto-approve per product spec).

Any of the above that Gaurav flags after the smoke test → follow-up tickets, not smoke-test failures.
