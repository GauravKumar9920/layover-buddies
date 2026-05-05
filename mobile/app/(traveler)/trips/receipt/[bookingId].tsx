// ============================================================================
// TRAVELER RECEIPT — Traveler (Phase 4)
// ============================================================================
// Day-complete receipt for the traveler. Shown when status ∈
// {completed, rated}. Shows refund breakdown and Rating CTA.
//
// §10 verbatim: unused buffer refunded + ₹500 deposit returned = total refund.
//
// Route: /(traveler)/trips/receipt/[bookingId]
// ============================================================================

import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTrip } from '@/lib/hooks/useTrip';
import { computeReconciliationSnapshot } from '@/lib/booking/reconciliationSnapshot';
import { formatPaise } from '@/lib/booking/money';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import type { PayoutDispatch } from '@/lib/api/tripLifecycle';

export default function TravelerReceiptScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { booking, agreement, expenseProofs, payoutDispatches, loading, error }
    = useTrip(bookingId ?? null);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !booking || !agreement) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Booking not found'}</Text>
      </View>
    );
  }

  const declaredSpendPaise = expenseProofs.reduce((s, p) => s + p.amount_paise, 0);

  const snapshot = computeReconciliationSnapshot({
    buddyFeePaise:       agreement.buddy_fee_paise,
    itineraryFundPaise:  agreement.itinerary_fund_paise,
    bufferPaise:         agreement.buffer_paise,
    capturedTopUpsPaise: 0,
    declaredSpendPaise,
  });

  const copy = financialCopy.reconciliationReceipt.traveler;

  const refundDispatch = payoutDispatches.find(d => d.kind === 'traveler_refund');
  const isStubbed      = refundDispatch?.failed_reason === 'razorpay_live_not_configured';

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Header title="Day complete 🎉" showBack={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Heading */}
        <Text style={styles.heading}>{copy.heading}</Text>
        <Text style={styles.completedAt}>
          {booking.completed_at
            ? new Date(booking.completed_at).toLocaleString('en-IN', {
                dateStyle: 'medium', timeStyle: 'short',
              })
            : 'Reconciliation in progress…'}
        </Text>

        {/* Refund status badge */}
        <View style={[styles.statusBadge, refundStatusStyle(refundDispatch)]}>
          <Text style={[styles.statusText, refundStatusStyle(refundDispatch)]}>
            {refundStatusLabel(refundDispatch)}
          </Text>
        </View>

        {/* Refund breakdown */}
        <Card style={styles.refundCard}>
          <Text style={styles.cardHeading}>{copy.refundHeading}</Text>

          {snapshot.unusedBufferPaise > 0 && (
            <RefundRow
              label="Unused buffer"
              value={`+${formatPaise(snapshot.unusedBufferPaise)}`}
            />
          )}
          <RefundRow
            label="Deposit returned"
            value={`+${formatPaise(50_000)}`}
          />
          <View style={styles.divider} />
          <RefundRow
            label="Total refund"
            value={formatPaise(snapshot.travelerRefundPaise)}
            bold
          />
        </Card>

        {/* What happened with the trip fund */}
        <Card style={styles.expenseCard}>
          <Text style={styles.cardHeading}>Trip fund summary</Text>
          <RefundRow
            label="Trip pot"
            value={formatPaise(snapshot.tripPotPaise)}
            small
          />
          <RefundRow
            label="Expenses declared"
            value={formatPaise(snapshot.declaredSpendCappedPaise)}
            small
            muted
          />
          <RefundRow
            label="Unused buffer (refunded)"
            value={formatPaise(snapshot.unusedBufferPaise)}
            small
            accent
          />
        </Card>

        {/* Processing note */}
        <Text style={styles.processingNote}>
          {copy.processingNote}
        </Text>

        {/* Rating CTA */}
        {booking.status !== 'rated' && (
          <Button
            title={financialCopy.buttons.rateTrip}
            onPress={() =>
              router.push({
                pathname: '/(traveler)/trips/review/[id]',
                params: { id: bookingId },
              } as never)
            }
            style={styles.rateBtn}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function refundStatusLabel(dispatch: PayoutDispatch | undefined): string {
  if (!dispatch) return 'Processing…';
  if (dispatch.failed_reason === 'razorpay_live_not_configured') {
    return 'Refund queued (will be issued when payment infra goes live)';
  }
  switch (dispatch.status) {
    case 'sent':    return '✓ Refund initiated';
    case 'failed':  return '✕ Refund failed — contact support';
    default:        return 'Processing…';
  }
}

function refundStatusStyle(dispatch: PayoutDispatch | undefined): object {
  const s = dispatch?.status;
  if (s === 'sent') return { backgroundColor: '#DCFCE7', color: '#166534' };
  if (s === 'failed') return { backgroundColor: '#FEE2E2', color: '#991B1B' };
  return { backgroundColor: '#FEF9C3', color: '#854D0E' };
}

function RefundRow({
  label, value, bold = false, small = false, muted = false, accent = false,
}: {
  label: string;
  value: string;
  bold?:   boolean;
  small?:  boolean;
  muted?:  boolean;
  accent?: boolean;
}) {
  return (
    <View style={rrStyles.row}>
      <Text style={[rrStyles.label, muted && rrStyles.muted, small && rrStyles.small]}>
        {label}
      </Text>
      <Text style={[
        rrStyles.value,
        bold   && rrStyles.boldValue,
        small  && rrStyles.small,
        accent && rrStyles.accent,
      ]}>
        {value}
      </Text>
    </View>
  );
}

const rrStyles = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label:     { fontSize: 14, color: theme.colors.text, flex: 1 },
  value:     { fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  muted:     { color: theme.colors.textSecondary },
  accent:    { color: '#16A34A' },
  boldValue: { fontSize: 16, fontWeight: '800' },
  small:     { fontSize: 13 },
});

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: theme.colors.background },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:       { color: '#991B1B', fontSize: 15 },
  scroll:          { flex: 1 },
  scrollContent:   { padding: 20, paddingBottom: 40 },
  heading:         { fontSize: 26, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  completedAt:     { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 16 },
  statusBadge:     { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 20 },
  statusText:      { fontSize: 13, fontWeight: '700' },
  refundCard:      { padding: 16, marginBottom: 16 },
  expenseCard:     { padding: 16, marginBottom: 16 },
  cardHeading:     { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  divider:         { height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 },
  processingNote:  { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20, marginVertical: 16 },
  rateBtn:         { marginTop: 8 },
});
