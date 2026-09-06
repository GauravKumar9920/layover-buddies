import { useEffect, useState } from 'react';
import CommandDialog from '@/components/CommandDialog';
import DataTable, { type Column } from '@/components/DataTable';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import Pagination, { type CursorHistory } from '@/components/Pagination';
import { ErrorState, Freshness, UnconfiguredState, Warnings } from '@/components/States';
import StatusBadge from '@/components/StatusBadge';
import { adminRequest, idempotencyKey } from '@/lib/api';
import { formatDateTime, relative } from '@/lib/format';
import { useAdminQuery } from '@/lib/useAdminQuery';
import type { PageData, ReportSummary, SosSummary } from '@/types/admin';
import { useAuth } from '@/auth/AuthProvider';
import { canMutate } from '@/lib/permissions';
import { getSupabase } from '@/lib/supabase';

const PAGE_SIZE = 30;

export function SosPage() {
  const { admin } = useAuth();
  const canUpdate = canMutate(admin?.role, 'safety');
  const [status, setStatus] = useState('open');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const [selected, setSelected] = useState<SosSummary | null>(null);
  const [targetStatus, setTargetStatus] = useState<'acknowledged' | 'resolved'>('acknowledged');
  const [realtimeState, setRealtimeState] = useState<'connecting' | 'live' | 'degraded'>('connecting');
  const alerts = useAdminQuery<PageData<SosSummary>>(() => adminRequest('sos.list', { cursor: cursor.current, pageSize: PAGE_SIZE, status: status === 'all' ? undefined : status }), [cursor.current, status]);

  useEffect(() => {
    let active = true;
    const client = getSupabase();
    const channel = client
      .channel('admin-sos-signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_realtime_signals', filter: 'topic=eq.sos' },
        () => { void alerts.refresh(); },
      )
      .subscribe((subscriptionStatus) => {
        if (!active) return;
        if (subscriptionStatus === 'SUBSCRIBED') setRealtimeState('live');
        else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT' || subscriptionStatus === 'CLOSED') setRealtimeState('degraded');
      });
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [alerts.refresh]);
  const columns: Column<SosSummary>[] = [
    { key: 'alert', header: 'Alert', render: (alert) => <div><p className="font-mono text-xs font-bold text-danger">SOS {alert.id.slice(0, 8)}</p><p className="mt-1 text-xs text-muted">Trip {alert.bookingId.slice(0, 8)}</p></div> },
    { key: 'person', header: 'Triggered by', render: (alert) => <div><p className="text-sm font-semibold">{alert.triggeredBy?.fullName ?? 'Member unavailable'}</p><p className="text-xs capitalize text-muted">{alert.triggeredBy?.role ?? 'role unavailable'}</p></div> },
    { key: 'status', header: 'Response', width: '140px', render: (alert) => <StatusBadge value={alert.status} /> },
    { key: 'dispatch', header: 'Paging', width: '150px', render: (alert) => <div><StatusBadge value={alert.dispatchStatus} /><p className="mt-1 text-[10px] text-muted">{alert.dispatchAttempts ?? 0} attempts</p></div> },
    { key: 'time', header: 'Triggered', width: '160px', render: (alert) => <div><p className="text-xs font-semibold text-danger">{relative(alert.triggeredAt)}</p><p className="text-[10px] text-muted">{formatDateTime(alert.triggeredAt)}</p></div> },
    { key: 'location', header: 'Location', width: '110px', render: (alert) => alert.latitude != null && alert.longitude != null ? <a className="text-link" href={`https://www.google.com/maps?q=${encodeURIComponent(`${alert.latitude},${alert.longitude}`)}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open map <Icon name="external" className="h-3 w-3" /></a> : <span className="text-xs text-muted">Protected</span> },
    { key: 'action', header: '', width: '150px', align: 'right', render: (alert) => alert.status !== 'resolved' && canUpdate ? <button className={alert.status === 'triggered' ? 'danger-button compact' : 'secondary-button compact'} onClick={(event) => { event.stopPropagation(); setSelected(alert); setTargetStatus(alert.status === 'triggered' ? 'acknowledged' : 'resolved'); }}>{alert.status === 'triggered' ? 'Acknowledge' : 'Resolve'}</button> : <span className="text-xs text-muted">{alert.status === 'resolved' ? 'Resolved' : 'View only'}</span> },
  ];
  async function transition(reason: string) {
    if (!selected) return;
    await adminRequest('sos.transition', { id: selected.id, status: targetStatus, reason, resolutionNotes: targetStatus === 'resolved' ? reason : undefined, idempotencyKey: idempotencyKey('sos', selected.id) });
    await alerts.refresh();
  }
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Trust & safety" title="SOS alerts" subtitle="Emergency facts, paging delivery and human ownership. Treat every triggered alert as immediate." actions={<><span className={`live-indicator ${realtimeState === 'degraded' ? 'live-indicator-degraded' : ''}`}><span /> {realtimeState === 'live' ? 'Realtime watch' : realtimeState === 'connecting' ? 'Connecting' : 'Realtime degraded'}</span><Freshness meta={alerts.meta} refreshing={alerts.refreshing} /></>} />
      <div className="page-content space-y-4">
        <div className="rounded-2xl border border-danger/25 bg-danger/5 px-5 py-4"><div className="flex gap-3"><Icon name="sos" className="h-5 w-5 shrink-0 text-danger" /><div><p className="text-sm font-bold text-navy">Emergency operating rule</p><p className="mt-1 text-xs leading-5 text-muted">Acknowledge confirms a human owns the response. Resolve only after contact and a documented outcome. Paging errors remain visible.</p></div></div></div>
        <div className="toolbar"><div className="filter-tabs">{['open', 'triggered', 'acknowledged', 'resolved', 'all'].map((value) => <button key={value} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setCursor({ previous: [] }); }}>{value}</button>)}</div></div>
        <Warnings warnings={alerts.meta.warnings} />
        {alerts.error && <ErrorState title="SOS feed unavailable" message={alerts.error} onRetry={() => void alerts.refresh()} />}
        {!alerts.error && <DataTable columns={columns} rows={alerts.data?.items ?? []} rowKey={(alert) => alert.id} loading={alerts.loading} emptyMessage="No SOS alerts match this filter." />}
        {!alerts.error && alerts.data && <Pagination count={alerts.data.items.length} history={{ ...cursor, next: alerts.meta.nextCursor }} onChange={setCursor} />}
      </div>
      <CommandDialog open={Boolean(selected)} title={targetStatus === 'acknowledged' ? 'Acknowledge SOS' : 'Resolve SOS'} description={targetStatus === 'acknowledged' ? 'Confirm that you own the response and have started contacting the traveler or Buddy.' : 'Document the verified resolution. This closes the active emergency queue but keeps the permanent record.'} confirmLabel={targetStatus === 'acknowledged' ? 'Acknowledge alert' : 'Resolve alert'} tone="danger" onClose={() => setSelected(null)} onConfirm={transition} />
    </div>
  );
}

export function ReportsPage() {
  const { admin } = useAuth();
  const canUpdate = canMutate(admin?.role, 'safety');
  const [status, setStatus] = useState('open');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const [selected, setSelected] = useState<ReportSummary | null>(null);
  const [targetStatus, setTargetStatus] = useState('reviewing');
  const reports = useAdminQuery<PageData<ReportSummary>>(() => adminRequest('reports.list', { cursor: cursor.current, pageSize: PAGE_SIZE, status: status === 'all' ? undefined : status }), [cursor.current, status]);
  const columns: Column<ReportSummary>[] = [
    { key: 'case', header: 'Case', render: (report) => <div><p className="font-mono text-xs font-bold">#{report.id.slice(0, 8)}</p><p className="mt-1 text-xs text-muted">{relative(report.createdAt)}</p></div> },
    { key: 'people', header: 'Reporter → Reported', render: (report) => <div><p className="text-sm font-semibold">{report.reporter?.fullName ?? 'Reporter protected'}</p><p className="text-xs text-muted">against {report.reportedUser?.fullName ?? 'Member unavailable'}</p></div> },
    { key: 'reason', header: 'Reason & evidence', render: (report) => <div><StatusBadge value={report.reason} /><p className="mt-1 max-w-sm truncate text-xs text-muted">{report.details ?? 'No written detail'}</p></div> },
    { key: 'trip', header: 'Trip', width: '100px', render: (report) => report.bookingId ? <a className="text-link" href={`/operations/bookings/${report.bookingId}`}>{report.bookingId.slice(0, 8)}</a> : <span className="text-xs text-muted">None</span> },
    { key: 'status', header: 'Status', width: '120px', render: (report) => <StatusBadge value={report.status} /> },
    { key: 'action', header: '', width: '110px', align: 'right', render: (report) => !['actioned', 'dismissed'].includes(report.status) && canUpdate ? <button className="secondary-button compact" onClick={(event) => { event.stopPropagation(); setSelected(report); setTargetStatus(report.status === 'open' ? 'reviewing' : 'actioned'); }}>Review</button> : <span className="text-xs text-muted">{['actioned', 'dismissed'].includes(report.status) ? 'Closed' : 'View only'}</span> },
  ];
  async function transition(reason: string) {
    if (!selected) return;
    await adminRequest('reports.transition', { id: selected.id, status: targetStatus, reason, adminNotes: reason, idempotencyKey: idempotencyKey('report', selected.id) });
    await reports.refresh();
  }
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Trust & safety" title="Moderation reports" subtitle="Evidence, prior context and audited case outcomes. Nothing disappears when a case closes." actions={<Freshness meta={reports.meta} refreshing={reports.refreshing} />} />
      <div className="page-content space-y-4">
        <div className="toolbar"><div className="filter-tabs">{['open', 'reviewing', 'actioned', 'dismissed', 'all'].map((value) => <button key={value} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setCursor({ previous: [] }); }}>{value}</button>)}</div></div>
        <Warnings warnings={reports.meta.warnings} />
        {reports.error && <ErrorState title="Moderation cases unavailable" message={reports.error} onRetry={() => void reports.refresh()} />}
        {!reports.error && <DataTable columns={columns} rows={reports.data?.items ?? []} rowKey={(report) => report.id} loading={reports.loading} emptyMessage="No reports match this status." />}
        {!reports.error && reports.data && <Pagination count={reports.data.items.length} history={{ ...cursor, next: reports.meta.nextCursor }} onChange={setCursor} />}
      </div>
      <CommandDialog open={Boolean(selected)} title="Update moderation case" description="Choose a deliberate case outcome. Suspending a member is a separate audited command from their profile." confirmLabel="Update case" tone={targetStatus === 'dismissed' ? 'primary' : 'danger'} onClose={() => setSelected(null)} onConfirm={transition}>
        <label className="field-label mt-5 block">Case status<select className="field-input mt-2" value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}><option value="reviewing">Reviewing</option><option value="actioned">Actioned</option><option value="dismissed">Dismissed</option></select></label>
      </CommandDialog>
    </div>
  );
}

export function TrustCapabilityPage({ kind }: { kind: 'access' | 'deletions' }) {
  const copy = kind === 'access'
    ? { title: 'Sensitive access', body: 'Sensitive-record access events are not yet exposed by the admin API. The console will not infer an empty history from that absence.' }
    : { title: 'Account deletion', body: 'Account-deletion workflow records are not yet exposed by the admin API. Continue using the server-side deletion function until this queue is connected.' };
  return <div className="page-wrap"><PageHeader eyebrow="Trust & safety" title={copy.title} /><div className="page-content"><UnconfiguredState title="Backend capability not connected" message={copy.body} /></div></div>;
}
