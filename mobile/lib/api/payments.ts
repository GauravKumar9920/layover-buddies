import { supabase } from '../supabase';
import { env } from '@/config/env';
import { Platform } from 'react-native';
import { PAYMENT_STATUS } from '@/config/constants';
import type { PaymentStatus } from '@/types';

export interface RazorpayOrder {
  order_id: string;
  amount_paise: number;
  currency: string;
  key_id: string;
}

export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const RAZORPAY_NATIVE_UNAVAILABLE_MESSAGE =
  'Razorpay checkout is unavailable in Expo Go. Please run the app as a development build (`npx expo run:android` or `npx expo run:ios`) and try again.';

const RAZORPAY_WEB_UNSUPPORTED_MESSAGE =
  'Razorpay checkout is not supported on web. Please use the Android or iOS app.';

type RazorpayCheckoutModule = {
  open: (options: Record<string, unknown>) => Promise<RazorpayPaymentResult>;
};

function resolveRazorpayCheckoutModule(): RazorpayCheckoutModule {
  if (Platform.OS === 'web') {
    throw new Error(RAZORPAY_WEB_UNSUPPORTED_MESSAGE);
  }

  try {
    // Dynamic require ensures app startup remains stable until checkout is used.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-razorpay');
    const checkout = (mod?.default ?? mod) as Partial<RazorpayCheckoutModule> | null;

    if (!checkout || typeof checkout.open !== 'function') {
      throw new Error(RAZORPAY_NATIVE_UNAVAILABLE_MESSAGE);
    }

    return checkout as RazorpayCheckoutModule;
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (
        err.message === RAZORPAY_NATIVE_UNAVAILABLE_MESSAGE
        || err.message === RAZORPAY_WEB_UNSUPPORTED_MESSAGE
      ) {
        throw err;
      }
    }

    throw new Error(RAZORPAY_NATIVE_UNAVAILABLE_MESSAGE);
  }
}

export function assertRazorpayCheckoutAvailable(): void {
  resolveRazorpayCheckoutModule();
}

export function isRazorpayCheckoutUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.message === RAZORPAY_NATIVE_UNAVAILABLE_MESSAGE
    || error.message === RAZORPAY_WEB_UNSUPPORTED_MESSAGE
  );
}

/**
 * Calls the Supabase Edge Function to create a Razorpay order.
 * The Razorpay secret never leaves the Edge Function.
 */
export async function createRazorpayOrder(
  bookingId: string,
  amountInr: number,
): Promise<RazorpayOrder> {
  if (!env.RAZORPAY_KEY_ID) {
    throw new Error('Razorpay is not configured. Set EXPO_PUBLIC_RAZORPAY_KEY_ID.');
  }

  const { data, error } = await supabase.functions.invoke('create-booking-payment', {
    body: { booking_id: bookingId, amount_inr: amountInr },
  });

  if (error) throw new Error(`Payment initialization failed: ${error.message}`);

  const payload = data as Record<string, unknown>;
  if (!payload?.order_id) {
    throw new Error(
      (payload?.error as string) ?? 'Payment service returned an invalid response.',
    );
  }

  return {
    order_id: payload.order_id as string,
    amount_paise: payload.amount_paise as number,
    currency: (payload.currency as string) ?? 'INR',
    key_id: (payload.key_id as string) ?? env.RAZORPAY_KEY_ID,
  };
}

/**
 * Opens the Razorpay native checkout sheet.
 * Resolves with payment IDs on success, rejects on cancel/failure.
 */
export async function openRazorpayCheckout(params: {
  order: RazorpayOrder;
  travelerName?: string;
  travelerEmail?: string;
  tourName?: string;
}): Promise<RazorpayPaymentResult> {
  const RazorpayCheckout = resolveRazorpayCheckoutModule();

  return RazorpayCheckout.open({
    description: params.tourName ? `Booking: ${params.tourName}` : 'Mumbai Buddies Tour Booking',
    currency: params.order.currency,
    key: params.order.key_id,
    amount: String(params.order.amount_paise),
    name: 'Mumbai Buddies',
    order_id: params.order.order_id,
    prefill: {
      name: params.travelerName ?? '',
      email: params.travelerEmail ?? '',
    },
    theme: { color: '#0D7377' },
    modal: { backdropclose: false },
  }) as Promise<RazorpayPaymentResult>;
}

/** Updates booking's payment fields after a successful or failed payment. */
export async function recordPaymentResult(
  bookingId: string,
  result: {
    paymentId: string | null;
    orderId: string;
    status: PaymentStatus;
  },
): Promise<void> {
  const updates: Record<string, unknown> = {
    payment_id: result.paymentId,
    payment_status: result.status,
  };

  // Advance booking status on capture
  if (result.status === PAYMENT_STATUS.CAPTURED) {
    updates.status = 'confirmed';
  }

  const { error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId);

  if (error) throw error;
}
