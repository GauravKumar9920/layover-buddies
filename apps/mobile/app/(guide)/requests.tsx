import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookingCardSkeleton } from '@/components/ui/Loading';
import { fetchPendingRequests, acceptBooking, declineBooking } from '@/lib/api/bookings';
import { getEffectiveRates } from '@/lib/api/platformSettings';
import { layoverHoursBetween } from '@/lib/booking/timeFit';
import { getItineraryPhoto } from '@/config/photoLibrary';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import type { Booking } from '@/types';

export default function RequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 0 during early access — the fee line is hidden entirely then.
  const [commissionRate, setCommissionRate] = useState<number | null>(null);

  useEffect(() => {
    getEffectiveRates()
      .then((rates) => setCommissionRate(rates.commissionRate))
      .catch(() => setCommissionRate(null));
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setRequests([]);
        setLoadError('Please sign in again to view booking requests.');
        return;
      }

      const data = await fetchPendingRequests(user.id);
      setRequests(data);
      setLoadError(null);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load requests');
    }
  }, []);

  useEffect(() => {
    loadRequests().finally(() => setLoading(false));
  }, [loadRequests]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRequests().finally(() => setRefreshing(false));
  };

  async function handleAccept(bookingId: string) {
    setActionId(bookingId);
    try {
      await acceptBooking(bookingId);
      setRequests((prev) => prev.filter((r) => r.id !== bookingId));
      // Accepting moves the booking to agreement_drafting — the next step is
      // drafting the agreement together in chat, not a payment capture.
      Alert.alert(
        'Request accepted',
        'Next: draft the trip agreement with the traveler in chat.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open chat', onPress: () => router.push(`/(shared)/messages/${bookingId}` as never) },
        ],
      );
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setActionId(null);
    }
  }

  async function handleDecline(bookingId: string) {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this booking?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionId(bookingId);
            try {
              await declineBooking(bookingId);
              setRequests((prev) => prev.filter((r) => r.id !== bookingId));
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to decline');
            } finally {
              setActionId(null);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
        <Header title="Booking Requests" />
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map((i) => <BookingCardSkeleton key={i} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header
        title={`Booking Requests${requests.length > 0 ? ` (${requests.length})` : ''}`}
      />

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
        ListHeaderComponent={loadError ? (
          <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text style={{ fontSize: 13, color: theme.colors.error }}>
              {loadError}
            </Text>
          </Card>
        ) : null}
        ListEmptyComponent={
          <EmptyState
            title="No pending requests"
            subtitle="New booking requests will appear here. Make sure your profile and tours are active!"
          />
        }
        renderItem={({ item }) => {
          const layoverHours = layoverHoursBetween(item.arrival_time, item.departure_time);
          const interests = item.traveler?.interests?.slice(0, 4) ?? [];
          const itineraryPhoto = item.itinerary ? getItineraryPhoto(item.itinerary) : null;
          return (
          <Card style={{ marginBottom: 16 }}>
            {/* Traveler Info */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontFamily: theme.fonts.displaySemi, fontSize: 17, color: theme.colors.text }}>
                  {item.traveler?.name ?? 'Traveler'}
                </Text>
                {(item.traveler?.nationality || layoverHours !== null) && (
                  <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 4 }}>
                    {[
                      item.traveler?.nationality,
                      layoverHours !== null ? `⏱ ${Math.round(layoverHours)}h layover` : null,
                    ].filter(Boolean).join('  ·  ')}
                  </Text>
                )}
                {interests.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {interests.map((interest) => (
                      <View
                        key={interest}
                        style={{
                          backgroundColor: theme.colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: theme.colors.divider,
                          borderRadius: theme.borderRadius.full,
                          paddingHorizontal: 9,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                          {interest}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <Badge label="New request" variant="warning" />
            </View>

            {/* Tour Details */}
            <View
              style={{
                backgroundColor: theme.colors.primaryLight,
                borderRadius: theme.borderRadius.md,
                borderWidth: 1,
                borderColor: 'rgba(200,84,42,0.2)',
                padding: 14,
                marginBottom: 14,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {itineraryPhoto && (
                  <Image
                    source={{ uri: itineraryPhoto }}
                    style={{ width: 44, height: 44, borderRadius: theme.borderRadius.sm }}
                    contentFit="cover"
                    transition={250}
                  />
                )}
                <Text style={{ fontFamily: theme.fonts.displaySemi, fontSize: 15, color: theme.colors.text, flex: 1 }}>
                  {item.itinerary?.name ?? 'Tour'}
                </Text>
              </View>
              <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                {format(new Date(item.start_date), 'EEE, MMM d, yyyy')}
              </Text>
              {item.flight_number && (
                <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Flight {item.flight_number}
                </Text>
              )}
              {item.total_price > 0 && (
                <Text style={{ fontFamily: theme.fonts.monoMed, fontSize: 16, color: theme.colors.primary, marginTop: 6 }}>
                  ₹{(item.total_price - item.commission).toLocaleString('en-IN')}
                  <Text style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textMuted }}> your payout</Text>
                </Text>
              )}
              {item.total_price > 0 && commissionRate !== null && commissionRate > 0 && (
                <Text style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  After {Math.round(commissionRate * 100)}% platform fee
                </Text>
              )}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Accept"
                onPress={() => handleAccept(item.id)}
                loading={actionId === item.id}
                style={{ flex: 1 }}
                size="sm"
              />
              <Button
                title="Decline"
                onPress={() => handleDecline(item.id)}
                variant="danger"
                style={{ flex: 1 }}
                size="sm"
                disabled={actionId === item.id}
              />
            </View>
          </Card>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
