import type { BOOKING_STATUS, PAYMENT_STATUS } from '@/config/constants';

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  phone?: string;
  created_at: string;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export interface GuideProfile {
  id: string;
  user_id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  portfolio_image_url?: string | null;
  university?: string | null;
  avg_rating: number;
  total_reviews: number;
  is_active: boolean;
  languages: string[];
  hometown: string | null;
  categories: string[];
  created_at: string;
}

export interface TravelerProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  nationality: string | null;
  phone: string | null;
  created_at: string;
}

// ─── Itineraries ─────────────────────────────────────────────────────────────

export interface ItineraryStop {
  id: string;
  itinerary_id: string;
  order: number;
  location: string;
  description: string;
  estimated_duration_minutes: number;
  image_url?: string | null;
}

export interface Itinerary {
  id: string;
  guide_id: string;
  name: string;
  title?: string;
  description: string;
  city: string;
  category?: string | null;
  image_url?: string | null;
  cover_image_url?: string | null;
  estimated_duration_hours: number;
  buddy_cost_inr: number;
  max_travelers: number;
  is_active: boolean;
  created_at: string;
  stops?: ItineraryStop[];
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

export interface Booking {
  id: string;
  traveler_id: string;
  guide_id: string;
  itinerary_id: string;
  flight_number: string | null;
  flight_date: string | null;
  start_date: string;
  end_date: string;
  total_price: number;
  commission: number;
  status: BookingStatus;
  payment_intent_id: string | null;
  payment_status: PaymentStatus;
  created_at: string;
  // Joined fields
  guide?: GuideProfile;
  traveler?: TravelerProfile;
  itinerary?: Itinerary;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: TravelerProfile | GuideProfile;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ─── API Request/Response ────────────────────────────────────────────────────

export interface CreateBookingRequest {
  guide_id: string;
  itinerary_id: string;
  flight_number?: string;
  flight_date?: string;
  start_date: string;
  end_date: string;
}

export interface CreateReviewRequest {
  booking_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
}

export interface SendMessageRequest {
  booking_id: string;
  content: string;
}

// ─── UI State ────────────────────────────────────────────────────────────────

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export type UserRole = 'traveler' | 'guide';
