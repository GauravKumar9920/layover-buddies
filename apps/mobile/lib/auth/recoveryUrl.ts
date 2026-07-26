// ============================================================================
// PASSWORD-RECOVERY URL PARSING (pure helpers)
// ============================================================================
// Kept dependency-free (no expo/supabase imports) so it can be unit-tested in
// isolation. `recoveryLink.ts` wires these to the live Linking/Supabase APIs.
// ============================================================================

export interface RecoveryCredentials {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  errorDescription: string | null;
  type: string | null;
}

/**
 * Merge params from BOTH the query string and the URL fragment into one bag.
 * Supabase puts recovery tokens in the fragment (implicit flow) but the PKCE
 * `code` in the query — a single link never carries both, but reading both
 * keeps this flow-agnostic. `URLSearchParams` is a global built-in in Node and
 * polyfilled on native by react-native-url-polyfill (lib/supabase.ts).
 */
export function paramsFromUrl(url: string): URLSearchParams {
  const merged = new URLSearchParams();
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  for (const src of [query, fragment]) {
    if (!src) continue;
    try {
      new URLSearchParams(src).forEach((v, k) => merged.set(k, v));
    } catch {
      // Malformed segment — rely on whatever the other segment held.
    }
  }
  return merged;
}

/** Is this URL a password-recovery link we should act on? */
export function isRecoveryLink(url: string, params: URLSearchParams): boolean {
  return url.includes('reset-password') || params.get('type') === 'recovery';
}

/** Pull the credentials Supabase may have delivered in either flow. */
export function credentialsFromParams(params: URLSearchParams): RecoveryCredentials {
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    code: params.get('code'),
    errorDescription: params.get('error_description') || params.get('error'),
    type: params.get('type'),
  };
}
