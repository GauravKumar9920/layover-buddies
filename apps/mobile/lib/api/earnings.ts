// ============================================================================
// EARNINGS — guide-side payout history + summary
// ============================================================================
// Reads the payout_dispatches ledger (RLS: recipients can read their own
// rows) plus the guide's bookings to build the three numbers a guide cares
// about: earned to date, expected from trips in flight, and actually paid out.
//
// NOTE: never select razorpay_fund_account_id — the column grant is revoked
// for authenticated users; selecting it errors the whole query.
// ============================================================================

import { supabase } from '../supabase';
import { fetchGuideBookings } from './bookings';
import { rupeesToPaise } from '../booking/money';
import { stageForState } from '../booking/tripStages';
import { PLATFORM_FEE_DOWN_RATE, TDS_RATE } from '@/config/constants';
import type { Booking } from '@/types';
import type { Database } from '@/types/supabase';

export type PayoutKind = Database['public']['Enums']['payout_kind'];
export type PayoutDispatchStatus = Database['public']['Enums']['payout_dispatch_status'];

export interface GuidePayout {
  id: string;
  booking_id: string;
  kind: PayoutKind;
  status: PayoutDispatchStatus;
  gross_paise: number;
  net_paise: number;
  tds_paise: number;
  initiated_at: string;
  completed_at: string | null;
  failed_reason: string | null;
}

export const PAYOUT_KIND_LABELS: Partial<Record<PayoutKind, string>> = {
  trip_pot_release: 'Trip pot release',
  buddy_fee_final: 'Buddy fee',
  traveler_refund: 'Traveler refund',
  cancellation_refund: 'Cancellation refund',
};

export function payoutKindLabel(kind: PayoutKind): string {
  return PAYOUT_KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');
}

/**
 * A guide's expected net earning from one booking, in paise — mirrors
 * `compute_reconciliation_tx` (12.5% platform-down, then 1% TDS) on the
 * BUDDY FEE only.
 *
 * Critically this is based on `buddy_cost`, NOT `total_price − commission`:
 * `total_price` also bundles `estimated_expenses` (the traveler's trip pot),
 * which is never guide income — any unused portion is refunded to the traveler
 * (see the `traveler_refund` dispatch in 20260512100200_reconciliation_function).
 *
 * Early-access bookings carry `commission` 0, meaning every platform charge was
 * zeroed at booking time (platform-down + TDS included), so the guide keeps the
 * full buddy fee. This is an estimate — the source of truth is `paidOutPaise`
 * (actual `payout_dispatches.net_paise`), which also folds in the ±deposit/buffer
 * terms we can't know from the booking row alone.
 */
export function expectedNetPaise(booking: Pick<Booking, 'buddy_cost' | 'commission'>): number {
  const buddyFeePaise = rupeesToPaise(booking.buddy_cost);
  // commission (platform_fee) 0 ⇒ early access ⇒ no platform-down / TDS applied.
  if (booking.commission <= 0) return buddyFeePaise;
  const afterPlatform = Math.floor(buddyFeePaise * (1 - PLATFORM_FEE_DOWN_RATE));
  return afterPlatform - Math.round(afterPlatform * TDS_RATE);
}

export async function fetchGuidePayouts(guideUserId: string): Promise<GuidePayout[]> {
  const { data, error } = await supabase
    .from('payout_dispatches')
    .select('id, booking_id, kind, status, gross_paise, net_paise, tds_paise, initiated_at, completed_at, failed_reason')
    .eq('recipient_user_id', guideUserId)
    .order('initiated_at', { ascending: false });

  if (error) throw error;
  return (data as GuidePayout[] | null) ?? [];
}

export interface EarningsSummary {
  /** Sum of expected net buddy fee across completed/rated trips, in paise
   *  (platform-down + TDS applied; excludes the traveler's expense pot). */
  earnedPaise: number;
  /** Expected net buddy fee from trips in flight (deposits locked → not yet
   *  completed), in paise. */
  pipelinePaise: number;
  /** Sum of net payouts actually dispatched (status = sent), in paise. */
  paidOutPaise: number;
  completedTrips: number;
  pipelineTrips: number;
}

/**
 * Bookings enter the pipeline once real money is committed — the Balance
 * stage (index 3 in TRIP_STAGES) means both deposits are in escrow.
 */
const PIPELINE_STAGE_START = 3;

export async function fetchEarningsSummary(guideUserId: string): Promise<{
  summary: EarningsSummary;
  payouts: GuidePayout[];
}> {
  const [bookings, payouts] = await Promise.all([
    fetchGuideBookings(guideUserId),
    fetchGuidePayouts(guideUserId),
  ]);

  let earnedPaise = 0;
  let pipelinePaise = 0;
  let completedTrips = 0;
  let pipelineTrips = 0;

  for (const booking of bookings) {
    const expected = expectedNetPaise(booking);
    if (booking.status === 'completed' || booking.status === 'rated') {
      earnedPaise += expected;
      completedTrips += 1;
      continue;
    }
    const position = stageForState(booking.status);
    if (position.status === 'active' && position.index >= PIPELINE_STAGE_START && position.index < 6) {
      pipelinePaise += expected;
      pipelineTrips += 1;
    }
  }

  const paidOutPaise = payouts
    .filter((p) => p.status === 'sent')
    .reduce((sum, p) => sum + p.net_paise, 0);

  return {
    summary: { earnedPaise, pipelinePaise, paidOutPaise, completedTrips, pipelineTrips },
    payouts,
  };
}
