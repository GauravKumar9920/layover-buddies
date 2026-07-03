import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { SafetyBar } from '@/components/bookings/SafetyBar';
import { fetchBookingById } from '@/lib/api/bookings';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import type { Booking } from '@/types';

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

const DEFAULT_MUMBAI_REGION: Region = {
  latitude: 19.076,
  longitude: 72.8777,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function LiveTourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [guideLocation, setGuideLocation] = useState<LocationPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

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
        setConnectionMessage(
          err instanceof Error ? err.message : 'Unable to fetch live location.',
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    // Real-time subscription — inserts from the guide's location_tracking row
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
          const timestamp =
            typeof payload.new.timestamp === 'string'
              ? payload.new.timestamp
              : new Date().toISOString();

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

          const loc: LocationPoint = { latitude, longitude, timestamp };
          setGuideLocation(loc);

          // Smoothly pan the map to follow the guide
          mapRef.current?.animateToRegion(
            { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
            500,
          );
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionMessage(null);
          return;
        }
        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setConnectionMessage(
            'Live updates disconnected. Re-open this screen to reconnect.',
          );
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  function openInMaps() {
    const loc = guideLocation ?? DEFAULT_MUMBAI_REGION;
    const label = encodeURIComponent(booking?.guide?.name ?? 'Your Guide');
    // `maps://` deep-links to Apple Maps on iOS; falls back to Google Maps web URL
    const appleUrl = `maps://app?ll=${loc.latitude},${loc.longitude}&q=${label}`;
    const webFallback = `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
    Linking.openURL(appleUrl).catch(() => Linking.openURL(webFallback));
  }

  if (loading) return <Loading fullScreen message="Connecting to your guide…" />;

  const mapRegion: Region = guideLocation
    ? {
        latitude: guideLocation.latitude,
        longitude: guideLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : DEFAULT_MUMBAI_REGION;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Live Tour" showBack />

      {connectionMessage && (
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Card style={{ borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text style={{ fontSize: 13, color: theme.colors.error }}>
              {connectionMessage}
            </Text>
          </Card>
        </View>
      )}

      {/* ── Live Google Map ─────────────────────────────────────────── */}
      <View
        style={[
          styles.mapContainer,
          { marginTop: connectionMessage ? 8 : 12 },
        ]}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={mapRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
          toolbarEnabled={false}
        >
          {guideLocation && (
            <Marker
              coordinate={{
                latitude: guideLocation.latitude,
                longitude: guideLocation.longitude,
              }}
              title={booking?.guide?.name ?? 'Your Guide'}
              description="Live guide location"
              pinColor={theme.colors.primary}
            />
          )}
        </MapView>

        {/* "Waiting" overlay when guide hasn't shared location yet */}
        {!guideLocation && (
          <View style={styles.waitingOverlay}>
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
              Waiting for guide to share location…
            </Text>
          </View>
        )}
      </View>

      {guideLocation && (
        <Text style={styles.timestampLabel}>
          Updated {new Date(guideLocation.timestamp).toLocaleTimeString()}
        </Text>
      )}

      {/* Open in Maps */}
      <TouchableOpacity style={styles.openMapsBtn} onPress={openInMaps} activeOpacity={0.85}>
        <Text style={styles.openMapsBtnText}>Open in Apple Maps</Text>
      </TouchableOpacity>

      {/* ── Itinerary Stops ─────────────────────────────────────────── */}
      {booking?.itinerary?.stops && booking.itinerary.stops.length > 0 && (
        <ScrollView
          style={{ flex: 1, marginTop: 12 }}
          contentContainerStyle={{ marginHorizontal: 16, paddingBottom: insets.bottom + 96 }}
        >
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
                    <View style={styles.stopBadge}>
                      <Text style={styles.stopBadgeText}>{idx + 1}</Text>
                    </View>
                    {idx < booking.itinerary!.stops!.length - 1 && (
                      <View style={styles.stopConnector} />
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
        </ScrollView>
      )}

      {/* Fixed-bottom safety bar — SOS writes a real sos_alerts row that the
          admin console's SOS page monitors. Falls back to the guide's last
          shared position if this device can't produce a fix. */}
      <SafetyBar
        bookingId={id ?? ''}
        insets={insets}
        contactName={booking?.guide?.name ?? 'your buddy'}
        fallbackCoords={
          guideLocation
            ? { latitude: guideLocation.latitude, longitude: guideLocation.longitude }
            : { latitude: DEFAULT_MUMBAI_REGION.latitude, longitude: DEFAULT_MUMBAI_REGION.longitude }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 300,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    // theme.shadows.md equivalent (shadow props must be in StyleSheet for iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  waitingOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  timestampLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginHorizontal: 16,
  },
  openMapsBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  openMapsBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  stopBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  stopBadgeText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  stopConnector: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.divider,
    marginTop: 4,
  },
});
