import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Badge, bookingStatusLabel, bookingStatusVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { AgreementCtaBlock } from '@/components/bookings/AgreementCtaBlock';
import { fetchBookingById, cancelBooking } from '@/lib/api/bookings';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { getItineraryPhoto } from '@/config/photoLibrary';
import { theme } from '@/config/theme';
import { BOOKING_STATUS } from '@/config/constants';
import type { BookingState } from '@/lib/booking/stateMachine';
import type { Booking } from '@/types';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function loadBooking(showLoader = true) {
    if (!id) return;

    try {
      if (showLoader) setLoading(true);
      const fetched = await fetchBookingById(id);
      setBooking(fetched);
    } catch (err: unknown) {
      Alert.alert('Unable to load booking', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!id) return;

    loadBooking();

    const interval = setInterval(() => {
      setSyncing(true);
      fetchBookingById(id)
        .then(setBooking)
        .finally(() => setSyncing(false));
    }, 15000);

    return () => clearInterval(interval);
  }, [id]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadBooking(false);
    setRefreshing(false);
  }

  async function handleCancel() {
    if (!id) return;

    // React Native Web's Alert.alert ignores multi-button dialogs (no native
    // modal exists), so the destructive button never fires and clicking
    // "Cancel Booking" feels broken. Use window.confirm on web; keep the
    // native Alert.alert flow on iOS/Android.
    const proceed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm('Cancel this booking? This cannot be undone.'));
        return;
      }
      Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
        { text: 'Keep It', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Cancel Booking', style: 'destructive', onPress: () => resolve(true) },
      ], { onDismiss: () => resolve(false) });
    });

    if (!proceed) return;

    try {
      await cancelBooking(id);
      // After cancelling, ensure we always land somewhere even if there's no
      // history (e.g. user opened this trip via direct link).
      safeBack(router, '/(traveler)/trips');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please try again.';
      if (Platform.OS === 'web') {
        window.alert(`Unable to cancel: ${msg}`);
      } else {
        Alert.alert('Unable to cancel', msg);
      }
    }
  }

  if (loading) return <Loading fullScreen />;
  if (!booking) return <View style={{ flex: 1 }}><Text>Booking not found</Text></View>;

  // Chat is available from the very first state (chat_open) all the way
  // through the trip and reconciliation — basically anything except a
  // terminal cancellation. This is the entire premise of the chat-first
  // booking flow.
  const TERMINAL_STATUSES = new Set<string>([
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.CANCELLED_PRE_SIGNING,
    'cancelled_no_pay', 'cancelled_traveler_voluntary', 'cancelled_buddy',
    'cancelled_force_majeure', 'cancelled_no_deposit',
  ]);
  const canChat = !TERMINAL_STATUSES.has(booking.status);
  const canLive = booking.status === BOOKING_STATUS.IN_PROGRESS || booking.status === 'in_progress';
  const canReview = booking.status === BOOKING_STATUS.COMPLETED;
  // A traveler can cancel any time before the trip actually starts.  The
  // Phase 1 lifecycle starts new bookings at `chat_open` (not `pending`), and
  // adds the full agreement/deposit/balance sequence before the trip.  All
  // of these are pre-trip and refundable per the cancellation tier math.
  const PRE_TRIP_STATUSES = new Set<string>([
    'chat_open', 'agreement_drafting', 'agreement_sent',
    'agreement_signed_traveler', 'agreement_signed_buddy',
    'awaiting_deposits', 'deposits_held',
    'awaiting_balance', 'late_fee_due', 'balance_paid',
    'trip_ready',
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.GUIDE_ACCEPTED,
    BOOKING_STATUS.CONFIRMED,
  ]);
  const canCancel = PRE_TRIP_STATUSES.has(booking.status);
  const isGuide = currentUserId === booking.guide_id;
  const chatLabel = isGuide ? '💬 Message Traveler' : '💬 Message Guide';
  const itineraryPhoto = booking.itinerary ? getItineraryPhoto(booking.itinerary) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Trip Details" showBack backFallback="/(traveler)/(tabs)/trips" />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
      >
        {itineraryPhoto && (
          <View style={{ height: 170, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
            <Image
              source={{ uri: itineraryPhoto }}
              contentFit="cover"
              transition={250}
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        )}

        {/* Status */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Badge
            label={bookingStatusLabel(booking.status)}
            variant={bookingStatusVariant(booking.status)}
          />
          <Text style={{ fontSize: 13, color: theme.colors.textMuted }}>
            Booked {format(new Date(booking.created_at), 'MMM d, yyyy')}
          </Text>
          {syncing && (
            <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>
              Syncing...
            </Text>
          )}
        </View>

        {/* Phase 2 — Agreement & Deposit CTA */}
        <AgreementCtaBlock
          bookingId={booking.id}
          bookingStatus={booking.status as BookingState}
          viewer="traveler"
        />

        {/* Tour Info */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>
            {booking.itinerary?.name ?? 'Tour'}
          </Text>
          <InfoRow label="Guide" value={booking.guide?.name ?? '—'} />
          <InfoRow label="City" value={booking.itinerary?.city ?? '—'} />
          <InfoRow label="Date" value={format(new Date(booking.start_date), 'EEE, MMM d, yyyy')} />
          <InfoRow label="Duration" value={`${booking.itinerary?.estimated_duration_hours ?? '?'} hours`} />
          {booking.flight_number && <InfoRow label="Flight" value={booking.flight_number} />}
        </Card>

        {/* Price */}
        <Card style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>
            Payment
          </Text>
          {booking.num_travelers > 1 && (
            <InfoRow label="Travelers" value={String(booking.num_travelers)} />
          )}
          <InfoRow
            label="Buddy fee"
            value={`₹${(booking.buddy_cost || booking.total_price).toLocaleString('en-IN')}`}
          />
          {booking.estimated_expenses > 0 && (
            <InfoRow
              label="Estimated expenses"
              value={`₹${booking.estimated_expenses.toLocaleString('en-IN')}`}
            />
          )}
          {booking.commission > 0 && (
            <InfoRow
              label="Platform fee"
              value={`₹${booking.commission.toLocaleString('en-IN')}`}
            />
          )}
          <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>Total</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.primary }}>
              ₹{booking.total_price.toLocaleString('en-IN')}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 6 }}>
            {booking.payment_status === 'captured' ? '✅ Payment captured' : '🔒 Held in escrow'}
          </Text>
        </Card>

        {/* Actions */}
        <View style={{ gap: 12 }}>
          {canChat && (
            <Button
              title={chatLabel}
              onPress={() => router.push(`/(shared)/messages/${booking.id}` as never)}
              variant="secondary"
            />
          )}
          {canLive && (
            <Button
              title="📍 Live Tour View"
              onPress={() => router.push(`/(traveler)/trips/live/${booking.id}`)}
            />
          )}
          {canReview && (
            <Button
              title="⭐ Leave a Review"
              onPress={() => router.push(`/(traveler)/trips/review/${booking.id}`)}
            />
          )}
          {canCancel && (
            <Button
              title="Cancel Booking"
              onPress={handleCancel}
              variant="danger"
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, color: theme.colors.text, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
