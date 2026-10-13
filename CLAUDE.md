# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Last verified: 2026-09-26. `AGENTS.md` mirrors this file for other agents. When you change one, update the other.

## What This Project Is
Detour is a marketplace for Mumbai layover experiences. The current launch is founder-hosted, and student buddies are planned for January 2027.

The repo is an **npm-workspaces monorepo** orchestrated by Turborepo. The root workspaces are `apps/admin`, `apps/marketing`, `apps/mobile` and `packages/*`.

| Path | Package | What |
|---|---|---|
| `apps/mobile/` | `@detour/mobile` | React Native 0.76 + Expo 52 + Expo Router 4, NativeWind 4, Zustand, Reanimated |
| `apps/admin/` | `@detour/admin` | "Admin 2.0" ops console: Vite 8 + React 18 + React Router 7 + Tailwind → `detour-admin.vercel.app` |
| `apps/marketing/` | `@detour/marketing` | Astro 7 static site with optional Sanity content → detourtrips.com |
| `apps/studio/` | (not a workspace) | Sanity 6 Studio on **React 19**, with its **own lockfile** so React 19 is never hoisted into Expo or admin |
| `packages/types` | `@detour/types` | Shared domain models |
| `packages/config` | `@detour/config` | v3 theme tokens + business constants (commission, fees) |
| `packages/database` | `@detour/database` | Browser-safe re-export of generated DB types |
| `supabase/` | — | Postgres migrations (60+), `seed.sql`, 25 Deno edge functions. Kept at the root because the Supabase CLI expects `./supabase` |

## Commands

Install the root workspaces first, then the isolated Studio:
```bash
npm install
npm install --prefix apps/studio
```
`postinstall` runs `scripts/patch-image-size.mjs`, a security patch that `npm run test:dependency-security` verifies.

### Run
```bash
npm run mobile              # Expo dev server (press i / a / w)
npm run mobile:ios          # needs Simulator open (`open -a Simulator`)
npm run mobile:android      # needs ANDROID_HOME + an emulator running
npm run start:web --workspace @detour/mobile   # fastest for local testing
npm run admin               # http://127.0.0.1:5174
npm run dev --workspace @detour/marketing       # http://127.0.0.1:8791
npm run studio              # http://127.0.0.1:3333
npx supabase start          # local backend, Docker required, API on :54321
npx supabase db reset       # re-apply all migrations + seed.sql (seed accounts: docs/technical/RUNBOOK.md)
```

### Check
```bash
npm run type-check          # turbo: tsc in every workspace
npm run lint                # mobile ESLint; admin "lint" is tsc -b
npm run test                # turbo: mobile Jest + admin node --test + marketing route parity
npm run test:edge           # Deno tests in supabase/functions/__tests__/
npm run build
npm run studio:test         # Studio type-check + schema contract
npm run security:admin-bundle   # pre-release gate; build admin first
```

### Run a single test
```bash
# Mobile Jest (roots: lib/, config/; files match **/__tests__/**/*.test.ts)
npm test --workspace @detour/mobile -- lib/booking/__tests__/tripStages.test.ts
npm test --workspace @detour/mobile -- -t "name of test"

# One Deno edge-function test
deno test --allow-env --no-check supabase/functions/__tests__/stateMachineParity.test.ts

# Admin / marketing (node:test)
node --test apps/admin/tests/<file>.test.mjs
npm run test:build --workspace @detour/marketing   # marketing parity checks need a fresh build
```

CI (`.github/workflows/ci.yml`) runs separate jobs per workspace. The mobile job also runs `expo install --check` for SDK alignment and fails the build if a Google API key (`AIza…`) is committed. Production migrations are deployed only by hand, through `deploy-migrations.yml` (`workflow_dispatch`, dry-run by default).

## Architecture

### Security boundary (ADR-003)
- Every browser client (mobile, admin, marketing) uses the **anon key** against one shared Supabase project. A service-role key, Google credential or deploy token must never go in a `VITE_*` or `EXPO_PUBLIC_*` variable.
- Admin privileges live server-side only. The admin SPA calls the `admin-api` and `admin-growth-report` edge functions, which check Supabase Auth, an optional TOTP MFA (`ADMIN_REQUIRE_MFA`), and the `admin_memberships` role (`owner`/`operations`/`finance`/`growth`). Sensitive mutations append to `admin_action_log`. Admin surfaces whose provider config is missing fail closed.
- Server secrets belong in `supabase/.env.local` (see its `.example`) and `supabase secrets set`.
- `apps/admin/tests/` enforces this contract, and `scripts/assert-no-client-secrets.mjs` scans the built bundle.

### Single sources of truth, re-exported outward
- **Booking state machine**: the canonical reducer is `supabase/functions/_shared/domain/stateMachine.ts`. The chain `packages/types/stateMachine.ts` → `apps/mobile/lib/booking/stateMachine.ts` only re-exports it, and edge functions import it through `_shared/stateMachine.ts`. It lives inside the edge tree because Supabase deploys `supabase/functions` in isolation, so canonical code must not live outside it. `stateMachineParity.test.ts` guards the mirror.
- **DB types**: generated into `supabase/functions/_shared/database.types.ts`, then re-exported by `@detour/database` for browsers.
- **Theme/constants**: `packages/config` (`theme.ts`, `constants.ts`). The files in `apps/mobile/config/` are re-export shims, plus app-local LEGAL URLs.
- Mobile booking money logic is pure and unit-tested in `apps/mobile/lib/booking/`: agreement/cancellation/reconciliation snapshots, late fees, CTA mapping, trip stages. Agreement snapshots freeze rates at signing.

### Edge functions
Each directory under `supabase/functions/` is one function. Shared logic goes in `_shared/`: Razorpay client and signatures, deposit/balance/top-up capture, refund dispatch, push, SOS, admin auth/contract, and the API envelope. Tests go in `__tests__/`. Payments work like this: the mobile app calls `create-*-order` functions, which create Razorpay orders server-side. `razorpayCheckout.ts` then opens the native sheet, and `razorpay-webhook` / `confirm-payment` capture the payment. Live payouts and refunds stay gated behind `RAZORPAY_LIVE_FEATURES_ENABLED`. Push notifications are queued as `notifications` rows and delivered by `send-push`.

### Mobile
- Expo Router groups: `(auth)`, `(traveler)`, `(guide)`, `(shared)`. The root `app/_layout.tsx` routes by auth state and role.
- API calls go through `lib/api/*`. The `@/` alias maps to the `apps/mobile` root.
- `app/(traveler)/trips/live/[id].native.tsx` is the native map variant. On web, a stub in `metro.config.js` replaces it. `metro.config.js` is also monorepo-aware (watchFolders + nodeModulesPaths).
- Native maps need `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Env vars live in `apps/mobile/.env.local` (see `.env.local.example`).

### Marketing
Pages are JSON manifests in `src/content/pages/`, rendered by `src/pages/[...slug].astro` and checked against the legacy HTML in `src/legacy/`. `scripts/check-route-parity.mjs` enforces the expected route list (currently 97), so extend it whenever you add routes. The homepage ships two separate designs in the same HTML: `.desktop-home` (legacy `src/legacy/index.html`) and a distinct mobile site, `.mw-shell` (`src/components/mobile/`, `public/assets/mobile/`), switched at 767px. Edit and check both. Links inside `src/legacy/` must be relative (`x.html`); `legacy.ts` resolves them against the file's folder, so `/guides/x` becomes `/guides/guides/x`. Tool pages (layover checker, `/login`, `/account`) are Astro components chosen by route in `[...slug].astro`; the checker and the places filter share the timing rules in `src/lib/layover.mjs`. Website accounts reuse the app's Supabase Auth and switch on only when `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are set at build time (the build fails on a secret key). Ordinary pages use `public/assets/account-lite.js` (REST, no SDK); only the account pages bundle supabase-js. Deploy migration `20260926100000_website_accounts.sql` and the updated `submit-marketing-lead` before setting those variables.

## Gotchas
- **Worktrees**: in a git worktree, `@detour/*` resolves to the **main checkout's** `packages/`, so package edits aren't visible to apps until merged. Keep app-facing constants local while you work in a worktree.
- Old branches such as `archive/static-marketing-seo` share no merge base with `main`, so bring their work over with cherry-picks or ports, not merges.
- Guides auto-approve per the product spec, so the admin has no guide-approval queue.
- Security `overrides` must be declared in the **root** `package.json`. After changing any of them, verify Expo bundling, the mobile tests and the admin build.

## Design
The current system is v3 "Warm Editorial" (paper/ink, terracotta CTA `#C8542A`, sea `#2D7BA9`, marigold `#E89F2C`). Fonts: Bricolage Grotesque for display, Plus Jakarta Sans for body, Instrument Serif for editorial, DM Mono for eyebrows and prices. Tokens live in `packages/config/theme.ts`, and the full spec is in `design/brand/detour-design-philosophy.md` + `design-handoff-spec.md`. `design/brand/design-system.md` (saffron v2) is **superseded**, so don't use it. New or restyled screens use a spring press of `scale(0.96)` (damping 15, stiffness 150).

## Where Things Stand
- Roadmap: `docs/project/NEXT_TASKS.md`.
- Deferred items with runbooks: `docs/project/DEFERRED.md`.
- Admin provider setup (10 steps): `docs/technical/ADMIN2_PROVIDER_SETUP_RUNBOOK.md`.
- Booking support: `docs/technical/BOOKING_SUPPORT_RUNBOOK.md`.
- Manual smoke checklist: `docs/technical/TESTING.md`.

**Open owner decision:** commission is 25% in `packages/config/constants.ts` but 15% in older docs. Don't change it without the owner.
