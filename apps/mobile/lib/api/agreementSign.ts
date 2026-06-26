// ============================================================================
// AGREEMENT SIGN API — Edge-function client (Phase 2)
// ============================================================================
// Calls the sign-agreement Edge Function for both traveler and buddy sign
// actions. The function handles the atomic timestamp + agreement-status
// write, then advances bookings.status via the shared state-machine.
//
// Why a single Edge function for both sides:
//   - Phase 1 RLS only grants UPDATE on `agreements` to the drafter (buddy)
//     via `agreements_update_buddy`. Traveler signature MUST go through
//     service-role.
//   - Routing buddy through the same function keeps the post-write guard
//     computation in one place — exactly one server-side caller of
//     `transition()` per sign.
// ============================================================================

import { supabase } from '../supabase';
import type { Database } from '@/types/supabase';

export type SignSide = 'traveler' | 'buddy';

export interface SignResult {
  ok: true;
  booking_status:   Database['public']['Enums']['booking_status'];
  agreement_status: Database['public']['Enums']['agreement_status'];
  already_signed?:  boolean;
}

export class SignAgreementError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SignAgreementError';
  }
}

export async function signAgreement(
  bookingId: string,
  side: SignSide,
  fullName: string,
): Promise<SignResult> {
  const trimmed = fullName.trim();
  if (!trimmed) {
    throw new SignAgreementError('full_name_required', 'Type your full name to sign.');
  }

  const { data, error } = await supabase.functions.invoke('sign-agreement', {
    body: { booking_id: bookingId, side, full_name: trimmed },
  });

  if (error) {
    throw new SignAgreementError('edge_error', `Sign failed: ${error.message}`);
  }

  const payload = data as Record<string, unknown>;
  if (payload?.error) {
    throw new SignAgreementError(
      String(payload.error),
      (payload.error as string) ?? 'Sign request rejected.',
    );
  }
  if (!payload?.ok) {
    throw new SignAgreementError('invalid_response', 'sign-agreement returned an invalid response.');
  }

  return {
    ok:               true,
    booking_status:   payload.booking_status as SignResult['booking_status'],
    agreement_status: payload.agreement_status as SignResult['agreement_status'],
    already_signed:   (payload.already_signed as boolean | undefined) ?? false,
  };
}
