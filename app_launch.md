# App Launch — Operating Notes

How to bring the stack up locally and reproduce today's two-sided demo
(Harshal on Android phone via Expo Go, Aarav as guide in the laptop browser).

---

## 1. Prereqs

- Supabase local stack running:
  ```bash
  cd /Users/gaurav/Desktop/mumbai-buddies
  supabase start
  ```
  Verify: `supabase status` shows Studio at `http://127.0.0.1:54323` and the
  REST API at `http://127.0.0.1:54321`.
- Android device connected via USB with USB debugging enabled.
  Verify: `adb devices` lists the device (today's was `R5CT41RCJ8W`).
- Android SDK PATH exported in the shell that runs Metro:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
  ```

---

## 2. Bring up Metro for **USB + Expo Go (Android)**

The mobile app is SDK 52; Expo Go on the device must be the SDK-52 line
(`2.32.x`). The first launch will offer to swap automatically. Day 2+ the
right version is already installed.

### One-shot startup

```bash
# Map the phone's localhost → Mac's localhost for Metro + Supabase
adb reverse tcp:8081  tcp:8081
adb reverse tcp:54321 tcp:54321

cd /Users/gaurav/Desktop/mumbai-buddies/mobile

# `script -q` gives Expo a pseudo-TTY so the interactive prompts work
# even when launched from a non-interactive shell.
# `printf 'n\n'` answers "no" to the "install recommended Expo Go" prompt
# when 2.32.x is already on the device.
REACT_NATIVE_PACKAGER_HOSTNAME=localhost \
  script -q /tmp/expo-pty.log \
  bash -c "printf 'n\n' | npx expo start --android --go --localhost --clear"
```

Watch `/tmp/expo-pty.log` — when you see `Metro waiting on exp://localhost:8081`
the bundler is ready. Expo Go on the phone auto-opens to that URL.

### Why `--localhost` + `adb reverse`

The phone has no Wi-Fi access to the Mac's LAN IP. Binding Metro to
`localhost` and tunnelling port 8081 over USB (`adb reverse`) makes
`exp://localhost:8081` reachable from the phone. Same trick for Supabase
on 54321.

### `mobile/.env.local`

`EXPO_PUBLIC_SUPABASE_URL` must be `http://localhost:54321` for the phone
(via the USB tunnel) — not a stale LAN IP like `10.x.x.x`.

```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon JWT from `supabase status -o json`>
EXPO_PUBLIC_RAZORPAY_KEY_ID=<your Razorpay test key id>
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<key>
```

### If Expo Go SDK version is wrong (54 vs 52)

Expo CLI will prompt to download `Exponent-2.32.20.apk`. Approve on the
phone — first install takes ~30 s. After that, the recommended version
stays put across restarts.

---

## 3. Bring up the **web app** for the guide-side demo

The same Metro server also serves a web build at `http://localhost:8081`.

Two gotchas were fixed today:

1. **`react-native-maps` is native-only** — the web bundle crashed at
   `codegenNativeCommands`. Aliased to a stub in
   [`mobile/metro.config.js`](mobile/metro.config.js) +
   [`mobile/lib/stubs/react-native-maps.web.js`](mobile/lib/stubs/react-native-maps.web.js).
2. **`react-native`'s `Alert.alert` is a no-op on web** — Save / Send
   buttons on the guide's agreement-draft screen silently failed. Fixed
   with a cross-platform [`mobile/lib/ui/alert.ts`](mobile/lib/ui/alert.ts)
   helper (`notify` + `confirmAsync`).

To launch on web: open `http://localhost:8081` in any browser. The first
bundle takes ~30-60 s; subsequent loads are HMR-fast.

---

## 4. Demo accounts

| Role     | Name           | Email                       | Password    | Notes                                      |
| -------- | -------------- | --------------------------- | ----------- | ------------------------------------------ |
| Guide    | Aarav Patil    | aarav.patil@vjti.ac.in      | Aarav1234!  | VJTI ME 3rd-yr, owns "Midnight Mumbai" itin. |
| Guide    | Priya Sharma   | priya.sharma@iitb.ac.in     | _unset_     | Set via admin API if needed.               |
| Guide    | Rohan D'Souza  | rohan.dsouza@xaviers.edu    | _unset_     | "                                          |
| Guide    | Sneha Mehta    | sneha.mehta@nmims.edu       | _unset_     | "                                          |
| Guide    | Kabir Joshi    | kabir.joshi@mithibai.ac.in  | _unset_     | "                                          |
| Traveler | Harshal        | _(real, signed up via app)_ | _user-set_  | Live test account.                          |

### Reset / set a seeded account's password

```bash
SVC=$(supabase status -o json | python3 -c "import sys,json; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")
USER_ID="aaaaaaaa-0000-4000-a000-000000000001"  # Aarav

curl -sS -X PUT "http://localhost:54321/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" \
  -d '{"password":"Aarav1234!","email_confirm":true}'
```

The 5 seed-data guides all have IDs of the form
`aaaaaaaa-0000-4000-a000-00000000000N`. Find a specific guide's UUID with:

```bash
curl -sS "http://localhost:54321/rest/v1/users?role=eq.guide&select=id,full_name" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC"
```

---

## 5. Two-sided demo runbook

1. **Phone (Android, Expo Go)** — Harshal logs in, browses guides,
   messages Aarav about a trip.
2. **Laptop (browser)** — open `http://localhost:8081`, log in as Aarav,
   tap **Inbox** → Harshal's thread. Replies sent here arrive on the
   phone via Supabase Realtime within ~1 s.
3. **Auto-responder bot (optional)** — `/tmp/aarav-bot/poller.sh`
   polls Supabase every 3 s for new Harshal messages, logs them to
   `/tmp/aarav-bot/inbox.ndjson`, and sends any replies dropped into
   `/tmp/aarav-bot/queue.json` (a JSON array of strings) back as Aarav
   via the Supabase REST API. Useful for hands-free guide-side replies
   while focusing on the traveler UX.

---

## 6. Common cleanup

```bash
# Kill stuck Metro / pty wrapper
pkill -f "expo start"
pkill -f "node.*metro"
pkill -f "script -q /tmp/expo-pty"

# Re-establish USB tunnels after replug
adb reverse tcp:8081  tcp:8081
adb reverse tcp:54321 tcp:54321

# Force-relaunch Expo Go on the phone at our Metro
adb shell am force-stop host.exp.exponent
adb shell am start -a android.intent.action.VIEW -d "exp://localhost:8081" host.exp.exponent
```

If you ever see the phone load `exp://10.x.x.x:8081` instead of
`exp://localhost:8081`, Metro was started without
`REACT_NATIVE_PACKAGER_HOSTNAME=localhost`. Restart with that env var set.

---

## 7. Known-good state — 2026-05-17

- Mobile: SDK 52, Expo Go 2.32.19 on Galaxy S22 Ultra (`SM_S908N`).
- Supabase: local stack, service role + anon JWTs from
  `supabase status -o json`.
- Edits landed today:
  - [`mobile/lib/hooks/useAuth.ts`](mobile/lib/hooks/useAuth.ts) —
    onboarding-complete signal flips `needsOnboarding` synchronously to
    stop the layout from bouncing back to step 1.
  - [`mobile/app/(traveler)/onboarding.tsx`](mobile/app/(traveler)/onboarding.tsx)
    — replaced text date/time inputs with
    `@react-native-community/datetimepicker` (native calendar + clock,
    Cancel/Done modal on iOS).
  - [`mobile/metro.config.js`](mobile/metro.config.js) +
    [`mobile/lib/stubs/react-native-maps.web.js`](mobile/lib/stubs/react-native-maps.web.js)
    — unblocked web bundle.
  - [`mobile/lib/ui/alert.ts`](mobile/lib/ui/alert.ts) +
    [`mobile/app/(guide)/bookings/agreement-draft/[bookingId].tsx`](mobile/app/(guide)/bookings/agreement-draft/[bookingId].tsx)
    — Save / Send now work on web.
