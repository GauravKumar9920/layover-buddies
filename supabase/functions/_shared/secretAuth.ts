const encoder = new TextEncoder();

export function constantTimeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length, 1);
  let different = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    different |= (a[index % Math.max(a.length, 1)] ?? 0) ^ (b[index % Math.max(b.length, 1)] ?? 0);
  }
  return different === 0;
}

export function bearerMatchesDedicatedSecret(req: Request, expected: string | undefined): boolean {
  if (!expected || expected.length < 24) return false;
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return Boolean(match && constantTimeEqual(match[1], expected));
}

export async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyHexHmac(message: string, signature: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || secret.length < 24 || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = await hmacSha256Hex(message, secret);
  return constantTimeEqual(signature.toLowerCase(), expected);
}

export async function hmacSha1Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Vercel signs webhook deliveries as a hex HMAC-SHA1 of the exact raw body in
 * `x-vercel-signature`. SHA-1 is Vercel's choice, not ours; it is only ever
 * compared against a locally computed digest, never used to derive a secret.
 */
export async function verifyVercelSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || secret.length < 16 || !signature || !/^[a-f0-9]{40}$/i.test(signature)) return false;
  const expected = await hmacSha1Hex(rawBody, secret);
  return constantTimeEqual(signature.toLowerCase(), expected);
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Sanity webhook-toolkit v4 signature: `t=<milliseconds>,v1=<base64url hmac>`. */
export async function verifySanitySignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!secret || secret.length < 24 || !signature || rawBody.length === 0) return false;
  const match = signature.trim().match(/^t=(\d+)[, ]+v1=([^, ]+)$/);
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || timestamp < 1_609_459_200_000) return false;
  // Sanity retries delivery; allow one hour while idempotency-key prevents a
  // captured valid delivery from causing a second deployment.
  if (Math.abs(now - timestamp) > 60 * 60_000) return false;
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  return constantTimeEqual(match[2], base64Url(new Uint8Array(signed)));
}
