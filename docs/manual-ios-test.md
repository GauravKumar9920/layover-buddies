# Mumbai Buddies — Manual iOS Simulator Test Script

This checklist covers the native-only features that cannot be tested in the Expo Web export. Run it on the iOS Simulator (or a physical iPhone with Expo Dev Client) before each release. Roughly 30–45 minutes to walk end-to-end.

## 0. Prerequisites

- [ ] `npm --prefix mobile run start:ios` boots Metro + opens Simulator
- [ ] Local Supabase running (`docker start $(docker ps -a -q --filter "name=supabase")`)
- [ ] Edge Functions served locally for payments: `supabase functions serve --env-file supabase/functions/.env`
- [ ] `mobile/.env.local` populated with Supabase URL/anon key + Razorpay test key (`rzp_test_...`)
- [ ] App rebuilt with native Razorpay SDK: `cd mobile && npx expo run:ios`
- [ ] Two fresh accounts on hand: traveler (`ios_traveler_$(date +%s)@test.com`) and guide (`ios_guide_$(date +%s)@test.com`), Password `Test1234!`

## 1. Razorpay Payment Flows (Phase 1–4)

These all crash on web with `RAZORPAY_WEB_UNSUPPORTED_MESSAGE`. On iOS they should open the native Razorpay sheet.

### 1.1 Phase-2 Deposits (₹500 traveler + ₹500 buddy)
- [ ] Traveler creates booking, lands on chat-open detail
- [ ] Guide drafts agreement → traveler signs
- [ ] Booking moves to `awaiting_deposits`
- [ ] Tap "Pay deposit" as traveler → Razorpay sheet opens, complete with test card `4111 1111 1111 1111` / any future expiry / CVV `123`
- [ ] After capture, status is `deposits_held` then auto-advance to `awaiting_balance`
- [ ] Repeat as guide for buddy deposit
- **If fails:** check `supabase functions logs create-deposit-order` and `razorpay-webhook`

### 1.2 Phase-3 Balance Payment
- [ ] Traveler taps "Pay balance"
- [ ] Razorpay sheet opens with the correct paise amount (sum of itinerary fund + buffer + GST)
- [ ] After capture, status → `balance_paid`
- [ ] T-12h auto-advance to `trip_ready` (or trigger manually via `cron_t_minus_12_balance_paid` if testing the same day)

### 1.3 Phase-4 Top-Up
- [ ] In `in_progress` status, guide drafts a top-up request (₹500 for "extra food stop")
- [ ] Traveler receives notification + sees TopUpApprovalModal
- [ ] Traveler taps Approve → Razorpay sheet opens
- [ ] After capture, top-up rolls into trip pot
- **Verify:** only one inflight top-up at a time (unique partial index) — try requesting a second while first is pending

### 1.4 Razorpay UX gotchas
- [ ] Cancel mid-sheet → graceful error toast, no half-written DB row
- [ ] Network drop mid-capture → confirm webhook reconciles on retry (idempotency)

## 2. Native Map + Live Location (`trips/live/[id].native.tsx`)

- [ ] After `qr_scanned`, traveler opens "Live trip" → Apple Maps view loads with Mumbai coordinates
- [ ] Guide GPS pin updates as buddy moves (in Simulator: Debug → Location → Apple)
- [ ] Tap "Open in Apple Maps" deep-link works
- **Web fallback:** verify the .tsx (non-native) variant only shows static coords

## 3. QR Code Generation + Scanning

- [ ] Traveler opens `trips/qr/[bookingId]` → QR code renders via `react-native-qrcode-svg` (web export couldn't render this)
- [ ] Guide opens `bookings/qr-scan/[bookingId]` → camera preview appears (must grant camera permission)
- [ ] Guide scans traveler's QR → atomic transition to `in_progress`
- [ ] Verify trip pot release: payout_dispatches row created with `kind='trip_pot_release'`
- **Edge case:** Scan the same QR twice → second scan returns 409 (concurrent-scan guard)

## 4. Push Notifications (Phase 5)

- [ ] On first launch after `expo run:ios`, app prompts for notification permission → grant
- [ ] Verify `user_push_tokens` table has row with `platform='ios'` and `is_valid=true`
- [ ] Trigger a notification: another user sends a message → push received in foreground (banner) and background (lock screen)
- [ ] Tap push from lock screen → app opens to correct deep link (booking/chat)
- [ ] Sign out → `invalidate_token` should be called (currently NOT — see Mobile finding HIGH #18)
- [ ] Re-launch on another sim with same Apple ID → token swap works

## 5. Camera & Image Picker

### Avatar upload
- [ ] Guide profile → tap circular avatar → iOS photo picker opens
- [ ] Pick image → uploads to `avatars` bucket, displays new image
- [ ] Web flow uses file picker — both paths share `lib/imagePicker.ts`

### Itinerary cover photo
- [ ] Create itinerary → "Add Cover Photo" → iOS picker
- [ ] Uploads to `itinerary-photos` bucket, displays on guide card

### Expense proof bills (Phase 4)
- [ ] In `awaiting_proofs`, guide uploads bill + UPI payment proof
- [ ] Both files upload to `expense-proofs/{booking_id}/` (private bucket)
- [ ] DB row in `expense_proofs` has `bill_url` and `payment_proof_url` set
- **Confirmed risk:** mobile/lib/api/expenseProofs.ts line 59 — bill upload is unawaited; if it silently fails, the DB row has a 404 URL. Test by killing wifi mid-upload.

## 6. Haptics

- [ ] Tap "Confirm Booking" → soft haptic tap (success)
- [ ] Tap a 5-star rating → small haptic per star
- [ ] Cancel destructive action → warning haptic
- **All silent on web** — confirm they fire on iOS

## 7. Deep Linking (`mumbaibuddies://` scheme)

- [ ] From Safari: paste `mumbaibuddies://booking/<some-id>` → app opens to trip detail
- [ ] From a notification payload `deep_link: mumbaibuddies://chat/<booking_id>` → opens chat
- [ ] Cold start: kill app, tap notification → app routes correctly after auth bootstrap

## 8. Auth & Session

- [ ] Sign in on iOS → session persists across kill/restart
- [ ] Sign out → AsyncStorage cleared, lands on login
- [ ] Background app for 1h → session still valid on resume
- [ ] Force-quit during signup → no orphaned auth.users row

## What to capture if a step fails

1. Which step number
2. Expected vs actual
3. iOS console log (Xcode → Window → Devices → select sim → "Open Console")
4. Supabase logs: `supabase functions logs <fn-name>` for any Edge Function involved
5. Screenshot (`Cmd+S` in Simulator)
6. Network: enable proxy via Charles or `npx expo start --tunnel` to capture traffic

Drop the capture into a new GitHub issue or paste into the next Claude conversation.

## Out of scope

- Android: parallel script TBD when an Android device is set up
- Real Razorpay live keys (test mode only for now)
- FlightAware integration (deferred to Phase 6)
- Production Apple Push Notification certs (Expo Push handles in dev)
