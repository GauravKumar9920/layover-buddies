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
import { stageForState } from '../booking/tripStages';
import { expectedNetPaise } from '@/lib/booking/earnings';
import type { Database } from '@/types/supabase';

export { expectedNetPaise } from '@/lib/booking/earnings';

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
