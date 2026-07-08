// ============================================================================
// SOS ALERT DELIVERY — pure, fetch-injectable helpers
// ============================================================================
// The SafetyBar promises an SOS "immediately notifies the Detour ops team".
// Before this, an SOS only wrote a `sos_alerts` row whose sole consumer was a
// never-deployed local admin console — nobody was actually paged. These helpers
// turn that row into an out-of-band alert (webhook + email), because the ops
// team is NOT an app user with a push token.
//
// Design goals:
//   • Never throw on missing/failed delivery config. An SOS must degrade
//     loudly-in-logs but gracefully-in-behaviour — a broken Slack webhook must
//     not blow up the whole handler and lose the other channel.
//   • Pure + fetch-injected so every branch is unit-testable in Deno without
//     network or env access.
// ============================================================================

export interface SosContext {
  alertId: string;
  bookingId: string;
  latitude: number;
  longitude: number;
  triggeredAt: string | null;
  /** Display name of the person who hit SOS. */
  triggeredByName: string;
  /** 'traveler' | 'guide' | 'unknown' — role of the person who hit SOS. */
  triggeredByRole: string;
  /** The other party on the trip, for context. */
  counterpartName: string;
  tourName: string | null;
  city: string | null;
  /** Booking start date (ISO) if known. */
  startDate: string | null;
}

export interface SosDeliveryConfig {
  /** Generic JSON webhook (Slack/Discord/Zapier compatible). */
  webhookUrl?: string;
  /** Resend API key for email delivery. */
  resendApiKey?: string;
  /** Destination inbox for SOS emails (comma-separated allowed). */
  alertEmail?: string;
  /** From address for SOS emails; defaults to a detourtrips.com sender. */
  alertFrom?: string;
  /** Admin console base URL, linked in the alert for one-tap triage. */
  adminUrl?: string;
}

export interface SosDeliveryResult {
  delivered: string[];
  failed: Array<{ channel: string; reason: string }>;
  /** Set when no channel was configured at all. */
  skipped?: string;
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Build the human-readable message shared across channels. */
export function buildSosOpsMessage(ctx: SosContext): { subject: string; text: string; html: string } {
  const who = `${ctx.triggeredByName} (${ctx.triggeredByRole})`;
  const tour = ctx.tourName ? ctx.tourName : 'a trip';
  const cityPart = ctx.city ? ` in ${ctx.city}` : '';
  const link = mapsLink(ctx.latitude, ctx.longitude);
  const when = ctx.triggeredAt ?? 'just now';
  const coords = `${ctx.latitude}, ${ctx.longitude}`;

  const subject = `🚨 SOS — ${ctx.triggeredByName} on ${tour}${cityPart}`;

  const lines = [
    '🚨 SOS ALERT — a Detour user needs help.',
    '',
    `Triggered by: ${who}`,
    `With: ${ctx.counterpartName}`,
    `Trip: ${tour}${cityPart}`,
    ctx.startDate ? `Trip date: ${ctx.startDate}` : null,
    `Time: ${when}`,
    `Location: ${coords}`,
    `Map: ${link}`,
    '',
    `Booking: ${ctx.bookingId}`,
    `SOS id: ${ctx.alertId}`,
    'Acknowledge / resolve this in the admin SOS console.',
  ].filter((l): l is string => l !== null);

  const text = lines.join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.5;color:#0B1229">
      <h2 style="color:#C0392B;margin:0 0 8px">🚨 SOS Alert</h2>
      <p style="margin:0 0 12px">A Detour user needs help.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:2px 12px 2px 0;color:#6B7280">Triggered by</td><td>${escapeHtml(who)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6B7280">With</td><td>${escapeHtml(ctx.counterpartName)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6B7280">Trip</td><td>${escapeHtml(tour + cityPart)}</td></tr>
        ${ctx.startDate ? `<tr><td style="padding:2px 12px 2px 0;color:#6B7280">Trip date</td><td>${escapeHtml(ctx.startDate)}</td></tr>` : ''}
        <tr><td style="padding:2px 12px 2px 0;color:#6B7280">Time</td><td>${escapeHtml(when)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6B7280">Location</td><td><a href="${link}">${escapeHtml(coords)}</a></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6B7280">Booking</td><td>${escapeHtml(ctx.bookingId)}</td></tr>
      </table>
      <p style="margin:12px 0 0"><a href="${link}" style="color:#C0392B;font-weight:600">Open location in Google Maps →</a></p>
    </div>`.trim();

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Deliver the SOS to every configured channel. Each channel's failure is
 * isolated — one broken channel never suppresses another, and the function
 * never throws. Returns a per-channel report the caller can log and return.
 */
export async function deliverSosAlert(args: {
  ctx: SosContext;
  config: SosDeliveryConfig;
  fetchFn: typeof fetch;
}): Promise<SosDeliveryResult> {
  const { ctx, config, fetchFn } = args;
  const msg = buildSosOpsMessage(ctx);
  const result: SosDeliveryResult = { delivered: [], failed: [] };

  const hasWebhook = !!config.webhookUrl;
  const hasEmail = !!config.resendApiKey && !!config.alertEmail;

  if (!hasWebhook && !hasEmail) {
    result.skipped = 'no_channel_configured';
    return result;
  }

  if (hasWebhook) {
    try {
      const res = await fetchFn(config.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `text` satisfies Slack/Discord/Mattermost; the structured fields let
        // Zapier/Make and custom consumers route on the raw data.
        body: JSON.stringify({
          text: msg.text,
          sos: {
            alert_id: ctx.alertId,
            booking_id: ctx.bookingId,
            triggered_by: ctx.triggeredByName,
            role: ctx.triggeredByRole,
            latitude: ctx.latitude,
            longitude: ctx.longitude,
            maps_url: mapsLink(ctx.latitude, ctx.longitude),
            triggered_at: ctx.triggeredAt,
          },
        }),
      });
      if (res.ok) result.delivered.push('webhook');
      else result.failed.push({ channel: 'webhook', reason: `http_${res.status}` });
    } catch (err) {
      result.failed.push({ channel: 'webhook', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  if (hasEmail) {
    try {
      const to = config.alertEmail!.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.resendApiKey}`,
        },
        body: JSON.stringify({
          from: config.alertFrom || 'Detour SOS <sos@detourtrips.com>',
          to,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        }),
      });
      if (res.ok) result.delivered.push('email');
      else result.failed.push({ channel: 'email', reason: `http_${res.status}` });
    } catch (err) {
      result.failed.push({ channel: 'email', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}

/** Read delivery config from the Deno environment. */
export function sosConfigFromEnv(env: { get(key: string): string | undefined }): SosDeliveryConfig {
  return {
    webhookUrl: env.get('SOS_WEBHOOK_URL') || undefined,
    resendApiKey: env.get('RESEND_API_KEY') || undefined,
    alertEmail: env.get('SOS_ALERT_EMAIL') || undefined,
    alertFrom: env.get('SOS_ALERT_FROM') || undefined,
    adminUrl: env.get('ADMIN_CONSOLE_URL') || undefined,
  };
}
