// ============================================================================
// CANCEL BOOKING — Traveler cancellation confirmation screen (Phase 3)
// ============================================================================
// Modal-style screen. Shows the resolution preview from the pure TS helper,
// then calls cancelBooking() on confirm.
// Route: /(traveler)/trips/cancel/[bookingId]
// ============================================================================

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { cancelBooking } from '@/lib/api/cancellation';
import { fetchBookingById } from '@/lib/api/bookings';
import { theme } from '@/config/theme';
import type { AmountFate } from '@/lib/booking/cancellationSnapshot';
import type { Booking } from '@/types';

const FATE_LABELS: Record<AmountFate, string> = {
  refunded:  'Cash refund',
  forfeited: 'Forfeited',
  voucher:   'Platform voucher',
  waived:    'Waived',
  not_paid:  'Not charged',
};

const FATE_COLORS: Record<AmountFate, string> = {
  refunded:  '#166534',
  forfeited: '#991B1B',
  voucher:   '#854D0E',
  waived:    '#64748B',
  not_paid:  '#64748B',
};

export default function CancelBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [reason,       setReason]       = useState('');
  const [confirming,   setConfirming]   = useState(false);
  const [booking,      setBooking]      = useState<Booking | null>(null);

  // Fetch the booking so we can show the user *which* refund tier they're
  // in based on hours-until-trip — the previous version hard-coded a static
  // schedule that gave no situational context at all.
  useEffect(() => {
    if (!bookingId) return;
    fetchBookingById(bookingId).then(setBooking).catch(() => setBooking(null));
  }, [bookingId]);

  const hoursUntilTrip = booking
    ? Math.max(0, Math.floor((new Date(booking.start_date).getTime() - Date.now()) / 3_600_000))
    : null;

  // Which of the 3 schedule windows this cancellation falls into.
  const activeTier: '>72' | '24-72' | '<24' | null =
    hoursUntilTrip == null ? null
    : hoursUntilTrip > 72   ? '>72'
    : hoursUntilTrip >= 24  ? '24-72'
    :                         '<24';

  async function handleConfirm() {
    if (!bookingId) return;

    // React Native Web ignores all but the first button in multi-button
    // Alert.alert calls, so the destructive flow never fires.  Use
    // window.confirm on web, keep the native modal on iOS/Android.
    const proceed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm('Are you sure? This cannot be undone.'));
        return;
      }
      Alert.alert(
        'Confirm cancellation',
        'Are you sure? This cannot be undone.',
        [
          { text: 'Keep my booking', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Yes, cancel', style: 'destructive', onPress: () => resolve(true) },
        ],
        { onDismiss: () => resolve(false) },
      );
    });

    if (!proceed) return;

    try {
      setConfirming(true);
      await cancelBooking({ bookingId, reason: reason.trim() || undefined });
      router.replace({
        pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]',
        params:   { bookingId },
      } as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Please try again.';
      if (Platform.OS === 'web') window.alert(`Cancel failed: ${msg}`);
      else Alert.alert('Cancel failed', msg);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
      <Header title="Cancel booking" showBack backFallback={bookingId ? `/(traveler)/trips/${bookingId}` : '/(traveler)/(tabs)/trips'} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.warningCard}>
          <Text style={styles.warningTitle}>Before you cancel</Text>
          <Text style={styles.warningBody}>
            Your refund amount depends on how far in advance you cancel. Review
            your agreement for the exact refund schedule.
          </Text>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Refund schedule</Text>
          {hoursUntilTrip != null && (
            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 10 }}>
              Trip starts in approximately {hoursUntilTrip < 1 ? 'less than 1 hour' : `${hoursUntilTrip} hour${hoursUntilTrip === 1 ? '' : 's'}`}.
              You're in the{' '}
              <Text style={{ fontWeight: '700', color: theme.colors.text }}>
                {activeTier === '>72' ? 'most favorable' : activeTier === '24-72' ? 'middle' : 'last-minute'}
              </Text>{' '}
              refund tier.
            </Text>
          )}
          {[
            { window: '>72h before trip', outcome: 'Full deposit refund', key: '>72' as const },
            { window: '24–72h before trip', outcome: '50% deposit + 50% trip fund', key: '24-72' as const },
            { window: '<24h before trip', outcome: 'Platform voucher (30 days)', key: '<24' as const },
          ].map(row => {
            const active = activeTier === row.key;
            return (
              <View
                key={row.window}
                style={[
                  styles.infoRow,
                  active && {
                    backgroundColor: theme.colors.primaryLight,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    marginHorizontal: -10,
                  },
                ]}
              >
                <Text style={[styles.infoWindow, active && { color: theme.colors.primary, fontWeight: '700' }]}>
                  {active ? '› ' : ''}{row.window}
                </Text>
                <Text style={[styles.infoOutcome, active && { color: theme.colors.primary, fontWeight: '700' }]}>
                  {row.outcome}
                </Text>
              </View>
            );
          })}
        </Card>

        <Card style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>Reason (optional)</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. flight delayed, changed plans…"
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? 0 : 16 }]}>
        <TouchableOpacity
          style={styles.keepButton}
          onPress={() => router.back()}
          disabled={confirming}
        >
          <Text style={styles.keepButtonText}>Keep my booking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, confirming && styles.cancelButtonDisabled]}
          onPress={handleConfirm}
          disabled={confirming}
          activeOpacity={0.8}
        >
          {confirming
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.cancelButtonText}>Yes, cancel my trip</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: theme.colors.background },
  scroll:         { flex: 1 },
  content:        { padding: 16, gap: 12 },
  warningCard:    { backgroundColor: '#FEF9C3', padding: 16 },
  warningTitle:   { fontSize: 16, fontWeight: '700', color: '#854D0E', marginBottom: 6 },
  warningBody:    { fontSize: 14, color: '#854D0E', lineHeight: 20 },
  infoCard:       { padding: 16, gap: 8 },
  infoTitle:      { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  infoRow:        { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  infoWindow:     { fontSize: 13, color: theme.colors.textSecondary, flex: 1 },
  infoOutcome:    { fontSize: 13, color: theme.colors.text, fontWeight: '600', textAlign: 'right', flex: 1 },
  reasonCard:     { padding: 16 },
  reasonLabel:    { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  reasonInput:    {
    borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 8, padding: 10, fontSize: 14, color: theme.colors.text,
    minHeight: 72, textAlignVertical: 'top',
  },
  footer:         { padding: 16, gap: 10 },
  keepButton:     {
    padding: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  keepButtonText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  cancelButton:   {
    padding: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  cancelButtonDisabled: { opacity: 0.6 },
  cancelButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
