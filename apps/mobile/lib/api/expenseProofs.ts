// ============================================================================
// EXPENSE PROOFS API — Phase 4
// ============================================================================
// Handles upload, fetch, delete, and final submission of buddy expense proofs.
// ============================================================================

import { supabase } from '../supabase';

export interface ExpenseProof {
  id:                    string;
  booking_id:            string;
  uploaded_by_user_id:   string;
  category:              string;
  description:           string | null;
  amount_paise:          number;
  bill_url:              string | null;
  payment_proof_url:     string;
  created_at:            string;
}

export interface UploadProofParams {
  bookingId:         string;
  category:          string;
  description?:      string;
  amountPaise:       number;
  paymentProofBlob:  Blob;
  billBlob?:         Blob;
}

function ext(blob: Blob): string {
  const type = blob.type;
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('png'))  return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('pdf'))  return 'pdf';
  return 'jpg';
}

/**
 * UUID v4 that works on every JS runtime we target.
 *
 * Why not `crypto.randomUUID()`?
 *   - Hermes (the default RN engine on New Architecture) does NOT ship
 *     `crypto.randomUUID`. `react-native-get-random-values` adds
 *     `crypto.getRandomValues` but NOT `randomUUID`. The original code
 *     here threw `TypeError: crypto.randomUUID is not a function` the
 *     first time a buddy submitted an expense proof on iOS/Android.
 *   - Older mobile-web browsers and non-https contexts also lack it.
 *
 * Falls back to `Math.random()` only when nothing better is available
 * (e.g. unit tests). The proof keys aren't security-critical — storage
 * RLS gates access by booking-id-prefixed path — so a weak random is
 * acceptable as a final fallback.
 */
function uuidv4(): string {
  // Cast to a permissive shape because TS's lib.dom Crypto type doesn't
  // know about random{UUID,Values} on every runtime.
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  // Last-resort fallback (test envs, very old engines).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function uploadExpenseProof(params: UploadProofParams): Promise<ExpenseProof> {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  if (!userId) throw new Error('not_authenticated');

  const proofKey = `${params.bookingId}/${uuidv4()}.${ext(params.paymentProofBlob)}`;

  const { error: upErr } = await supabase.storage
    .from('expense-proofs')
    .upload(proofKey, params.paymentProofBlob, { upsert: false });

  if (upErr) throw upErr;

  const { data: { publicUrl: paymentProofUrl } } = supabase.storage
    .from('expense-proofs')
    .getPublicUrl(proofKey);

  let billUrl: string | null = null;
  if (params.billBlob) {
    const billKey = `${params.bookingId}/${uuidv4()}_bill.${ext(params.billBlob)}`;
    // Check the upload result so a silently-failed bill upload doesn't end
    // up persisting a bill_url that resolves to 404.
    const { error: billErr } = await supabase.storage
      .from('expense-proofs')
      .upload(billKey, params.billBlob, { upsert: false });
    if (billErr) throw billErr;
    billUrl = supabase.storage.from('expense-proofs').getPublicUrl(billKey).data.publicUrl;
  }

  const { data, error } = await supabase
    .from('expense_proofs')
    .insert({
      booking_id:           params.bookingId,
      uploaded_by_user_id:  userId,
      category:             params.category,
      description:          params.description ?? null,
      amount_paise:         params.amountPaise,
      payment_proof_url:    paymentProofUrl,
      bill_url:             billUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ExpenseProof;
}

export async function fetchExpenseProofs(bookingId: string): Promise<ExpenseProof[]> {
  const { data, error } = await supabase
    .from('expense_proofs')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExpenseProof[];
}

export async function deleteExpenseProof(proofId: string): Promise<void> {
  const { error } = await supabase
    .from('expense_proofs')
    .delete()
    .eq('id', proofId);
  if (error) throw error;
}
