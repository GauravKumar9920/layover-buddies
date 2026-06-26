// ============================================================================
// CANCELLATION RECEIPT — Traveler view (Phase 3)
// ============================================================================
// Renders bookings.cancelled_resolution_jsonb for the traveler.
// Route: /(traveler)/trips/cancellation-receipt/[bookingId]
// ============================================================================

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { formatPaise } from '@/lib/booking/money';
import { fetchCancellationResolution } from '@/lib/api/cancellation';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import type { CancellationResolution, AmountFate } from '@/lib/booking/cancellationSnapshot';

const FATE_LABEL: Record<AmountFate, string> = {
  refunded:  'Cash refund',
  forfeited: 'Forfeited',
  voucher:   'Platform voucher (30 days)',
  waived:    'Waived',
  not_paid:  'Not charged',
};

const FATE_COLOR: Record<AmountFate, string> = {
  refunded:  '#166534',
  forfeited: '#991B1B',
  voucher:   '#854D0E',
  waived:    '#64748B',
  not_paid:  '#64748B',
};

interface ResolutionRowProps {
  label: string;
  component: { fate: AmountFate; amount_paise: number };
}

function ResolutionRow({ label, component }: ResolutionRowProps) {
  const fate  = component.fate;
  const color = FATE_COLOR[fate];

  if (fate === 'not_paid') return null; // don't clutter with "not charged" rows

  return (
    <View style={styles.resRow}>
      <View style={styles.resLeft}>
        <Text style={styles.resLabel}>{label}</Text>
        <Text style={[styles.resFate, { color }]}>{FATE_LABEL[fate]}</Text>
      </View>
      <Text style={[styles.resAmount, { color }]}>
        {fate === 'forfeited' ? '−' : fate === 'refunded' || fate === 'voucher' ? '+' : ''}
        {formatPaise(component.amount_paise)}
      </Text>
    </View>
  );
}

export default function CancellationReceiptScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();

  const [resolution, setResolution] = useState<CancellationResolution | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    fetchCancellationResolution(bookingId)
      .then(r => setResolution(r))
      .catch(e => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const copy = financialCopy.cancellationReceipt;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !resolution) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Resolution not found'}</Text>
      </View>
    );
  }

  const tierLabel = copy.tierLabel[resolution.tier as keyof typeof copy.tierLabel]
    ?? resolution.tier;

  const totalRefunded = [
    resolution.traveler_deposit,
    resolution.itinerary_buffer,
    resolution.buddy_fee,
  ].reduce((sum, c) => sum + (c.fate === 'refunded' ? c.amount_paise : 0), 0);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Header title="Cancellation" showBack />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Tier badge */}
        <Card style={styles.tierCard}>
          <Text style={styles.heading}>{copy.heading}</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierLabel}>{tierLabel}</Text>
          </View>
        </Card>

        {/* Per-component breakdown */}
        <Card style={styles.breakdownCard}>
          <Text style={styles.sectionTitle}>Breakdown</Text>
          <ResolutionRow label="Your deposit"      component={resolution.traveler_deposit} />
          <ResolutionRow label="Guide's deposit"   component={resolution.buddy_deposit} />
          <ResolutionRow label="Trip fund"         component={resolution.itinerary_buffer} />
          <ResolutionRow label="Buddy fee"         component={resolution.buddy_fee} />
          {resolution.late_fee.fate !== 'not_paid' && resolution.late_fee.fate !== 'waived' && (
            <ResolutionRow label="Late fee"        component={resolution.late_fee} />
          )}
          {resolution.platform_credit.amount_paise > 0 && (
            <View style={styles.resRow}>
              <View style={styles.resLeft}>
                <Text style={styles.resLabel}>Platform credit</Text>
                <Text style={[styles.resFate, { color: '#166534' }]}>30-day credit</Text>
              </View>
              <Text style={[styles.resAmount, { color: '#166534' }]}>
                +{formatPaise(resolution.platform_credit.amount_paise)}
              </Text>
            </View>
          )}
        </Card>

        {/* Cash refund total */}
        {totalRefunded > 0 && (
          <Card style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total cash refund</Text>
              <Text style={styles.totalAmount}>{formatPaise(totalRefunded)}</Text>
            </View>
            <Text style={styles.totalNote}>{copy.processingNote}</Text>
          </Card>
        )}

        {/* PG fee note */}
        {resolution.pg_fee_paise > 0 && (
          <Text style={styles.pgNote}>
            {copy.pgFeeNote} (₹{(resolution.pg_fee_paise / 100).toFixed(2)})
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: theme.colors.background },
  scroll:        { flex: 1 },
  content:       { padding: 16, gap: 12 },
  centered:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:     { color: '#991B1B', fontSize: 15 },
  tierCard:      { padding: 16 },
  heading:       { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
  tierBadge:     {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  tierLabel:     { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  breakdownCard: { padding: 16, gap: 12 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  resRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resLeft:       { flex: 1, gap: 2 },
  resLabel:      { fontSize: 14, color: theme.colors.text, fontWeight: '500' },
  resFate:       { fontSize: 12, fontWeight: '600' },
  resAmount:     { fontSize: 15, fontWeight: '700' },
  totalCard:     { padding: 16, backgroundColor: '#F0FDF4' },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:    { fontSize: 15, fontWeight: '700', color: '#166534' },
  totalAmount:   { fontSize: 18, fontWeight: '800', color: '#166534' },
  totalNote:     { fontSize: 12, color: '#166534', marginTop: 6 },
  pgNote:        { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4 },
});
