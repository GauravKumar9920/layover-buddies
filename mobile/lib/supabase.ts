import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Read from process.env — Expo inlines EXPO_PUBLIC_* at build time
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Helpful when diagnosing simulator network issues with local Supabase hosts.
  console.log('[supabase] URL:', supabaseUrl);
}

function getMetroHostIp(): string | null {
  const hostUri =
    (Constants.expoConfig?.hostUri as string | undefined) ??
    ((Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri as string | undefined);

  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

function buildLocalSupabaseOrigins(url: string): string[] {
  try {
    const parsed = new URL(url);
    const portPart = parsed.port ? `:${parsed.port}` : '';
    const protocol = parsed.protocol;
    const origins: string[] = [parsed.origin];

    const metroHost = getMetroHostIp();
    const candidates = ['localhost', '127.0.0.1', metroHost].filter(Boolean) as string[];
    for (const host of candidates) {
      const origin = `${protocol}//${host}${portPart}`;
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    }

    return origins;
  } catch {
    return [url];
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed')
  );
}

const supabaseOrigins = buildLocalSupabaseOrigins(supabaseUrl);
let activeSupabaseOrigin = supabaseOrigins[0];

const supabaseFetch: typeof fetch = async (input, init) => {
  const requestUrl = typeof input === 'string' ? input : input.url;
  const requestedPath = (() => {
    try {
      const parsed = new URL(requestUrl);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return '';
    }
  })();

  const isSupabaseRequest = supabaseOrigins.some((origin) => requestUrl.startsWith(origin));
  if (!isSupabaseRequest || !requestedPath || supabaseOrigins.length <= 1) {
    return fetch(input, init);
  }

  const orderedOrigins = [activeSupabaseOrigin, ...supabaseOrigins.filter((o) => o !== activeSupabaseOrigin)];
  const requestTemplate = typeof input === 'string' ? null : input.clone();
  let lastError: unknown;

  for (const origin of orderedOrigins) {
    const attemptUrl = `${origin}${requestedPath}`;
    try {
      const response = requestTemplate
        ? await fetch(new Request(attemptUrl, requestTemplate.clone()))
        : await fetch(attemptUrl, init);

      if (origin !== activeSupabaseOrigin && typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[supabase] Switched to fallback origin:', origin);
      }
      activeSupabaseOrigin = origin;
      return response;
    } catch (err) {
      lastError = err;
      if (!isNetworkFailure(err)) {
        throw err;
      }
    }
  }

  throw lastError;
};

export const isSupabaseConfigured =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
  !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// On web the Supabase JS client uses the Web Locks API to serialize auth
// token operations. When multiple app instances share the same origin
// (e.g. preview iframes, multiple tabs, HMR) they fight over the same lock
// causing NavigatorLockAcquireTimeoutError and an infinite loading spinner.
// Replacing the lock with a no-op serializes nothing but avoids the deadlock;
// single-user dev is safe without it. Also disable autoRefreshToken on web to
// prevent the concurrent-refresh race that rotates the token out from under
// the next bootstrap call.
const isWeb = typeof document !== 'undefined';

const noopLock: (name: string, acquireTimeout: number, fn: () => Promise<void>) => Promise<void> =
  (_name, _timeout, fn) => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: !isWeb,
    persistSession: true,
    detectSessionInUrl: false,
    ...(isWeb ? { lock: noopLock } : {}),
  },
});
