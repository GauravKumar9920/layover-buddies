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

export async function uploadExpenseProof(params: UploadProofParams): Promise<ExpenseProof> {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;
  if (!userId) throw new Error('not_authenticated');

  const proofKey = `${params.bookingId}/${crypto.randomUUID()}.${ext(params.paymentProofBlob)}`;

  const { error: upErr } = await supabase.storage
    .from('expense-proofs')
    .upload(proofKey, params.paymentProofBlob, { upsert: false });

  if (upErr) throw upErr;

  const { data: { publicUrl: paymentProofUrl } } = supabase.storage
    .from('expense-proofs')
    .getPublicUrl(proofKey);

  let billUrl: string | null = null;
  if (params.billBlob) {
    const billKey = `${params.bookingId}/${crypto.randomUUID()}_bill.${ext(params.billBlob)}`;
    await supabase.storage.from('expense-proofs').upload(billKey, params.billBlob, { upsert: false });
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
