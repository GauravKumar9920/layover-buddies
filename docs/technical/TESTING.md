# Testing Guide — Detour

This is a **manual smoke-test checklist** you run before shipping anything. It's deliberately written for someone who is not a professional QA — the steps are explicit, not "click around and see if it works."

The goal is to catch the kind of bugs that the type checker (`npm --prefix mobile run type-check`, runs in CI on every push) **cannot** catch — visual glitches, broken navigation, layouts that look off, network errors, and missing data. Walking the full checklist takes about **20–30 minutes**. Run it:

- Before each release / before showing the app to a real user
- After any non-trivial change to the auth, booking, profile, or messaging flows
- Whenever a friend says "the app is broken" and you need to figure out where

If a step fails, stop and write down what you saw — see [What to report](#what-to-report) at the bottom.

---

## 0. Setup (5 min, do once per session)

- [ ] **Local Supabase is running.** Run `npx supabase status` — should print URLs ending in `:54321`. If not, run `npx supabase start`.
- [ ] **Mobile env file exists.** `cat mobile/.env.local` — should show `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and a `sb_publishable_*` anon key. If missing, copy from `mobile/.env.local.example` and run `npx supabase status` to grab the actual local anon key.
- [ ] **Database is fresh.** If you've been running migrations or testing for a while, `npx supabase db reset` to start from a clean seeded state. (Destroys all local test data — don't do this on production.)
- [ ] **Start the mobile app.** Run `npm --prefix mobile run start:web` (web is fastest for testing). For native testing: `npm --prefix mobile run start:ios` or `start:android`.
- [ ] **Open two browser windows side-by-side** for the cross-account test below — one normal, one Incognito/Private. This lets you be logged in as both a traveler and a guide at the same time.
- [ ] **Open dev tools** (`F12` / `Cmd+Option+I`). Watch the Console tab while testing — any red errors are bugs to report.

---

## 1. Traveler smoke test (~10 min)

Run this in the **normal** browser window.

### Sign up
- [ ] On the login screen, tap "Sign up" (or wherever the signup link is).
- [ ] Sign up as a traveler with a fresh email like `traveler_test1@example.com` / `Traveler1234!`.
- [ ] After signup, you should land on the Explore tab — not back at the login screen.
- [ ] Console should have **no red errors**.

### Browse and pick a guide
- [ ] Explore tab shows guide cards. None are empty placeholders.
- [ ] Tap a guide card. The **editorial-zine guide profile** opens.
- [ ] Hero photo loads (no broken-image icon).
- [ ] You can see: the guide's name, university (if set), a large italic pull-quote, three Q&A cards ("Three things about me"), at least one tour card, and the photo journal grid.
- [ ] Scroll all the way down — no layout gaps, no overlapping text, no console errors.
- [ ] Tap the back arrow → returns to Explore.

### Search
- [ ] Tap the Search tab (🔍).
- [ ] Type part of a guide's name → results filter in real-time.
- [ ] Clear the search box → all guides return.

### Book a tour
- [ ] Open a guide → tap the "Book" button.
- [ ] Booking form shows: itinerary picker, arrival/departure dates, flight number, traveler count.
- [ ] Pick an itinerary, fill the dates with **future** dates, set traveler count to 1.
- [ ] Price breakdown updates as you change inputs.
- [ ] Tap "Confirm Booking" → no error toast → you're redirected to the trip detail page.

### My Trips
- [ ] Tap "My Trips" tab (🎒). The booking you just made appears at the top.
- [ ] Tap it. Trip detail loads with status badge, dates, and a "Message Guide" button.
- [ ] Status should say **"pending"** until a guide accepts.

### Inbox tab
- [ ] Tap the new "Inbox" tab (💬).
- [ ] You should see an **empty state** ("No conversations yet…") because the booking is still pending — messaging unlocks once a guide accepts.

### Sign out
- [ ] Profile / settings → Sign Out. You should land back on the login screen.

---

## 2. Guide smoke test (~10 min)

Run this in the **Incognito/Private** window so you're a different user.

### Sign up as a guide
- [ ] Sign up with `guide_test1@example.com` / `Guide1234!` and pick the Guide role on signup.
- [ ] After signup, lands on the Guide Dashboard tab (📊). The hero shows a Mumbai cityscape — **not a food bowl**, not a broken image.

### Fill out the profile (THE NEW FIELDS)
- [ ] Tap the Profile tab (👤).
- [ ] You should see **two cards**: "Edit Profile" and "Your Story".
- [ ] **Edit Profile** card has these inputs: Full Name, University, Hometown, Languages, Bio.
- [ ] **Your Story** card has: Headline quote (multiline), then 3 prompt blocks each with a question label + multiline answer field.
- [ ] Fill in everything:
    - Full Name: "Aisha Patel"
    - University: "IIT Bombay"
    - Hometown: "Mumbai"
    - Languages: "English, Hindi, Marathi"
    - Bio: a few sentences
    - Headline quote: a unique sentence you'd recognize, like "The best part of Mumbai is the chai stall on the corner of MG Road."
    - All 3 prompt answers
- [ ] Tap "Save Changes" → green ✅ Saved alert.
- [ ] Pull-to-refresh the screen → all your inputs persist (didn't get wiped).

### Tap your avatar
- [ ] Tap the circular avatar at the top. On Web: a file picker opens. On native: the photo library opens.
- [ ] Pick any image. After upload, the avatar updates to your image.

### Create a tour
- [ ] Tap the Tours tab (🗺️) → tap "+ New Tour" or similar.
- [ ] Add a name, description, duration, price, and at least one stop.
- [ ] Tap "Add Cover Photo" → file picker opens, you can pick an image.
- [ ] Save. Tour appears in your Tours list.

### Accept the booking
- [ ] Tap the Requests tab (📬). The pending booking from your traveler should be there.
- [ ] Tap "Accept". Confirmation. Status changes.
- [ ] Now tap the Inbox tab (💬). You should see one conversation with the traveler.

### Message the traveler
- [ ] Tap the conversation → conversation screen opens.
- [ ] Type "Hello! I'm excited to show you Mumbai." → tap Send. Message appears in the thread.

---

## 3. Cross-account verification — the real test (~5 min)

Now switch back to the **normal** browser window (still logged in as the traveler).

### Verify the new profile fields surfaced correctly
- [ ] Explore tab → find the guide you just created (Aisha Patel).
- [ ] Open her profile.
- [ ] **Hero subtitle** shows "IIT Bombay · Mumbai" (not blank, not fallback).
- [ ] **Pull quote** shows your unique sentence — not a fabricated fallback.
- [ ] **Three things about me** cards show your prompt answers — not placeholder text.
- [ ] Photo journal shows your tour cover image.

### Verify messaging round-trip
- [ ] Tap the Inbox tab (💬). Now there's one conversation (the booking is no longer pending).
- [ ] Open it. You should see the guide's "Hello! I'm excited…" message.
- [ ] Type "Thanks! Looking forward." → Send. Message appears.
- [ ] Switch back to the **Incognito** (guide) window.
- [ ] Inbox → open the conversation → pull-to-refresh. The traveler's reply appears.

### Trip lifecycle
- [ ] As the **guide** (Incognito), open the booking detail → mark as "Confirmed" / "In Progress" / "Completed" depending on what your status flow shows.
- [ ] Switch to **traveler** window → My Trips → status reflects the change after a refresh.

---

## 4. What to report

If any step fails, capture this info **before moving on** — otherwise it's much harder to debug later:

1. **What step number failed.** (e.g. "Step 2.4 — saving the profile.")
2. **What you expected.** (e.g. "The save button should show a green Saved alert.")
3. **What actually happened.** (e.g. "Got a red error: 'column hometown does not exist'.")
4. **Browser console** — open dev tools → Console tab → screenshot the red errors. Or copy the text.
5. **Which role you were in** — traveler or guide.
6. **URL of the page.** (e.g. `localhost:8081/(guide)/profile`)
7. **A screenshot** of the broken state. On Mac: `Cmd+Shift+4` then drag a box.

Drop all of the above into a Notion page, a GitHub issue, or just paste it into your next conversation with me. The more of these you include, the faster I can fix it.

---

## What's NOT in this checklist (and why)

- **Unit tests / Jest / React Testing Library.** Worth setting up once the codebase stops changing weekly. Right now they'd break with every refactor and slow you down. Type checking in CI catches the same class of bugs cheaper.
- **End-to-end tests / Detox / Maestro.** Same reason, plus they need a real device farm to be meaningful. Not worth it before launch.
- **Load/performance testing.** Pre-launch with a handful of users, the only number that matters is "does the homepage load in under 3 seconds." Eyeball it.
- **Razorpay / payment flow.** Stubbed — test once Razorpay is live-keyed.
- **Push notifications, deep links.** Stubbed.
- **Marketing site (`index.html`, `know-more.html`).** Static pages — visual diff in a browser, no automation needed.

When the app has 50+ paying users and changes slow down, revisit this list and add automation for the boring parts.
