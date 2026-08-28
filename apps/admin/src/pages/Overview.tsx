import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Icon from '@/components/Icon';
import { ErrorState, Freshness, LoadingState, UnconfiguredState, Warnings } from '@/components/States';
import { adminRequest } from '@/lib/api';
import { formatDuration, formatPaise, relative } from '@/lib/format';
import { useAdminQuery } from '@/lib/useAdminQuery';
import type { ActionItem, BookingSummary, FunnelStep, OverviewData } from '@/types/admin';

const metricLinks = [
  { key: 'travelers', label: 'Travelers', to: '/marketplace/travelers', tone: 'blue' },
  { key: 'buddies', label: 'Active Buddies', to: '/marketplace/buddies', tone: 'pink' },
  { key: 'openInquiries', label: 'Open inquiries', to: '/operations/inquiries', tone: 'orange' },
  { key: 'activeTrips', label: 'Trips in motion', to: '/operations/live', tone: 'green' },
  { key: 'completedTrips', label: 'Completed trips', to: '/operations/bookings?status=completed', tone: 'navy' },
  { key: 'websiteLeads', label: 'Website leads', to: '/operations/leads', tone: 'purple' },
] as const;

export default function OverviewPage() {
  const mumbaiNow = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const weekday = mumbaiNow.find((part) => part.type === 'weekday')?.value ?? 'Today';
  const hour = Number(mumbaiNow.find((part) => part.type === 'hour')?.value ?? 12);
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const overview = useAdminQuery<OverviewData>(() => adminRequest('overview.get'), []);
  const actions = useAdminQuery(() => adminRequest('actions.list', { pageSize: 50 }), []);
  const actionCoverageDegraded = Boolean(actions.meta.warnings?.length || overview.meta.warnings?.length || overview.error);

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow={`${weekday}, Mumbai`}
        title={`Good ${daypart}. Here’s what needs you.`}
        subtitle="Prioritised by safety, money and traveler wait time—not by which table changed last."
        actions={<button className="secondary-button" onClick={() => { void overview.refresh(); void actions.refresh(); }}><Icon name="refresh" className="h-4 w-4" /> Refresh</button>}
      />
      <div className="page-content space-y-7">
        <Warnings warnings={[...(overview.meta.warnings ?? []), ...(actions.meta.warnings ?? [])]} />

        <section>
          <div className="section-heading">
            <div><p className="eyebrow">Action centre</p><h2 className="section-title">Work the queue</h2></div>
            <Freshness meta={actions.meta} refreshing={actions.refreshing} />
          </div>
          {actions.loading && <LoadingState rows={3} />}
          {actions.error && <ErrorState message={actions.error} onRetry={() => void actions.refresh()} title="Action queue unavailable" />}
          {!actions.loading && !actions.error && actions.data && (
            actions.data.items.length ? <ActionQueue items={actions.data.items} /> : actionCoverageDegraded ? (
              <UnconfiguredState title="Action coverage is degraded" message="No due actions were returned, but at least one source could not be evaluated. Treat the queue as incomplete until the warnings above are cleared." />
            ) : (
              <div className="rounded-2xl border border-success/25 bg-success/5 px-5 py-5">
                <p className="font-heading font-bold text-navy">No actions are currently due</p>
                <p className="mt-1 text-sm text-muted">The queue loaded successfully and every tracked SLA is clear.</p>
              </div>
            )
          )}
        </section>

        <section>
          <div className="section-heading"><div><p className="eyebrow">Marketplace pulse</p><h2 className="section-title">From interest to a great Detour</h2></div><Freshness meta={overview.meta} refreshing={overview.refreshing} /></div>
          {overview.loading && <LoadingState rows={2} />}
          {overview.error && <ErrorState message={overview.error} onRetry={() => void overview.refresh()} title="Marketplace pulse unavailable" />}
          {overview.data && !overview.error && <OverviewMetrics data={overview.data} />}
        </section>

        {overview.data && !overview.error && (
          <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <Funnel steps={overview.data.funnel} />
            <TodayTrips trips={overview.data.todayTrips} />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionQueue({ items }: { items: ActionItem[] }) {
  const sorted = [...items].sort((a, b) => (a.slaSeconds - a.ageSeconds) - (b.slaSeconds - b.ageSeconds));
  return <div className="space-y-2">{sorted.map((item) => {
    const breached = item.ageSeconds >= item.slaSeconds;
    return (
      <Link to={item.href} key={item.id} className={`action-row action-${item.severity}`}>
        <div className="severity-rail" />
        <div className={`action-icon action-icon-${item.severity}`}><Icon name={item.severity === 'critical' ? 'sos' : item.severity === 'high' ? 'warning' : 'clock'} className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-navy">{item.title}</h3><span className={`sla-pill ${breached ? 'sla-breached' : ''}`}>{breached ? 'SLA breached' : `${formatDuration(item.slaSeconds - item.ageSeconds)} left`}</span></div>
          {item.description && <p className="mt-1 truncate text-xs text-muted">{item.description}</p>}
        </div>
        <div className="hidden min-w-28 sm:block"><p className="meta-label">Owner</p><p className="mt-1 text-xs font-semibold text-ink">{item.owner?.name ?? 'Unassigned'}</p></div>
        <div className="hidden min-w-20 md:block"><p className="meta-label">Waiting</p><p className="mt-1 text-xs font-semibold text-ink">{formatDuration(item.ageSeconds)}</p></div>
        <div className="hidden min-w-40 lg:block"><p className="meta-label">Next action</p><p className="mt-1 text-xs font-semibold text-primary-dark">{item.nextAction}</p></div>
        <Icon name="chevron" className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    );
  })}</div>;
}

function OverviewMetrics({ data }: { data: OverviewData }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{metricLinks.map((metric) => (
    <Link key={metric.key} to={metric.to} className="metric-card group">
      <span className={`metric-accent accent-${metric.tone}`} />
      <p className="meta-label">{metric.label}</p>
      <p className="metric-value">{data.metrics[metric.key].toLocaleString('en-IN')}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted group-hover:text-primary-dark">Open view <Icon name="arrow" className="h-3 w-3" /></span>
    </Link>
  ))}</div>;
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start justify-between"><div><p className="eyebrow">Marketplace funnel</p><h3 className="mt-1 font-heading text-lg font-bold">Where people move—or stop</h3></div><Link className="text-link" to="/growth">Growth details <Icon name="arrow" className="h-3.5 w-3.5" /></Link></div>
      <div className="mt-6 space-y-4">{steps.length ? steps.map((step, index) => (
        <div key={step.label} className="grid grid-cols-[100px_1fr_auto] items-center gap-3 sm:grid-cols-[140px_1fr_auto]">
          <p className="truncate text-xs font-semibold text-ink">{step.label}</p>
          <div className="h-2 overflow-hidden rounded-full bg-divider/60"><div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.max(3, step.value / max * 100)}%` }} /></div>
          <p className="num min-w-12 text-right text-sm font-extrabold text-navy">{step.value.toLocaleString('en-IN')}</p>
          {index < steps.length - 1 && steps[index].value > 0 && <p className="col-start-2 -mt-2 text-[10px] text-muted">{Math.round(steps[index + 1].value / steps[index].value * 100)}% continue</p>}
        </div>
      )) : <p className="py-8 text-center text-sm text-muted">Funnel data is not available yet.</p>}</div>
    </section>
  );
}

function TodayTrips({ trips }: { trips: BookingSummary[] }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start justify-between"><div><p className="eyebrow">Today in Mumbai</p><h3 className="mt-1 font-heading text-lg font-bold">Trips to watch</h3></div><Link className="text-link" to="/operations/live">All live <Icon name="arrow" className="h-3.5 w-3.5" /></Link></div>
      <div className="mt-4 divide-y divide-divider">{trips.length ? trips.slice(0, 5).map((trip) => (
        <Link key={trip.id} to={`/operations/bookings/${trip.id}`} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
          <div className="timeline-dot"><span /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy">{trip.traveler?.fullName ?? 'Traveler'} with {trip.buddy?.fullName ?? 'Buddy'}</p><p className="mt-0.5 text-xs text-muted">{trip.tripStartsAt ? relative(trip.tripStartsAt) : 'Time unavailable'} · {trip.status.replace(/_/g, ' ')}</p></div><p className="num text-xs font-semibold">{formatPaise(trip.totalPaise)}</p><Icon name="chevron" className="h-4 w-4 text-muted" />
        </Link>
      )) : <p className="py-10 text-center text-sm text-muted">No trips are scheduled for today.</p>}</div>
    </section>
  );
}
