import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Badge, bookingStatusLabel, bookingStatusVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { fetchBookingById } from '@/lib/api/bookings';
import { theme } from '@/config/theme';
import type { Booking } from '@/types';

export default function GuideBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const fetched = await fetchBookingById(id);
      setBooking(fetched);
    } catch (err: unknown) {
      Alert.alert('Unable to load booking', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) return <Loading fullScreen />;

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
        <Header title="Booking" showBack />
        <Card style={{ margin: 16 }}>
          <Text style={{ color: theme.colors.textSecondary }}>Booking not found.</Text>
        </Card>
      </View>
    );
  }

  const itinerary = booking.itinerary;
  const traveler = booking.traveler;
  const payout = booking.total_price - booking.commission;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Booking Details" showBack />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Traveler */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
              {traveler?.avatar_url ? (
                <Image
                  source={{ uri: traveler.avatar_url }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: theme.colors.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>🧳</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text }}>
                  {traveler?.name ?? 'Traveler'}
                </Text>
                {traveler?.nationality && (
                  <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
                    🌍 {traveler.nationality}
                  </Text>
                )}
                {traveler?.phone && (
                  <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 }}>
                    📞 {traveler.phone}
                  </Text>
                )}
              </View>
            </View>
            <Badge label={bookingStatusLabel(booking.status)} variant={bookingStatusVariant(booking.status)} />
          </View>
        </Card>

        {/* Flight & schedule */}
        <Card style={{ marginBottom: 16, gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Schedule
          </Text>
          <Text style={{ fontSize: 15, color: theme.colors.text }}>
            📅 {format(new Date(booking.start_date), 'EEE, MMM d, yyyy · h:mm a')}
          </Text>
          {booking.flight_number && (
            <Text style={{ fontSize: 15, color: theme.colors.text }}>
              ✈️ Flight {booking.flight_number}
            </Text>
          )}
        </Card>

        {/* Tour */}
        {itinerary && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              Tour
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>
              {itinerary.name}
            </Text>
            {itinerary.description ? (
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 19 }}>
                {itinerary.description}
              </Text>
            ) : null}
            {itinerary.stops && itinerary.stops.length > 0 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {itinerary.stops
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((stop, i) => (
                    <View key={stop.id} style={{ flexDirection: 'row', gap: 10 }}>
                      <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '700', minWidth: 18 }}>
                        {i + 1}.
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: theme.colors.text, fontWeight: '600' }}>
                          {stop.location}
                        </Text>
                        {stop.description ? (
                          <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2 }}>
                            {stop.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
              </View>
            )}
          </Card>
        )}

        {/* Payout */}
        <Card style={{ marginBottom: 16, gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
            Payout
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>Booking total</Text>
            <Text style={{ fontSize: 14, color: theme.colors.text }}>
              ₹{booking.total_price.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>Platform fee</Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>
              −₹{booking.commission.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.primary }}>Your payout</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.colors.primary }}>
              ₹{payout.toLocaleString('en-IN')}
            </Text>
          </View>
        </Card>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }}>
        <Button
          title="💬 Message Traveler"
          onPress={() => router.push(`/(shared)/messages/${booking.id}` as never)}
          size="lg"
        />
      </View>
    </View>
  );
}
