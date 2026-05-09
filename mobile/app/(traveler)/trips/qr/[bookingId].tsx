// ============================================================================
// TRIP QR DISPLAY — Traveler (Phase 4)
// ============================================================================
// Shows the trip_qr_token as a QR code. Navigates to live screen on
// status → in_progress (Realtime).
// Route: /(traveler)/trips/qr/[bookingId]
// ============================================================================

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { useTrip } from '@/lib/hooks/useTrip';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';

// react-native-qrcode-svg must be added to package.json:
//   expo install react-native-qrcode-svg
// It is a pure-JS package, no native binaries needed.
let QRCode: React.ComponentType<{ value: string; size: number }> | null = null;
try {
  // Dynamic import so the screen doesn't crash if the package isn't yet installed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  QRCode = require('react-native-qrcode-svg').default;
} catch {
  QRCode = null;
}

export default function TripQrScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { booking, loading, error } = useTrip(bookingId ?? null);

  // Navigate away when trip starts.
  useEffect(() => {
    if (booking?.status === 'in_progress') {
      router.replace({
        pathname: '/(traveler)/trips/live/[id]',
        params:   { id: bookingId },
      } as never);
    }
  }, [booking?.status, bookingId, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Booking not found'}</Text>
      </View>
    );
  }

  const token = booking.trip_qr_token;
  const copy  = financialCopy.tripQrInstructions;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Header title="Your QR code" showBack={false} />
      <View style={styles.body}>
        <Text style={styles.heading}>{copy.travelerHeading}</Text>
        <Text style={styles.sub}>{copy.travelerSub}</Text>

        <View style={styles.qrContainer}>
          {token && QRCode ? (
            <QRCode value={token} size={220} />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>
                {token
                  ? 'Install react-native-qrcode-svg to render QR'
                  : 'QR token not yet available'}
              </Text>
              {token && <Text style={styles.tokenText}>{token}</Text>}
            </View>
          )}
        </View>

        <Text style={styles.waitingNote}>Waiting for your buddy to scan…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: theme.colors.background },
  body:             { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centered:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:        { color: '#991B1B', fontSize: 15 },
  heading:          { fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 8 },
  sub:              { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  qrContainer:      {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 32,
  },
  qrPlaceholder:    { width: 220, height: 220, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8 },
  qrPlaceholderText:{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', padding: 12 },
  tokenText:        { fontSize: 10, color: '#64748B', marginTop: 8, textAlign: 'center', fontFamily: 'monospace' },
  waitingNote:      { fontSize: 13, color: theme.colors.textSecondary },
});
