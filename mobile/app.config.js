// Dynamic Expo config — reads environment variables at build time so sensitive
// keys (Google Maps, Razorpay) are never hard-coded in version control.
// This file supersedes app.json; delete app.json if you no longer need it for
// legacy tooling.
//
// Usage:
//   npx expo run:ios   — reads .env.local automatically via Expo CLI
//   eas build          — set env vars in eas.json or the EAS dashboard

const { withAndroidManifest } = require('@expo/config-plugins');

// Custom config plugin — guarantees the Google Maps API key meta-data tag
// is present in the generated AndroidManifest.xml. The built-in
// `android.config.googleMaps.apiKey` path is supposed to do this but it
// silently skipped on our SDK 52 prebuild, leaving MapView to crash at
// runtime with "API key not found". Doing it here explicitly removes that
// failure mode regardless of what the upstream plugin does.
function withGoogleMapsMetaData(expoConfig, { apiKey }) {
  if (!apiKey) return expoConfig;
  return withAndroidManifest(expoConfig, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;
    application['meta-data'] ||= [];
    const existing = application['meta-data'].findIndex(
      (m) => m.$?.['android:name'] === 'com.google.android.geo.API_KEY',
    );
    const tag = {
      $: {
        'android:name': 'com.google.android.geo.API_KEY',
        'android:value': apiKey,
      },
    };
    if (existing >= 0) application['meta-data'][existing] = tag;
    else application['meta-data'].push(tag);
    return config;
  });
}

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'Detour',
  slug: 'detour',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F97316',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.detourtrips.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Detour uses your location to show your guide\'s live position during the tour.',
      NSLocationAlwaysUsageDescription:
        'Detour uses your location for real-time tracking during tours.',
      NSCameraUsageDescription:
        'Detour uses your camera for profile photos.',
      NSPhotoLibraryUsageDescription:
        'Detour needs access to your photos for profile pictures.',
    },
    // Google Maps SDK for iOS — required when MapView uses PROVIDER_GOOGLE.
    // If you prefer Apple Maps (PROVIDER_DEFAULT on iOS) you can omit this,
    // but the same key works for both; keep it here for future flexibility.
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F97316',
    },
    package: 'com.detourtrips.app',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
    ],
    // Google Maps for Android — always required (Android has no Apple Maps).
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      },
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  notification: {
    iosDisplayInForeground: true,
    androidMode: 'default',
    androidCollapsedTitle: 'Detour',
    color: '#C8542A',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Detour uses your location during tours.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Detour uses your camera for profile photos.',
      },
    ],
    [
      'expo-notifications',
      {
        color: '#C8542A',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  newArchEnabled: true,
  scheme: 'detour',
  extra: {
    eas: {
      projectId: 'PLACEHOLDER_RUN_EAS_INIT_TO_GENERATE',
    },
  },
};

// Apply the inline plugin so the API key meta-data lands in the manifest.
const finalConfig = withGoogleMapsMetaData(config, {
  apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
});

export default { expo: finalConfig };
