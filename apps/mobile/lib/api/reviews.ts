import { supabase } from '../supabase';
import type { CreateReviewRequest, Review } from '@/types';

/** Returns the review for a specific booking, or null if none exists yet. */
export async function fetchReviewForBooking(bookingId: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:users!reviewer_id(id, full_name, avatar_url)')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    ...(row as object),
    rating: (row.overall_rating as number) ?? 0,
    reviewer: row.reviewer
      ? { id: (row.reviewer as Record<string, unknown>).id, name: (row.reviewer as Record<string, unknown>).full_name, avatar_url: (row.reviewer as Record<string, unknown>).avatar_url }
      : undefined,
  } as Review;
}

export async function submitReview(req: CreateReviewRequest): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reviews').insert({
    booking_id: req.booking_id,
    reviewer_id: user.id,
    reviewee_id: req.reviewee_id,
    overall_rating: req.rating,
    comment: req.comment ?? null,
  });

  // Database trigger `maintain_guide_review_state` owns both denormalized guide
  // rating metrics and the completed → rated booking transition atomically.
  if (error) throw error;
}

export async function fetchReviewsForGuide(guideId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:users!reviewer_id(id, full_name, avatar_url)')
    .eq('reviewee_id', guideId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as object),
    rating: (row.overall_rating as number) ?? 0,
    reviewer: row.reviewer
      ? { id: (row.reviewer as Record<string, unknown>).id, name: (row.reviewer as Record<string, unknown>).full_name, avatar_url: (row.reviewer as Record<string, unknown>).avatar_url }
      : undefined,
  })) as Review[];
}
