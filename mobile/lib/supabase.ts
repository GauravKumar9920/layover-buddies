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
  // `input` can be string | URL | Request. URL doesn't have .url/.clone(), so
  // narrow against Request explicitly — that's the only branch with extras.
  const isRequest = typeof Request !== 'undefined' && input instanceof Request;
  const requestUrl =
    typeof input === 'string' ? input : isRequest ? input.url : input.toString();
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
  const requestTemplate = isRequest ? input.clone() : null;
  let lastError: unknown;

  // On web, use the intercepting fetch that clears stale refresh tokens on 400.
  const baseFetch = _webFetch ?? fetch;

  for (const origin of orderedOrigins) {
    const attemptUrl = `${origin}${requestedPath}`;
    try {
      const response = requestTemplate
        ? await baseFetch(new Request(attemptUrl, requestTemplate.clone()))
        : await baseFetch(attemptUrl, init);

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
//
// Additionally: intercept failed refresh-token requests on web and immediately
// clear the stored session so the client stops retrying. Without this, a stale
// refresh token (e.g. after `supabase db reset`) causes every subsequent API
// call to hang waiting for auth that will never resolve.
const _isWeb = typeof document !== 'undefined';
const _nativeFetch = typeof fetch !== 'undefined' ? fetch : undefined;
const _webFetch: typeof fetch | undefined =
  _isWeb && _nativeFetch
    ? async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof Request
            ? input.url
            : input.toString();
        const isRefresh = url.includes('grant_type=refresh_token');
        const res = await _nativeFetch!(input, init);
        if (isRefresh && res.status === 400) {
          // Stale refresh token — purge from storage so the client stops looping.
          // We can't call supabase.auth.signOut() here (circular dep at module
          // init time), so remove all auth-related keys for this project.
          try {
            const projectRef = supabaseUrl.split('https://')[1]?.split('.')[0] || '';
            const keysToRemove = Object.keys(localStorage).filter(
              (k) =>
                k.includes(`sb-${projectRef}`) ||
                k.includes('supabase-auth-token') ||
                (k.includes('supabase') && (k.includes('auth') || k.includes('token'))),
            );
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          } catch {
            // localStorage unavailable (SSR) — ignore
          }
        }
        return res;
      }
    : undefined;
const isWeb = typeof document !== 'undefined';

// Supabase's LockFunc is generic — `<R>(...) => Promise<R>`. A typed function
// expression can't capture the type parameter, so use a `function` declaration.
function noopLock<R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> {
  return fn();
}

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
