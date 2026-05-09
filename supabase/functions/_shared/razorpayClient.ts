// ============================================================================
// RAZORPAY CLIENT — Phase 3+4 stub seam
// ============================================================================
// Single module that wraps every Razorpay API verb used in Phase 3+4.
//
// Split into two tiers:
//
//   LIVE NOW (test-key-safe):
//     createOrder()         — Razorpay v1 Orders API. Works against test keys
//                             today. Used by create-balance-order and
//                             create-topup-order.
//
//   GATED (live keys required):
//     createRefund()        — Refund against a captured payment.
//     createPayout()        — Payout to a fund account (UPI/IMPS).
//     createFundAccount()   — Register a contact's UPI VPA as a fund account.
//
// The three gated verbs check RAZORPAY_LIVE_FEATURES_ENABLED at call time.
// When unset (which is the pre-registration default), they throw
// RazorpayLiveNotConfiguredError. Edge handlers MUST catch this, persist a
// payout_dispatches row with failed_reason='razorpay_live_not_configured',
// and continue the state-machine transition — bookings advance correctly
// without money moving. replay-stubbed-payouts drains the backlog when live
// keys arrive.
//
// idempotencyKey() — deterministic key builder for Razorpay-bound requests.
// Stable across retries; ≤40 chars (Razorpay limit). Prevents double-charges
// when replay-stubbed-payouts runs after the live flip.
// ============================================================================

export class RazorpayLiveNotConfiguredError extends Error {
  constructor(verb: string) {
    super(
      `Razorpay live call '${verb}' skipped — RAZORPAY_LIVE_FEATURES_ENABLED is not set. ` +
      `Persist a payout_dispatches row with failed_reason='razorpay_live_not_configured' ` +
      `and continue the state-machine transition.`,
    );
    this.name = 'RazorpayLiveNotConfiguredError';
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────

function getKeyId(): string {
  const id = Deno.env.get('RAZORPAY_KEY_ID');
  if (!id) throw new Error('RAZORPAY_KEY_ID is not set');
  return id;
}

function getKeySecret(): string {
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET is not set');
  return secret;
}

function isLiveEnabled(): boolean {
  const v = Deno.env.get('RAZORPAY_LIVE_FEATURES_ENABLED');
  return v === 'true' || v === '1';
}

function authHeader(): string {
  const creds = btoa(`${getKeyId()}:${getKeySecret()}`);
  return `Basic ${creds}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrderResult {
  order_id: string;
  amount:   number;
  currency: string;
  receipt:  string;
}

export interface RefundResult {
  refund_id: string;
  payment_id: string;
  amount:    number;
  status:    string;
}

export interface PayoutResult {
  payout_id: string;
  fund_account_id: string;
  amount:    number;
  status:    string;
}

export interface FundAccountResult {
  fund_account_id: string;
  contact_id:      string;
}

// ─── Idempotency key ─────────────────────────────────────────────────────────

/**
 * Build a deterministic, ≤40-char idempotency key from ordered string parts.
 * Stable across retries — prevents Razorpay double-charges when
 * replay-stubbed-payouts is called more than once.
 *
 * Pattern: sha256(parts.join('|')) truncated to 40 hex chars.
 * (Razorpay's maximum idempotency key length is 40 chars.)
 */
export async function idempotencyKey(parts: string[]): Promise<string> {
  const raw = parts.join('|');
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 40);
}

// ─── Live verbs ──────────────────────────────────────────────────────────────

/**
 * Create a Razorpay order.
 * Works with test keys; safe to call pre-registration.
 */
export async function createOrder(params: {
  amount_paise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<OrderResult> {
  const body = {
    amount:   params.amount_paise,
    currency: params.currency ?? 'INR',
    receipt:  params.receipt,
    notes:    params.notes ?? {},
  };

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method:  'POST',
    headers: {
      Authorization:  authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay createOrder failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    order_id: data.id,
    amount:   data.amount,
    currency: data.currency,
    receipt:  data.receipt ?? params.receipt,
  };
}

/**
 * Refund a captured payment.
 * GATED — requires RAZORPAY_LIVE_FEATURES_ENABLED=true.
 * Throws RazorpayLiveNotConfiguredError when the flag is unset.
 */
export async function createRefund(params: {
  payment_id:      string;
  amount_paise:    number;
  idempotency_key: string;
  notes?:          Record<string, string>;
}): Promise<RefundResult> {
  if (!isLiveEnabled()) throw new RazorpayLiveNotConfiguredError('createRefund');

  const body: Record<string, unknown> = {
    amount: params.amount_paise,
    notes:  params.notes ?? {},
  };

  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${params.payment_id}/refund`,
    {
      method:  'POST',
      headers: {
        Authorization:     authHeader(),
        'Content-Type':    'application/json',
        'Idempotency-Key': params.idempotency_key,
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay createRefund failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    refund_id:  data.id,
    payment_id: data.payment_id,
    amount:     data.amount,
    status:     data.status,
  };
}

/**
 * Dispatch a payout to a Razorpay fund account.
 * GATED — requires RAZORPAY_LIVE_FEATURES_ENABLED=true.
 * Throws RazorpayLiveNotConfiguredError when the flag is unset.
 */
export async function createPayout(params: {
  fund_account_id: string;
  amount_paise:    number;
  mode?:           'UPI' | 'IMPS' | 'NEFT' | 'RTGS';
  purpose?:        string;
  idempotency_key: string;
  notes?:          Record<string, string>;
}): Promise<PayoutResult> {
  if (!isLiveEnabled()) throw new RazorpayLiveNotConfiguredError('createPayout');

  const body = {
    account_number:  Deno.env.get('RAZORPAY_X_ACCOUNT_NUMBER') ?? '',
    fund_account_id: params.fund_account_id,
    amount:          params.amount_paise,
    currency:        'INR',
    mode:            params.mode ?? 'UPI',
    purpose:         params.purpose ?? 'payout',
    queue_if_low_balance: true,
    notes:           params.notes ?? {},
  };

  const res = await fetch('https://api.razorpay.com/v1/payouts', {
    method:  'POST',
    headers: {
      Authorization:     authHeader(),
      'Content-Type':    'application/json',
      'Idempotency-Key': params.idempotency_key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay createPayout failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    payout_id:       data.id,
    fund_account_id: data.fund_account_id,
    amount:          data.amount,
    status:          data.status,
  };
}

/**
 * Register a UPI VPA as a Razorpay fund account for a contact.
 * GATED — requires RAZORPAY_LIVE_FEATURES_ENABLED=true.
 * Throws RazorpayLiveNotConfiguredError when the flag is unset.
 *
 * Callers should cache the returned fund_account_id on users.razorpay_fund_account_id
 * so this is only called once per buddy.
 */
export async function createFundAccount(params: {
  contact_id:           string;
  vpa:                  string;
  account_holder_name:  string;
}): Promise<FundAccountResult> {
  if (!isLiveEnabled()) throw new RazorpayLiveNotConfiguredError('createFundAccount');

  const body = {
    contact_id:   params.contact_id,
    account_type: 'vpa',
    vpa: {
      address: params.vpa,
    },
  };

  const res = await fetch('https://api.razorpay.com/v1/fund_accounts', {
    method:  'POST',
    headers: {
      Authorization:  authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay createFundAccount failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    fund_account_id: data.id,
    contact_id:      data.contact_id,
  };
}
