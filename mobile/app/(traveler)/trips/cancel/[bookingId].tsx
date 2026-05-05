// ============================================================================
// CANCEL BOOKING — Traveler cancellation confirmation screen (Phase 3)
// ============================================================================
// Modal-style screen. Shows the resolution preview from the pure TS helper,
// then calls cancelBooking() on confirm.
// Route: /(traveler)/trips/cancel/[bookingId]
// ============================================================================

import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { formatPaise } from '@/lib/booking/money';
import { cancelBooking } from '@/lib/api/cancellation';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import type { AmountFate } from '@/lib/booking/cancellationSnapshot';

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

  async function handleConfirm() {
    if (!bookingId) return;
    Alert.alert(
      'Confirm cancellation',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Keep my booking', style: 'cancel' },
        {
          text: 'Yes, cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setConfirming(true);
              const result = await cancelBooking({ bookingId, reason: reason.trim() || undefined });
              router.replace({
                pathname: '/(traveler)/trips/cancellation-receipt/[bookingId]',
                params:   { bookingId },
              } as never);
            } catch (err) {
              Alert.alert('Cancel failed', err instanceof Error ? err.message : 'Please try again.');
            } finally {
              setConfirming(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
      <Header title="Cancel booking" showBack />

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
          {[
            { window: '>72h before trip', outcome: 'Full deposit refund' },
            { window: '24–72h before trip', outcome: '50% deposit + 50% trip fund' },
            { window: '<24h before trip', outcome: 'Platform voucher (30 days)' },
          ].map(row => (
            <View key={row.window} style={styles.infoRow}>
              <Text style={styles.infoWindow}>{row.window}</Text>
              <Text style={styles.infoOutcome}>{row.outcome}</Text>
            </View>
          ))}
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
