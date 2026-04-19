# Layover Buddies

A two-sided marketplace connecting international airport layover travelers with Mumbai student guides — turning transit time into a real local experience.

## What It Is

Travelers with layovers in Mumbai get matched with verified student guides who show them the city. Guides earn income; travelers get an authentic experience in hours.

## Project Structure

```
layover-buddies/
├── index.html              # Marketing landing page
├── know-more.html          # Deep-dive info page for travelers & guides
├── src/style.css           # Custom CSS + Tailwind directives
├── tailwind.config.js      # Tailwind config
├── vite.config.js          # Vite build config
├── mobile/                 # React Native + Expo app
│   ├── app/                # Expo Router screens
│   │   ├── (auth)/         # Login, signup, forgot-password
│   │   ├── (traveler)/     # Browse, book, trips, live map
│   │   ├── (guide)/        # Dashboard, requests, profile, itineraries
│   │   └── (shared)/       # Messaging
│   ├── components/         # Reusable UI components
│   ├── lib/api/            # Supabase API layer
│   ├── config/             # Theme tokens + business constants
│   └── types/              # TypeScript models
├── supabase/               # Database schema, migrations, seed data
├── design/                 # Brand guidelines and UI mockups
└── docs/                   # Architecture and API docs
```

## Tech Stack

| Layer | Tech |
|---|---|
| Marketing site | Vite 5, Tailwind CSS 3, Vanilla JS |
| Mobile app | React Native 0.76, Expo 52, Expo Router 4, TypeScript |
| Styling | NativeWind 4 (Tailwind for React Native) |
| Animations | React Native Reanimated 3 |
| State | Zustand 4 |
| Backend | Supabase (auth + Postgres + storage) |
| Payments | Razorpay (integration in progress) |
| Maps | react-native-maps, expo-location |

## Running Locally

### Marketing Site
```bash
npm install
npm run dev
```

### Mobile App (iOS Simulator)
```bash
npm --prefix mobile install
npm --prefix mobile run start
# press `i` in the Expo terminal
```

### Mobile App (Android Emulator)
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH

npm --prefix mobile run start
# press `a` in the Expo terminal
```

### Environment Variables
Copy `mobile/.env.local.example` to `mobile/.env.local` and fill in:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## License

Copyright (c) 2026 Layover Buddies. All Rights Reserved. See [LICENSE](LICENSE).
