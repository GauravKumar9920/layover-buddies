import { useMemo, useState } from 'react';
import DataTable, { type Column } from '@/components/DataTable';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import Pagination, { type CursorHistory } from '@/components/Pagination';
import { EmptyState, ErrorState, Freshness, LoadingState, UnconfiguredState, Warnings } from '@/components/States';
import StatusBadge from '@/components/StatusBadge';
import { adminRequest, growthRequest } from '@/lib/api';
import { formatCompact, formatDateTime, formatPercent } from '@/lib/format';
import { useAdminQuery } from '@/lib/useAdminQuery';
import type { DeploymentSummary, GrowthMetric, GrowthReportData, GrowthRow, PageData } from '@/types/admin';

type Report = GrowthReportData['report'];

function dateRange(days: number) {
  const end = new Date();
  const start = new Date(); start.setUTCDate(start.getUTCDate() - days + 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function GrowthPage() {
  const [period, setPeriod] = useState<7 | 28 | 90>(28);
  const [report, setReport] = useState<Report>('overview');
  const range = useMemo(() => dateRange(period), [period]);
  const analytics = useAdminQuery<GrowthReportData>(() => growthRequest({ report, ...range, limit: 100 }), [report, range.startDate, range.endDate]);
  const dynamicColumns = useMemo<Column<GrowthRow>[]>(() => {
    const first = analytics.data?.rows[0];
    if (!first) return [];
    return [
      ...Object.keys(first.dimensions).map((key): Column<GrowthRow> => ({ key: `d:${key}`, header: key.replace(/_/g, ' '), render: (row) => <span className="max-w-64 break-words text-xs font-semibold">{row.dimensions[key] || '—'}</span> })),
      ...Object.keys(first.metrics).map((key): Column<GrowthRow> => ({ key: `m:${key}`, header: key.replace(/_/g, ' '), align: 'right', numeric: true, render: (row) => <span className="text-xs font-bold">{metricValue(key, row.metrics[key])}</span> })),
    ];
  }, [analytics.data]);

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Growth & content" title="Website analytics" subtitle="GA4, Search Console and Detour outcomes—organised around decisions, with freshness and provider gaps kept visible." actions={<Freshness meta={analytics.meta} refreshing={analytics.refreshing} />} />
      <div className="page-content space-y-6">
        <div className="toolbar">
          <div className="filter-tabs">{(['overview', 'acquisition', 'content', 'search', 'health'] as Report[]).map((value) => <button key={value} className={report === value ? 'active' : ''} onClick={() => setReport(value)}>{value}</button>)}</div>
          <div className="filter-tabs">{([7, 28, 90] as const).map((value) => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value} days</button>)}</div>
        </div>
        <Warnings warnings={analytics.meta.warnings} />
        {analytics.loading && <LoadingState rows={4} />}
        {analytics.error && <ErrorState title={`${report} report unavailable`} message={analytics.error} onRetry={() => void analytics.refresh()} />}
        {analytics.data && !analytics.error && (
          <>
            {analytics.data.providers?.length ? <ProviderStrip providers={analytics.data.providers} /> : null}
            {analytics.data.metrics.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{analytics.data.metrics.map((metric) => <GrowthMetricCard key={metric.key} metric={metric} />)}</div> : <UnconfiguredState title="No metrics returned" message="The provider is reachable, but this report has no configured metric set for the selected period." />}
            {analytics.data.funnel?.length ? <section className="card p-5 sm:p-6"><p className="eyebrow">Traffic to trip</p><h2 className="section-title mt-1">One connected funnel</h2><div className="mt-6 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">{analytics.data.funnel.map((step, index) => <div key={step.label} className="relative rounded-xl border border-divider bg-cream/50 p-4"><p className="meta-label">{step.label}</p><p className="metric-value">{step.value.toLocaleString('en-IN')}</p>{index < (analytics.data?.funnel?.length ?? 0) - 1 && <Icon name="chevron" className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-white text-muted shadow sm:block" />}</div>)}</div></section> : null}
            {analytics.data.opportunities?.length ? <section><div className="section-heading"><div><p className="eyebrow">Recommended actions</p><h2 className="section-title">Opportunities worth taking</h2></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{analytics.data.opportunities.map((opportunity) => <article key={opportunity.id} className={`card border-l-4 p-5 opportunity-${opportunity.priority}`}><div className="flex items-center justify-between"><StatusBadge value={opportunity.priority} />{opportunity.href && <a className="text-link" href={opportunity.href}>Open <Icon name="external" className="h-3 w-3" /></a>}</div><h3 className="mt-3 font-heading text-base font-bold">{opportunity.title}</h3><p className="mt-2 text-xs leading-5 text-muted">{opportunity.description}</p></article>)}</div></section> : null}
            {analytics.data.rows.length ? <section><div className="section-heading"><div><p className="eyebrow">Report detail</p><h2 className="section-title capitalize">{report} breakdown</h2></div><span className="text-xs text-muted">Current period vs equal previous period</span></div><DataTable columns={dynamicColumns} rows={analytics.data.rows} rowKey={(row) => JSON.stringify(row.dimensions)} /></section> : <EmptyState title="No detailed rows" message="The report loaded successfully, but no rows exist for this period." />}
          </>
        )}
      </div>
    </div>
  );
}

export function ContentPage() {
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const deployments = useAdminQuery<PageData<DeploymentSummary>>(() => adminRequest('content.deployments.list', { cursor: cursor.current, pageSize: 30 }), [cursor.current]);
  const studioUrl = import.meta.env.VITE_SANITY_STUDIO_URL?.trim();
  const studioDocumentUrl = (documentId: string) => studioUrl ? `${studioUrl.replace(/\/$/, '')}/intent/edit/id=${encodeURIComponent(documentId)}` : null;
  const columns: Column<DeploymentSummary>[] = [
    { key: 'document', header: 'Content', render: (row) => <div>{row.documentId && studioDocumentUrl(row.documentId) ? <a className="inline-flex items-center gap-1 font-semibold text-navy hover:text-primary" href={studioDocumentUrl(row.documentId) ?? '#'} target="_blank" rel="noreferrer">{row.documentTitle ?? row.documentId}<Icon name="external" className="h-3 w-3" /></a> : <p className="font-semibold text-navy">{row.documentTitle ?? row.documentId ?? 'Website publish'}</p>}<p className="mt-0.5 text-[10px] text-muted">{row.version ?? row.id.slice(0, 8)}</p></div> },
    { key: 'status', header: 'Deployment', width: '130px', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'person', header: 'Requested by', width: '160px', render: (row) => <span className="text-xs">{row.requestedBy?.fullName ?? row.requestedBy?.email ?? 'System'}</span> },
    { key: 'time', header: 'Requested', width: '180px', render: (row) => <span className="text-xs text-muted">{formatDateTime(row.requestedAt)}</span> },
    { key: 'error', header: 'Result', render: (row) => row.error ? <span className="text-xs text-danger">{row.error}</span> : row.completedAt ? <span className="text-xs text-success">Completed {formatDateTime(row.completedAt)}</span> : <span className="text-xs text-muted">In progress</span> },
    { key: 'links', header: '', width: '120px', align: 'right', render: (row) => row.previewUrl || row.productionUrl ? <a className="text-link" href={row.previewUrl ?? row.productionUrl ?? '#'} target="_blank" rel="noreferrer">Open <Icon name="external" className="h-3 w-3" /></a> : <span className="text-xs text-muted">—</span> },
  ];
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Growth & content" title="Publishing" subtitle="Structured editing lives in Sanity; this console tracks deploy state, preview parity and production failures." actions={studioUrl ? <a className="primary-button" href={studioUrl} target="_blank" rel="noreferrer">Open Sanity Studio <Icon name="external" className="h-4 w-4" /></a> : undefined} />
      <div className="page-content space-y-5">
        {!studioUrl && <UnconfiguredState title="Sanity Studio URL not configured" message="Set VITE_SANITY_STUDIO_URL to give editors a direct route to drafts, previews and revision history. Content deployments can still be monitored below." />}
        <div className="grid gap-4 md:grid-cols-3"><WorkflowStep number="01" title="Draft in Sanity" body="Editors change bounded content and SEO fields." /><WorkflowStep number="02" title="Preview on Vercel" body="Verify routes, copy, metadata and layout before publish." /><WorkflowStep number="03" title="Publish & monitor" body="One webhook creates one deployment with visible status." /></div>
        <section><div className="section-heading"><div><p className="eyebrow">Deployment history</p><h2 className="section-title">What reached the website</h2></div><Freshness meta={deployments.meta} refreshing={deployments.refreshing} /></div><Warnings warnings={deployments.meta.warnings} />{deployments.error && <ErrorState title="Deployment history unavailable" message={deployments.error} onRetry={() => void deployments.refresh()} />}{!deployments.error && <DataTable columns={columns} rows={deployments.data?.items ?? []} rowKey={(row) => row.id} loading={deployments.loading} emptyMessage="No content deployments have been recorded yet." />}{!deployments.error && deployments.data && <Pagination count={deployments.data.items.length} history={{ ...cursor, next: deployments.meta.nextCursor }} onChange={setCursor} />}</section>
      </div>
    </div>
  );
}

function GrowthMetricCard({ metric }: { metric: GrowthMetric }) {
  const change = metric.changePercent;
  return <div className="metric-card"><p className="meta-label">{metric.label}</p><p className="metric-value">{metric.format === 'percent' ? formatPercent(metric.value) : formatCompact(metric.value)}</p>{change != null && <p className={`mt-2 text-[11px] font-bold ${change > 0 ? 'text-success' : change < 0 ? 'text-danger' : 'text-muted'}`}>{formatPercent(change, true)} <span className="font-normal text-muted">vs previous</span></p>}{change == null && <p className="mt-2 text-[11px] text-muted">No comparison</p>}</div>;
}

function ProviderStrip({ providers }: { providers: NonNullable<GrowthReportData['providers']> }) {
  return <section className="card flex flex-wrap gap-x-8 gap-y-3 px-5 py-4">{providers.map((provider) => <div key={provider.name} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full provider-${provider.state}`} /><div><p className="text-xs font-bold text-navy">{provider.name}</p><p className="text-[10px] text-muted">{provider.message ?? (provider.updatedAt ? `Updated ${formatDateTime(provider.updatedAt)}` : provider.state)}</p></div></div>)}</section>;
}

function WorkflowStep({ number, title, body }: { number: string; title: string; body: string }) { return <article className="card p-5"><span className="font-mono text-xs font-bold text-primary">{number}</span><h2 className="mt-3 font-heading text-base font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted">{body}</p></article>; }

function metricValue(key: string, value: number): string { const normalized = key.toLowerCase(); if (normalized.includes('ctr') || normalized.includes('rate') || normalized.includes('percent')) return formatPercent(value); if (normalized.includes('position')) return value.toLocaleString('en-IN', { maximumFractionDigits: 1 }); return formatCompact(value); }
