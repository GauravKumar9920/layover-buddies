import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient } from '../_shared/supabaseAdmin.ts';
import { errorEnvelope, successEnvelope } from '../_shared/apiEnvelope.ts';
import { googleJson } from '../_shared/googleServiceAccount.ts';
import { bearerMatchesDedicatedSecret, constantTimeEqual } from '../_shared/secretAuth.ts';

const WEBMASTERS_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const MAX_BODY_BYTES = 4 * 1024;

interface SearchAnalyticsResponse {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function syncDates(): string[] {
  // GSC is normally delayed. Re-sync three completed provider days so late
  // attribution corrections replace prior directional snapshots atomically.
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return [4, 3, 2].map((daysAgo) => dateOnly(new Date(today.getTime() - daysAgo * 86_400_000)));
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return errorEnvelope('method_not_allowed', 'Use POST.', 405);
  const secret = Deno.env.get('SEARCH_SYNC_SECRET');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || (serviceKey && constantTimeEqual(secret, serviceKey))) {
    console.error('[sync-search-console] dedicated sync secret is not configured safely');
    return errorEnvelope('service_unavailable', 'Search sync is not configured.', 503);
  }
  if (!bearerMatchesDedicatedSecret(req, secret)) {
    return errorEnvelope('unauthorized', 'The sync credential is invalid.', 401);
  }
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return errorEnvelope('payload_too_large', 'Request is too large.', 413);

  const siteUrl = Deno.env.get('SEARCH_CONSOLE_SITE_URL')?.trim();
  if (!siteUrl) return errorEnvelope('provider_unconfigured', 'Search Console is not configured.', 503);
  const searchType = Deno.env.get('SEARCH_CONSOLE_SEARCH_TYPE')?.trim() || 'web';
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const db = adminClient();
  const synced: Array<{ date: string; rows: number }> = [];

  try {
    for (const date of syncDates()) {
      const provider = await googleJson<SearchAnalyticsResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          startDate: date,
          endDate: date,
          dimensions: ['query', 'page', 'device', 'country'],
          searchType,
          dataState: 'final',
          rowLimit: 25000,
          startRow: 0,
        }),
      }, WEBMASTERS_SCOPE);
      const rows = (provider.rows ?? []).map((row) => ({
        query: row.keys?.[0] ?? '',
        page: row.keys?.[1] ?? '',
        device: row.keys?.[2] ?? '',
        country: row.keys?.[3] ?? '',
        clicks: Math.max(0, Math.trunc(Number(row.clicks ?? 0))),
        impressions: Math.max(0, Math.trunc(Number(row.impressions ?? 0))),
        ctr: Math.min(1, Math.max(0, Number(row.ctr ?? 0))),
        position: Math.max(0, Number(row.position ?? 0)),
      }));
      const { data, error } = await db.rpc('replace_search_console_day_tx', {
        p_site_url: siteUrl,
        p_metric_date: date,
        p_search_type: searchType,
        p_rows: rows,
      });
      if (error) throw new Error(`search_snapshot_failed:${error.code ?? 'database'}`);
      synced.push({ date, rows: Number(data ?? 0) });
    }
    await db.from('growth_report_cache').delete().in('report_name', ['overview', 'search', 'health']);
    return successEnvelope({ site: siteUrl, synced, freshnessDate: synced.at(-1)?.date ?? null });
  } catch (error) {
    console.error('[sync-search-console] provider or snapshot failed');
    return errorEnvelope(
      'search_sync_failed',
      'Search Console could not be synchronized. Existing snapshots were preserved for unsynced days.',
      502,
      { meta: { warnings: [error instanceof Error ? error.message.split(':')[0] : 'provider_failed'] } },
    );
  }
});
