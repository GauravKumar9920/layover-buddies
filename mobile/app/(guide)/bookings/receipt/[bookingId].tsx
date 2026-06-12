// ============================================================================
// BUDDY RECEIPT — Guide (Phase 4)
// ============================================================================
// Post-reconciliation receipt for the buddy. Shown when status ∈
// {reconciling, completed, rated}. Reads from useTrip + computes the
// reconciliation snapshot from live agreement + expenseProofs data.
//
// §11 verbatim breakdown: buddy fee → platform fee → TDS → deposit back →
// unused buffer clawback → net payout. Payout dispatch status row.
//
// Route: /(guide)/bookings/receipt/[bookingId]
// ============================================================================

import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { useTrip } from '@/lib/hooks/useTrip';
import { computeReconciliationSnapshot } from '@/lib/booking/reconciliationSnapshot';
import { formatPaise } from '@/lib/booking/money';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import type { PayoutDispatch } from '@/lib/api/tripLifecycle';

export default function GuideReceiptScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets  = useSafeAreaInsets();
  const { booking, agreement, expenseProofs, payoutDispatches, topUpRequests, loading, error }
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

  // Compute snapshot from live data (should match what Postgres computed).
  const capturedTopUpsPaise = topUpRequests
    .filter(r => r.status === 'captured')
    .reduce((sum, r) => sum + r.requested_paise, 0);
  const declaredSpendPaise  = expenseProofs.reduce((s, p) => s + p.amount_paise, 0);

  const snapshot = computeReconciliationSnapshot({
    buddyFeePaise:       agreement.buddy_fee_paise,
    itineraryFundPaise:  agreement.itinerary_fund_paise,
    bufferPaise:         agreement.buffer_paise,
    capturedTopUpsPaise,
    declaredSpendPaise,
    platformFeeDownRate: agreement.platform_fee_down_rate,
    tdsRate:             agreement.tds_rate,
  });

  const copy = financialCopy.reconciliationReceipt.buddy;

  // Find the buddy's payout dispatch row.
  const buddyDispatch = payoutDispatches.find(d => d.kind === 'buddy_fee_final');

  const platformFeePaise = agreement.buddy_fee_paise - snapshot.buddyFeeAfterPlatformPaise;
  const isStubbed        = buddyDispatch?.failed_reason === 'razorpay_live_not_configured';

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Header title="Trip payout" showBack={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Heading */}
        <Text style={styles.heading}>{copy.heading}</Text>
        <Text style={styles.completedAt}>
          {booking.completed_at
            ? `Completed ${new Date(booking.completed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
            : 'Reconciliation in progress…'}
        </Text>

        {/* Payout status badge */}
        <View style={[styles.statusBadge, getStatusStyle(buddyDispatch?.status)]}>
          <Text style={[styles.statusText, getStatusStyle(buddyDispatch?.status)]}>
            {getStatusLabel(buddyDispatch)}
          </Text>
        </View>

        {/* Payout breakdown */}
        <Card style={styles.breakdownCard}>
          <Text style={styles.breakdownHeading}>{copy.payoutHeading}</Text>

          <LineItem
            label={copy.payoutBreakdown.buddyFee(agreement.buddy_fee_paise).split(':')[0]}
            value={formatPaise(agreement.buddy_fee_paise)}
          />
          <LineItem
            label={`Platform fee (12.5%)`}
            value={`−${formatPaise(platformFeePaise)}`}
            muted
          />
          <LineItem
            label={`TDS (1%)`}
            value={`−${formatPaise(snapshot.tdsPaise)}`}
            muted
          />
          {snapshot.unusedBufferPaise > 0 && (
            <LineItem
              label="Unused buffer clawback"
              value={`−${formatPaise(snapshot.unusedBufferPaise)}`}
              muted
            />
          )}
          <LineItem
            label="Deposit returned"
            value={`+${formatPaise(50_000)}`}
            accent
          />
          <View style={styles.divider} />
          <LineItem
            label="Net payout"
            value={formatPaise(snapshot.buddyNetPaise)}
            bold
          />
        </Card>

        {/* Expense summary */}
        <Card style={styles.expenseCard}>
          <Text style={styles.breakdownHeading}>Expenses declared</Text>
          {expenseProofs.length === 0 ? (
            <Text style={styles.noExpenses}>No expenses uploaded.</Text>
          ) : (
            <>
              {expenseProofs.map(p => (
                <LineItem
                  key={p.id}
                  label={`${p.category}${p.description ? ` — ${p.description}` : ''}`}
                  value={formatPaise(p.amount_paise)}
                  small
                />
              ))}
              <View style={styles.divider} />
              <LineItem
                label="Total declared"
                value={formatPaise(declaredSpendPaise)}
                bold
              />
            </>
          )}
        </Card>

        {/* Processing note */}
        <Text style={styles.processingNote}>
          {isStubbed ? copy.stubNote : copy.processingNote}
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusLabel(dispatch: PayoutDispatch | undefined): string {
  if (!dispatch) return 'Pending';
  if (dispatch.failed_reason === 'razorpay_live_not_configured') return 'Queued (payment infra pending)';
  switch (dispatch.status) {
    case 'sent':    return '✓ Sent';
    case 'failed':  return '✕ Failed — contact support';
    case 'pending': return 'Processing…';
    default:        return dispatch.status;
  }
}

function getStatusStyle(status: string | undefined): object {
  switch (status) {
    case 'sent':    return { backgroundColor: '#DCFCE7', color: '#166534' };
    case 'failed':  return { backgroundColor: '#FEE2E2', color: '#991B1B' };
    default:        return { backgroundColor: '#FEF9C3', color: '#854D0E' };
  }
}

function LineItem({
  label, value, muted = false, accent = false, bold = false, small = false,
}: {
  label: string;
  value: string;
  muted?:  boolean;
  accent?: boolean;
  bold?:   boolean;
  small?:  boolean;
}) {
  return (
    <View style={liStyles.row}>
      <Text style={[liStyles.label, muted && liStyles.muted, small && liStyles.small]}>
        {label}
      </Text>
      <Text style={[
        liStyles.value,
        muted   && liStyles.muted,
        accent  && liStyles.accent,
        bold    && liStyles.boldValue,
        small   && liStyles.small,
      ]}>
        {value}
      </Text>
    </View>
  );
}

const liStyles = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label:     { fontSize: 14, color: theme.colors.text, flex: 1 },
  value:     { fontSize: 14, color: theme.colors.text, fontWeight: '600', textAlign: 'right' },
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
  breakdownCard:   { padding: 16, marginBottom: 16 },
  breakdownHeading:{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  expenseCard:     { padding: 16, marginBottom: 16 },
  noExpenses:      { fontSize: 14, color: theme.colors.textMuted, paddingVertical: 8 },
  divider:         { height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 },
  processingNote:  { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 8 },
});
