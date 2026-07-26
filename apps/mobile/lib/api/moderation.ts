// ============================================================================
// MODERATION API — report & block (Apple Guideline 1.2, UGC safety)
// ============================================================================
// reportUser files a report the admin console triages; blockUser/unblockUser
// manage the caller's block list. A block is enforced server-side by the
// messages BEFORE INSERT guard (migration 20260707130000) — a blocked pair
// cannot message in either direction.
// ============================================================================

import { supabase } from '../supabase';

export type ReportReason = 'harassment' | 'safety' | 'inappropriate' | 'spam' | 'scam' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'harassment', label: 'Harassment or abuse' },
  { key: 'safety', label: 'Safety concern' },
  { key: 'inappropriate', label: 'Inappropriate behaviour' },
  { key: 'scam', label: 'Scam or fraud' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Something else' },
];

export async function reportUser(input: {
  reportedUserId: string;
  bookingId?: string | null;
  reason: ReportReason;
  details?: string;
}): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    reported_user_id: input.reportedUserId,
    booking_id: input.bookingId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
  if (error) throw error;
}

export async function blockUser(blockedUserId: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: user.id, blocked_id: blockedUserId });

  // 23505 = unique_violation — already blocked, treat as success (idempotent).
  if (error && (error as { code?: string }).code !== '23505') throw error;
}

export async function unblockUser(blockedUserId: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedUserId);
  if (error) throw error;
}

/** Ids the current user has blocked (for hiding/blocking UI affordances). */
export async function fetchBlockedUserIds(): Promise<string[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', user.id);
  if (error) throw error;
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}
