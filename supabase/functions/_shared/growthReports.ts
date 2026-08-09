export const GROWTH_REPORTS = ['overview', 'acquisition', 'content', 'search', 'health'] as const;
export type GrowthReportName = typeof GROWTH_REPORTS[number];

export interface GrowthRange {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  days: number;
}

export interface GrowthReportRequest {
  report: GrowthReportName;
  startDate: string;
  endDate: string;
  limit: number;
}

export type GrowthRequestResult =
  | { ok: true; value: GrowthReportRequest & { range: GrowthRange } }
  | { ok: false; code: string; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function utcDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseGrowthRequest(value: unknown): GrowthRequestResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, code: 'invalid_request', message: 'Request body must be an object.' };
  }
  const input = value as Record<string, unknown>;
  if (typeof input.report !== 'string' || !GROWTH_REPORTS.includes(input.report as GrowthReportName)) {
    return { ok: false, code: 'unsupported_report', message: 'Use an allowlisted growth report.' };
  }
  if (typeof input.startDate !== 'string' || typeof input.endDate !== 'string') {
    return { ok: false, code: 'invalid_date_range', message: 'startDate and endDate are required.' };
  }
  const start = utcDate(input.startDate);
  const end = utcDate(input.endDate);
  if (!start || !end || start > end) {
    return { ok: false, code: 'invalid_date_range', message: 'Use valid inclusive YYYY-MM-DD dates.' };
  }
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > 366) {
    return { ok: false, code: 'date_range_too_large', message: 'Date ranges are limited to 366 days.' };
  }
  const limit = input.limit === undefined ? 100 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return { ok: false, code: 'invalid_limit', message: 'limit must be an integer from 1 to 500.' };
  }
  const previousEnd = new Date(start.getTime() - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86_400_000);
  const range: GrowthRange = {
    startDate: input.startDate,
    endDate: input.endDate,
    previousStartDate: dateOnly(previousStart),
    previousEndDate: dateOnly(previousEnd),
    days,
  };
  return {
    ok: true,
    value: { report: input.report as GrowthReportName, startDate: input.startDate, endDate: input.endDate, limit, range },
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 10_000) / 100;
}

export interface MetricInput {
  key: string;
  label: string;
  value: number;
  previousValue?: number | null;
  format?: 'number' | 'percent' | 'duration';
}

export function growthMetric(input: MetricInput): Record<string, unknown> {
  const previous = input.previousValue ?? null;
  return {
    key: input.key,
    label: input.label,
    value: Number.isFinite(input.value) ? input.value : 0,
    previousValue: previous,
    changePercent: previous === null ? null : percentChange(input.value, previous),
    ...(input.format ? { format: input.format } : {}),
  };
}

export interface SearchRow {
  query?: string;
  page?: string;
  device?: string;
  country?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function searchOpportunities(rows: SearchRow[], limit = 10): Array<{
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium';
  href?: string;
}> {
  const opportunities: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium';
    href?: string;
  }> = [];
  for (const [index, row] of rows.entries()) {
    const subject = row.query || row.page || 'Search result';
    if (row.impressions >= 100 && row.ctr < 0.02) {
      opportunities.push({
        id: `low-ctr:${index}:${subject}`,
        title: `Improve click-through for ${subject}`,
        description: `${row.impressions.toLocaleString('en-IN')} impressions at ${(row.ctr * 100).toFixed(1)}% CTR. Review title and description without changing intent.`,
        priority: row.impressions >= 500 ? 'high' : 'medium',
        ...(row.page ? { href: row.page } : {}),
      });
    } else if (row.impressions >= 50 && row.position >= 5 && row.position <= 20) {
      opportunities.push({
        id: `near-page-one:${index}:${subject}`,
        title: `Strengthen ${subject}`,
        description: `Average position ${row.position.toFixed(1)} is within striking distance. Add useful local detail and internal links.`,
        priority: row.position <= 10 ? 'high' : 'medium',
        ...(row.page ? { href: row.page } : {}),
      });
    }
    if (opportunities.length >= limit) break;
  }
  return opportunities;
}

export function aggregateSearch(rows: SearchRow[]): { clicks: number; impressions: number; ctr: number; position: number } {
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const weightedPosition = rows.reduce((sum, row) => sum + Number(row.position || 0) * Number(row.impressions || 0), 0);
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
  };
}
