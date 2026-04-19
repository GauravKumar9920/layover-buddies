import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
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
import { fetchBookingById } from '@/lib/api/bookings';
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
import { PAYMENT_STATUS } from '@/config/constants';
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
        <Header title="Payment" showBack />
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

  const buddyCost = booking.total_price - booking.commission;
  const platformFee = booking.commission;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingTop: insets.top }}>
        <Header title="Confirm Payment" showBack />
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
          <PriceRow label="Platform fee" value={`₹${platformFee.toLocaleString('en-IN')}`} />
          <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 }} />
          <PriceRow label="Total to pay" value={`₹${booking.total_price.toLocaleString('en-IN')}`} bold />
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
            title={`Pay ₹${booking.total_price.toLocaleString('en-IN')}`}
            onPress={handlePay}
            loading={processing}
            disabled={processing}
            size="lg"
            style={{ backgroundColor: theme.colors.accent, borderRadius: 16, height: 56 }}
          />
        </Animated.View>
        <Button
          title="Cancel Booking"
          onPress={() => {
            Alert.alert('Cancel?', 'Your booking slot will be released.', [
              { text: 'Keep It', style: 'cancel' },
              { text: 'Cancel', style: 'destructive', onPress: () => router.replace('/(traveler)/' as never) },
            ]);
          }}
          variant="secondary"
          size="sm"
        />
      </View>
    </View>
  );
}
