export type LeadRequestType = 'detour' | 'cheat_sheet';

export interface LeadSubmission {
  requestType: LeadRequestType;
  contact: { name?: string; email: string };
  layover?: {
    arrival?: string;
    departure?: string;
    flightNumbers?: string;
    interests?: string;
  };
  landingPage: string;
  firstAttribution: Record<string, string>;
  lastAttribution: Record<string, string>;
  honeypot: string;
}

export type LeadValidationResult =
  | { ok: true; value: LeadSubmission }
  | { ok: false; code: string; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, max: number, required = false): string | undefined {
  if (value === undefined || value === null) return required ? undefined : undefined;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!cleaned || cleaned.length > max) return undefined;
  return cleaned;
}

function validEmail(email: string): boolean {
  if (email.length > 320 || /[\r\n]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const ATTRIBUTION_KEYS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'msclkid',
  'attribution_first_source', 'attribution_first_seen',
  'attribution_landing', 'attribution_referrer',
  'captured_at', 'landing_page', 'referrer',
]);

function safeReferrer(value: string): string | null {
  if (value === '(direct)') return value;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin.slice(0, 256);
  } catch {
    // The legacy tracker may already have reduced the value to a hostname.
    return /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(value) ? value.slice(0, 256) : null;
  }
}

function cleanAttribution(value: unknown): Record<string, string> | null {
  if (value === undefined) return {};
  if (!isObject(value)) return null;
  const result: Record<string, string> = {};
  const entries = Object.entries(value);
  if (entries.length > 30) return null;
  for (const [key, raw] of entries) {
    if (!ATTRIBUTION_KEYS.has(key) || typeof raw !== 'string') return null;
    const cleaned = cleanString(raw, 512);
    if (!cleaned) continue;
    if (key === 'landing_page' || key === 'attribution_landing') {
      const landing = normalizeLandingPage(cleaned);
      if (landing) result[key] = landing;
    } else if (key === 'referrer' || key === 'attribution_referrer') {
      const referrer = safeReferrer(cleaned);
      if (referrer) result[key] = referrer;
    } else if (key === 'captured_at' || key === 'attribution_first_seen') {
      const parsed = new Date(cleaned);
      if (!Number.isNaN(parsed.getTime())) result[key] = parsed.toISOString();
    } else {
      result[key] = cleaned;
    }
  }
  return result;
}

export function normalizeLandingPage(
  raw: unknown,
  allowedHosts = ['detourtrips.com', 'www.detourtrips.com', 'localhost', '127.0.0.1'],
): string | null {
  const value = cleanString(raw, 2048, true);
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value.split(/[?#]/, 1)[0] || '/';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !allowedHosts.includes(url.hostname)) return null;
    return url.pathname || '/';
  } catch {
    return null;
  }
}

export function validateLeadSubmission(value: unknown): LeadValidationResult {
  if (!isObject(value)) return { ok: false, code: 'invalid_request', message: 'Request body must be an object.' };
  if (value.requestType !== 'detour' && value.requestType !== 'cheat_sheet') {
    return { ok: false, code: 'invalid_request_type', message: 'requestType must be detour or cheat_sheet.' };
  }
  if (!isObject(value.contact)) return { ok: false, code: 'invalid_contact', message: 'contact is required.' };

  const name = cleanString(value.contact.name, 120);
  const email = cleanString(value.contact.email, 320, true)?.toLowerCase();
  if (!email || !validEmail(email)) return { ok: false, code: 'invalid_email', message: 'Enter a valid email address.' };

  const layover = value.layover === undefined ? {} : value.layover;
  if (!isObject(layover)) return { ok: false, code: 'invalid_layover', message: 'layover must be an object.' };
  const arrival = cleanString(layover.arrival, 120);
  const departure = cleanString(layover.departure, 120);
  const flightNumbers = cleanString(layover.flightNumbers, 120);
  const interests = cleanString(layover.interests, 2000);

  if (value.requestType === 'detour' && (!name || !arrival || !departure)) {
    return {
      ok: false,
      code: 'missing_detour_fields',
      message: 'name, arrival and departure are required for a Detour request.',
    };
  }

  const landingPage = normalizeLandingPage(value.landingPage);
  if (!landingPage) return { ok: false, code: 'invalid_landing_page', message: 'landingPage must be a Detour site path.' };
  const firstAttribution = cleanAttribution(value.firstAttribution);
  const lastAttribution = cleanAttribution(value.lastAttribution);
  if (!firstAttribution || !lastAttribution) {
    return { ok: false, code: 'invalid_attribution', message: 'Attribution fields must contain bounded string values.' };
  }

  return {
    ok: true,
    value: {
      requestType: value.requestType,
      contact: { name, email },
      layover: { arrival, departure, flightNumbers, interests },
      landingPage,
      firstAttribution,
      lastAttribution,
      honeypot: typeof value.honeypot === 'string' ? value.honeypot.trim().slice(0, 256) : '',
    },
  };
}

export function submissionFingerprintInput(lead: LeadSubmission, utcDate: string): string {
  return [
    lead.requestType,
    lead.contact.email.toLowerCase(),
    lead.layover?.arrival ?? '',
    lead.layover?.departure ?? '',
    lead.landingPage,
    utcDate,
  ].join('|');
}

export async function hmacSha256Hex(value: string, secret: string): Promise<string> {
  if (secret.length < 16) throw new Error('hmac_secret_too_short');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
