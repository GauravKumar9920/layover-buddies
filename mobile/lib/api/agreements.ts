// ============================================================================
// AGREEMENTS API — direct-to-Supabase REST writes (Phase 2)
// ============================================================================
// Plain Supabase wrappers for the buddy-side drafting flow. Edge-function
// calls (sign, deposit) live in `agreementSign.ts` and `deposits.ts`.
//
// `sendAgreement` is the one place in Phase 2 client code that calls
// `transition()` — every other status write happens server-side in an Edge
// function (sign or webhook). This is per the plan §"Mobile files".
// ============================================================================

import { supabase } from '../supabase';
import { computeAgreementSnapshot } from '../booking/agreementSnapshot';
import { transition, type BookingState } from '../booking/stateMachine';
import { MIN_BOOKING_NOTICE_HOURS } from '@/config/constants';
import type { Database } from '@/types/supabase';

export type Agreement      = Database['public']['Tables']['agreements']['Row'];
export type AgreementInsert = Database['public']['Tables']['agreements']['Insert'];
export type CostLineItem   = Database['public']['Tables']['cost_line_items']['Row'];
export type CostCategory   = Database['public']['Enums']['cost_category'];

export interface DraftLineItem {
  id?: string;                  // present when editing an existing row
  category: CostCategory;
  description: string;
  estimated_paise: number;
  position: number;
}

export interface CreateDraftInput {
  booking_id: string;
  trip_starts_at: string;       // ISO
  trip_ends_at?: string | null; // ISO
  // Initial financial fields are stored as 0 / placeholders; the snapshot
  // is computed at "Send" time. The DB CHECK constraints permit zeros but
  // the snapshot helper rejects them, which keeps drafts valid until ready.
}

export interface SaveDraftPatch {
  buddy_fee_paise?: number;
  itinerary_fund_paise?: number;
  buffer_paise?: number;
  trip_starts_at?: string;
  trip_ends_at?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAgreementByBooking(bookingId: string): Promise<Agreement | null> {
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchLineItemsByAgreement(agreementId: string): Promise<CostLineItem[]> {
  const { data, error } = await supabase
    .from('cost_line_items')
    .select('*')
    .eq('agreement_id', agreementId)
    .order('position', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Drafting writes (buddy-only via RLS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new agreement draft for a booking. Initial financial values are
 * placeholders that satisfy the DB CHECK constraints (buffer = 20% of
 * itinerary; total = subtotal + GST + 50000) so the row is INSERT-able even
 * before the buddy fills the form. The snapshot helper rejects zero amounts
 * at "Send" time, which is the correct gate.
 *
 * Uses 100 paise (₹1) as the seed itinerary fund so floor(100 × 0.20) = 20
 * makes the buffer constraint satisfied. Caller fills real values via
 * `saveAgreementDraft` immediately after.
 */
export async function createAgreementDraft(input: CreateDraftInput): Promise<Agreement> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  // Seed values that satisfy CHECK constraints. Real numbers go in via
  // `saveAgreementDraft` before the user can hit "Send".
  const itineraryFundPaise = 100;
  const bufferPaise        = 20;             // floor(100 * 0.20) — satisfies CHECK
  const subtotal           = 0 + itineraryFundPaise + bufferPaise; // = 120
  const gst                = 0;              // floor(120 * 0.05) → 6, but CHECK only requires equality if we compute; use 0
  // The total CHECK is: total = subtotal + gst + 50000
  // So: 120 + 0 + 50000 = 50120
  const totalSeed          = subtotal + gst + 50_000;

  const insert: AgreementInsert = {
    booking_id:               input.booking_id,
    drafted_by_user_id:       user.id,
    status:                   'draft',
    buddy_fee_paise:          0,
    itinerary_fund_paise:     itineraryFundPaise,
    buffer_paise:             bufferPaise,
    gst_rate:                 0.05,
    traveler_subtotal_paise:  subtotal,
    traveler_gst_paise:       gst,
    traveler_total_paise:     totalSeed,
    trip_starts_at:           input.trip_starts_at,
    trip_ends_at:             input.trip_ends_at ?? null,
  };

  const { data, error } = await supabase
    .from('agreements')
    .insert(insert)
    .select('*')
    .single();

  if (error) throw error;

  // Side effect: advance booking from chat_open → agreement_drafting if applicable.
  await advanceBookingOnDraftCreate(input.booking_id);

  return data;
}

/**
 * Read the booking, run a state-machine transition for `guide_starts_drafting`,
 * and update bookings.status if the reducer says it's a legal move.
 */
async function advanceBookingOnDraftCreate(bookingId: string): Promise<void> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .single();

  if (error) throw error;

  const result = transition(
    booking.status as BookingState,
    { kind: 'guide_starts_drafting' },
    { bothSignaturesPresent: false, bothDepositsHeld: false },
  );

  if (!result.ok) return; // already past chat_open — fine, no-op

  await supabase.from('bookings').update({ status: result.next }).eq('id', bookingId);
}

/**
 * Patch an in-progress draft. Skips snapshot recomputation — the snapshot
 * is recomputed exactly once at `sendAgreement` time. Callers should still
 * pass a valid buffer (= floor(itin × 0.20)) when they update itinerary, or
 * the DB CHECK will reject the write.
 */
export async function saveAgreementDraft(
  agreementId: string,
  patch: SaveDraftPatch,
): Promise<void> {
  // If only buddy_fee changed, we don't need to keep the snapshot consistent
  // (it'll be recomputed on Send anyway). But the CHECK constraints DO require
  // buffer/total to stay consistent with itinerary at all times. So if the
  // caller updates itinerary, they MUST also pass buffer.
  if (patch.itinerary_fund_paise !== undefined && patch.buffer_paise === undefined) {
    throw new Error('Updating itinerary_fund_paise requires also updating buffer_paise');
  }

  // If they updated either money field, also bump the seed snapshot to keep
  // the total CHECK happy. This is a placeholder — `sendAgreement` will
  // overwrite with the real snapshot.
  const moneyChanged = patch.buddy_fee_paise !== undefined
    || patch.itinerary_fund_paise !== undefined
    || patch.buffer_paise !== undefined;

  let extra: Partial<SaveDraftPatch & { traveler_subtotal_paise: number; traveler_gst_paise: number; traveler_total_paise: number }> = {};

  if (moneyChanged) {
    // Re-fetch current to fill in any fields the patch didn't touch.
    const { data: current, error: readErr } = await supabase
      .from('agreements')
      .select('buddy_fee_paise, itinerary_fund_paise, buffer_paise, gst_rate')
      .eq('id', agreementId)
      .single();
    if (readErr) throw readErr;

    const merged = {
      buddy_fee_paise:      patch.buddy_fee_paise      ?? current.buddy_fee_paise,
      itinerary_fund_paise: patch.itinerary_fund_paise ?? current.itinerary_fund_paise,
      buffer_paise:         patch.buffer_paise         ?? current.buffer_paise,
      gstRate:              current.gst_rate,
    };

    // Tentative snapshot — may not be the canonical formula (zero buddy fee,
    // etc.), but the CHECK constraint just needs total = subtotal + gst + 50000.
    const subtotal = Math.round(merged.buddy_fee_paise * 1.125)
                   + merged.itinerary_fund_paise
                   + merged.buffer_paise;
    const gst      = Math.round(subtotal * merged.gstRate);
    const total    = subtotal + gst + 50_000;

    extra = {
      traveler_subtotal_paise: subtotal,
      traveler_gst_paise:      gst,
      traveler_total_paise:    total,
    };
  }

  const { error } = await supabase
    .from('agreements')
    .update({ ...patch, ...extra })
    .eq('id', agreementId);

  if (error) throw error;
}

/**
 * Replace the line items for an agreement. Phase 2 keeps it simple: delete
 * all existing rows and insert the new set. Rare write path (only happens
 * on save), small list size, so the round-trip cost is negligible.
 */
export async function upsertCostLineItems(
  agreementId: string,
  items: DraftLineItem[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('cost_line_items')
    .delete()
    .eq('agreement_id', agreementId);
  if (delErr) throw delErr;

  if (items.length === 0) return;

  const rows = items.map((item, idx) => ({
    agreement_id:    agreementId,
    category:        item.category,
    description:     item.description,
    estimated_paise: item.estimated_paise,
    position:        item.position ?? idx,
  }));

  const { error: insErr } = await supabase.from('cost_line_items').insert(rows);
  if (insErr) throw insErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send: compute snapshot, validate, advance booking via transition()
// ─────────────────────────────────────────────────────────────────────────────

export class SendAgreementError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SendAgreementError';
  }
}

/**
 * Finalise the draft and send it to the traveler. Computes the canonical
 * snapshot, validates inputs, writes the snapshot fields, transitions the
 * booking from `agreement_drafting` (or `chat_open`) to `agreement_sent`.
 */
export async function sendAgreement(agreementId: string): Promise<Agreement> {
  // ── Read agreement + booking + line items ────────────────────────────────
  const { data: agreement, error: agrErr } = await supabase
    .from('agreements')
    .select('*')
    .eq('id', agreementId)
    .single();
  if (agrErr) throw agrErr;

  const { data: lineItems, error: liErr } = await supabase
    .from('cost_line_items')
    .select('id')
    .eq('agreement_id', agreementId);
  if (liErr) throw liErr;

  if (!lineItems || lineItems.length === 0) {
    throw new SendAgreementError('no_line_items', 'Add at least one cost line item before sending.');
  }

  if (agreement.buddy_fee_paise <= 0) {
    throw new SendAgreementError('buddy_fee_required', 'Set a buddy fee greater than ₹0.');
  }
  if (agreement.itinerary_fund_paise <= 0) {
    throw new SendAgreementError('itinerary_fund_required', 'Set a day-expenses fund greater than ₹0.');
  }

  const tripStart = new Date(agreement.trip_starts_at).getTime();
  const minStart  = Date.now() + MIN_BOOKING_NOTICE_HOURS * 60 * 60 * 1000;
  if (tripStart < minStart) {
    throw new SendAgreementError(
      'trip_too_soon',
      `Trip must start at least ${MIN_BOOKING_NOTICE_HOURS} hours from now.`,
    );
  }

  // ── Compute canonical snapshot ───────────────────────────────────────────
  const snap = computeAgreementSnapshot({
    buddyFeePaise:      agreement.buddy_fee_paise,
    itineraryFundPaise: agreement.itinerary_fund_paise,
    bufferPaise:        agreement.buffer_paise,
    gstRate:            agreement.gst_rate,
  });

  // ── Persist snapshot + status='sent' + sent_at ──────────────────────────
  const { data: updated, error: updateErr } = await supabase
    .from('agreements')
    .update({
      status:                  'sent',
      sent_at:                 new Date().toISOString(),
      traveler_subtotal_paise: snap.travelerSubtotalPaise,
      traveler_gst_paise:      snap.travelerGstPaise,
      traveler_total_paise:    snap.travelerTotalPaise,
    })
    .eq('id', agreementId)
    .select('*')
    .single();
  if (updateErr) throw updateErr;

  // ── Advance booking status ───────────────────────────────────────────────
  const { data: booking, error: bookErr } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', agreement.booking_id)
    .single();
  if (bookErr) throw bookErr;

  const result = transition(
    booking.status as BookingState,
    { kind: 'guide_sends_agreement' },
    { bothSignaturesPresent: false, bothDepositsHeld: false },
  );

  if (!result.ok) {
    // Roll back agreement status to draft so the buddy can retry once
    // the booking-side issue is resolved.
    const { error: rollbackErr } = await supabase
      .from('agreements')
      .update({ status: 'draft', sent_at: null })
      .eq('id', agreementId);
    if (rollbackErr) {
      // Both the state-machine rejection and the rollback failed — surface the
      // combined error so the caller knows the agreement is in a dirty state.
      throw new SendAgreementError(
        'rollback_failed',
        `Cannot send from status "${booking.status}" and rollback also failed: ${rollbackErr.message}`,
      );
    }
    throw new SendAgreementError(
      'illegal_booking_transition',
      `Cannot send agreement from booking status "${booking.status}".`,
    );
  }

  const { error: bookUpdErr } = await supabase
    .from('bookings')
    .update({ status: result.next })
    .eq('id', agreement.booking_id);
  if (bookUpdErr) throw bookUpdErr;

  return updated;
}
