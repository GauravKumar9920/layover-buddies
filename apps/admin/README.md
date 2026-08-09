# Detour Admin

Detour Admin is the hosted operations, trust, finance, growth and publishing console. It is a Vite SPA authenticated with Supabase email/password plus mandatory TOTP MFA.

## Security boundary

- The browser receives only the public Supabase project URL and anon/publishable key.
- Active membership, role and authenticator assurance are checked on every privileged server request.
- Operational reads and audited commands go through `admin-api`; growth reports go through `admin-growth-report`.
- The UI never falls back to direct privileged table access. Missing APIs and provider failures render as unavailable or unconfigured.
- Role-aware navigation is only a usability layer; server authorization is canonical.

## Local setup

```bash
cp apps/admin/.env.local.example apps/admin/.env.local
npm run dev --workspace @detour/admin
```

Required public variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional public links:

- `VITE_SANITY_STUDIO_URL`
- `VITE_SUPPORT_EMAIL`

Google reporting credentials, deployment hooks and all other secrets belong in the Edge Function/server environment and must never use a `VITE_` prefix.

## Checks

```bash
npm run type-check --workspace @detour/admin
npm run test --workspace @detour/admin
npm run build --workspace @detour/admin
npm run security:scan --workspace @detour/admin
```

The Vercel configuration provides SPA rewrites plus restrictive browser security headers. Production deployment additionally requires the backend migrations/functions, at least one active owner membership, and an enrolled authenticator factor.
