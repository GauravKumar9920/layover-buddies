import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Loading } from '@/components/ui/Loading';

/**
 * Compatibility route for links created by the pre-agreement booking flow.
 *
 * The legacy full-payment endpoint is intentionally retired: it returned 410
 * and its client-side success write could never be a trustworthy payment
 * source of truth. Keep old deep links useful by forwarding them into the
 * current agreement/deposit flow, where Razorpay capture is verified by the
 * server webhook before booking state advances.
 */
export default function LegacyPaymentRedirect() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const router = useRouter();
  const resolvedBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;

  useEffect(() => {
    if (resolvedBookingId) {
      router.replace(`/(shared)/agreements/${resolvedBookingId}` as never);
    } else {
      router.replace('/(traveler)/(tabs)/trips' as never);
    }
  }, [resolvedBookingId, router]);

  return <Loading fullScreen message="Opening secure payment..." />;
}
