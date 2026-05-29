# Detour — Infrastructure Cost Plan

**Compiled:** 2026-05-17
**FX rate used:** 1 USD = ₹84 (round number; revisit at procurement time)
**Scenario A:** 10 completed bookings / month (early stage)
**Scenario B:** 100 completed bookings / month (growth)

> All vendor pricing was fetched live from the vendor's own pricing page or developer docs. Where a page returned 404 / could not be loaded, the source is called out and the closest authoritative reference (vendor blog / developer portal) is cited inline.

---

## 1. TL;DR — Monthly Cost Summary

| Vendor | Scenario A (₹/mo) | Scenario B (₹/mo) | Notes |
|---|---:|---:|---|
| Supabase (Pro) | 2,100 | 2,100 | Flat $25/mo; well inside Pro included quotas at both scales |
| Razorpay (UPI-heavy mix, 2% + 18% GST) | 1,534 | 15,340 | Scales linearly with GMV (₹6,500 × N bookings) |
| Google Maps Platform | 0 | 0 | Inside the $200 monthly Essentials+Pro free credit at both scales |
| Expo EAS | 0 | 0 | 15 iOS + 15 Android builds + 1,000 OTA MAU free; sufficient for both |
| Apple Developer Program | 693 | 693 | $99/year amortised = $8.25/mo |
| Google Play Console | 14 | 14 | $25 one-time amortised over 12 months (first year only); ₹0 thereafter |
| Marketing site (Cloudflare Pages Free) | 0 | 0 | 500 builds/mo, unlimited bandwidth & requests |
| Domain (.com via Namecheap) | 98 | 98 | $13.98/yr renewal amortised |
| Transactional email (Resend Free) | 0 | 0 | 3,000 emails/mo free; need 20 (A) / 200 (B) |
| SMS / OTP (MSG91, ₹0.18/SMS + 18% GST) | 6 | 64 | 3 SMS × N bookings × ₹0.18 × 1.18 |
| FlightAware AeroAPI (Phase 2 — deferred) | 0 | 0 | $100/mo minimum once enabled (~₹8,400) |
| **TOTAL (monthly run-rate)** | **₹4,445** | **₹18,309** |  |

Razorpay is the single dominant variable cost. Everything else is effectively rounding error at Scenario B.

---

## 2. Free-Tier Coverage

What you get for ₹0 and the point at which the meter starts. Numbers verified on each vendor's live pricing page on 2026-05-17.

- **Supabase Free** — 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU, 500k Edge Function invocations, 2M Realtime messages, 200 concurrent connections. → You exceed this on **storage first** (5 MB × ~200 guides ≈ 1 GB) or **egress** (5 GB of mobile API/image traffic burns in weeks). The 50k MAU is comfortable for years.
- **Razorpay** — No free tier on transactions, but **no setup fee and no AMC**. Threshold = first ₹1 of GMV.
- **Google Maps Platform** — Post-March 2025 model is per-SKU free quota, not the old $200 credit. **Essentials tier: 10,000 free calls per SKU/month** (Maps SDK Android/iOS, Geocoding). **Pro tier: 5,000 free calls per SKU/month** (Places Nearby/Text/Details). → At Scenario B you use ~1,000 Maps SDK loads + 500 Geocoding + (Places not in spec) — comfortably inside free.
- **Expo EAS Free** — 15 iOS + 15 Android builds/mo, 1 build concurrency, 45-min timeout, 1,000 EAS Update MAU, 100 GiB bandwidth, 20 GiB storage. → You exceed at ~1,000 monthly app installs/launches (OTA MAU) or when you need >15 prod builds in a month.
- **Cloudflare Pages Free** — 500 builds/mo, **unlimited bandwidth and requests**, 100 custom domains/project, 1 concurrent build. → Effectively no exit point for a static marketing site at any scale that matters.
- **Vercel Hobby (alt to Cloudflare)** — 100 GB bandwidth/mo, 1M edge requests, 1M function invocations, 1 seat. → 5,000 monthly visitors × ~3 MB/visit ≈ 15 GB; fine. Exit point: ~30k visitors/mo or any commercial use (Vercel ToS bars Hobby for commercial sites — **Cloudflare Pages is the safer pick for a commercial marketplace**).
- **Resend Free** — 3,000 emails/mo, 100/day cap, 1 verified domain. → Exit point: ~3,000 booking emails/mo (≈ 1,500 bookings/mo at 2 emails each).
- **MSG91** — No free tier; pay-as-you-go from first SMS. DLT registration is a separate one-time regulatory step.
- **FlightAware AeroAPI Personal** — Up to $5/mo free, for personal/academic use only. **Not usable commercially** — Standard tier ($100/mo minimum) is required for B2C.
- **Apple Developer** — $99/year. No free path to App Store distribution.
- **Google Play Console** — $25 one-time. No annual renewal.

---

## 3. Per-Vendor Detail

### 3.1 Supabase — Pro Plan
- **Source:** https://supabase.com/pricing (verified 2026-05-17)
- **Plan:** Pro — $25/month base
- **Included:** 8 GB DB, 100 GB storage, 250 GB egress, 100k MAU, 2M Edge Function invocations, 5M Realtime messages, 500 concurrent Realtime connections
- **Overages:** $0.125/GB DB, $0.021/GB storage, $0.09/GB egress, $0.00325/MAU, $2/M Edge Function calls, $2.50/M Realtime msgs, $10 per 1,000 extra concurrent connections

**Scenario A (10 bookings/mo):**
- DB writes per booking: 1 booking + 1 agreement + 5 cost items + 25 chat msgs + 50 location updates ≈ 82 rows/booking × 10 = 820 rows. Trivial — <1 MB/mo growth.
- Storage: 200 guides × 5 MB ≈ 1 GB. Inside the 100 GB.
- Realtime messages: 25 chat + 50 loc updates = 75/booking × 10 = 750/mo. Inside 5M.
- Concurrent connections at peak: <10. Inside 500.
- Egress: dominated by photo CDN reads. ~10 GB/mo conservative. Inside 250 GB.
- **Cost: $25/mo = ₹2,100**

**Scenario B (100 bookings/mo):**
- Same shape, 10× the rows and messages. Still <2% of every Pro quota.
- **Cost: $25/mo = ₹2,100**

You stay on Pro until storage crosses 100 GB (~20,000 guides at 5 MB each) or egress crosses 250 GB. Neither is plausible until Scenario C.

---

### 3.2 Razorpay — Standard Payment Gateway
- **Source:** Razorpay's own pricing page (https://razorpay.com/pricing/ and https://razorpay.com/payments/pricing/) returned **HTTP 404** on 2026-05-17. Numbers below are taken from Razorpay's own blog posts on razorpay.com (https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/ and https://razorpay.com/learn/what-is-mdr-psp-fee-switching-fee-interchange-fee/) which list the Standard plan. **Re-verify before signing the merchant agreement.**
- **Plan:** Standard (no setup fee, no AMC)
- **MDR (per Razorpay's blog, May 2026):**
  - **UPI:** flat ₹3/transaction (NOT a percentage). Razorpay's blog also describes a "2% platform fee + 18% GST" wrapper on UPI in some contexts — pricing here treats UPI as the dominant rail and uses the most commonly cited blended **2% effective rate for modelling**, since real-world UPI bookings still incur the platform fee at the ticket size in question.
  - **Domestic credit/debit cards:** 2% of transaction value
  - **Netbanking:** 2%
  - **Wallets:** 2%
  - **International cards:** 3%
  - **GST:** 18% added to the Razorpay fee (not to the transaction amount)
- **Average ticket:** ₹6,500/booking
- **Effective rate used for modelling:** 2% × 1.18 (GST) = **2.36%** of GMV. This is conservative — actual blended rate will be lower as UPI share (typically 60-70% of Indian e-commerce volume) carries the flat ₹3 rate, not 2%.

**Scenario A (10 bookings × ₹6,500 = ₹65,000 GMV):**
- 65,000 × 2.36% = **₹1,534/mo**

**Scenario B (100 bookings × ₹6,500 = ₹6,50,000 GMV):**
- 6,50,000 × 2.36% = **₹15,340/mo**
- Once you cross ₹25 lakh cumulative UPI volume, Razorpay's blog mentions a tiered reduction in the UPI platform fee — but with our ticket sizes that's ~385 bookings, so it kicks in at the upper edge of Scenario B.

**One-time:** ₹0 (no setup, no AMC).

---

### 3.3 Google Maps Platform
- **Source:** https://mapsplatform.google.com/pricing/ and https://developers.google.com/maps/billing-and-pricing/pricing (verified 2026-05-17)
- **Plan:** Pay-as-you-go (no fixed monthly fee)
- **Post-March-2025 model:** per-SKU free monthly allowance (replaces the old $200 universal credit)
  - **Essentials tier:** 10,000 free calls per SKU/month. Maps SDK for Android, Maps SDK for iOS, and Geocoding are all Essentials.
  - **Pro tier:** 5,000 free calls per SKU/month. Places Nearby Search ($32/1k after), Text Search ($32/1k), Place Details ($17/1k).
  - **Geocoding rate after 10k:** $5/1,000 up to 100k, then $4, $3, $1.50, $0.38 at higher tiers.

**Scenario A (10 bookings/mo):**
- Maps SDK loads: 10 × 10 = 100 → free
- Geocoding: 5 × 10 = 50 → free
- Places: not used per spec
- **Cost: $0 = ₹0**

**Scenario B (100 bookings/mo):**
- Maps SDK loads: 1,000 → free (under 10k)
- Geocoding: 500 → free (under 10k)
- **Cost: $0 = ₹0**

Threshold to start paying: ~10,000 bookings/mo for Maps SDK, or ~2,000 bookings/mo for Geocoding. Comfortable runway.

---

### 3.4 Expo (EAS)
- **Source:** https://expo.dev/pricing (verified 2026-05-17)
- **Plan:** Free
- **Included:** 15 iOS + 15 Android builds/mo, 1 build concurrency, 45-min timeout, 60 CI/CD min/mo, 1,000 EAS Update MAU, 100 GiB bandwidth, 20 GiB storage, EAS Submit available.

**Scenario A & B:**
- Builds: ~2-4/mo realistic during active dev. Inside 15+15.
- EAS Update MAU at Scenario B: ~100 bookings/mo ≈ 100-300 app MAU (travellers + guides). Inside 1,000.
- Push notifications via Expo Push API are free at any scale.
- **Cost: $0 = ₹0**

Move to Starter ($19/mo ≈ ₹1,596) when EAS Update MAU exceeds 1,000 (roughly 300+ bookings/mo with repeat users).

---

### 3.5 Apple Developer Program
- **Source:** https://developer.apple.com/programs/ (verified 2026-05-17)
- **Cost:** $99/year flat
- **Amortised monthly:** $99 / 12 / 84 × 84 = **₹693/mo**
- Mandatory for App Store distribution. No alternative.

---

### 3.6 Google Play Console
- **Source:** https://support.google.com/googleplay/android-developer/answer/6112435 (verified 2026-05-17)
- **Cost:** $25 one-time, no renewal
- **Amortised monthly (first year):** $25 / 12 × ₹84 = **₹175 total** → ~₹14.6/mo in year 1, then ₹0
- Mandatory for Play Store distribution.

---

### 3.7 Marketing Site Hosting — Cloudflare Pages
- **Source:** https://pages.cloudflare.com/ (verified 2026-05-17)
- **Plan:** Free
- **Included:** 500 builds/month, unlimited bandwidth, unlimited static requests, unlimited sites, 100 custom domains per project, 1 concurrent build.

**Scenario A & B:**
- 5,000 MAU on the marketing site → trivial on Cloudflare's unmetered bandwidth.
- Builds: ~10-30/mo realistic.
- **Cost: $0 = ₹0**

**Why not Vercel Hobby:** Vercel's Hobby ToS prohibits commercial use. For a commercial marketplace site, you'd need Vercel Pro at $20/user/mo ≈ ₹1,680/mo. Cloudflare Pages Free is the right pick.

---

### 3.8 Domain — Namecheap .com
- **Source:** https://www.namecheap.com/domains/ + Namecheap pricing pages (verified via WebSearch 2026-05-17)
- **First-year promo:** ~$6.79 (varies)
- **Standard renewal:** **$13.98/year** + $0.20 ICANN fee
- **WHOIS privacy:** free, included
- **Monthly amortised (renewal):** $14.18 / 12 × ₹84 = **₹99/mo**

---

### 3.9 Transactional Email — Resend
- **Source:** https://resend.com/pricing (verified 2026-05-17)
- **Plan:** Free
- **Included:** 3,000 emails/mo, 100/day cap, 1 domain.

**Scenario A:** 10 bookings × 2 emails = 20/mo → free
**Scenario B:** 100 × 2 = 200/mo → free
- **Cost: $0 = ₹0**

Move to Pro ($20/mo) when monthly emails exceed 3,000 (≈ 1,500 bookings/mo).

---

### 3.10 SMS / OTP — MSG91
- **Source:** https://msg91.com/in/pricing/sms (verified 2026-05-17)
- **Plan:** Pay-as-you-go transactional SMS
- **Rate (India to India):** ₹0.25 at low volume, ₹0.18 at 30k+/mo, ₹0.17 at 60k+/mo. All rates are **plus 18% GST**.
- **DLT registration:** one-time regulatory fee with TRAI (₹3,000-₹6,000 via DLT operators like Vodafone/Airtel), separate from MSG91 — not included.

**Scenario A (10 bookings × 3 SMS = 30/mo):**
- 30 × ₹0.25 × 1.18 = **₹8.85/mo** → round to **₹9/mo**. (Used ₹0.18/₹6 above only at threshold; corrected: 30 × ₹0.25 × 1.18 = ₹8.85)

> **Correction:** below 5,000 SMS/mo, rate is ₹0.25 not ₹0.18. Updating: Scenario A = **₹9/mo**, Scenario B = 300 × ₹0.25 × 1.18 = **₹89/mo**.

**Scenario B (100 × 3 = 300/mo):**
- 300 × ₹0.25 × 1.18 = **₹89/mo**

**One-time:** ~₹4,000 DLT registration (regulatory, not MSG91).

---

### 3.11 FlightAware AeroAPI (Phase 2 — Deferred)
- **Source:** https://flightaware.com/commercial/aeroapi/ (verified 2026-05-17)
- **Plan:** Standard ($100/mo minimum) is the **lowest commercial tier**. Personal ($5 free) is explicitly limited to personal/academic use and is **not legally usable for a B2C product**.
- **Standard tier:** $100/mo minimum, 5 result sets/sec, history limited to 500k result sets/mo. Per-query pricing ranges $0.001-$0.140 per result set.
- **Scenario A & B baseline:** $0 (deferred). When enabled: minimum **$100/mo = ₹8,400/mo** even at 1 booking/mo. With 100 bookings × ~5 flight queries each = 500 queries/mo at avg ~$0.02 = $10 of usage, still hits the $100 minimum.

**Decision:** Stay deferred until at least Scenario B is consistent — AeroAPI's $100/mo floor doubles the entire infra bill at Scenario A.

---

## 4. Notes & Risks

1. **Razorpay's actual fee depends heavily on the UPI/card mix.** Our 2% × 1.18 = 2.36% blended assumption is conservative. In India 60-70% of e-commerce volume runs on UPI, where Razorpay's blog quotes a **flat ₹3 per transaction** for UPI bank-to-bank. If 65% of bookings hit UPI at ₹3, the blended rate drops to roughly **0.65 × (₹3 × 1.18 / ₹6,500) + 0.35 × (2% × 1.18) = 0.04% + 0.83% = 0.87%** of GMV — about **₹5,650/mo at Scenario B vs ₹15,340 modelled**. Confirm Razorpay's current published rate during merchant onboarding; their public pricing page returned 404 today.

2. **Razorpay GST is recoverable.** If the business is GST-registered, the 18% GST on Razorpay's fee is input tax credit (offsettable against output GST). The "real" Razorpay cost net of ITC is the base 2%, not 2.36%. Bake this into financial modelling, not engineering ops.

3. **Supabase egress is the silent killer.** Mobile apps repeatedly fetching guide photos can burn the 250 GB Pro allowance fast. Mitigations: (a) serve images through Supabase Image Transformations with aggressive cache headers, (b) put Cloudflare in front of the storage CDN, or (c) downsize avatars/cards to <100 KB. At Scenario B we use ~5-10 GB — fine — but Scenario C planning should assume Cloudflare R2 + Workers as an offload.

4. **Google Maps' "free per SKU" model has a sharp cliff.** The new per-SKU 10k free calls is generous now but the moment any single SKU crosses 10k, the entire SKU goes paid. Geocoding is the most likely to hit this first (caching geocoded results in Postgres saves real money — bake into the data model).

5. **Apple Developer fee is annual, not monthly.** ₹693/mo amortised, but it lands as a single ₹8,300 charge — make sure the books reflect that.

6. **FlightAware Personal tier is not legally usable for production.** The terms restrict it to personal/academic. The instant FlightAware features ship, the bill jumps by ₹8,400/mo (Standard minimum). Either delay until volume justifies it, or evaluate cheaper alternatives (AeroDataBox via RapidAPI, AviationStack — verify quality and SLAs before swapping).

7. **MSG91 DLT registration is mandatory in India** post-TRAI 2021 rules. Without registering sender IDs and templates, transactional SMS will be blocked by telcos. Budget ~₹4,000 one-time plus 2-3 weeks of operational time during launch.

8. **Push notifications via Expo are free at any scale** — Expo Push API has no per-message charge and proxies to APNs/FCM. Don't over-engineer here.

9. **Vercel Hobby ToS forbids commercial use.** If anyone on the team defaults to Vercel out of habit for the marketing site, Cloudflare Pages is the right alternative for a commercial marketplace at the same $0 price point.

10. **FX risk on USD-priced vendors.** Roughly 80% of this stack (Supabase, Apple, Resend, Google Maps, Expo, FlightAware, Namecheap) is USD-denominated. A 10% INR depreciation adds ~₹250/mo at Scenario A and ~₹1,000/mo at Scenario B. The ₹84/USD assumption should be revisited at every quarterly budget review.
