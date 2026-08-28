import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateAdmin } from '../_shared/adminAuth.ts';
import { errorEnvelope, successEnvelope } from '../_shared/apiEnvelope.ts';
import {
  aggregateSearch,
  growthMetric,
  parseGrowthRequest,
  searchOpportunities,
  type GrowthRange,
  type SearchRow,
} from '../_shared/growthReports.ts';
import { googleCredentials, googleJson } from '../_shared/googleServiceAccount.ts';

const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const MAX_BODY_BYTES = 16 * 1024;

interface GaResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
}

type Row = Record<string, any>;

function rangeTimes(startDate: string, endDate: string): { start: string; endExclusive: string } {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: `${startDate}T00:00:00.000Z`, endExclusive: end.toISOString() };
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function gaReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  metrics: string[],
  limit = 100,
): Promise<Array<{ dimensions: Record<string, string>; metrics: Record<string, number> }>> {
  const response = await googleJson<GaResponse>(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: 'POST',
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
        limit: String(limit),
        keepEmptyRows: false,
      }),
    },
    ANALYTICS_SCOPE,
  );
  return (response.rows ?? []).map((row) => ({
    dimensions: Object.fromEntries(dimensions.map((name, index) => [name, row.dimensionValues?.[index]?.value ?? '(not set)'])),
    metrics: Object.fromEntries(metrics.map((name, index) => [name, number(row.metricValues?.[index]?.value)])),
  }));
}

function gaTotals(rows: Array<{ metrics: Record<string, number> }>): Record<string, number> {
  return rows[0]?.metrics ?? {};
}

function eventCounts(rows: Array<{ dimensions: Record<string, string>; metrics: Record<string, number> }>): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.dimensions.eventName, number(row.metrics.eventCount)]));
}

async function detourCounts(db: any, startDate: string, endDate: string): Promise<{ values: Record<string, number>; ok: boolean }> {
  const range = rangeTimes(startDate, endDate);
  const results = await Promise.all([
    db.from('marketing_leads').select('id', { count: 'exact', head: true }).gte('created_at', range.start).lt('created_at', range.endExclusive),
    db.from('marketing_leads').select('id', { count: 'exact', head: true }).gte('qualified_at', range.start).lt('qualified_at', range.endExclusive),
    db.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', range.start).lt('created_at', range.endExclusive),
    db.from('bookings').select('id', { count: 'exact', head: true }).gte('completed_at', range.start).lt('completed_at', range.endExclusive),
    db.from('reviews').select('id', { count: 'exact', head: true }).gte('created_at', range.start).lt('created_at', range.endExclusive),
    db.from('marketing_leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);
  if (results.some((result) => result.error)) return { values: {}, ok: false };
  return {
    ok: true,
    values: {
      leads: results[0].count ?? 0,
      qualifiedLeads: results[1].count ?? 0,
      bookings: results[2].count ?? 0,
      completedTrips: results[3].count ?? 0,
      reviews: results[4].count ?? 0,
      unansweredLeads: results[5].count ?? 0,
    },
  };
}

async function searchReport(db: any, startDate: string, endDate: string, limit: number): Promise<Row | null> {
  const { data, error } = await db.rpc('admin_search_console_report', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
  });
  return error ? null : data as Row;
}

function provider(name: string, state: string, extra: Row = {}): Row {
  return { name, state, ...extra };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorEnvelope('method_not_allowed', 'Use POST.', 405);
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return errorEnvelope('payload_too_large', 'Request is too large.', 413);

  let input: unknown;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return errorEnvelope('payload_too_large', 'Request is too large.', 413);
    input = JSON.parse(raw);
  } catch {
    return errorEnvelope('invalid_json', 'Request body is not valid JSON.', 400);
  }
  const parsed = parseGrowthRequest(input);
  if (!parsed.ok) return errorEnvelope(parsed.code, parsed.message, 400);
  const auth = await authenticateAdmin(req, { requireAal2: true, allowedRoles: ['owner', 'growth'] });
  if (!auth.ok) return errorEnvelope(auth.code, auth.message, auth.status);

  const { report, range, limit } = parsed.value;
  const db = auth.db;
  const { data: cached } = await db.from('growth_report_cache')
    .select('payload,warnings,generated_at,expires_at')
    .eq('report_name', report).eq('provider', 'detour')
    .eq('start_date', range.startDate).eq('end_date', range.endDate)
    .gt('expires_at', new Date().toISOString()).maybeSingle();
  if (cached?.payload) {
    return successEnvelope(cached.payload, {
      meta: { warnings: cached.warnings ?? [], freshness: { cache: cached.generated_at } },
    });
  }

  const warnings: string[] = [];
  const providers: Row[] = [];
  const metrics: Row[] = [];
  const rows: Row[] = [];
  const opportunities: Row[] = [];
  let funnel: Row[] | undefined;
  const freshness: Record<string, string | null> = {};

  const [detourCurrent, detourPrevious] = await Promise.all([
    detourCounts(db, range.startDate, range.endDate),
    detourCounts(db, range.previousStartDate, range.previousEndDate),
  ]);
  if (detourCurrent.ok && detourPrevious.ok) {
    providers.push(provider('Detour', 'healthy'));
    for (const [key, label] of [
      ['leads', 'Website leads'], ['qualifiedLeads', 'Qualified leads'], ['bookings', 'Bookings'],
      ['completedTrips', 'Completed trips'], ['reviews', 'Reviews'],
    ] as const) {
      metrics.push(growthMetric({ key, label, value: detourCurrent.values[key], previousValue: detourPrevious.values[key] }));
    }
    if (detourCurrent.values.unansweredLeads > 0) opportunities.push({
      id: 'unanswered-leads', title: `${detourCurrent.values.unansweredLeads} website lead(s) need a reply`,
      description: 'Assign an owner and respond within the four-hour SLA.', priority: 'high', href: '/operations/leads',
    });
    if (report === 'acquisition') {
      const { data: acquisition, error: acquisitionError } = await db.rpc('admin_marketing_attribution_report', {
        p_start_date: range.startDate,
        p_end_date: range.endDate,
        p_limit: limit,
      });
      if (acquisitionError) warnings.push('detour_attribution_unavailable');
      else rows.push(...(((acquisition as Row | null)?.rows ?? []) as Row[]));
    }
  } else {
    providers.push(provider('Detour', 'failed', { message: 'Marketplace conversion data is unavailable.' }));
    warnings.push('detour_conversion_unavailable');
  }

  const [searchCurrent, searchPrevious] = await Promise.all([
    searchReport(db, range.startDate, range.endDate, limit),
    searchReport(db, range.previousStartDate, range.previousEndDate, limit),
  ]);
  if (searchCurrent && searchPrevious) {
    const currentSearchRows = (searchCurrent.rows ?? []).map((row: Row) => ({
      query: row.query, page: row.page, device: row.device, country: row.country,
      clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), position: number(row.position),
    })) as SearchRow[];
    const currentTotals = aggregateSearch(currentSearchRows.length ? currentSearchRows : [{
      clicks: number(searchCurrent.totals?.clicks), impressions: number(searchCurrent.totals?.impressions),
      ctr: number(searchCurrent.totals?.ctr), position: number(searchCurrent.totals?.position),
    }]);
    const previousTotals = searchPrevious.totals ?? {};
    metrics.push(
      growthMetric({ key: 'searchClicks', label: 'Search clicks', value: number(searchCurrent.totals?.clicks ?? currentTotals.clicks), previousValue: number(previousTotals.clicks) }),
      growthMetric({ key: 'searchImpressions', label: 'Search impressions', value: number(searchCurrent.totals?.impressions ?? currentTotals.impressions), previousValue: number(previousTotals.impressions) }),
      growthMetric({ key: 'searchCtr', label: 'Search CTR', value: number(searchCurrent.totals?.ctr ?? currentTotals.ctr), previousValue: number(previousTotals.ctr), format: 'percent' }),
      growthMetric({ key: 'searchPosition', label: 'Average position', value: number(searchCurrent.totals?.position ?? currentTotals.position), previousValue: number(previousTotals.position) }),
    );
    if (report === 'search' || report === 'overview') {
      if (report === 'search') rows.push(...currentSearchRows.map((row) => ({
        dimensions: { query: row.query ?? '', page: row.page ?? '', device: row.device ?? '', country: row.country ?? '' },
        metrics: { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position },
      })));
      opportunities.push(...searchOpportunities(currentSearchRows));
    }
    freshness.searchConsole = searchCurrent.syncedAt ?? null;
    providers.push(provider('Search Console', searchCurrent.syncedAt ? 'healthy' : 'unconfigured', {
      dataAvailableSince: searchCurrent.dataAvailableSince ?? null,
      updatedAt: searchCurrent.syncedAt ?? null,
      message: searchCurrent.syncedAt ? 'Detailed rows are directional and provider-delayed.' : 'No synchronized data yet.',
    }));
  } else {
    providers.push(provider('Search Console', 'failed', { message: 'Stored search snapshots are unavailable.' }));
    warnings.push('search_console_unavailable');
  }

  const propertyId = Deno.env.get('GA4_PROPERTY_ID')?.trim();
  if (!propertyId || !googleCredentials()) {
    providers.push(provider('GA4', 'unconfigured', { message: 'Add the numeric property ID and read-only service account.' }));
    warnings.push('ga4_unconfigured');
  } else {
    try {
      const totalMetrics = ['totalUsers', 'sessions', 'engagedSessions', 'screenPageViews'];
      const [currentTotalsRows, previousTotalsRows, currentEvents, previousEvents] = await Promise.all([
        gaReport(propertyId, range.startDate, range.endDate, [], totalMetrics, 1),
        gaReport(propertyId, range.previousStartDate, range.previousEndDate, [], totalMetrics, 1),
        gaReport(propertyId, range.startDate, range.endDate, ['eventName'], ['eventCount'], 100),
        gaReport(propertyId, range.previousStartDate, range.previousEndDate, ['eventName'], ['eventCount'], 100),
      ]);
      const current = gaTotals(currentTotalsRows);
      const previous = gaTotals(previousTotalsRows);
      const events = eventCounts(currentEvents);
      const previousEventCounts = eventCounts(previousEvents);
      metrics.push(
        growthMetric({ key: 'users', label: 'Users', value: number(current.totalUsers), previousValue: number(previous.totalUsers) }),
        growthMetric({ key: 'sessions', label: 'Sessions', value: number(current.sessions), previousValue: number(previous.sessions) }),
        growthMetric({ key: 'engagedSessions', label: 'Engaged sessions', value: number(current.engagedSessions), previousValue: number(previous.engagedSessions) }),
        growthMetric({ key: 'views', label: 'Views', value: number(current.screenPageViews), previousValue: number(previous.screenPageViews) }),
        growthMetric({ key: 'formStarts', label: 'Form starts', value: number(events.form_start), previousValue: number(previousEventCounts.form_start) }),
        growthMetric({ key: 'gaLeads', label: 'Confirmed lead events', value: number(events.generate_lead), previousValue: number(previousEventCounts.generate_lead) }),
      );
      if (report === 'acquisition') {
        const acquisition = await gaReport(propertyId, range.startDate, range.endDate,
          ['sessionSource', 'sessionMedium', 'sessionCampaignName', 'country', 'deviceCategory'],
          ['sessions', 'engagedSessions', 'totalUsers'], limit);
        rows.push(...acquisition.map((row) => ({
          dimensions: { provider: 'ga4', ...row.dimensions }, metrics: row.metrics,
        })));
      } else if (report === 'content') {
        rows.push(...await gaReport(propertyId, range.startDate, range.endDate,
          ['landingPagePlusQueryString', 'pageTitle'], ['sessions', 'screenPageViews', 'totalUsers', 'engagementRate'], limit));
      }
      funnel = [
        { label: 'Sessions', value: number(current.sessions) },
        { label: 'Form starts', value: number(events.form_start) },
        { label: 'Leads', value: detourCurrent.ok ? detourCurrent.values.leads : number(events.generate_lead) },
        { label: 'Qualified leads', value: detourCurrent.values.qualifiedLeads ?? 0 },
        { label: 'Bookings', value: detourCurrent.values.bookings ?? 0 },
        { label: 'Completed trips', value: detourCurrent.values.completedTrips ?? 0 },
        { label: 'Reviews', value: detourCurrent.values.reviews ?? 0 },
      ];
      if (detourCurrent.ok && detourCurrent.values.leads > 0 && number(events.generate_lead) === 0) opportunities.push({
        id: 'missing-generate-lead', title: 'Lead tracking is missing',
        description: 'Detour received leads, but GA4 recorded no generate_lead event after server confirmation.',
        priority: 'high', href: '/growth/health',
      });
      providers.push(provider('GA4', 'healthy', { updatedAt: new Date().toISOString() }));
      freshness.ga4 = new Date().toISOString();
    } catch {
      providers.push(provider('GA4', 'failed', { message: 'GA4 did not return the fixed report.' }));
      warnings.push('ga4_unavailable');
    }
  }

  const data = {
    report,
    metrics: report === 'health' ? [] : metrics,
    rows: report === 'overview' || report === 'health' ? [] : rows,
    ...(funnel && report === 'overview' ? { funnel } : {}),
    ...(opportunities.length && (report === 'overview' || report === 'search' || report === 'health')
      ? { opportunities: opportunities.slice(0, 20) } : {}),
    providers,
  };
  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error: cacheError } = await db.from('growth_report_cache').upsert({
    report_name: report,
    provider: 'detour',
    start_date: range.startDate,
    end_date: range.endDate,
    payload: data,
    warnings,
    generated_at: generatedAt,
    expires_at: expiresAt,
  }, { onConflict: 'report_name,provider,start_date,end_date' });
  if (cacheError) warnings.push('growth_cache_write_failed');
  return successEnvelope(data, { meta: { warnings, freshness } });
});
