import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { fetchBookingById } from '@/lib/api/bookings';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import type { Booking } from '@/types';

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

const DEFAULT_MUMBAI_COORDS = {
  latitude: 19.076,
  longitude: 72.8777,
};

export default function LiveTourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [guideLocation, setGuideLocation] = useState<LocationPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    async function loadInitialData() {
      try {
        const [fetchedBooking, latestLocationRes] = await Promise.all([
          fetchBookingById(id),
          supabase
            .from('location_tracking')
            .select('latitude, longitude, timestamp')
            .eq('booking_id', id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        setBooking(fetchedBooking);

        if (latestLocationRes.data) {
          setGuideLocation({
            latitude: latestLocationRes.data.latitude,
            longitude: latestLocationRes.data.longitude,
            timestamp: latestLocationRes.data.timestamp,
          });
        }
      } catch (err: unknown) {
        setConnectionMessage(err instanceof Error ? err.message : 'Unable to fetch live location right now.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    const channel = supabase
      .channel(`location:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_tracking',
          filter: `booking_id=eq.${id}`,
        },
        (payload) => {
          const latitude = Number(payload.new.latitude);
          const longitude = Number(payload.new.longitude);
          const timestamp = typeof payload.new.timestamp === 'string'
            ? payload.new.timestamp
            : new Date().toISOString();

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return;
          }

          setGuideLocation({
            latitude,
            longitude,
            timestamp,
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionMessage(null);
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionMessage('Live updates disconnected. Re-open this screen to reconnect.');
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) return <Loading fullScreen message="Connecting to your guide..." />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Live Tour" showBack />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {connectionMessage && (
          <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text style={{ fontSize: 13, color: theme.colors.error }}>
              {connectionMessage}
            </Text>
          </Card>
        )}

        <View
          style={{
            height: 260,
            backgroundColor: theme.colors.primaryLight,
            borderRadius: theme.borderRadius.lg,
            marginBottom: 16,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.md,
          }}
        >
          {guideLocation ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>📍</Text>
              <Text style={{ color: theme.colors.primary, fontWeight: '700', marginTop: 8 }}>
                Guide live location updated
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {guideLocation.latitude.toFixed(4)}, {guideLocation.longitude.toFixed(4)}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                Updated at {new Date(guideLocation.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>🗺️</Text>
              <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
                Live map preview is native-only for now
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                Default center: Mumbai ({DEFAULT_MUMBAI_COORDS.latitude.toFixed(3)}, {DEFAULT_MUMBAI_COORDS.longitude.toFixed(3)})
              </Text>
            </View>
          )}
        </View>

        {booking?.itinerary?.stops && booking.itinerary.stops.length > 0 && (
          <Card>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>
              Today's Itinerary
            </Text>
            {booking.itinerary.stops
              .sort((a, b) => a.order - b.order)
              .map((stop, idx) => (
                <View
                  key={stop.id}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    marginBottom: idx < booking.itinerary!.stops!.length - 1 ? 16 : 0,
                  }}
                >
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: theme.colors.primaryLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: theme.colors.primary,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}>
                        {idx + 1}
                      </Text>
                    </View>
                    {idx < booking.itinerary!.stops!.length - 1 && (
                      <View style={{ width: 2, flex: 1, backgroundColor: theme.colors.divider, marginTop: 4 }} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingTop: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>
                      {stop.location}
                    </Text>
                    {stop.description && (
                      <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
                        {stop.description}
                      </Text>
                    )}
                    <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 4 }}>
                      ⏱ {stop.estimated_duration_minutes} min
                    </Text>
                  </View>
                </View>
              ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
