// Razorpay webhook signature verification (HMAC-SHA256).
// Razorpay's reference: https://razorpay.com/docs/webhooks/validate-test/
// Algorithm:
//   computed = HMAC_SHA256_HEX(secret, raw_body)
//   constant-time compare with the X-Razorpay-Signature header value.

/** Constant-time string comparison to prevent signature-timing leaks. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** HMAC-SHA256 hex digest using the Web Crypto API (works in Deno + browsers). */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sigBuf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify a Razorpay webhook signature against the raw request body.
 * Returns false on missing header, length mismatch, or HMAC mismatch.
 */
export async function verifyRazorpaySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || signatureHeader.length === 0) return false;
  if (!secret) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected, signatureHeader);
}
