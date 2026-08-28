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

Completion is reported by a second Edge Function, `vercel-deployment-webhook`,
which Vercel calls directly. Create a webhook in Vercel Project Settings →
Webhooks:

- URL: `https://<project-ref>.supabase.co/functions/v1/vercel-deployment-webhook`
- Events: `deployment.succeeded`, `deployment.error`, `deployment.canceled`
  (`deployment.created` is optional and only refines the `building` timestamp).
- Scope: the marketing project only.
- Secret: Vercel generates a signing secret when the webhook is created. Store
  it as `VERCEL_WEBHOOK_SECRET`, and set `VERCEL_MARKETING_PROJECT_ID` so events
  from another project are ignored rather than mismatched.

Vercel signs the exact raw body as hex HMAC-**SHA1** in `x-vercel-signature`;
that is Vercel's scheme, not ours, and the digest is only ever compared against
a locally computed one.

Correlation is not by deployment id alone. The deploy-hook response returns a
*job* id while the webhook reports a *deployment* id, and the two differ, so
`resolve_content_deployment_for_vercel` claims the oldest publish still pending
within a 30-minute window and stamps the deployment id onto it. Every later
event for that build then matches directly. A Vercel deploy with no pending
publish — a git push, a manual redeploy — resolves to nothing and is ignored.

The `x-detour-signature` / `CONTENT_STATUS_SECRET` path on
`content-deployment-webhook` remains supported for manual replay and for any
other deployment provider. Its body must contain `eventId`, `deploymentId`,
`documentId`, `status` (`building`, `ready`, `failed`, or `cancelled`) and
provider URLs/IDs where available, signed as hex HMAC-SHA256. That secret must
differ from both the Sanity webhook secret and the Supabase service-role key.

If no completion event ever arrives, Admin correctly keeps the deployment in
`building` instead of reporting a false success.

The editor workflow is: edit draft → open the preview URL → publish → wait for
the deployment status → verify the clean URL. Sanity's document history can
restore a prior revision; publishing that revision creates a fresh deployment.
