# Detour Admin 2.0 — provider setup runbook

**Prepared:** 2026-08-15 · Continues `ADMIN2_GROWTH_HANDOFF_2026-08-14.md`

Every command is ready to run as written. Values shown as `<PASTE_…>` are the
only things you must supply, and you must type them yourself — never paste a
secret into chat, a commit, a `VITE_*`/`PUBLIC_*` variable, or a screenshot.

Run everything from `/Users/gaurav/Desktop/mumbai-buddies-admin2`.

## Already done (no action needed)

| Item | Evidence |
| --- | --- |
| PR #54 conflict resolved | merge `75639d0`, 9/9 checks green |
| Publishing-loop sender implemented | `vercel-deployment-webhook`, commit `7280725` |
| Admin production deploy | `dpl_4ZV1qawNnnehgxTGJ9SzdGGZ2yS7`, READY |
| `admin.detourtrips.com` attached to `detour-admin` | awaiting DNS only |
| Deployed Admin bundle has no privileged credential | scanned the served bundle, not local `dist` |

## Reference values (not secrets)

```text
Supabase project ref          kajybmmqccfmsejrrpqs
Supabase functions base       https://kajybmmqccfmsejrrpqs.supabase.co/functions/v1
Vercel admin project          detour-admin        prj_J0W7gBzzgfvKhqClnFvSf5QD0DBG
Vercel marketing project      marketing           prj_Su1olSOwRxebiByAe9DcYTlwTQIn
Admin production alias        https://detour-admin.vercel.app
Chosen Admin domain           https://admin.detourtrips.com
DNS provider                  Google Cloud DNS (ns-cloud-a{1..4}.googledomains.com)
GA4 measurement id            G-54QYM83DKF   (browser-side, already live)
```

---

## Step 2 — finish the Admin domain

### 2.1 DNS (you, in Google Cloud Console)

`detourtrips.com` is served by Google Cloud DNS. Add one record in the zone:

```text
Name    admin.detourtrips.com
Type    A
TTL     300
Value   76.76.21.21
```

The apex already uses this same Vercel anycast IP, so this is consistent with
how `detourtrips.com` itself resolves.

### 2.2 Verify propagation

```bash
dig +short admin.detourtrips.com
```

Expect `76.76.21.21`. Then:

```bash
cd /Users/gaurav/Desktop/mumbai-buddies-admin2 && npx vercel domains inspect admin.detourtrips.com
```

Vercel issues the certificate automatically once the record resolves.

### 2.3 Supabase Auth redirects (you, in the Supabase dashboard)

Dashboard → Authentication → URL Configuration. These are hosted settings; do
**not** run `supabase config push`, because `supabase/config.toml` intentionally
holds the *local* values (`http://127.0.0.1:5174`) and pushing would overwrite
production with localhost.

```text
Site URL                https://admin.detourtrips.com
Additional redirect URLs
  https://admin.detourtrips.com
  https://admin.detourtrips.com/**
  http://127.0.0.1:5174
  http://localhost:5174
```

### 2.4 Acceptance

- Sign in at `https://admin.detourtrips.com` as `admin@detourtrips.com`.
- Confirm a password reset email links to the new domain, not localhost.
- Re-run the served-bundle credential check after any redeploy:

  ```bash
  npm run build && npm run security:admin-bundle
  ```

---

## Step 3 — MFA decision

`ADMIN_REQUIRE_MFA` is currently `false`, and Admin is reachable at
`https://detour-admin.vercel.app` with no Vercel Deployment Protection. A
password is therefore the only control between the internet and an owner-role
console. That is a deliberate trade-off, but it should be a decided one.

To turn MFA on — only after each Admin user has an enrolled TOTP factor and a
recovery path, or you will lock yourself out:

```bash
supabase secrets set ADMIN_REQUIRE_MFA=true --project-ref kajybmmqccfmsejrrpqs
```

Cheap compensating control if you keep it off: enable Vercel Deployment
Protection (Vercel → detour-admin → Settings → Deployment Protection) so the
console is not publicly reachable at all.

---

## Step 4 — lead notification email (Resend)

1. Create an API key at <https://resend.com/api-keys> (send-only scope).
2. Verify the sending domain so `leads@detourtrips.com` can send.
3. Set the secrets — type the key at the prompt rather than putting it in your
   shell history:

   ```bash
   supabase secrets set RESEND_API_KEY --project-ref kajybmmqccfmsejrrpqs
   ```

   ```bash
   supabase secrets set LEAD_NOTIFICATION_EMAIL=admin@detourtrips.com LEAD_NOTIFICATION_FROM="Detour Leads <leads@detourtrips.com>" --project-ref kajybmmqccfmsejrrpqs
   ```

4. Submit one real lead through the live form and confirm the email lands.
5. Remove the test lead afterwards; `marketing_leads` holds contact and flight
   PII and follows a 30-day redaction workflow.

---

## Step 5 — GA4 Data API

Owner account for this and step 6: `admin@detourtrips.com`. It must first be
added as an **Administrator** on the existing GA4 property behind
`G-54QYM83DKF`, and as an **Owner** on the Search Console property.

1. GA4 Admin → Property Settings → copy the **numeric** property ID (not the
   `G-` measurement ID).
2. Google Cloud Console → create a dedicated service account, e.g.
   `detour-reporting@<project>.iam.gserviceaccount.com`. Grant it no project
   roles — GA4 access is granted inside GA4, not through IAM.
3. Create a JSON key and download it once.
4. GA4 Admin → Property Access Management → add the service-account email with
   **Viewer**.
5. Set the secrets:

   ```bash
   supabase secrets set GA4_PROPERTY_ID=<PASTE_NUMERIC_PROPERTY_ID> --project-ref kajybmmqccfmsejrrpqs
   ```

   ```bash
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL=<PASTE_SERVICE_ACCOUNT_EMAIL> --project-ref kajybmmqccfmsejrrpqs
   ```

   The private key is multi-line. Set it from the downloaded file so the
   newlines survive, then delete the file:

   ```bash
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="$(node -e 'process.stdout.write(require("<PASTE_PATH_TO_KEY_JSON>").private_key)')" --project-ref kajybmmqccfmsejrrpqs
   ```

   ```bash
   rm -P <PASTE_PATH_TO_KEY_JSON>
   ```

6. GA4 Admin → Events → mark `generate_lead` as a **key event**.
7. Confirm Admin → Growth renders real numbers, and that a provider failure
   shows a warning rather than a zero.

> The JSON key file must never enter the repo. `.gitignore` does not cover an
> arbitrary download path, so delete it as soon as the secret is set.

---

## Step 6 — Search Console

1. Add the property `sc-domain:detourtrips.com` (domain property, DNS
   verification — add the `TXT` record Google gives you to the same Google Cloud
   DNS zone as step 2.1).
2. Search Console → Settings → Users and permissions → add the **same service
   account email** from step 5 as a **Full** user. Search Console does not
   accept Restricted for API reads.
3. Generate and set the sync secret. Generate it locally, never reuse the
   service-role key:

   ```bash
   openssl rand -base64 32
   ```

   ```bash
   supabase secrets set SEARCH_SYNC_SECRET=<PASTE_GENERATED_SECRET> --project-ref kajybmmqccfmsejrrpqs
   ```

4. The scheduled job reads its own copy from database settings. Set both, using
   the same value:

   ```sql
   -- Supabase SQL editor
   ALTER DATABASE postgres SET app.settings.search_sync_secret = '<PASTE_GENERATED_SECRET>';
   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://kajybmmqccfmsejrrpqs.supabase.co';
   ```

5. Trigger one manual sync and confirm freshness warnings appear rather than
   silent zeros. Search Console data lags ~2 days; that delay is expected and
   the UI should say so.

---

## Step 7 — Sanity → Vercel publishing

The code half is complete as of commit `7280725`. What remains is configuration.

### 7.1 Deploy the new function

```bash
supabase functions deploy vercel-deployment-webhook --project-ref kajybmmqccfmsejrrpqs
```

```bash
supabase db push --project-ref kajybmmqccfmsejrrpqs
```

The migration `20260815090000_vercel_deployment_correlation.sql` adds the
correlation resolver and two indexes. It replays cleanly in CI and was applied
against a live Postgres during development.

### 7.2 Connect Vercel Git (browser only)

Vercel → marketing project → Settings → Git → connect
`GauravKumar9920/layover-buddies`. The CLI cannot do this; the GitHub App needs
repository access granted interactively. This is what blocks the deploy hook.

### 7.3 Create the deploy hook

Vercel → marketing → Settings → Git → Deploy Hooks → create one named
`sanity-publish` on branch `main`. Copy the URL, then:

```bash
supabase secrets set VERCEL_DEPLOY_HOOK_URL=<PASTE_DEPLOY_HOOK_URL> --project-ref kajybmmqccfmsejrrpqs
```

Treat the hook URL as a secret — anyone holding it can trigger deployments.

### 7.4 Create the Vercel deployment webhook

Vercel → Settings → Webhooks → create:

```text
URL      https://kajybmmqccfmsejrrpqs.supabase.co/functions/v1/vercel-deployment-webhook
Scope    marketing project only
Events   deployment.succeeded, deployment.error, deployment.canceled
```

Vercel shows a signing secret once. Then:

```bash
supabase secrets set VERCEL_WEBHOOK_SECRET=<PASTE_VERCEL_SIGNING_SECRET> --project-ref kajybmmqccfmsejrrpqs
```

```bash
supabase secrets set VERCEL_MARKETING_PROJECT_ID=prj_Su1olSOwRxebiByAe9DcYTlwTQIn --project-ref kajybmmqccfmsejrrpqs
```

### 7.5 Create the Sanity webhook

Sanity → Manage → API → Webhooks:

```text
URL         https://kajybmmqccfmsejrrpqs.supabase.co/functions/v1/content-deployment-webhook
Dataset     production
Triggers    create, update, delete
Filter      _type in ["guide", "landingPage"]
Projection  {_id, _type, "slug": slug.current, path, _rev, _updatedAt}
Drafts      excluded
```

```bash
supabase secrets set SANITY_WEBHOOK_SECRET=<PASTE_SANITY_WEBHOOK_SECRET> --project-ref kajybmmqccfmsejrrpqs
```

```bash
openssl rand -base64 32
```

```bash
supabase secrets set CONTENT_STATUS_SECRET=<PASTE_A_DIFFERENT_GENERATED_SECRET> --project-ref kajybmmqccfmsejrrpqs
```

`CONTENT_STATUS_SECRET` must differ from both `SANITY_WEBHOOK_SECRET` and the
service-role key — the function rejects it otherwise, by design.

### 7.6 Acceptance

Publish one harmless draft and confirm **one** `content_deployments` row moves
`requested → building → ready` with `completed_at` set and a deployment URL.

Correlation note: the deploy-hook response returns a *job* id while the webhook
reports a *deployment* id, so the resolver claims the oldest publish pending
within 30 minutes. Publish **one document at a time** for this first test — two
publishes inside the window can only be matched in relay order.

---

## Step 8 — import managed content

Site content is still code/fallback content. Create the initial Sanity `guide`
and `landingPage` documents, then test draft → private preview → publish →
rollback, and check canonical tags, sitemap `lastmod` and route parity.

---

## Step 9 — marketing production release

**Open finding.** Production is serving an older build than this branch:

```text
detourtrips.com/privacy   404      (branch builds it)
detourtrips.com/terms     404      (branch builds it)
production sitemap        9 entries
branch build sitemap      11 entries
```

Nothing links to those routes yet, so there are no broken links today — but the
live site collects lead PII with no reachable privacy policy. Fix this as part
of the promotion rather than after it.

Before promoting, verify every legacy clean URL, redirects, forms, tracking
consent, structured data, sitemap, robots, responsive images and mobile
Lighthouse. Then promote atomically.

---

## Step 10 — operations acceptance

Run against non-production-safe test records, as owner and then as a non-owner.

| Area | Confirm |
| --- | --- |
| Booking workspace | Lifecycle transitions are server-validated; an invalid transition is refused, not silently ignored |
| SOS | Acknowledge/Resolve write to `admin_action_log`; the realtime signal carries no PII |
| Moderation | Actions are audited and reversible where designed |
| Finance | Earned vs pipeline split matches the server contract; all-time uses the server all-time semantic |
| Action Centre | With a provider deliberately misconfigured, tiles read *unavailable* — never `0` |
| Audit log | Every mutation above appears, attributed, append-only |
| Growth | GA4 and Search Console panels show provider freshness and partial-failure warnings |

The fail-closed check is the important one: break a provider on purpose and
confirm the UI distinguishes "no data" from "zero".

---

## Definition of complete — current state

| Criterion | State |
| --- | --- |
| PR #54 merged cleanly, no privileged browser credential | Conflict resolved and pushed; bundle verified. Merge itself still pending your review |
| Admin sign-in from permanent domain, role-checked and audited | Blocked on DNS (step 2.1) |
| Lead submission persists, notifies, connects attribution | Blocked on Resend (step 4) |
| GA4 + Search Console show real server-fetched data | Blocked on steps 5–6 |
| Editor can draft → preview → publish → roll back; one publish → one tracked deployment | Code complete; blocked on config (step 7) |
| Marketing production is Astro, URL-compatible, verified | Blocked; see the privacy/terms finding above |
| Team completed operational smoke test, understands MFA policy | Blocked on step 10 and the step 3 decision |
