# ADR-002: Workspaces Monorepo Structure

**Status:** ACCEPTED
**Date:** 2026-06-26
**Decision Maker:** Gaurav (Founder)
**Supersedes/extends:** Builds on [ADR-001](ADR-001-unified-codebase.md) (Expo Universal app). ADR-001 decided *how the app is built*; this ADR decides *how the repository is organized*.

---

## Context

The codebase grew into four products in one git repo — the Expo mobile app, a Vite admin console, a static marketing site, and the Supabase backend — but organized as **loose top-level folders with no workspace tooling**. Each app had its own `package.json` and `package-lock.json`; there was no shared dependency resolution, no shared task runner, and the structure had drifted (dead placeholder dirs, a stale legacy site, temp artifacts, scattered docs).

Ahead of scaling, we needed to "segregate the codebases into separate packages." Two shapes were considered:

- **Polyrepo** — split each app into its own GitHub repository.
- **Monorepo with workspaces** — one repo, explicit package boundaries via npm workspaces.

The decisive constraint: `mobile` and `admin` **share one Supabase schema** (mobile via the anon key under RLS, admin via the service-role key), and the booking state-machine logic is mirrored between `apps/mobile/lib/booking/` and `supabase/functions/_shared/`. Splitting into separate repos would force cross-repo coordination of that shared schema and logic with no upside for a small team.

---

## Decision

Adopt a **structured monorepo using npm workspaces, with Turborepo for task orchestration.**

```
apps/        mobile (@detour/mobile), admin (@detour/admin), marketing (@detour/marketing)
packages/    shared internal libraries (@detour/*)
supabase/    shared backend (migrations + Deno edge functions) — kept at repo root
```

### Key choices & rationale

- **npm workspaces, NOT pnpm.** Expo/Metro and React Native resolve dependencies most reliably with npm/yarn-classic hoisting. pnpm's strict symlinking routinely breaks Metro. The repo already used npm.
- **Single root `package-lock.json`; per-app lockfiles removed.** One hoisted `node_modules`. Verified a single React/React-Native copy (no duplicate-hoist).
- **`overrides` consolidated to the root `package.json`.** npm only honours `overrides` from the workspace root, so the Dependabot security pins from each app were merged there.
- **Metro made monorepo-aware** (`apps/mobile/metro.config.js`): `watchFolders = [monorepoRoot]` + `resolver.nodeModulesPaths = [app, root]`, per Expo's monorepo guide. Also resolves the optional `@opentelemetry/api` (pulled by supabase-js ≥2.49) to an empty module — supabase guards against it, so tracing is simply disabled.
- **`supabase/` stays at the repo root**, not under `packages/` — the Supabase CLI and CI (`supabase start`) expect `./supabase`. It is conceptually the "backend package."
- **CI uses a single root `npm ci`** then per-workspace scripts (`npm run <task> -w <name>`); Turborepo drives local task orchestration. (Remote caching can be added later.)

### Why not polyrepo (for now)

Polyrepo gives maximum isolation and per-repo access control, but at this stage it would add: cross-repo coordination of the shared DB schema/types, no atomic cross-cutting commits, duplicated CI setup, and more overhead for a small team. **Any package here can still be extracted to its own GitHub repo later** with `git filter-repo` — the workspace boundaries make that clean. The most likely future extraction is `supabase/` (the shared backend) when a dedicated backend team forms.

---

## Consequences

**Positive**
- Genuinely separate, independently-buildable packages with explicit names (`@detour/*`).
- Atomic cross-cutting changes (e.g. a schema change + the mobile + admin code that uses it) in one commit/PR.
- One install, one CI, shared tooling; clear home (`packages/`) for shared code.

**Negative / watch-items**
- A fresh root lockfile resolved dependencies to the latest within each semver range (e.g. supabase-js `^2.47` → `2.108`). Verified green (type-check, builds, 49 edge tests, web bundle, 257 Jest tests), but it is a one-time dependency refresh to be aware of.
- Expo + workspace hoisting is the main fragility; the Metro config above mitigates it. Always validate a real Metro bundle after touching dependencies or the Metro config.
- `apps/mobile/ios/` and `apps/mobile/android/` contain a committed native skeleton but are otherwise gitignored (pre-existing state, preserved).

**Follow-up (see ADR-002 / CLAUDE.md TODO #8)**
- Extract `@detour/types` and `@detour/config` into `packages/` and rewire imports.
- De-duplicate the booking state-machine/snapshot logic mirrored between `apps/mobile/lib/booking/` and `supabase/functions/_shared/` into a shared package consumable by both RN and Deno.

---

## Verification (2026-06-26)

`npm install` (1352 pkgs, single lockfile) · workspaces resolved · single React/RN · `tsc` type-check (mobile) · `vite build` (admin) · `deno test` edge (49 pass) · `expo export --platform web` (Metro monorepo) · Jest (257 pass). `supabase start` not run locally (Docker); covered by the CI `db-migrations` job.
