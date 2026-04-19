# Mobile Applications - React Native / Expo

## Purpose
This folder will contain the cross-platform mobile applications for iOS and Android using React Native and Expo. The mobile app provides travelers and guides with on-the-go access to search, booking, messaging, and payment features with native look-and-feel on both platforms.

## Tech Stack
- **Framework**: React Native + Expo
- **Language**: JavaScript / TypeScript
- **Navigation**: React Navigation
- **State Management**: Redux Toolkit or Zustand
- **Database/API**: Supabase or REST API (from backend)
- **Styling**: NativeWind or Styled Components
- **Payment**: Razorpay mobile SDK
- **Maps**: React Native Maps
- **Push Notifications**: Expo Notifications

## Project Structure (When Implemented)
```
mobile/
├── app/                      # App Router screens
│   ├── (auth)/              # Authentication stack
│   ├── (tabs)/              # Main app tabs
│   ├── (guide)/             # Guide-specific screens
│   └── _layout.tsx
├── components/               # Reusable components
├── screens/                 # Screen components
├── navigation/              # Navigation configuration
├── services/                # API & Supabase integration
├── utils/                   # Helper functions
├── assets/                  # Images, fonts, icons
├── app.json                 # Expo configuration
├── package.json
└── .env
```

## Key Features (To Build)
- User onboarding & authentication (travelers & guides)
- Guide discovery with real-time location
- Booking & calendar management
- In-app messaging
- Notification system
- Payment processing
- Review & rating submission
- Earnings tracking (for guides)
- Push notifications for bookings
- Offline support (offline bookings cache)

## Environment Variables
```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=
RAZORPAY_KEY_ID=
```

## Getting Started (When Ready)
```bash
npm install -g expo-cli
npx create-expo-app mobile
cd mobile
npm install
npx expo start
```

## Testing on Devices
```bash
# Scan QR code with Expo Go app on iOS/Android
npx expo start

# Build for native testing
eas build --platform ios
eas build --platform android
```

## Deployment
Use EAS (Expo Application Services) for building and distributing:
```bash
eas build
eas submit
```
