# Detour publishing setup

Sanity owns structured editorial content; Astro owns layout, navigation, forms,
analytics, legal text, and marketplace business logic. Drafts and revision
history stay in Sanity. Only published documents are read by the production
Astro build.

## Local setup

1. Create or select a Sanity project and a `production` dataset.
2. Copy `.env.example` to `.env.local` and set the project ID and dataset.
3. Add `http://127.0.0.1:3333` and the deployed Studio origin to the Sanity
   project's CORS origins with credentials enabled.
4. Run `npm install --prefix apps/studio` once, then `npm run studio`.
5. Give the marketing build `PUBLIC_SANITY_PROJECT_ID` and
   `PUBLIC_SANITY_DATASET`. Add `SANITY_READ_TOKEN` only when the dataset is
   private. Without these values, the checked-in local content remains the
   deterministic fallback.

## Protected draft preview

Use a separate Vercel preview project or environment; do not enable drafts on
the production deployment. Configure that preview build with
`SANITY_PREVIEW_DRAFTS=true`, a read-only `SANITY_READ_TOKEN`, and the same
project/dataset values. The build fails instead of serving stale local content
when draft mode cannot read Sanity, and every generated page is `noindex`.

Set `SANITY_STUDIO_PREVIEW_ORIGIN` to this protected preview origin. Enable
Vercel Deployment Protection for it and share access only with editors. Create
a second server-secret hook named `VERCEL_PREVIEW_DEPLOY_HOOK_URL`; a Sanity
webhook that includes drafts may call this hook so editors can rebuild their
current draft before using the Studio preview link. The production webhook
below must continue to exclude drafts.

## Publish to Vercel

Create a Vercel Deploy Hook for the production marketing project. Treat its URL as a
server secret named `VERCEL_DEPLOY_HOOK_URL`; never add it to a
`SANITY_STUDIO_*` variable because Studio variables are bundled for browsers.

In Sanity Manage → API → Webhooks, add a webhook with:

- URL: the deployed Supabase `content-deployment-webhook` Edge Function.
- Dataset: `production`.
- Trigger: create, update, and delete.
- Filter: `_type in ["guide", "landingPage"]`.
- Projection: `{_id, _type, "slug": slug.current, path, _rev, _updatedAt}`.
- Drafts: disabled.
- Delivery ID: Sanity's native `sanity-webhook-id` header is used for
  idempotency. A custom `Idempotency-Key` header remains supported for manual
  replay tooling.
- Secret: the same dedicated `SANITY_WEBHOOK_SECRET` configured on Supabase.

Do not point Sanity directly at Vercel. The Edge relay verifies Sanity's
signature, deduplicates the delivery, writes `content_deployments`, calls the
server-only Vercel hook, and records the accepted build state. This is what
makes deployment failures visible in Detour Admin.

Configure a server-side Vercel deployment listener to POST completion events
back to the same Edge Function. The callback body must contain `eventId`,
`deploymentId`, `documentId`, `status` (`building`, `ready`, `failed`, or
`cancelled`) and provider URLs/IDs where available. Sign the exact JSON body as
hex HMAC-SHA256 in `x-detour-signature` with a dedicated
`CONTENT_STATUS_SECRET`. That secret must differ from both the Sanity webhook
secret and the Supabase service-role key. Without the callback, Admin correctly
keeps the deployment in `building` instead of reporting a false success.

The editor workflow is: edit draft → open the preview URL → publish → wait for
the deployment status → verify the clean URL. Sanity's document history can
restore a prior revision; publishing that revision creates a fresh deployment.
