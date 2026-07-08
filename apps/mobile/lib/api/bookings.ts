import { supabase } from '../supabase';
import { COMMISSION_RATE, BOOKING_STATUS, ESTIMATED_EXPENSES_PERCENT } from '@/config/constants';
import { getEffectiveRates } from './platformSettings';
import type { Booking, CreateBookingRequest, BookingStatus, PaymentStatus } from '@/types';

interface RawUserJoin {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface RawTravelerProfileJoin {
  nationality: string | null;
}

interface RawTravelerJoin extends RawUserJoin {
  // PostgREST may embed as a single object (1:1 via UNIQUE FK) or array — handle both.
  traveler_profile?: RawTravelerProfileJoin | RawTravelerProfileJoin[] | null;
}

interface RawItineraryStopRow {
  id: string;
  itinerary_id: string;
  stop_order: number | null;
  name: string | null;
  description: string | null;
  estimated_duration_minutes: number | null;
  image_url?: string | null;
}

interface RawItineraryRow {
  id: string;
  guide_id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  duration_hours: number | null;
  buddy_cost: number | null;
  max_travelers: number | null;
  is_published: boolean | null;
  created_at: string;
  stops?: RawItineraryStopRow[];
}

interface RawBookingRow {
  id: string;
  traveler_id: string;
  guide_id: string;
  itinerary_id: string | null;
  arrival_flight_number: string | null;
  arrival_time: string | null;
  tour_start_time: string | null;
  tour_end_time: string | null;
  num_travelers: number | null;
  buddy_cost: number | null;
  estimated_expenses: number | null;
  total_amount: number | null;
  platform_fee: number | null;
  status: string;
  payment_id: string | null;
  payment_status: string;
  created_at: string;
  guide?: RawUserJoin;
  traveler?: RawTravelerJoin;
  itinerary?: RawItineraryRow;
}

function toIsoOrNull(date: string | undefined, time: string): string | null {
  if (!date) return null;
  // The booking form collects a calendar date only — no time picker yet.
  // Callers pass a default-time string like `09:00:00.000Z`. Previously we
  // appended that as a literal UTC suffix, so a "Mon Jun 1 09:00 UTC" tour
  // landed at 14:30 IST in the UI — well into lunch. Tours run in Mumbai
  // local time, so we anchor the default time to IST (UTC+5:30) instead.
  const istOffsetMinutes = 5 * 60 + 30;
  const localIso = `${date}T${time.replace(/Z$/, '')}`; // strip any trailing Z
  const localMs = Date.parse(localIso);
  if (Number.isNaN(localMs)) return null;
  // Date.parse on `YYYY-MM-DDTHH:mm:ss.sss` (no zone) is treated as local
  // time by the JS engine — which in the dev env is whatever the host is.
  // Force it to IST by subtracting the IST offset relative to UTC so the
  // stored ISO timestamp consistently represents "9 AM Mumbai" regardless of
  // where the caller is running.
  const istAsUtcMs = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(time.slice(0, 2)) || 0,
    Number(time.slice(3, 5)) || 0,
    0,
  ) - istOffsetMinutes * 60_000;
  return new Date(istAsUtcMs).toISOString();
}

function normalizePaymentStatus(status: string): PaymentStatus {
  if (status === 'paid') return 'captured';
  if (status === 'pending' || status === 'authorized' || status === 'captured' || status === 'released' || status === 'failed' || status === 'refunded') {
    return status;
  }
  return 'pending';
}

// All booking_status values that are valid in the DB post Phase 1 migration.
// New financial-lifecycle states are passed through as-is; the mobile UI
// falls back gracefully (BookingCard shows a neutral badge for unknown states).
const VALID_BOOKING_STATUSES = new Set<string>([
  // Legacy values (data migrated but enum values still present)
  'pending', 'guide_accepted', 'confirmed',
  // Unchanged from original schema
  'in_progress', 'completed', 'cancelled', 'disputed',
  // Phase 1 financial lifecycle states
  'chat_open', 'agreement_drafting', 'agreement_sent',
  'agreement_signed_traveler', 'agreement_signed_buddy',
  'awaiting_deposits', 'deposits_held',
  'awaiting_balance', 'late_fee_due', 'balance_paid',
  'trip_ready', 'awaiting_proofs', 'reconciling', 'rated',
  'cancelled_no_pay', 'cancelled_traveler_voluntary', 'cancelled_buddy',
  'cancelled_force_majeure', 'cancelled_pre_signing', 'cancelled_no_deposit',
]);

function normalizeBookingStatus(status: string): BookingStatus {
  if (VALID_BOOKING_STATUSES.has(status)) {
    return status as BookingStatus;
  }
  // Unrecognised value from DB — default to chat_open rather than 'pending'
  // so it surfaces as a real (visible) state rather than an orphan.
  return 'chat_open' as BookingStatus;
}

function normalizeItinerary(row?: RawItineraryRow): Booking['itinerary'] {
  if (!row) return undefined;

  return {
    id: row.id,
    guide_id: row.guide_id,
    name: row.title ?? 'Mumbai Tour',
    title: row.title ?? 'Mumbai Tour',
    description: row.description ?? '',
    city: 'Mumbai',
    category: row.category,
    image_url: row.cover_image_url ?? null,
    cover_image_url: row.cover_image_url ?? null,
    estimated_duration_hours: Number(row.duration_hours ?? 0),
    buddy_cost_inr: Number(row.buddy_cost ?? 0),
    max_travelers: Number(row.max_travelers ?? 1),
    is_active: row.is_published ?? false,
    created_at: row.created_at,
    stops: Array.isArray(row.stops)
      ? row.stops.map((stop) => ({
          id: stop.id,
          itinerary_id: stop.itinerary_id,
          order: Number(stop.stop_order ?? 0),
          location: stop.name ?? 'Stop',
          description: stop.description ?? '',
          estimated_duration_minutes: Number(stop.estimated_duration_minutes ?? 0),
          image_url: stop.image_url ?? null,
        }))
      : [],
  };
}

function normalizeGuideUser(row?: RawUserJoin): Booking['guide'] {
  if (!row) return undefined;

  return {
    id: row.id,
    user_id: row.id,
    name: row.full_name ?? 'Guide',
    bio: null,
    avatar_url: row.avatar_url ?? null,
    avg_rating: 0,
    total_reviews: 0,
    is_active: true,
    languages: [],
    hometown: null,
    categories: [],
    created_at: new Date().toISOString(),
  };
}

function normalizeTravelerUser(row?: RawTravelerJoin): Booking['traveler'] {
  if (!row) return undefined;

  const profile = Array.isArray(row.traveler_profile)
    ? row.traveler_profile[0] ?? null
    : row.traveler_profile ?? null;

  return {
    id: row.id,
    user_id: row.id,
    name: row.full_name ?? 'Traveler',
    avatar_url: row.avatar_url ?? null,
    nationality: profile?.nationality ?? null,
    phone: null,
    created_at: new Date().toISOString(),
  };
}

function normalizeBooking(row: RawBookingRow): Booking {
  const startDate = row.tour_start_time ?? row.arrival_time ?? row.created_at;
  const endDate = row.tour_end_time ?? startDate;

  return {
    id: row.id,
    traveler_id: row.traveler_id,
    guide_id: row.guide_id,
    itinerary_id: row.itinerary_id ?? '',
    flight_number: row.arrival_flight_number,
    flight_date: row.arrival_time ? row.arrival_time.slice(0, 10) : null,
    start_date: startDate,
    end_date: endDate,
    num_travelers: Number(row.num_travelers ?? 1),
    buddy_cost: Number(row.buddy_cost ?? 0),
    estimated_expenses: Number(row.estimated_expenses ?? 0),
    total_price: Number(row.total_amount ?? 0),
    commission: Number(row.platform_fee ?? 0),
    status: normalizeBookingStatus(row.status),
    payment_intent_id: row.payment_id,
    payment_status: normalizePaymentStatus(row.payment_status),
    created_at: row.created_at,
    guide: normalizeGuideUser(row.guide),
    traveler: normalizeTravelerUser(row.traveler),
    itinerary: normalizeItinerary(row.itinerary),
  };
}

/**
 * Estimate-path commission. Pass the effective rate from
 * `getEffectiveRates()` — 0 during early access. Falls back to the
 * legacy constant when no rate is supplied.
 */
export function calcCommission(buddyCost: number, commissionRate: number = COMMISSION_RATE): number {
  return Math.round(buddyCost * commissionRate);
}

export async function createBooking(req: CreateBookingRequest): Promise<Booking> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const tourStartTime = toIsoOrNull(req.start_date, '09:00:00.000Z');
  const tourEndTime = toIsoOrNull(req.end_date, '17:00:00.000Z');
  // Preserve the traveler's actual arrival/departure times (HH:MM, IST) when
  // provided; fall back to midnight only if no time was entered.
  const arrivalTime = toIsoOrNull(req.flight_date, req.flight_time || '00:00:00.000Z');
  const departureTime = toIsoOrNull(req.departure_date, req.departure_time || '00:00:00.000Z');

  // Clamp group size to [1, 10] — DB has the same CHECK constraint, this just
  // gives a friendlier failure mode than a 23514.
  const numTravelers = Math.max(1, Math.min(10, Math.round(req.num_travelers ?? 1)));

  // A casual inquiry has no package yet — pricing is figured out later in the
  // chat/agreement once the itinerary is built. Only fetch + price when a tour
  // was actually selected.
  let buddyCost = 0;
  let estimatedExpenses = 0;
  let commission = 0;

  if (req.itinerary_id) {
    // Fetch itinerary to get price (deleted tours can't be booked)
    const { data: itin, error: itinErr } = await supabase
      .from('itineraries')
      .select('buddy_cost')
      .eq('id', req.itinerary_id)
      .is('deleted_at', null)
      .single();

    if (itinErr || !itin) throw new Error('Itinerary not found');

    const rates = await getEffectiveRates();

    // Per-person rates from the itinerary; total scales linearly with group size.
    const perPersonBuddyCost = itin.buddy_cost;
    const perPersonExpenses  = Math.round(perPersonBuddyCost * (ESTIMATED_EXPENSES_PERCENT / 100));
    const perPersonCommission = calcCommission(perPersonBuddyCost, rates.commissionRate);

    buddyCost          = perPersonBuddyCost  * numTravelers;
    estimatedExpenses  = perPersonExpenses   * numTravelers;
    commission         = perPersonCommission * numTravelers;
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      traveler_id: user.id,
      guide_id: req.guide_id,
      itinerary_id: req.itinerary_id ?? null,
      arrival_flight_number: req.flight_number ?? null,
      arrival_time: arrivalTime,
      departure_time: departureTime,
      tour_start_time: tourStartTime,
      tour_end_time: tourEndTime,
      num_travelers: numTravelers,
      buddy_cost: buddyCost,
      estimated_expenses: estimatedExpenses,
      platform_fee: commission,
      total_amount: buddyCost + estimatedExpenses + commission,
      // Every booking starts as an inquiry (chat_open); the agreement flow
      // turns it into a paid booking later.
      status: 'chat_open',
      payment_status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeBooking(data as RawBookingRow);
}

export async function fetchTravelerBookings(travelerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      '*, guide:users!guide_id(id, full_name, avatar_url), itinerary:itineraries(*)',
    )
    .eq('traveler_id', travelerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as RawBookingRow[] | null)?.map(normalizeBooking) ?? [];
}

export async function fetchGuideBookings(guideId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      '*, traveler:users!traveler_id(id, full_name, avatar_url, traveler_profile:traveler_profiles(nationality)), itinerary:itineraries(*)',
    )
    .eq('guide_id', guideId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as RawBookingRow[] | null)?.map(normalizeBooking) ?? [];
}

export async function fetchPendingRequests(guideId: string): Promise<Booking[]> {
  // Phase 1: bookings start at chat_open, not pending. All existing `pending`
  // rows were migrated to `agreement_sent` by migration 20260503110100. Query
  // both so any row that survived the migration or was created by an old client
  // still shows up on the guide's requests dashboard.
  const { data, error } = await supabase
    .from('bookings')
    .select('*, traveler:users!traveler_id(id, full_name, avatar_url, traveler_profile:traveler_profiles(nationality)), itinerary:itineraries(*)')
    .eq('guide_id', guideId)
    .in('status', ['chat_open', 'agreement_sent'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as RawBookingRow[] | null)?.map(normalizeBooking) ?? [];
}

export async function acceptBooking(bookingId: string): Promise<void> {
  // Phase 1: accepting a request means the guide is starting to draft the
  // binding agreement, so we advance to agreement_drafting.
  // BOOKING_STATUS.GUIDE_ACCEPTED is kept in constants for legacy read-compat.
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'agreement_drafting' })
    .eq('id', bookingId);

  if (error) throw error;
}

export async function declineBooking(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: BOOKING_STATUS.CANCELLED_PRE_SIGNING, cancelled_by: 'guide' })
    .eq('id', bookingId);

  if (error) throw error;
}

/**
 * Traveler cancels an inquiry before both signatures land (no money held).
 * Writes cancelled_pre_signing directly — the DB transition trigger permits
 * exactly this move for booking parties. Once deposits exist the cancellation
 * must go through the cancel-booking edge function (lib/api/cancellation.ts),
 * which computes the refund resolution; direct status writes are rejected
 * server-side.
 */
export async function cancelBookingPreSigning(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: BOOKING_STATUS.CANCELLED_PRE_SIGNING, cancelled_by: 'traveler' })
    .eq('id', bookingId);

  if (error) throw error;
}

export async function fetchBookingById(bookingId: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, guide:users!guide_id(id, full_name, avatar_url), traveler:users!traveler_id(id, full_name, avatar_url, traveler_profile:traveler_profiles(nationality)), itinerary:itineraries(*, stops:itinerary_stops(*))')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeBooking(data as RawBookingRow) : null;
}
