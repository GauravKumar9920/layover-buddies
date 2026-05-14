import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, RefreshControl } from 'react-native';
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
import { supabase } from '@/lib/supabase';
import { getItineraryPhoto } from '@/config/photoLibrary';
import { theme } from '@/config/theme';
import { BOOKING_STATUS } from '@/config/constants';
import { isActiveBookingState, type BookingState } from '@/lib/booking/stateMachine';
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
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep It', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await cancelBooking(id);
            router.back();
          } catch (err: unknown) {
            Alert.alert('Unable to cancel', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  if (loading) return <Loading fullScreen />;
  if (!booking) return <View style={{ flex: 1 }}><Text>Booking not found</Text></View>;

  // Chat is available throughout the entire non-terminal lifecycle. Both legacy
  // (`guide_accepted`, `confirmed`, `in_progress`) and Phase 1+ states
  // (`chat_open`, `agreement_*`, `awaiting_*`, `balance_paid`, `trip_ready`,
  // `awaiting_proofs`, `reconciling`) need to be chat-able — the previous
  // 3-state whitelist hid the button for every Phase 1+ booking.
  const canChat = isActiveBookingState(booking.status);
  // Live tour map is available once the trip is actually under way. The
  // state machine transitions trip_ready → in_progress on the buddy's QR scan
  // (qr_scanned is the event, not a state), so `in_progress` is the only
  // value the live map needs to gate on.
  const canLive = booking.status === 'in_progress';
  // Review unlocks once the trip is completed (whether or not it's been rated).
  const canReview = booking.status === 'completed';
  // Cancel is allowed in pre-trip states. The actual policy (refunds, tiers)
  // lives in compute_cancellation_resolution_tx; we just gate the button visibility.
  const canCancel =
    booking.status === BOOKING_STATUS.PENDING ||
    booking.status === BOOKING_STATUS.GUIDE_ACCEPTED ||
    booking.status === 'chat_open' ||
    booking.status === 'agreement_drafting' ||
    booking.status === 'agreement_sent' ||
    booking.status === 'agreement_signed_traveler' ||
    booking.status === 'agreement_signed_buddy' ||
    booking.status === 'awaiting_deposits' ||
    booking.status === 'deposits_held' ||
    booking.status === 'awaiting_balance' ||
    booking.status === 'balance_paid' ||
    booking.status === 'late_fee_due' ||
    booking.status === 'trip_ready';
  const isGuide = currentUserId === booking.guide_id;
  const chatLabel = isGuide ? '💬 Message Traveler' : '💬 Message Guide';
  const itineraryPhoto = booking.itinerary ? getItineraryPhoto(booking.itinerary) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Trip Details" showBack />
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
          <InfoRow label="Buddy Cost" value={`₹${booking.total_price.toLocaleString('en-IN')}`} />
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
