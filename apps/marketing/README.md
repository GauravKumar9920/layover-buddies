# Detour marketing site

The public site for [detourtrips.com](https://detourtrips.com) is statically
generated with Astro. The migration deliberately keeps the current HTML and
visual behaviour as checked-in parity sources while moving routing, metadata,
sitemaps, analytics, lead delivery, and future editorial content into shared
infrastructure.

## Run and verify

From the repository root:

```bash
npm run dev --workspace @detour/marketing
npm run test:build --workspace @detour/marketing
```

The development site runs at `http://127.0.0.1:8791`. Route-parity checks cover
all current clean URLs, internal links and assets, canonical metadata,
structured data, deferred video, the analytics contract, and the initial local
payload budget.

## Content sources

- `src/content/pages/` is the typed route and publication manifest. Its
  `updatedAt` values generate sitemap `lastmod` values.
- `src/legacy/` preserves the current live content and styling during the
  no-redesign Astro migration.
- A published Sanity `guide` or `landingPage` with the same clean route can
  provide structured body and SEO fields at build time. New Sanity routes are
  also generated. If Sanity is unconfigured or unavailable, local content
  builds deterministically. `/privacy` and `/terms` are explicitly denied in
  both Studio validation and the build resolver because legal text remains
  code-controlled.
- `public/` contains browser assets. Images include original JPEG, responsive
  WebP, and AVIF variants. The sub-1 MB hero video attaches only after visitor
  interaction; the secondary band attaches when it approaches the viewport.

Copy `.env.example` to `.env.local` for the lead endpoint and optional Sanity
source. The same file exposes optional Google Search Console and Bing
verification tags. Never put service-role, Google service-account, Sanity write, or Vercel
Deploy Hook secrets in a `PUBLIC_*` variable.

## Leads and measurement

Forms POST the documented nested payload to the configurable
`submit-marketing-lead` endpoint. FormSubmit is used temporarily only when the
primary endpoint is unconfigured, unreachable, or returns 5xx; validation,
rate-limit, and other 4xx responses cannot bypass the primary endpoint.

GA4 loads only after analytics consent. Events are allowlisted and contain no
names, emails, flight details, interests, or arbitrary URLs. Persistent UTM
attribution uses the same consent, expires after 90 days (or the browser
session for last touch), excludes advertising click IDs, and is submitted only
with the lead.

## Vercel

Set the project root to `apps/marketing`, build command to `npm run build`, and
output directory to `dist`. Keep `cleanUrls` enabled. Publishing content from
Sanity should call the Vercel Deploy Hook described in
`../studio/docs/publishing.md`; a Git push by itself is not proof of a
production release.
