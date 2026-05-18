import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { fetchBookingById, cancelBooking } from '@/lib/api/bookings';
import { safeBack } from '@/lib/navigation';
import {
  assertRazorpayCheckoutAvailable,
  createRazorpayOrder,
  isRazorpayCheckoutUnavailableError,
  openRazorpayCheckout,
  recordPaymentResult,
} from '@/lib/api/payments';
import { hapticImpactMedium, hapticSuccess, hapticError } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { theme } from '@/config/theme';
import { PAYMENT_STATUS, ESTIMATED_EXPENSES_PERCENT, DEPOSIT_PAISE } from '@/config/constants';
import type { Booking } from '@/types';

function PriceRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontSize: bold ? 16 : 14, color: bold ? theme.colors.text : theme.colors.textSecondary, fontWeight: bold ? '700' : '400' }}>
        {label}
      </Text>
      <Text style={{ fontSize: bold ? 18 : 14, color: bold ? theme.colors.primary : theme.colors.text, fontWeight: bold ? '800' : '500' }}>
        {value}
      </Text>
    </View>
  );
}

// Selectable row used in the "Pay now" choice card — booking deposit vs full.
function PayOption({
  selected, onPress, title, subtitle, badge,
}: {
  selected: boolean;
  onPress: () => void;
  title:    string;
  subtitle: string;
  badge?:   string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        padding: 14,
        backgroundColor: selected ? theme.colors.primaryLight : '#FFFFFF',
        borderRadius: theme.borderRadius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors.primary : theme.colors.divider,
      }}
    >
      {/* Radio glyph */}
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? theme.colors.primary : theme.colors.divider,
        backgroundColor: selected ? theme.colors.primary : 'transparent',
        alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
      }}>
        {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{title}</Text>
          {badge ? (
            <View style={{ backgroundColor: theme.colors.success + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.success }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 17 }}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Success animation shown after payment
function PaymentSuccessView({ booking }: { booking: Booking }) {
  const router = useRouter();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 120 }),
    );
    opacity.value = withDelay(300, withTiming(1, { duration: 400 }));
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 40 }}>
      <Animated.Text style={[{ fontSize: 80 }, useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))]}>
        🎉
      </Animated.Text>
      <Animated.View style={[{ alignItems: 'center' }, useAnimatedStyle(() => ({ opacity: opacity.value }))]}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: theme.colors.text, marginTop: 20, textAlign: 'center' }}>
          Booking Confirmed!
        </Text>
        <Text style={{ fontSize: 15, color: theme.colors.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
          {booking.guide?.name
            ? `Your tour with ${booking.guide.name} is confirmed.`
            : 'Your booking is confirmed.'}{'\n'}
          Check your trip for details.
        </Text>
        <Button
          title="View My Trip"
          onPress={() => router.replace(`/(traveler)/trips/${booking.id}` as never)}
          style={{ marginTop: 32, minWidth: 200 }}
          size="lg"
        />
        <Button
          title="Browse More"
          onPress={() => router.replace('/(traveler)/' as never)}
          variant="secondary"
          style={{ marginTop: 12, minWidth: 200 }}
          size="sm"
        />
      </Animated.View>
    </View>
  );
}

export default function PaymentScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [travelerEmail, setTravelerEmail] = useState('');
  const [travelerName, setTravelerName] = useState('');
  // "deposit" = pay just the ₹500 refundable booking fee now; balance is due
  // 72h before the trip. "full" = pay everything up front (locks the price
  // and skips the late-fee window).
  const [payOption, setPayOption] = useState<'deposit' | 'full'>('deposit');

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  useEffect(() => {
    if (!bookingId) return;

    Promise.all([
      fetchBookingById(bookingId),
      supabase.auth.getUser(),
    ]).then(([b, { data: { user } }]) => {
      setBooking(b);
      setTravelerEmail(user?.email ?? '');
      // Fetch traveler name from users table
      if (user?.id) {
        supabase.from('users').select('full_name').eq('id', user.id).maybeSingle()
          .then(({ data }) => setTravelerName(data?.full_name ?? ''));
      }
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load booking.');
    }).finally(() => setLoading(false));
  }, [bookingId]);

  async function handlePay() {
    if (!booking || !bookingId) return;
    setError(null);
    hapticImpactMedium();

    btnScale.value = withSequence(
      withSpring(0.95, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 12 }),
    );

    setProcessing(true);
    let orderCreated = false;
    try {
      // Ensure native payment bridge exists before creating an order.
      assertRazorpayCheckoutAvailable();

      // Step 1: Create order via Edge Function (secret stays server-side)
      const order = await createRazorpayOrder(bookingId, booking.total_price);
      orderCreated = true;

      // Step 2: Open Razorpay native checkout
      const payment = await openRazorpayCheckout({
        order,
        travelerName,
        travelerEmail,
        tourName: booking.itinerary?.name,
      });

      // Step 3: Record successful payment in DB
      await recordPaymentResult(bookingId, {
        paymentId: payment.razorpay_payment_id,
        orderId: payment.razorpay_order_id,
        status: PAYMENT_STATUS.CAPTURED,
      });

      hapticSuccess();
      setPaid(true);
    } catch (err: unknown) {
      hapticError();
      const msg = err instanceof Error ? err.message : String(err);
      const isCheckoutUnavailable = isRazorpayCheckoutUnavailableError(err);
      const isCancelled =
        typeof err === 'object'
        && err !== null
        && (err as Record<string, unknown>).code === 0;

      // Razorpay cancels come through as error with code 0 — treat as cancellation, not error
      if (isCancelled) {
        setError('Payment was cancelled. You can retry when ready.');
      } else {
        setError(msg);
      }

      // Only mark failed when an order was actually created and checkout wasn't just unavailable locally.
      if (bookingId && orderCreated && !isCancelled && !isCheckoutUnavailable) {
        await recordPaymentResult(bookingId, {
          paymentId: null,
          orderId: '',
          status: PAYMENT_STATUS.FAILED,
        }).catch(() => {});
      }
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <Loading fullScreen message="Preparing payment..." />;
  if (paid && booking) return <PaymentSuccessView booking={booking} />;

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Header title="Payment" showBack backFallback="/(traveler)/(tabs)/trips" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 15, marginTop: 16, textAlign: 'center' }}>
            {error ?? 'Booking not found.'}
          </Text>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 24 }} variant="secondary" />
        </View>
      </View>
    );
  }

  // Pricing is locked at booking time on `bookings.buddy_cost / estimated_expenses
  // / platform_fee / total_amount` — every one already multiplied by group size.
  // Re-deriving from itinerary.buddy_cost_inr would silently lie about the line
  // items for any booking with num_travelers > 1.  Prefer the persisted values
  // and only fall back to the per-person × N math when they're not yet hydrated
  // (e.g. older rows that pre-date the column).
  const N = booking.num_travelers || 1;
  const buddyCost =
    booking.buddy_cost > 0 ? booking.buddy_cost : (booking.itinerary?.buddy_cost_inr ?? 0) * N;
  const estimatedExpenses =
    booking.estimated_expenses > 0
      ? booking.estimated_expenses
      : Math.round(buddyCost * (ESTIMATED_EXPENSES_PERCENT / 100));
  const platformFee = booking.commission;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingTop: insets.top }}>
        <Header title="Confirm Payment" showBack backFallback="/(traveler)/(tabs)/trips" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tour Summary */}
        <Card style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
            Booking Summary
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 4 }}>
            {booking.itinerary?.name ?? 'City Tour'}
          </Text>
          {booking.guide?.name && (
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 12 }}>
              👤 Guide: {booking.guide.name}
            </Text>
          )}
          <View style={{ height: 1, backgroundColor: theme.colors.divider, marginBottom: 12 }} />
          <PriceRow label="Buddy fee" value={`₹${buddyCost.toLocaleString('en-IN')}`} />
          <PriceRow label={`Estimated expenses (~${ESTIMATED_EXPENSES_PERCENT}%)`} value={`₹${estimatedExpenses.toLocaleString('en-IN')}`} />
          <PriceRow label="Platform fee" value={`₹${platformFee.toLocaleString('en-IN')}`} />
          <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 }} />
          <PriceRow label="Total to pay" value={`₹${booking.total_price.toLocaleString('en-IN')}`} bold />
        </Card>

        {/* Pay-now choice — deposit holds the slot, full clears everything */}
        <Card style={{ marginBottom: 20 }}>
          <Text style={{
            fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary,
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14,
          }}>
            Pay now
          </Text>

          <PayOption
            selected={payOption === 'deposit'}
            onPress={() => setPayOption('deposit')}
            title={`₹${(DEPOSIT_PAISE / 100).toLocaleString('en-IN')} booking fee`}
            subtitle="Holds your slot. Balance is due 72 h before the trip — late fees kick in after."
            badge="Recommended"
          />
          <View style={{ height: 10 }} />
          <PayOption
            selected={payOption === 'full'}
            onPress={() => setPayOption('full')}
            title={`Pay full ₹${booking.total_price.toLocaleString('en-IN')}`}
            subtitle="Skip the second payment. Refundable per our cancellation tiers."
          />
        </Card>

        {/* Payment info */}
        <Card style={{ marginBottom: 20, backgroundColor: theme.colors.primaryLight }}>
          <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '600', lineHeight: 20 }}>
            🔒 Payment is held in escrow and released to the guide only after your tour is completed.
          </Text>
        </Card>

        {/* Test card hint (test mode only) */}
        <Card style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Test Mode — Sample Cards
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 }}>
            ✅ Success: 4111 1111 1111 1111{'\n'}
            ❌ Failure: 5104 0600 0000 0008{'\n'}
            🔐 3D Secure: 5104 0155 5555 5558{'\n'}
            CVV: any 3 digits · Expiry: any future date
          </Text>
        </Card>

        {/* Error */}
        {error && (
          <View style={{
            marginBottom: 16,
            backgroundColor: theme.colors.accentLight,
            borderRadius: theme.borderRadius.md,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.error,
            padding: 12,
          }}>
            <Text style={{ fontSize: 13, color: theme.colors.error, fontWeight: '500' }}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed pay button */}
      <View style={{
        position: 'absolute',
        bottom: insets.bottom + 16,
        left: 24,
        right: 24,
        gap: 10,
      }}>
        <Animated.View style={btnStyle}>
          <Button
            // Amount to charge depends on the selected pay option above. The
            // backend cancel/cron flow already understands a partial pay-now
            // → balance-later sequence (Phase 2/3), so this just gates the
            // initial Razorpay charge.
            title={
              payOption === 'deposit'
                ? `Pay ₹${(DEPOSIT_PAISE / 100).toLocaleString('en-IN')} booking fee`
                : `Pay full ₹${booking.total_price.toLocaleString('en-IN')}`
            }
            onPress={handlePay}
            loading={processing}
            disabled={processing}
            size="lg"
            style={{ backgroundColor: theme.colors.accent, borderRadius: 16, height: 56 }}
          />
        </Animated.View>
        <Button
          title="Cancel Booking"
          onPress={async () => {
            if (!booking?.id) return;
            // Web-friendly confirm (Alert.alert multi-button is a no-op on RN-Web)
            const proceed = await new Promise<boolean>((resolve) => {
              if (Platform.OS === 'web') {
                resolve(window.confirm('Cancel this booking? Your slot will be released.'));
                return;
              }
              Alert.alert('Cancel?', 'Your booking slot will be released.', [
                { text: 'Keep It', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Cancel', style: 'destructive', onPress: () => resolve(true) },
              ], { onDismiss: () => resolve(false) });
            });
            if (!proceed) return;
            try {
              // Actually update the DB — previous version only routed away,
              // leaving the chat_open booking orphaned in My Trips & Inbox.
              await cancelBooking(booking.id);
              safeBack(router, '/(traveler)/(tabs)/trips');
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Please try again.';
              if (Platform.OS === 'web') window.alert(`Unable to cancel: ${msg}`);
              else Alert.alert('Unable to cancel', msg);
            }
          }}
          variant="secondary"
          size="sm"
        />
      </View>
    </View>
  );
}
