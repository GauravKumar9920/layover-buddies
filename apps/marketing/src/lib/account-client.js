// supabase-js client for the sign-in and account pages only. Everywhere else,
// public/assets/account-lite.js reads the same stored session without the SDK.
import { createClient } from '@supabase/supabase-js';

export const AUTH_STORAGE_KEY = 'detour-auth';

let client;

export function accountClient() {
  const url = document.querySelector('meta[name="detour-supabase-url"]')?.getAttribute('content');
  const key = document.querySelector('meta[name="detour-supabase-key"]')?.getAttribute('content');
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      // Email confirmation and password-reset links land on /account with the
      // session in the URL; the implicit flow keeps those links working on any device.
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  });
  return client;
}

// Only same-site paths are allowed as a post-sign-in destination.
export function safeNext(value, fallback = '/account') {
  if (typeof value !== 'string' || !/^\/(?!\/)[A-Za-z0-9/_\-.]*$/.test(value)) return fallback;
  if (value === '/login') return fallback;
  return value;
}

export function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'That email and password don’t match. Check both, or reset your password.';
  if (message.includes('email not confirmed')) return 'Please confirm your email first. The link is in the message we sent when you signed up.';
  if (message.includes('already registered') || message.includes('already been registered')) return 'There’s already an account with this email. Try signing in instead.';
  if (message.includes('password') && (message.includes('at least') || message.includes('short') || message.includes('weak'))) return 'Choose a longer password: at least 8 characters.';
  if (message.includes('rate limit') || message.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (message.includes('fetch') || message.includes('network')) return 'We couldn’t reach our servers. Check your connection and try again.';
  return 'Something went wrong. Please try again, or email admin@detourtrips.com.';
}
