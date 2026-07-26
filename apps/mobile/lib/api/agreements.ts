// ============================================================================
// AGREEMENTS API — direct-to-Supabase REST writes (Phase 2)
// ============================================================================
// Plain Supabase wrappers for the buddy-side drafting flow. Edge-function
// calls (sign, deposit) live in `agreementSign.ts` and `deposits.ts`.
//
// `sendAgreement` finalizes the agreement and syncs the booking through the
// atomic `send_agreement_tx` RPC. Other lifecycle writes happen in Edge
// functions (sign, deposit/webhook) or narrowly permitted pre-signing updates.
// ============================================================================

import { supabase } from '../supabase';
import { MIN_BOOKING_NOTICE_HOURS } from '@/config/constants';
import type { Database } from '@/types/supabase';

export type Agreement      = Database['public']['Tables']['agreements']['Row'];
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

  // Draft creation, effective-rate snapshotting, and the booking transition
  // happen atomically server-side. The client cannot supply fee/GST rates.
  const { data, error } = await supabase.rpc('create_agreement_draft_tx', {
    p_booking_id: input.booking_id,
    p_trip_starts_at: input.trip_starts_at,
    p_trip_ends_at: input.trip_ends_at ?? null,
  });
  if (error) throw error;

  const draft = Array.isArray(data) ? data[0] : data;
  if (!draft) throw new Error('Agreement draft creation returned no result.');
  return draft as Agreement;
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
  // The database recomputes derived snapshot fields from the immutable rate
  // snapshot before every permitted draft edit.
  if (patch.itinerary_fund_paise !== undefined && patch.buffer_paise === undefined) {
    throw new Error('Updating itinerary_fund_paise requires also updating buffer_paise');
  }

  const { error } = await supabase
    .from('agreements')
    .update(patch)
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
// Send: validate, then atomically finalize agreement + sync booking via RPC
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
 * booking from `agreement_drafting` to `agreement_sent`.
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

  // All authoritative checks and writes happen in one server transaction.
  // The caller supplies only the agreement id; money/status values are derived
  // from locked rows so the bookings column lockdown remains intact.
  const { data, error } = await supabase.rpc('send_agreement_tx', {
    p_agreement_id: agreementId,
  });
  if (error) {
    throw new SendAgreementError('send_failed', error.message);
  }

  const updated = Array.isArray(data) ? data[0] : data;
  if (!updated) {
    throw new SendAgreementError('send_failed', 'Agreement send returned no result.');
  }

  return updated as Agreement;
}
