// ============================================================================
// PLATFORM SETTINGS — effective pricing rates (early-access aware)
// ============================================================================
// Detour launches free: while `early_access_mode` is on in the DB's
// `platform_settings` row, every platform charge (platform-up/down fee,
// commission, GST, TDS, late fee) is zero. The admin panel flips the switch
// when monetisation starts.
//
// The zeroing rule itself lives in the `get_effective_rates()` Postgres
// function — this module just calls it via RPC and caches the result so
// pricing screens don't refetch on every render.
//
// IMPORTANT — agreements snapshot their rates at draft time (columns on the
// `agreements` table). Anything that re-renders an *existing* agreement must
// use the agreement row's rates, NOT this module. This module is only for
// pricing things that happen *now* (drafting a new agreement, the booking
// estimate card).
// ============================================================================

import { supabase } from '../supabase';
import {
  PLATFORM_FEE_UP_RATE,
  PLATFORM_FEE_DOWN_RATE,
  COMMISSION_RATE,
  TDS_RATE,
  LATE_FEE_PAISE,
} from '@/config/constants';

export interface EffectiveRates {
  earlyAccessMode: boolean;
  platformFeeUpRate: number;
  platformFeeDownRate: number;
  commissionRate: number;
  gstRate: number;
  tdsRate: number;
  lateFeePaise: number;
}

/**
 * Fallback when the RPC is unreachable (offline, cold start). We default to
 * EARLY ACCESS (all charges zero) — under-charging during an outage is a
 * recoverable mistake; over-charging a traveler who was promised "free" is not.
 */
export const EARLY_ACCESS_RATES: EffectiveRates = {
  earlyAccessMode: true,
  platformFeeUpRate: 0,
  platformFeeDownRate: 0,
  commissionRate: 0,
  gstRate: 0,
  tdsRate: 0,
  lateFeePaise: 0,
};

/** The post-early-access defaults, for reference/tests. */
export const STANDARD_RATES: EffectiveRates = {
  earlyAccessMode: false,
  platformFeeUpRate: PLATFORM_FEE_UP_RATE,
  platformFeeDownRate: PLATFORM_FEE_DOWN_RATE,
  commissionRate: COMMISSION_RATE,
  gstRate: 0.05,
  tdsRate: TDS_RATE,
  lateFeePaise: LATE_FEE_PAISE,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached: EffectiveRates | null = null;
let cachedAt = 0;

/**
 * Fetch the rates in force right now. Cached for 5 minutes; falls back to
 * early-access (free) rates if the RPC fails and there is no cached value.
 */
export async function getEffectiveRates(): Promise<EffectiveRates> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const { data, error } = await supabase.rpc('get_effective_rates');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('platform_settings row missing');

    cached = {
      earlyAccessMode: row.early_access_mode,
      platformFeeUpRate: Number(row.platform_fee_up_rate),
      platformFeeDownRate: Number(row.platform_fee_down_rate),
      commissionRate: Number(row.commission_rate),
      gstRate: Number(row.gst_rate),
      tdsRate: Number(row.tds_rate),
      lateFeePaise: Number(row.late_fee_paise),
    };
    cachedAt = now;
    return cached;
  } catch {
    // Stale cache beats the fallback; fallback beats a crash.
    return cached ?? EARLY_ACCESS_RATES;
  }
}

/** Test hook — reset the module cache. */
export function __resetRatesCache(): void {
  cached = null;
  cachedAt = 0;
}
