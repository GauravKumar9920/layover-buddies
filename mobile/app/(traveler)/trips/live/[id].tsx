import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { TopUpApprovalModal } from '@/components/bookings/TopUpApprovalModal';
import { SafetyBar } from '@/components/bookings/SafetyBar';
import { fetchBookingById } from '@/lib/api/bookings';
import { useTopUpRequest } from '@/lib/hooks/useTopUpRequest';
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

// Renders a Google Maps Embed iframe.
// This file ([id].tsx) is only ever bundled for **web** — Expo Router serves
// [id].native.tsx on iOS/Android, which uses react-native-maps instead.
// React.createElement is used to bypass JSX TypeScript restrictions on 'iframe'.
function WebMapEmbed({ latitude, longitude }: { latitude: number; longitude: number }) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  // Round to 3 d.p. (~110 m) so GPS jitter doesn't reload the map on every tick.
  const lat = Math.round(latitude * 1000) / 1000;
  const lng = Math.round(longitude * 1000) / 1000;

  // No API key configured (it's deferred per CLAUDE.md) → the embed would
  // render Google's raw "rejected your request" error tile. Degrade to a
  // branded placeholder with the coordinates instead.
  if (!apiKey) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceMuted,
          padding: 24,
        }}
      >
        <Feather name="map-pin" size={28} color={theme.colors.textMuted} />
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginTop: 10,
          }}
        >
          Live map coming soon
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.textMuted,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          Your buddy's position: {lat.toFixed(3)}, {lng.toFixed(3)}
        </Text>
      </View>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=16&maptype=roadmap`;

  return React.createElement('iframe', {
    src,
    style: { width: '100%', height: '100%', border: 'none' },
    allowFullScreen: true,
    loading: 'lazy',
    title: 'Guide live location',
  } as React.HTMLAttributes<HTMLIFrameElement> & {
    src: string;
    allowFullScreen: boolean;
    loading: string;
    title: string;
  });
}

export default function LiveTourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [guideLocation, setGuideLocation] = useState<LocationPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);

  // Phase 4 — top-up approval
  const { activeRequest } = useTopUpRequest(id ?? null);

  // Auto-open modal when a top-up request arrives.
  useEffect(() => {
    if (activeRequest) {
      setTopUpModalVisible(true);
    } else {
      setTopUpModalVisible(false);
    }
  }, [activeRequest?.id]);

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
          err instanceof Error ? err.message : 'Unable to fetch live location right now.',
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    // Real-time subscription — tracks INSERT events from the guide's device
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

          setGuideLocation({ latitude, longitude, timestamp });
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

  if (loading) return <Loading fullScreen message="Connecting to your guide…" />;

  const mapCoords = guideLocation ?? DEFAULT_MUMBAI_COORDS;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <Header title="Live Tour" showBack />

      {/* Phase 4 — top-up approval modal */}
      <TopUpApprovalModal
        visible={topUpModalVisible}
        request={activeRequest}
        bookingId={id ?? ''}
        buddyName={booking?.guide?.name ?? 'Your buddy'}
        onDismiss={() => setTopUpModalVisible(false)}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Trip progress bar — computed from tour_start_time → tour_end_time
            against `now`. Lets the traveler see at a glance how much of the
            day has been spent vs how much is left. */}
        {booking && <TripProgressBar booking={booking} />}

        {connectionMessage && (
          <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: '#FCA5A5' }}>
            <Text style={{ fontSize: 13, color: theme.colors.error }}>{connectionMessage}</Text>
          </Card>
        )}

        {/* ── Google Maps Embed ──────────────────────────────────────── */}
        <View
          style={{
            height: 280,
            borderRadius: theme.borderRadius.lg,
            marginBottom: 12,
            overflow: 'hidden',
            ...theme.shadows.md,
          }}
        >
          <WebMapEmbed latitude={mapCoords.latitude} longitude={mapCoords.longitude} />

          {/* Overlay: waiting for guide to share live location */}
          {!guideLocation && (
            <View
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                backgroundColor: 'rgba(255,255,255,0.92)',
                borderRadius: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                Waiting for guide to share location…
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 2 }}>
                Map is centered on Mumbai
              </Text>
            </View>
          )}
        </View>

        {/* Live coordinate timestamp */}
        {guideLocation && (
          <Text
            style={{
              fontSize: 12,
              color: theme.colors.textMuted,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            Updated {new Date(guideLocation.timestamp).toLocaleTimeString()} ·{' '}
            {guideLocation.latitude.toFixed(4)}, {guideLocation.longitude.toFixed(4)}
          </Text>
        )}

        {/* ── Today's Itinerary ──────────────────────────────────────── */}
        {booking?.itinerary?.stops && booking.itinerary.stops.length > 0 && (
          <Card>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: theme.colors.text,
                marginBottom: 12,
              }}
            >
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
                      <Text
                        style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}
                      >
                        {idx + 1}
                      </Text>
                    </View>
                    {idx < booking.itinerary!.stops!.length - 1 && (
                      <View
                        style={{
                          width: 2,
                          flex: 1,
                          backgroundColor: theme.colors.divider,
                          marginTop: 4,
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingTop: 4 }}>
                    <Text
                      style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}
                    >
                      {stop.location}
                    </Text>
                    {stop.description && (
                      <Text
                        style={{
                          fontSize: 13,
                          color: theme.colors.textSecondary,
                          marginTop: 2,
                          lineHeight: 18,
                        }}
                      >
                        {stop.description}
                      </Text>
                    )}
                    <Text
                      style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 4 }}
                    >
                      ⏱ {stop.estimated_duration_minutes} min
                    </Text>
                  </View>
                </View>
              ))}
          </Card>
        )}
      </ScrollView>

      {/* Fixed-bottom safety bar — SOS / Help / Contact. SOS is REAL: it
          writes to sos_alerts, which the admin console's SOS page monitors.
          Falls back to the guide's last shared position when the traveler's
          device can't produce a fix. */}
      <SafetyBar
        bookingId={id ?? ''}
        insets={insets}
        guideName={booking?.guide?.name ?? 'your buddy'}
        fallbackCoords={guideLocation ?? DEFAULT_MUMBAI_COORDS}
      />
    </View>
  );
}

// ─── Trip Progress Bar ──────────────────────────────────────────────────────
function TripProgressBar({ booking }: { booking: Booking }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    // Recompute every 30 s — enough resolution for a fill bar that fades
    // across a multi-hour tour without burning the device CPU.
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const start = booking.start_date ? Date.parse(booking.start_date) : NaN;
  const end   = booking.end_date   ? Date.parse(booking.end_date)   : NaN;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const pct = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const minutesLeft = Math.max(0, Math.round((end - now) / 60_000));
  const hoursLeft   = Math.floor(minutesLeft / 60);
  const minsLeft    = minutesLeft % 60;

  const label = pct >= 1
    ? "Trip's wrapping up"
    : `${hoursLeft > 0 ? `${hoursLeft}h ` : ''}${minsLeft}m remaining`;

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ ...theme.typography.eyebrow, color: theme.colors.textSecondary }}>
          Trip progress
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{label}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.divider, overflow: 'hidden' }}>
        <View style={{
          width: `${Math.round(pct * 100)}%`, height: 8,
          backgroundColor: theme.colors.primary,
        }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>
          Started {new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>
          Ends {new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Card>
  );
}

