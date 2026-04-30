import { supabase } from '../supabase';
import { fetchTravelerBookings, fetchGuideBookings } from './bookings';
import { BOOKING_STATUS } from '@/config/constants';
import type { Booking, Message, SendMessageRequest } from '@/types';

export async function sendMessage(req: SendMessageRequest): Promise<Message> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      booking_id: req.booking_id,
      sender_id: user.id,
      content: req.content,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMessages(bookingId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Marks all messages in a booking as read (messages not sent by current user). */
export async function markMessagesRead(bookingId: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return;

  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('booking_id', bookingId)
    .neq('sender_id', user.id)
    .eq('is_read', false);
}

/**
 * Returns a map of booking_id → unread message count for the current user.
 * Only counts messages NOT sent by the current user that are unread.
 */
export async function fetchUnreadCounts(bookingIds: string[]): Promise<Record<string, number>> {
  if (bookingIds.length === 0) return {};

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return {};

  const { data } = await supabase
    .from('messages')
    .select('booking_id')
    .in('booking_id', bookingIds)
    .neq('sender_id', user.id)
    .eq('is_read', false);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.booking_id] = (counts[row.booking_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Returns the bookings the current user can hold a conversation in — i.e.
 * bookings that have moved past the "pending" stage. Combines traveler-side
 * and guide-side bookings (a single user might play both roles), de-dupes
 * by id, and sorts most-recently-created first.
 *
 * Powers the shared Inbox tab. The conversation screen
 * (mobile/app/(shared)/messages/[bookingId].tsx) is reachable from here as
 * well as from individual booking detail screens.
 */
export async function fetchInbox(userId: string): Promise<Booking[]> {
  const [travelerBookings, guideBookings] = await Promise.all([
    fetchTravelerBookings(userId),
    fetchGuideBookings(userId),
  ]);

  const activeStatuses: string[] = [
    BOOKING_STATUS.GUIDE_ACCEPTED,
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.IN_PROGRESS,
    BOOKING_STATUS.COMPLETED,
  ];

  const seen = new Set<string>();
  const merged: Booking[] = [];
  for (const b of [...travelerBookings, ...guideBookings]) {
    if (seen.has(b.id)) continue;
    if (!activeStatuses.includes(b.status)) continue;
    seen.add(b.id);
    merged.push(b);
  }

  return merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
