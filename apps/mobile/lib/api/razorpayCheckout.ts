// ============================================================================
// RAZORPAY CHECKOUT — shared native-sheet wrapper
// ============================================================================
// The one place that touches the react-native-razorpay module. Used by every
// payment flow (deposits.ts, balance.ts, topUp.ts). Orders themselves are
// always created server-side by Edge Functions; this module only opens the
// checkout sheet and classifies availability errors (web / Expo Go have no
// native module — callers show a friendly fallback instead of crashing).
// ============================================================================

import { Platform } from 'react-native';

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
    description: params.tourName ? `Booking: ${params.tourName}` : 'Detour Tour Booking',
    currency: params.order.currency,
    key: params.order.key_id,
    amount: String(params.order.amount_paise),
    name: 'Detour',
    order_id: params.order.order_id,
    prefill: {
      name: params.travelerName ?? '',
      email: params.travelerEmail ?? '',
    },
    // Warm Editorial terracotta — keeps the checkout sheet on-brand (the old
    // value was the retired v2 saffron).
    theme: { color: '#C8542A' },
    modal: { backdropclose: false },
  }) as Promise<RazorpayPaymentResult>;
}
