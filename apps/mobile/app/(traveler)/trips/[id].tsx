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
import { canTransition, isActiveBookingState, type BookingState } from '@/lib/booking/stateMachine';
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
  // Cancel-button visibility is derived directly from the state machine's
  // TRANSITIONS map — `canTransition(state, 'cancel')` returns true iff the
  // state has a 'cancel' rule. That keeps this UI in lock-step with the FSM
  // (including the legacy state shims: `pending`, `guide_accepted`, and
  // `confirmed` all alias to their Phase 1+ canonical equivalents, so they
  // inherit the same cancel rules — earlier whitelists missed `confirmed`).
  // The actual refund/tier policy lives in compute_cancellation_resolution_tx
  // on the backend; we just gate the button visibility here.
  const canCancel = canTransition(booking.status, 'cancel');
  const isGuide = currentUserId === booking.guide_id;
  const chatLabel = isGuide ? 'Message traveler' : 'Message guide';
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
        <Card style={{ marginBottom: 16 }} framed elevation="none">
          <Text style={{ fontFamily: theme.fonts.display, fontSize: 19, color: theme.colors.text, letterSpacing: -0.3, marginBottom: 14 }}>
            {booking.itinerary?.name ?? 'Tour'}
          </Text>
          <InfoRow label="Guide" value={booking.guide?.name ?? '—'} />
          <InfoRow label="City" value={booking.itinerary?.city ?? '—'} />
          <InfoRow label="Date" value={format(new Date(booking.start_date), 'EEE, MMM d, yyyy')} />
          <InfoRow label="Duration" value={`${booking.itinerary?.estimated_duration_hours ?? '?'} hours`} />
          {booking.flight_number && <InfoRow label="Flight" value={booking.flight_number} />}
        </Card>

        {/* Price */}
        <Card style={{ marginBottom: 20 }} framed elevation="none">
          <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textSecondary, marginBottom: 12 }}>
            Payment
          </Text>
          <InfoRow label="Buddy cost" value={`₹${booking.total_price.toLocaleString('en-IN')}`} mono />
          <View style={{ height: 1, backgroundColor: 'rgba(14,25,41,0.1)', marginVertical: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 15, color: theme.colors.text }}>Total</Text>
            <Text style={{ ...theme.typography.price, color: theme.colors.primary }}>
              ₹{booking.total_price.toLocaleString('en-IN')}
            </Text>
          </View>
          <Text style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 8 }}>
            {booking.payment_status === 'captured' ? 'Payment captured' : 'Held in escrow'}
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
              title="Track live"
              onPress={() => router.push(`/(traveler)/trips/live/${booking.id}`)}
            />
          )}
          {canReview && (
            <Button
              title="Leave a review"
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: mono ? theme.fonts.monoMed : theme.fonts.bodySemi, fontSize: 14, color: theme.colors.text }}>{value}</Text>
    </View>
  );
}
