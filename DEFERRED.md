# DEFERRED — Things we've built but intentionally not activated

This file tracks the exact steps needed to flip each deferred feature on in production.
Update this file whenever you defer something; don't let decisions live only in code comments.

---

## 1. Razorpay Live Payouts — Refunds, Payouts, Fund Accounts

**Status:** Code complete. Stubbed behind `RAZORPAY_LIVE_FEATURES_ENABLED` env var.

**Why deferred:** Company not yet registered. Live Razorpay credentials require a GST number and bank account linked to the registered entity. Test-mode Orders work today; live Payouts and Refunds do not.

**What's stubbed:**
- `createRefund` — called by `submit-proofs`, `cancel-booking`, `issue-refund`
- `createPayout` — called by `qr-scan` (trip pot), `submit-proofs` (buddy net), `cancel-booking` (buddy cancel)
- `createFundAccount` — called anywhere a buddy's `razorpay_fund_account_id` is missing

All three throw `RazorpayLiveNotConfiguredError` when the env flag is unset. Callers catch this, persist a `payout_dispatches` row with `failed_reason='razorpay_live_not_configured'`, and **still complete the state-machine transition**. State is correct end-to-end; money hasn't moved.

**Runbook (when live keys arrive):**

1. Register the company. Get GST number + current account.
2. Upgrade Razorpay account to business/KYC-verified.
3. Generate live API keys in Razorpay Dashboard → Settings → API Keys.
4. Set the following secrets in Supabase:
   ```
   supabase secrets set RAZORPAY_KEY_ID=rzp_live_...
   supabase secrets set RAZORPAY_KEY_SECRET=...
   supabase secrets set RAZORPAY_LIVE_FEATURES_ENABLED=true
   ```
5. Deploy all Edge functions:
   ```
   supabase functions deploy
   ```
6. Run the backlog drain. Authenticate with the service role key:
   ```
   curl -X POST https://<project>.supabase.co/functions/v1/replay-stubbed-payouts \
     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"limit": 100}'
   ```
   Repeat until response shows `{ "replayed": 0 }`.
7. Verify in Razorpay Dashboard: refunds and payouts appear in Transactions.

**Idempotency guarantee:** `replay-stubbed-payouts` uses deterministic idempotency keys (`SHA-256` of `[dispatch_id, kind, booking_id]`). Calling it twice on the same booking will not double-charge. Razorpay deduplicates on the key.

---

## 2. Push Notifications

**Status:** `notifications` table is created (migration 100400). Rows are written by:
- `cron_balance_reminder` (T-84/48/24/18h before trip)
- `cron_rating_link_send` (T+3h post-completion)
- `cron_proofs_overdue` (when proofs deadline passes)
- `cancel-booking` Edge fn (on any cancellation — for ops review)

**Why deferred:** Expo Push Notifications require an FCM/APNs key setup and a registered push token per device. Adding it now would add infra complexity before the product is live.

**Runbook:**
1. Expo Push setup: https://docs.expo.dev/push-notifications/overview/
2. Store `expo_push_token` on the `users` table.
3. Write a `send-push` Edge fn that reads the `notifications` table + calls Expo Push API.
4. Schedule `send-push` to run every minute (pg_cron or external cron hitting the Edge fn).

---

## 3. Voucher / Platform Credit Issuance

**Status:** `cancelled_resolution_jsonb.platform_credit_paise` is computed and stored for buddy-cancelled bookings (₹500 per §7). The `payment_events` table has a `kind='platform_credit'` enum value reserved.

**Why deferred:** No credit ledger yet. The credit amount is logged in the cancellation JSON for audit; the traveler sees a note in the cancellation receipt ("₹500 credit will be applied to your next booking"). No credit is actually issued.

**Runbook:**
1. Add a `credits` table: `(user_id, amount_paise, reason, booking_id, expires_at, redeemed_at)`.
2. In `cancel-booking`, after `compute_cancellation_resolution_tx`, insert a `credits` row when `resolution.platform_credit_paise > 0`.
3. In `create-balance-order`, deduct available credits before creating the Razorpay order (reduce `amount_paise` by min of `credits` balance and 50% of order amount — pick a cap).
4. Mark credits redeemed on payment capture.

---

## 4. Buddy Ban Enforcement at Auth/Sign-In

**Status:** `users.is_banned = true` is set by `compute_cancellation_resolution_tx` for buddy-cancel cases. The column exists and is populated.

**Why deferred:** Auth guard requires changes to the auth flow (`_layout.tsx` or a Supabase Row-Level-Security policy on auth). Deliberately kept separate from the financial PR.

**Runbook:**
1. In `mobile/app/_layout.tsx`, after sign-in, check `users.is_banned`.
2. If `true`, sign the user out and show a ban message.
3. Optionally: add a Postgres RLS policy that prevents banned users from inserting bookings.

---

## 5. Failed-Payout Retry Cron

**Status:** `payout_dispatches` rows with `status='failed'` exist and are visible in the admin Payouts page. Manual retry via the "Retry" button in admin is available.

**Why deferred:** Edge case handling (alternate VPA, bank rejection codes) varies per Razorpay error type. Building a smart retry loop before we have real failed payout data would be premature.

**Runbook:**
1. Add a `cron_retry_failed_payouts()` pg_cron function (hourly).
2. SELECT `payout_dispatches WHERE status='failed' AND failed_reason NOT LIKE 'vpa_missing%' AND created_at > now() - interval '7 days'`.
3. For each: call `issue-refund` Edge fn with `payout_dispatch_id`.
4. Cap retries at 3 (add `retry_count integer default 0` column; skip if `>= 3`).

---

## 6. PDF Receipts

**Status:** All receipt data is rendered in-app (reconciliation receipt, cancellation receipt). No PDF export.

**Why deferred:** PDF generation in React Native requires either a native module or a headless-browser approach (Puppeteer on a server). Neither is needed for v1.

**Runbook:**
1. Add a `generate-receipt` Edge fn that uses `@react-pdf/renderer` (Deno-compatible via esm.sh) to render a PDF.
2. Upload the PDF to Supabase Storage, return a signed URL.
3. Add a "Download PDF" button to receipt screens.

---

## 7. Multi-Currency / FX

**Status:** All amounts are hardcoded INR. `CURRENCY = 'INR'` in `constants.ts`.

**Why deferred:** All Phase 1-4 users are expected to be Mumbai-based or India-visiting (INR-comfortable). FX caching (an OER/fixer.io subscription) adds API cost and complexity before product-market fit.

---

*Last updated: Phase 3+4 PR (Stage G)*
