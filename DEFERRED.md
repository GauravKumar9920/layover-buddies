# Deferred Work — Blocked on Company Registration / Hosting

Items below are ready to implement but blocked on external prerequisites.
Come back to this file once the company is registered and the site is live.

---

## Blocked: Company Registration + Razorpay Live Account

### Prerequisites (do in order)
1. **Register the company** (LLP or Pvt Ltd recommended for a two-sided marketplace)
2. **Activate a Razorpay live account** — requires GST number + company PAN + bank account
3. **Host the website** — the webhook URL must be a public HTTPS endpoint

### Once all three are done

**A. Generate a Razorpay webhook secret**
- Razorpay Dashboard → Settings → Webhooks → Add New Webhook
- Webhook URL: `https://<supabase-project-ref>.supabase.co/functions/v1/razorpay-webhook`
- Events to enable: `payment.captured`, `payment.failed`
- Copy the webhook secret it generates

**B. Set secrets in Supabase**
```bash
npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=<secret_from_step_A>
# Live key switch: replace test keys with live keys
npx supabase secrets set RAZORPAY_KEY_ID=rzp_live_...
npx supabase secrets set RAZORPAY_KEY_SECRET=<live_secret>
```

**C. Update mobile/.env.local (or EAS secret)**
```
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
```

**D. Deploy the three Phase 2 Edge functions**
```bash
npx supabase functions deploy create-deposit-order
npx supabase functions deploy sign-agreement
npx supabase functions deploy razorpay-webhook
```

**E. Run the Phase 2 migration on the production DB**
```bash
npx supabase db push
# verifies: 20260510100000_agreement_invariants.sql
#           20260510100001_agreement_signed_names.sql
```

**F. Smoke test** (use Razorpay test card 4111 1111 1111 1111 first)
- Guide drafts agreement → traveler signs → guide signs → both pay ₹500 deposit
- Verify booking reaches `awaiting_balance` in DB

---

## Deferred Technical Work (not blocked on registration)

These can be picked up any time regardless of company status:

| Item | Phase | File / notes |
|---|---|---|
| PDF rendering for agreements | Phase 2.5 | `render-agreement-pdf` Edge fn using `pdf-lib` (Deno-compatible); backfills `agreements.pdf_url` |
| Push notifications | Phase 5 | `expo-notifications` + `push_tokens` table + Expo Push Service |
| Balance order + checkout | Phase 3 | `create-balance-order` Edge fn; traveler pays remaining after escrow |
| Late-fee accrual (T-72h, T-12h crons) | Phase 3 | Supabase pg_cron jobs |
| Cancellation truth-table function | Phase 3 | `compute_cancellation_resolution` DB function |
| Refund issuance | Phase 3 | Razorpay Refunds API |
| QR code for guide check-in | Phase 4 | `react-native-camera` + QR generation |
| Expense-proof upload | Phase 4 | `expo-image-picker` + Supabase Storage |
| Reconciliation + payout dispatch | Phase 4 | `payout_dispatches` table + Razorpay Payouts API (needs live account) |
| Restore native map (Google Maps API key) | Backlog | `react-native-maps` already installed; just needs API key in `app.json` |
| Replace placeholder URLs in marketing site | Backlog | `index.html` / `know-more.html` — localhost:8081, WhatsApp, Instagram, Twitter |
| Source image/video assets | Backlog | ~30 images + 1 video for marketing site |
| CI/CD pipeline | Backlog | GitHub Actions → EAS build |

---

*Phase 1 (state machine) and Phase 2 (agreement + deposit flow) are merged. Resume at Phase 3 once Razorpay live keys are in hand.*
