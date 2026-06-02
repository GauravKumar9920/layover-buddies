import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { TopUpApprovalModal } from '@/components/bookings/TopUpApprovalModal';
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
            📍 Updated {new Date(guideLocation.timestamp).toLocaleTimeString()} ·{' '}
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

      {/* Fixed-bottom safety bar — SOS / Help / Contact. SOS is currently a
          dummy stub (logs to console + shows alert) per product decision;
          full sos_event integration is queued. */}
      <SafetyBar insets={insets} guideName={booking?.guide?.name ?? 'your buddy'} />
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
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>
          🎯 Trip progress
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

// ─── Safety Bar — SOS / Help / Contact ──────────────────────────────────────
// All three buttons are visible whenever the live tour screen is mounted.
// SOS is currently a STUB — it logs and shows an explicit "preview" alert
// telling the user this does NOT contact anyone. Until the sos_events table
// + Edge Function ship, the button must not be advertised as a real safety
// affordance: the label, accessibility hint, and confirmation copy are all
// scoped to "preview" so testers can't mistake it for a live signal.
function SafetyBar({ insets, guideName }: { insets: { bottom: number }, guideName: string }) {
  function sos() {
    const msg =
      `⚠️ PREVIEW ONLY — this button does NOT contact anyone yet.\n\n` +
      `In production it will alert on-call ops + ${guideName} + your emergency contact. ` +
      `For a real emergency right now, call 112 (India national emergency) or contact ${guideName} directly.`;
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('SOS preview', msg);
    // eslint-disable-next-line no-console
    console.log('[SOS] preview event for live trip screen (no backend wiring)');
  }
  function help() {
    const msg = `Need help? In production this opens the help center / chat-to-ops. For now, message ${guideName} directly.`;
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Help', msg);
  }
  function contact() {
    const msg = 'Contact Detour support at hello@detourtrips.com or +91 9999 XXXXX.';
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Contact us', msg);
  }
  return (
    <View style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      flexDirection: 'row', gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10, paddingBottom: insets.bottom + 10,
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1, borderTopColor: theme.colors.divider,
    }}>
      <TouchableOpacity
        onPress={sos}
        accessibilityRole="button"
        accessibilityLabel="SOS preview button"
        accessibilityHint="This is a preview — does not contact anyone. For a real emergency call 112."
        style={{
          flex: 1.4, paddingVertical: 12, borderRadius: 12,
          backgroundColor: theme.colors.error,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
        }}
      >
        <Text style={{ fontSize: 14 }}>🚨</Text>
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>SOS</Text>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 9, opacity: 0.85 }}>
          (preview)
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={help}
        style={{
          flex: 1, paddingVertical: 12, borderRadius: 12,
          backgroundColor: theme.colors.primaryLight,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
        }}
      >
        <Text style={{ fontSize: 14 }}>🆘</Text>
        <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 13 }}>Help</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={contact}
        style={{
          flex: 1, paddingVertical: 12, borderRadius: 12,
          backgroundColor: theme.colors.background,
          borderWidth: 1, borderColor: theme.colors.divider,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
        }}
      >
        <Text style={{ fontSize: 14 }}>📞</Text>
        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>Contact</Text>
      </TouchableOpacity>
    </View>
  );
}
