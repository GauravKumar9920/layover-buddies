const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const encoder = new TextEncoder();

interface CachedToken {
  value: string;
  expiresAt: number;
  scope: string;
  email: string;
}

let cachedToken: CachedToken | null = null;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlJson(value: unknown): string {
  return base64Url(encoder.encode(JSON.stringify(value)));
}

function pemBytes(value: string): Uint8Array {
  const normalized = value.replaceAll('\\n', '\n').trim();
  const body = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  if (!body) throw new Error('google_private_key_invalid');
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function serviceAccountAssertion(email: string, privateKey: string, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlJson({
    iss: email,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    ownedArrayBuffer(pemBytes(privateKey)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

export interface GoogleCredentials {
  email: string;
  privateKey: string;
}

export function googleCredentials(): GoogleCredentials | null {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')?.trim();
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  return email && privateKey ? { email, privateKey } : null;
}

export async function googleAccessToken(scope: string): Promise<string> {
  const credentials = googleCredentials();
  if (!credentials) throw new Error('google_credentials_unconfigured');
  if (
    cachedToken
    && cachedToken.scope === scope
    && cachedToken.email === credentials.email
    && cachedToken.expiresAt > Date.now() + 60_000
  ) return cachedToken.value;

  const assertion = await serviceAccountAssertion(credentials.email, credentials.privateKey, scope);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`google_token_failed:${response.status}`);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error('google_token_missing');
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in ?? 3600)) * 1000,
    scope,
    email: credentials.email,
  };
  return body.access_token;
}

export async function googleJson<T>(url: string, init: RequestInit, scope: string): Promise<T> {
  const token = await googleAccessToken(scope);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) throw new Error(`google_api_failed:${response.status}`);
  return await response.json() as T;
}
