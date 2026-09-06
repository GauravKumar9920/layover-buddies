# Detour Admin 2.0 / Growth / Publishing — continuation handoff

**Prepared:** 2026-08-14 (Asia/Kolkata)  
**Status:** implementation is on a feature branch and the hosted backend is provisioned; it is **not production-complete**. Resolve the PR conflict, complete provider configuration, perform production acceptance testing, then release deliberately.

## Exact checkout and Git state

| Item | Value |
| --- | --- |
| Working directory | `/Users/gaurav/Desktop/mumbai-buddies-admin2` |
| Repository | `GauravKumar9920/layover-buddies` |
| Branch | `codex/admin-2-growth-platform` |
| Branch HEAD | `ffa7f615ccc0408cbb13691ebbb40db62830aafb` |
| Upstream | `origin/codex/admin-2-growth-platform` |
| Worktree status | clean at handoff time |
| Pull request | [#54 — Detour Admin 2.0, Growth Analytics, SEO and Publishing](https://github.com/GauravKumar9920/layover-buddies/pull/54) |
| PR state | open draft, base `main`, **DIRTY** (merge conflict with `main`) |

The branch contains these commits, oldest to newest:

```text
8ed0d4c Build Admin 2.0 growth and publishing platform
84eeae1 Fix release CI security checks
aef9e85 Keep deployment metadata out of Admin
2ff4fe4 Use hosted-compatible UUID defaults
3f14126 Deploy Admin from monorepo root
8206e68 Lock Edge runtime transitive imports
629a7ff Configure hosted Sanity publishing
ffa7f61 Make Admin MFA configurable
```

All PR checks were green on the branch tip on 2026-08-09: mobile typecheck/lint/test, Admin build, Edge tests, marketing check, Studio typecheck/schema/build, migration replay and CodeQL. Re-run the relevant checks after resolving the conflict; do not rely on old CI against the changed merge result.

## What is implemented

### Admin control plane

- React/Vite Admin 2.0 lives in `apps/admin/`.
- Navigation and page areas cover Overview, Operations, Marketplace, Trust & Safety, Money, Growth and Platform.
- The browser uses Supabase Auth and the anon key only. Privileged reads and mutations are server-side through Edge Functions/RPCs rather than a browser service-role key.
- Roles: `owner`, `operations`, `finance`, `growth`, stored in `admin_memberships`.
- Mutations use domain commands, lifecycle checks, idempotency and append-only `admin_action_log` records.
- The Action Centre is designed to fail closed: unavailable data renders as unavailable, rather than a misleading zero.
- MFA is configurable. The hosted function secret `ADMIN_REQUIRE_MFA` is currently set to `false` at the user's request, and the unfinished enrolled TOTP factor for the owner account was removed. **This is a conscious security trade-off.** Re-enable before granting broader team access.

### Marketing, analytics and publishing

- `apps/marketing/` was converted to Astro while retaining legacy route compatibility and static HTML output.
- Marketing lead submission uses `submit-marketing-lead`, persists structured `marketing_leads`, supports attribution and retains FormSubmit as a notification fallback.
- Browser tracking includes outcome-only events such as `booking_form_open`, `form_start`, `generate_lead`, `cheat_sheet_download` and `app_store_click`. Do not add personally identifying fields to GA events.
- `admin-growth-report` provides an allowlisted server-side reporting boundary; Google credentials are never intended for the browser.
- Sanity Studio lives in `apps/studio/`, with schemas and documented publish flow. The Astro site has Sanity configuration and local fallback content.
- `content-deployment-webhook` records publishing/deployment work; it needs an actual Sanity webhook and Vercel deploy hook to become live end-to-end.

### Hosted Supabase

| Item | Current value |
| --- | --- |
| Project ref | `kajybmmqccfmsejrrpqs` |
| URL | `https://kajybmmqccfmsejrrpqs.supabase.co` |
| Region | Mumbai |
| Migration state | all migrations deployed; latest dry run and lint were clean on 2026-08-12 |
| Seed data | **not loaded** into hosted production |

Deployed functions, confirmed 2026-08-14:

```text
admin-api                  ACTIVE, version 3
admin-growth-report        ACTIVE, version 3
submit-marketing-lead      ACTIVE, version 2
sync-search-console        ACTIVE, version 2
content-deployment-webhook ACTIVE, version 3
```

Configured secret names only (never print values):

```text
ADMIN_REQUIRE_MFA
LEAD_HMAC_SECRET
SEARCH_CONSOLE_SEARCH_TYPE
SEARCH_CONSOLE_SITE_URL
```

Public lead endpoint:

```text
https://kajybmmqccfmsejrrpqs.supabase.co/functions/v1/submit-marketing-lead
```

It returned a successful 201 response during a previous smoke test. Synthetic test leads were removed afterwards.

### Sanity

| Item | Current value |
| --- | --- |
| Organisation | `Detour` (`oHJS8FNP0`) |
| Project | `Detour Content` (`xgush0mp`) |
| Dataset | `production` (public) |
| Studio | https://detour-content.sanity.studio/ |
| Studio application ID | `t39tv8ery06dhkawbyl5lxpc` |

`apps/studio/.env.local` is intentionally local/ignored. Do not commit it or any provider keys.

## Important source locations

```text
vercel.json
apps/admin/README.md
apps/admin/src/auth/AuthProvider.tsx
apps/admin/src/lib/api.ts
apps/admin/src/lib/supabase.ts

apps/marketing/README.md
apps/marketing/.env.example
apps/marketing/src/
apps/marketing/public/assets/analytics.js
apps/marketing/public/assets/booking.js

apps/studio/README.md
apps/studio/docs/publishing.md
apps/studio/.env.example

supabase/.env.local.example
supabase/config.toml
supabase/migrations/20260808100000_admin_growth_foundation.sql
supabase/migrations/20260808100100_admin_command_transactions.sql
supabase/migrations/20260808100200_admin_extended_commands_and_sync.sql
supabase/migrations/20260808100300_growth_sync_transactions.sql
supabase/functions/_shared/adminAuth.ts
supabase/functions/admin-api/index.ts
supabase/functions/admin-growth-report/index.ts
supabase/functions/submit-marketing-lead/index.ts
supabase/functions/sync-search-console/index.ts
supabase/functions/content-deployment-webhook/index.ts

docs/technical/ADR-003-admin-control-plane-growth-publishing.md
docs/technical/RUNBOOK.md
docs/technical/admin-smoke-test-handoff.md
```

## Provider and release state

### Vercel Admin

- Project: `detour-admin` (`prj_J0W7gBzzgfvKhqClnFvSf5QD0DBG`).
- Its root `vercel.json` builds from the monorepo root and outputs `apps/admin/dist`; do not deploy by treating `apps/admin` as an independent repository, or workspace packages will be missing.
- Preview deployments have worked. Example ready preview: `https://detour-admin-vttxkr7jj-gaurav-kumars-projects-d4f24517.vercel.app`.
- A prior production attempt using the Admin directory directly failed because `@detour/config` could not be resolved. It was not promoted.
- Required production work: deploy from the root config, assign a permanent Admin URL/domain (for example `admin.detourtrips.com`), add it to Supabase Auth Site URL/redirect allowlist, then conduct a real browser sign-in and role-action test.

### Vercel Marketing

- The marketing project was configured with root directory `apps/marketing` and Astro output `dist`.
- Environment names configured previously: `PUBLIC_SANITY_DATASET`, `PUBLIC_SANITY_PROJECT_ID`, `SITE_URL`, `PUBLIC_GA_MEASUREMENT_ID`, `PUBLIC_MARKETING_LEAD_ENDPOINT`.
- GA browser measurement ID configured: `G-54QYM83DKF`.
- A direct deployment works, but Vercel's Git integration could not be connected by CLI because the GitHub repository was inaccessible to the Vercel integration. Use Vercel Project Settings → Git in the user's authenticated browser to grant access and connect `GauravKumar9920/layover-buddies`.
- No Vercel Deploy Hook was present at last verification. It is required for Sanity-triggered publishes.
- Do not claim the Astro marketing version is production until `detourtrips.com` is explicitly promoted and checked route-by-route.

### Supabase Auth

- `admin@detourtrips.com` exists as an owner membership in the hosted project.
- The password is intentionally not recorded in this handoff. If access is lost, use the documented Supabase password reset flow; do not retrieve, paste or store a password in source control.
- Set Supabase Auth Site URL and redirect URLs only after the permanent Admin domain is chosen.

## Remaining work, in execution order

1. **Resolve PR #54 against current `main`.** Keep the feature branch, merge/rebase with `origin/main`, inspect every conflict, run checks, push, and only then mark the PR ready. Do not use forceful/destructive Git commands.
2. **Deploy and validate Admin production.** Use the root `vercel.json`; set the permanent Admin URL; update Supabase Auth redirects; sign in as owner; verify every role boundary with a non-owner test user if available; verify the production JavaScript bundle does not contain a service-role key or Google private key.
3. **Choose the MFA posture.** Current configuration is intentionally password-only. Either retain that explicit exception with compensating controls (owner-only access, strong password/reset process) or set `ADMIN_REQUIRE_MFA=true`, then enroll TOTP for each Admin user. Never turn it on blindly for an account without a recovery path.
4. **Finish lead notifications.** Add `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL`, and `LEAD_NOTIFICATION_FROM` to Supabase secrets, then use a real inbox to verify one lead email. Keep FormSubmit for the agreed transition period only.
5. **Connect GA4 Data API.** Identify the numeric GA4 property ID; create a dedicated Google service account; give it read access to GA4; set `GA4_PROPERTY_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` as Supabase secrets; mark `generate_lead` as a GA4 key event; test that reports show data without PII.
6. **Connect Search Console.** Verify the `sc-domain:detourtrips.com` property (normally via DNS); grant the same/dedicated service account read access; set `SEARCH_SYNC_SECRET`; store the related app settings required by the scheduled job (`search_sync_secret` and Supabase URL); run a manual sync then check delayed data/freshness warnings.
7. **Finish Sanity-to-Vercel publishing.** First connect Vercel Git integration or otherwise create a protected Deploy Hook. Set `SANITY_WEBHOOK_SECRET`, `VERCEL_DEPLOY_HOOK_URL`, and `CONTENT_STATUS_SECRET` in Supabase. Create a Sanity webhook:

   ```text
   URL: https://kajybmmqccfmsejrrpqs.supabase.co/functions/v1/content-deployment-webhook
   Dataset: production
   Triggers: create, update, delete
   Filter: _type in ["guide", "landingPage"]
   Projection: {_id, _type, "slug": slug.current, path, _rev, _updatedAt}
   Include drafts: no
   Idempotency header: Sanity's sanity-webhook-id is supported by the function
   ```

   Publish a harmless draft to a preview environment first. Verify one publish produces one deployment record. Implement/configure deployment-status callback handling before relying on the deployment state in Admin.
8. **Import initial managed content.** Existing site content remains code/fallback content. Create/import the initial Sanity guides and bounded landing-page documents, then test draft, preview, publish, rollback, canonical, sitemap `lastmod` and route parity.
9. **Production marketing release.** Test all legacy clean URLs, redirects, forms, tracking consent, structured data, sitemap, robots, responsive images and mobile Lighthouse before atomically promoting the Astro deployment. Then configure Search Console and Bing verification meta values if desired.
10. **Operations acceptance.** Perform a structured run across booking workspace, SOS, moderation, finance, Action Centre, audit log and Growth views using non-production-safe test records. Confirm API failures show warnings/data-unavailable rather than zeros.

## Missing integrations / values

| Area | Required configuration | Why it is blocked |
| --- | --- | --- |
| Email | Resend API key, sender and notification recipient | Lead exists, but primary email notification is not configured |
| GA reporting | Numeric GA4 property ID + service-account access/credentials | Browser events are configured but server-side reports cannot query GA4 |
| Search Console | Domain ownership + service-account read access + sync secret/database settings | Search snapshot job cannot fetch production search data |
| Sanity publishing | Sanity signing secret, protected Vercel Deploy Hook, content status secret | Studio publish cannot deploy the site end-to-end |
| Vercel Git | Grant Vercel's GitHub integration repository access | Automatic branch/production deployments and deploy hook setup are blocked |
| Admin production | Permanent domain and Supabase Auth redirects | Hosted sign-in is not yet a released flow |
| Payments | Razorpay production integration and webhook secrets | Money dashboards are operational structures, not a completed payment rail |
| Maps/notifications | Google Maps key and push provider setup | Deferred mobile product integrations, not Admin blockers |

## Safe continuation commands

Run commands from `/Users/gaurav/Desktop/mumbai-buddies-admin2` unless noted.

```bash
# Establish truth before edits.
git status -sb
git fetch origin --prune
gh pr view 54 --json url,state,isDraft,mergeStateStatus,statusCheckRollup

# Inspect conflict before deciding whether to merge or rebase.
git log --oneline --left-right --cherry-pick origin/main...HEAD
git diff --name-only origin/main...HEAD

# After integrating main, validate the changed result.
npm ci
npm run type-check
npm run build
npm run security:admin-bundle
npm run test:edge

# Check hosted schema/functions without writing changes.
supabase db push --dry-run
supabase db lint --linked
supabase functions list
supabase secrets list

# Deploy Admin only through the root config after testing.
npx vercel --prod --yes
```

For local development, use the repository scripts documented in `apps/admin/README.md` and `apps/marketing/README.md`. Do not create an Admin `.env.local` with a service-role browser variable; Admin development must follow the anonymous-auth/API boundary.

## Security and data-handling non-negotiables

- Never expose, log, commit or put in a Vite `VITE_*` variable: Supabase service role key, Google service-account private key, Resend API key, Sanity webhook secret, Vercel hook URL, content status secret or user passwords.
- Keep PII (email, name, flight number, emergency details) out of GA4 and Search Console calls. GA receives anonymous behavioural events only after successful outcomes.
- `marketing_leads` contact/flight data must follow the intended 30-day redaction/retention workflow once a lead or trip is closed.
- State changes must remain server-validated and audited; do not reintroduce raw browser status editing.
- Hosted production has no seed data by design. Do not seed the hosted project to make the dashboards look populated.

## Known technical notes

- Hosted migrations required replacing `uuid_generate_v4()` with `gen_random_uuid()` in older migrations because the hosted default search path did not expose the former. Do not revert that change.
- The local Deno executable was missing during earlier work. A temporary `/tmp/detour-deno-2.9.5/deno` was used for Edge tests; install/manage Deno normally if local Edge development continues.
- The Admin production bundle has a size warning around 507 KB minified. It is not a release blocker but should be code-split after correctness and provider integrations are complete.
- The repository dependency audit previously showed legacy Expo dependency findings. Treat it as a separate dependency-upgrade task, not a reason to bypass release checks.

## Definition of complete

The task is complete only when all of the following are demonstrated in production or a controlled production-equivalent environment:

- PR #54 is merged cleanly, and the deployed Admin has no privileged browser credential.
- Admin sign-in works from its permanent domain and every Admin mutation is role-checked and audited.
- Lead submission persists, notifies the team and connects attribution through lead → booking → completed trip.
- GA4 and Search Console reports show real server-fetched data, provider freshness and partial-failure warnings.
- A nontechnical editor can draft, privately preview, publish and roll back managed content; one publish leads to one tracked successful deployment.
- Marketing production is Astro, URL-compatible, indexable, performant and has verified sitemap/canonical/schema/form/tracking behaviour.
- The team has completed the operational smoke test and understands the intentional MFA policy.

## Suggested first continuation message

> I am continuing from `codex/admin-2-growth-platform` at `ffa7f615ccc0408cbb13691ebbb40db62830aafb` in `/Users/gaurav/Desktop/mumbai-buddies-admin2`. PR #54 is draft and conflicted with `main`; I will resolve and validate that merge result before touching provider configuration. I will not expose credentials or promote a deployment until the permanent Admin domain and Supabase redirect configuration are confirmed.

