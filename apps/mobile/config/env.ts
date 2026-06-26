import Constants from 'expo-constants';

const DEV_FALLBACKS: Record<string, string> = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
};

function getEnv(key: string, required = true): string {
  const value =
    (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[key] ??
    process.env[key];

  if (required && !value) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const fallback = DEV_FALLBACKS[key] ?? '';
      console.warn(`[env] Missing ${key}; using development fallback.`);
      return fallback;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? '';
}

export const env = {
  SUPABASE_URL: getEnv('EXPO_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  RAZORPAY_KEY_ID: getEnv('EXPO_PUBLIC_RAZORPAY_KEY_ID', false),
  GOOGLE_MAPS_API_KEY: getEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', false),
} as const;
