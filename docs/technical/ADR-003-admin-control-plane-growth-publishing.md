# ADR-003: Secure admin control plane, growth reporting, and structured publishing

**Status:** Accepted

**Date:** 2026-08-08
**Decider:** Gaurav Kumar

## Context

Detour's Vite admin began as a local, solo-operator tool. It embeds a Supabase
service-role credential in browser code and uses a shared plaintext password.
That is incompatible with hosted team access: a runtime production guard can
crash the page, but it cannot remove a credential that Vite already placed in
the downloadable bundle.

The mobile product now has inquiry, agreement, deposit, payment, live-trip,
proof, reconciliation, payout, moderation, profile, and safety workflows that
the original admin lists do not represent. The marketing site has GA4 and a
useful static guide cluster, but website leads are delivered through email and
cannot be connected to bookings or completed trips.

## Decision

1. Keep the admin as a Vite React SPA, but make it an unprivileged client. It
   uses the Supabase anon key for Auth and sends authenticated requests to
   allowlisted Edge Functions or narrow database RPCs.
2. Keep all service-role and Google credentials in Supabase Edge Function
   secrets. Every privileged mutation validates administrator membership and
   writes an append-only audit record.
3. Model administrators with scoped roles (`owner`, `operations`, `finance`,
   `growth`) and require MFA for hosted access.
4. Persist website leads in Supabase and keep GA4 free of personal data. Join
   acquisition to business outcomes through Detour lead and booking records.
5. Query GA4 and Search Console through fixed server reports with explicit
   freshness and partial-failure metadata; the browser cannot submit arbitrary
   provider queries.
6. Generate the public site with Astro. Use Sanity Studio for bounded editorial
   content and Vercel deploy hooks for static publishing. Layout, legal text,
   forms, analytics, safety claims, and business logic remain code-controlled.
7. Scan the built admin bundle in CI for privileged credential signatures.

## Options considered

### Keep the existing local admin

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Hosted security | Unacceptable |
| Team access | None |
| Operational scalability | Low |

This preserves speed for one machine but cannot safely satisfy team access,
auditability, analytics credentials, or content operations.

### Rewrite admin as a server-rendered application

| Dimension | Assessment |
|---|---|
| Complexity | High |
| Hosted security | Strong |
| Reuse of current UI | Low |
| Migration risk | High |

A framework with server routes would provide a natural secret boundary, but a
full rewrite is unnecessary while Supabase Edge Functions already provide that
boundary and the Vite UI remains serviceable.

### Vite SPA plus server-only Supabase control plane (chosen)

| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Hosted security | Strong when enforced |
| Reuse of current UI | High |
| Operational scalability | Appropriate for Detour's stage |

### Build a custom CMS

| Dimension | Assessment |
|---|---|
| Initial flexibility | High |
| Delivery time | High |
| Ongoing maintenance | High |
| Editorial maturity | Low initially |

The editor, media library, drafts, revisions, previews, permissions, and
publishing pipeline would become a second product. Sanity supplies those
capabilities while Astro keeps the public output static.

## Consequences

- Hosted admin releases are blocked until the old service key and password
  gate are absent from built assets.
- Admin features must use explicit read models and commands instead of direct
  god-mode table access.
- Operator identity, reason, idempotency, and audit history become part of each
  sensitive action's contract.
- Provider credentials and availability cannot break the whole Growth UI;
  reports expose freshness and warnings independently.
- Content editors use a linked Sanity Studio. Detour Admin owns workflow status
  and performance context, not rich-text editing internals.
- Studio uses its own lockfile/install boundary so its React 19 runtime cannot
  be mixed with the Expo/admin React 18 workspace graph.
- Static publishing adds a short deploy delay, traded for fast, resilient,
  indexable production HTML.

## Required gates

1. Admin bundle secret scan passes.
2. Unauthenticated and wrong-role integration tests pass.
3. Migrations apply to a fresh database and RLS coverage is verified.
4. Lead submission validation, rate limiting, and retention behavior pass.
5. Existing public URLs, forms, analytics behavior, and structured metadata
   pass parity checks before the Astro output replaces production.
6. Production deployment remains manual until Google, Sanity, and Vercel
   credentials are configured and preview verification is complete.
