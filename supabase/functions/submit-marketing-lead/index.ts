// ============================================================================
// SUBMIT-MARKETING-LEAD — public, first-party Detour website lead intake
// ============================================================================
// POST contract:
// {
//   requestType: 'detour' | 'cheat_sheet',
//   contact: { name?: string, email: string },
//   layover?: { arrival?, departure?, flightNumbers?, interests? },
//   landingPage: string,
//   firstAttribution?: Record<string,string>,
//   lastAttribution?: Record<string,string>,
//   honeypot?: string
// }
//
// Success: {data:{leadId,status:'received'},error:null,meta:{generatedAt}}
// The honeypot returns a synthetic 202 success without a leadId or DB insert.
// Secrets, raw IP addresses, and submission fingerprints never reach clients.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import { errorEnvelope, successEnvelope } from '../_shared/apiEnvelope.ts';
import {
  hmacSha256Hex,
  submissionFingerprintInput,
  validateLeadSubmission,
  type LeadSubmission,
} from '../_shared/leadValidation.ts';

const MAX_BODY_BYTES = 32 * 1024;

function allowedOrigin(origin: string): boolean {
  if (origin === 'https://detourtrips.com' || origin === 'https://www.detourtrips.com') return true;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function corsFor(req: Request): Record<string, string> | null {
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigin(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function clientAddress(req: Request): string {
  const raw = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]
    ?? 'unknown';
  const value = raw.trim().slice(0, 64);
  return /^[0-9a-f:.]+$/i.test(value) ? value : 'unknown';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] ?? char);
}

async function sendLeadNotification(lead: LeadSubmission, leadId: string): Promise<string | null> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('LEAD_NOTIFICATION_EMAIL') ?? 'admin@detourtrips.com';
  const from = Deno.env.get('LEAD_NOTIFICATION_FROM');
  if (!apiKey || !from) return 'lead_notification_not_configured';

  const rows = [
    ['Lead ID', leadId],
    ['Type', lead.requestType],
    ['Name', lead.contact.name ?? '—'],
    ['Email', lead.contact.email],
    ['Arrival', lead.layover?.arrival ?? '—'],
    ['Departure', lead.layover?.departure ?? '—'],
    ['Flights', lead.layover?.flightNumbers ?? '—'],
    ['Interests', lead.layover?.interests ?? '—'],
    ['Landing page', lead.landingPage],
  ];
  const html = `<h2>New Detour website request</h2><table>${rows.map(([key, value]) =>
    `<tr><th align="left">${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`
  ).join('')}</table>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `New Detour ${lead.requestType} request`, html }),
    });
    return response.ok ? null : 'lead_notification_failed';
  } catch {
    return 'lead_notification_failed';
  }
}

serve(async (req: Request) => {
  const cors = corsFor(req);
  if (!cors) return errorEnvelope('origin_forbidden', 'This origin is not allowed.', 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return errorEnvelope('method_not_allowed', 'Use POST.', 405, { headers: cors });
  }

  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return errorEnvelope('payload_too_large', 'Request body is too large.', 413, { headers: cors });
  }
  if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return errorEnvelope('unsupported_media_type', 'Content-Type must be application/json.', 415, { headers: cors });
  }

  let rawBody: string;
  let input: unknown;
  try {
    rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return errorEnvelope('payload_too_large', 'Request body is too large.', 413, { headers: cors });
    }
    input = JSON.parse(rawBody);
  } catch {
    return errorEnvelope('invalid_json', 'Request body is not valid JSON.', 400, { headers: cors });
  }

  // Do not reveal validation clues to simple form bots.
  if (
    typeof input === 'object' && input !== null && !Array.isArray(input)
    && typeof (input as Record<string, unknown>).honeypot === 'string'
    && ((input as Record<string, unknown>).honeypot as string).trim().length > 0
  ) {
    return successEnvelope({ status: 'received' }, { status: 202, headers: cors });
  }

  const parsed = validateLeadSubmission(input);
  if (!parsed.ok) return errorEnvelope(parsed.code, parsed.message, 422, { headers: cors });
  const lead = parsed.value;

  const hmacSecret = Deno.env.get('LEAD_HMAC_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (hmacSecret.length < 16) {
    console.error('[submit-marketing-lead] HMAC secret is not configured');
    return errorEnvelope('service_unavailable', 'Lead intake is temporarily unavailable.', 503, { headers: cors });
  }

  const today = new Date().toISOString().slice(0, 10);
  const [ipRateKeyHash, emailRateKeyHash, fingerprint] = await Promise.all([
    hmacSha256Hex(`ip:${clientAddress(req)}`, hmacSecret),
    hmacSha256Hex(`email:${lead.contact.email}`, hmacSecret),
    hmacSha256Hex(submissionFingerprintInput(lead, today), hmacSecret),
  ]);
  const db = adminClient();

  // Independent buckets prevent rotating emails from bypassing an IP limit and
  // rotating networks from bypassing an address-specific abuse limit. Both
  // identifiers are HMACs; the raw address and client IP are never persisted.
  const [ipRateResult, emailRateResult] = await Promise.all([
    db.rpc('consume_marketing_lead_rate_limit', {
      p_key_hash: ipRateKeyHash,
      p_window_seconds: 3600,
      p_max_requests: 30,
    }),
    db.rpc('consume_marketing_lead_rate_limit', {
      p_key_hash: emailRateKeyHash,
      p_window_seconds: 3600,
      p_max_requests: 8,
    }),
  ]);
  if (ipRateResult.error || emailRateResult.error) {
    console.error('[submit-marketing-lead] rate limiter unavailable');
    return errorEnvelope('service_unavailable', 'Lead intake is temporarily unavailable.', 503, { headers: cors });
  }
  const ipRate = ipRateResult.data as { allowed?: boolean; retry_after_seconds?: number } | null;
  const emailRate = emailRateResult.data as { allowed?: boolean; retry_after_seconds?: number } | null;
  if (!ipRate?.allowed || !emailRate?.allowed) {
    const retryAfter = Math.max(
      1,
      Number(ipRate?.allowed ? 0 : ipRate?.retry_after_seconds ?? 0),
      Number(emailRate?.allowed ? 0 : emailRate?.retry_after_seconds ?? 0),
    );
    return errorEnvelope('rate_limited', 'Too many requests. Please try again later.', 429, {
      headers: { ...cors, 'Retry-After': String(retryAfter) },
    });
  }

  const { data: existing, error: existingError } = await db
    .from('marketing_leads')
    .select('id')
    .eq('submission_fingerprint', fingerprint)
    .maybeSingle();
  if (existingError) {
    return errorEnvelope('service_unavailable', 'Lead intake is temporarily unavailable.', 503, { headers: cors });
  }
  if (existing) {
    return successEnvelope({ leadId: existing.id, status: 'received' }, { status: 200, headers: cors });
  }

  const { data: inserted, error: insertError } = await db
    .from('marketing_leads')
    .insert({
      request_type: lead.requestType,
      name: lead.contact.name ?? null,
      email: lead.contact.email,
      arrival: lead.layover?.arrival ?? null,
      departure: lead.layover?.departure ?? null,
      flight_numbers: lead.layover?.flightNumbers ?? null,
      interests: lead.layover?.interests ?? null,
      landing_page: lead.landingPage,
      first_attribution: lead.firstAttribution,
      last_attribution: lead.lastAttribution,
      metadata: { schemaVersion: 1 },
      submission_fingerprint: fingerprint,
      rate_limit_key_hash: ipRateKeyHash,
    })
    .select('id')
    .single();

  if (insertError) {
    // A concurrent identical request can win the unique fingerprint race.
    if (insertError.code === '23505') {
      const { data: raced } = await db
        .from('marketing_leads').select('id').eq('submission_fingerprint', fingerprint).maybeSingle();
      if (raced) return successEnvelope({ leadId: raced.id, status: 'received' }, { status: 200, headers: cors });
    }
    console.error('[submit-marketing-lead] insert failed', insertError.code);
    return errorEnvelope('service_unavailable', 'Lead intake is temporarily unavailable.', 503, { headers: cors });
  }

  const notificationWarning = await sendLeadNotification(lead, inserted.id);
  return successEnvelope(
    { leadId: inserted.id, status: 'received' },
    {
      status: 201,
      headers: cors,
      meta: notificationWarning ? { warnings: [notificationWarning] } : undefined,
    },
  );
});
