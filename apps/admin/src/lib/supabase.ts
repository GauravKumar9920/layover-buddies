import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@detour/database';

export interface PublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface ConfigState {
  configured: boolean;
  config: PublicConfig | null;
  problem: string | null;
}

function jwtRole(key: string): string | null {
  const payload = key.split('.')[1];
  if (!payload) return null;
  try {
    const unpadded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const normalized = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(normalized)) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
}

function readConfig(): ConfigState {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      configured: false,
      config: null,
      problem: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect this console.',
    };
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      throw new Error('Supabase URL must use HTTPS outside local development.');
    }
  } catch (error) {
    return {
      configured: false,
      config: null,
      problem: error instanceof Error ? error.message : 'Supabase URL is invalid.',
    };
  }

  const role = jwtRole(supabaseAnonKey);
  if (supabaseAnonKey.startsWith('sb_secret_') || (role !== null && role !== 'anon')) {
    return {
      configured: false,
      config: null,
      problem: 'The browser credential is privileged. Replace it with the public anon or publishable key.',
    };
  }

  return { configured: true, config: { supabaseUrl, supabaseAnonKey }, problem: null };
}

export const configState = readConfig();

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!configState.configured || !configState.config) {
    throw new Error(configState.problem ?? 'Admin console is not configured.');
  }
  if (!client) {
    client = createClient<Database>(configState.config.supabaseUrl, configState.config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export function isConfigured(): boolean {
  return configState.configured;
}
