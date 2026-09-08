# Booking support and settlement operations

Last verified: 2026-09-08. Production provider activation is separate.

## Reporting and review

A traveler or buddy can report the other party missing two hours after the agreed start, while the trip is still ready and no QR scan has started it. A report creates one open support case and pauses the booking as disputed. It does not penalize either party. Owner/operations staff review the evidence in Operations → booking → Trip support; confirmation applies the existing cancellation economics and buddy no-show ban policy. Dismissal restores the prior state. Both actions require a reason and an idempotency key and append an audit record.

Disputes are accepted during the trip and after reconciliation, including rated trips. The proposed deadline is seven days after `reconciled_at`; confirm it with Gaurav before launch. Change `POST_COMPLETION_DISPUTE_DAYS` and the SQL interval together through a new migration after deployment. Commission and provider flags are unchanged.

## Settlement outcomes

Before the trip starts, operations may cancel with no party at fault. Once a trip starts or its trip pot has a dispatch, resume the workflow and reconcile expenses first. This prevents returning the full pot after it has already been released.

For a reconciled booking, Release retains the original signed settlement. Refund and Split redistribute only the remaining unpaid net amount in the standard buddy-fee and traveler-refund rows, after the original deductions. Split uses integer percentages and paise and conserves the total. These operations cannot reverse sent payouts, rewrite sent refund allocations, or create new funds. Such adjustments need a separately funded, reconciled operation. The audit and mobile support history show the reviewed amounts; payment processing remains separate. Use the existing Money refund/payout commands to dispatch eligible pending rows.

Each money path, including replay-stubbed-payouts, claims the booking's dispatch before contacting the provider. Open disputes stop new dispatches. A report cannot be opened while a payment result is uncertain. Refunds reserve amounts against captured payments belonging to the actual recipient and reuse allocation IDs on retries. Existing sent refunds without allocation records fail closed until reconciled.

An uncertain provider result retains its claim without an automatic timeout. Check provider records and stored allocation/payment IDs before any recovery; never clear a claim merely because time elapsed. Record the evidence and exact result through the operator's controlled database incident procedure. Confirmed stored outcomes, disabled-live stubs and missing-VPA checks release their claims. Do not enable real refunds/payouts until provider setup and this recovery procedure are accepted.

## Deployment

Apply the four `20260908` migrations in order with the normal migration workflow. Deploy `booking-support`, `admin-api`, `cancel-booking`, `submit-proofs`, `qr-scan`, `issue-refund` and `replay-stubbed-payouts` together. The shared reducer stays inside `supabase/functions` so edge deployments include it. Then release the mobile/admin clients. Service RPCs are unavailable to anon/authenticated roles; client requests go through authenticated party or admin endpoints.

Do not reset a populated database. The validation below used an isolated disposable local Supabase project and seeded accounts. It did not enable production Razorpay, MFA, push or marketing publication.

## Verification

- Full migration chain plus seed applied from scratch.
- `supabase/tests/booking_support.sql`: party permissions, grace, no automatic ban, admin confirmation, idempotency, deadlines, disputed dispatch exclusion, settlement conservation, sent-fund protection and both-deposit recovery.
- `supabase/tests/refund_allocations.sql`: payer matching, capture limits, atomic reservations and stable retries.
- Mobile Jest and edge Deno suites; TypeScript, lint, Expo SDK alignment, Android Hermes export, admin build/security scan.
- Local HTTP acceptance: caller authentication, unrelated-party rejection, admin role boundary, report creation and case list.
- Browser acceptance: owner login, booking case display, audited dismissal and restored trip-ready state.

CI runs the rollback-only SQL tests after starting its fresh database. SQL tests require the repository seed; do not run them against production.
