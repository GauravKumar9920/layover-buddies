// ============================================================================
// BALANCE PAYMENT SCREEN — Traveler (Phase 3)
// ============================================================================
// Shows the trip pricing breakdown + optional late-fee banner, then opens
// the Razorpay checkout. After payment captured the webhook advances the
// booking status; this screen polls via Realtime (useTrip) and navigates
// to the QR screen on status → balance_paid / trip_ready.
//
// Route: /(traveler)/trips/balance/[bookingId]
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { formatPaise } from '@/lib/booking/money';
import { createBalanceOrder, openBalanceCheckout } from '@/lib/api/balance';
import { confirmPayment } from '@/lib/api/confirmPayment';
import { supabase } from '@/lib/supabase';
import { financialCopy } from '@/lib/copy/financial';
import { theme } from '@/config/theme';
import { LATE_FEE_PAISE } from '@/config/constants';
import type { BookingState } from '@/lib/booking/stateMachine';

interface AgreementSnapshot {
  traveler_subtotal_paise: number;
  traveler_gst_paise:      number;
  buddy_fee_paise:         number;
  itinerary_fund_paise:    number;
  buffer_paise:            number;
  trip_starts_at:          string;
}

interface BookingSnapshot {
  status:         BookingState;
  late_fee_paise: number;
  traveler_id:    string;
}

export default function BalancePaymentScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [booking,   setBooking]   = useState<BookingSnapshot | null>(null);
  const [agreement, setAgreement] = useState<AgreementSnapshot | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [paying,    setPaying]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!bookingId) return;
    try {
      setLoading(true);

      const [{ data: b }, { data: a }] = await Promise.all([
        supabase
          .from('bookings')
          .select('status, late_fee_paise, traveler_id')
          .eq('id', bookingId)
          .single(),
        supabase
          .from('agreements')
          .select('traveler_subtotal_paise, traveler_gst_paise, buddy_fee_paise, itinerary_fund_paise, buffer_paise, trip_starts_at')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

      setBooking(b as BookingSnapshot);
      setAgreement(a as AgreementSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime: navigate when booking status advances ───────────────────────
  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel(`balance_screen_${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        (payload) => {
          const newStatus = payload.new?.status as BookingState;
          if (newStatus === 'balance_paid' || newStatus === 'trip_ready') {
            router.replace({
              pathname: '/(traveler)/trips/qr/[bookingId]',
              params:   { bookingId },
            } as never);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId, router]);

  // ── Pay ───────────────────────────────────────────────────────────────────
  async function handlePay() {
    if (!bookingId || !booking) return;
    try {
      setPaying(true);
      const order = await createBalanceOrder(bookingId);

      // Get current user details for prefill.
      const { data: user } = await supabase.auth.getUser();
      const email = user?.user?.email ?? '';
      const name  = user?.user?.user_metadata?.full_name ?? '';

      // Open the native checkout. The native SDK resolves with three signed
      // values (order_id, payment_id, signature). We POST those to
      // `confirm-payment` so the balance settles immediately even when the
      // Razorpay webhook can't be configured (KYC pending, ngrok URL
      // rotated, etc.). The Realtime subscription still updates the UI;
      // the webhook (when it arrives) is a deduped no-op via payment_id.
      const result = await openBalanceCheckout({ order, travelerName: name, travelerEmail: email });
      try {
        await confirmPayment({
          booking_id:          bookingId,
          kind:                'balance',
          razorpay_order_id:   result.razorpay_order_id,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_signature:  result.razorpay_signature,
        });
      } catch (confirmErr) {
        // Confirm failed but the Razorpay sheet returned success — money was
        // charged. The webhook is the fallback; if it never arrives the user
        // may see a stale screen, but the payment IS at Razorpay.
        // eslint-disable-next-line no-console
        console.warn('[balance] confirm-payment failed, waiting on webhook:', confirmErr);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        // User dismissed checkout — not an error.
      } else {
        Alert.alert('Payment failed', err instanceof Error ? err.message : 'Please try again.');
      }
    } finally {
      setPaying(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
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
        <Text style={styles.errorText}>{error ?? 'Could not load booking'}</Text>
      </View>
    );
  }

  const isLateFee = booking.status === 'late_fee_due';
  // `??` not `||`: the cron writes the CONFIGURED fee, which is legitimately 0
  // during early access — `||` would silently re-charge the ₹1,000 default.
  const lateFee   = isLateFee ? (booking.late_fee_paise ?? LATE_FEE_PAISE) : 0;
  const total     = agreement.traveler_subtotal_paise + agreement.traveler_gst_paise + lateFee;

  const copy = financialCopy.balancePricing;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Header title="Pay trip balance" showBack />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Late-fee banner — hidden when the configured fee is ₹0 (early access) */}
        {isLateFee && lateFee > 0 && (
          <Card style={styles.lateFeeBanner}>
            <Text style={styles.lateFeeHeading}>{financialCopy.lateFeeBanner.heading}</Text>
            <Text style={styles.lateFeeBody}>
              {financialCopy.lateFeeBanner.body(lateFee)}
            </Text>
          </Card>
        )}

        {/* Breakdown */}
        <Card style={styles.breakdownCard}>
          <Text style={styles.sectionTitle}>{copy.sectionHeading}</Text>

          <LineItem
            label={copy.lineItems.tripFund.label}
            sub={copy.lineItems.tripFund.sub}
            amount={agreement.itinerary_fund_paise + agreement.buffer_paise}
          />
          {agreement.traveler_gst_paise > 0 && (
            <LineItem
              label={copy.lineItems.gst.label}
              amount={agreement.traveler_gst_paise}
            />
          )}
          {isLateFee && lateFee > 0 && (
            <LineItem
              label={copy.lineItems.lateFee.label}
              sub={copy.lineItems.lateFee.sub}
              amount={lateFee}
              highlight
            />
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatPaise(total)}</Text>
          </View>

          <Text style={styles.depositNote}>{copy.depositNote}</Text>
          <Text style={styles.refundNote}>
            {copy.refundNote(agreement.buffer_paise)}
          </Text>
        </Card>
      </ScrollView>

      {/* Pay CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <TouchableOpacity
          style={[styles.payButton, paying && styles.payButtonDisabled]}
          onPress={handlePay}
          disabled={paying}
          activeOpacity={0.85}
        >
          {paying
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.payButtonText}>
                {isLateFee
                  ? financialCopy.buttons.payBalanceWithLateFee(lateFee)
                  : financialCopy.buttons.payBalance}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function LineItem({
  label, sub, amount, highlight = false,
}: {
  label: string;
  sub?: string;
  amount: number;
  highlight?: boolean;
}) {
  return (
    <View style={styles.lineItem}>
      <View style={styles.lineItemLeft}>
        <Text style={[styles.lineLabel, highlight && styles.lineLabelHighlight]}>{label}</Text>
        {sub && <Text style={styles.lineSub}>{sub}</Text>}
      </View>
      <Text style={[styles.lineAmount, highlight && styles.lineAmountHighlight]}>
        {formatPaise(amount)}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: theme.colors.background },
  scroll:            { flex: 1 },
  content:           { padding: 16, gap: 12 },
  centered:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:         { color: '#991B1B', fontSize: 15 },
  lateFeeBanner:     { backgroundColor: '#FEF9C3', padding: 16 },
  lateFeeHeading:    { fontSize: 15, fontWeight: '700', color: '#854D0E', marginBottom: 4 },
  lateFeeBody:       { fontSize: 13, color: '#854D0E', lineHeight: 20 },
  breakdownCard:     { padding: 16, gap: 10 },
  sectionTitle:      { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  lineItem:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineItemLeft:      { flex: 1, marginRight: 8 },
  lineLabel:         { fontSize: 14, color: theme.colors.text, fontWeight: '500' },
  lineLabelHighlight:{ color: '#854D0E', fontWeight: '700' },
  lineSub:           { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  lineAmount:        { fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  lineAmountHighlight: { color: '#854D0E' },
  divider:           { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  totalRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:        { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  totalAmount:       { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  depositNote:       { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  refundNote:        { fontSize: 12, color: theme.colors.textSecondary },
  footer:            { padding: 16, backgroundColor: theme.colors.background },
  payButton:         {
    backgroundColor: theme.colors.primary,
    padding: 16, borderRadius: 14,
    alignItems: 'center',
  },
  payButtonDisabled: { opacity: 0.6 },
  payButtonText:     { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
