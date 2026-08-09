import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CommandDialog from '@/components/CommandDialog';
import DataTable, { type Column } from '@/components/DataTable';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import Pagination, { type CursorHistory } from '@/components/Pagination';
import { EmptyState, ErrorState, Freshness, LoadingState, Warnings } from '@/components/States';
import StatusBadge from '@/components/StatusBadge';
import { adminRequest, idempotencyKey } from '@/lib/api';
import { formatDateTime, formatINR, formatPaise, relative } from '@/lib/format';
import { useAdminQuery } from '@/lib/useAdminQuery';
import type { BookingDetail, BookingSummary, DisputeSummary, LeadSummary, PageData } from '@/types/admin';
import { useAuth } from '@/auth/AuthProvider';
import { canMutate } from '@/lib/permissions';

const PAGE_SIZE = 30;

export function LeadsPage() {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const [selected, setSelected] = useState<LeadSummary | null>(null);
  const [nextStatus, setNextStatus] = useState<string>('contacted');
  const [linkedUserId, setLinkedUserId] = useState('');
  const [linkedBookingId, setLinkedBookingId] = useState('');
  const { admin } = useAuth();
  const canUpdate = canMutate(admin?.role, 'operations');
  const leads = useAdminQuery<PageData<LeadSummary>>(
    () => adminRequest('leads.list', { cursor: cursor.current, pageSize: PAGE_SIZE, status: status === 'all' ? undefined : status, query: query || undefined }),
    [cursor.current, status, query],
  );

  const columns: Column<LeadSummary>[] = [
    { key: 'traveler', header: 'Traveler', render: (lead) => <div><p className="font-semibold text-navy">{lead.contactName ?? 'Name withheld'}</p><p className="mt-0.5 text-xs text-muted">{lead.contactEmail ?? 'Contact protected'}</p></div> },
    { key: 'request', header: 'Request', render: (lead) => <div><p className="font-medium capitalize">{lead.requestType.replace(/_/g, ' ')}</p><p className="mt-0.5 max-w-56 truncate text-xs text-muted">{lead.landingPage ?? 'Unknown landing page'}</p></div> },
    { key: 'source', header: 'Source', render: (lead) => <div><p className="text-xs font-semibold">{lead.source ?? 'Direct / unknown'}</p><p className="mt-0.5 text-[11px] text-muted">{[lead.medium, lead.campaign].filter(Boolean).join(' · ') || 'No campaign'}</p></div> },
    { key: 'status', header: 'Status', width: '130px', render: (lead) => <StatusBadge value={lead.status} /> },
    { key: 'owner', header: 'Owner', width: '140px', render: (lead) => <span className="text-xs">{lead.owner?.fullName ?? 'Unassigned'}</span> },
    { key: 'age', header: 'Waiting', width: '110px', render: (lead) => <span className={`text-xs font-semibold ${Date.now() - new Date(lead.createdAt).getTime() > 4 * 3600_000 && lead.status === 'new' ? 'text-danger' : 'text-muted'}`}>{relative(lead.createdAt)}</span> },
    { key: 'action', header: '', width: '110px', align: 'right', render: (lead) => canUpdate ? <button className="text-link" onClick={(event) => { event.stopPropagation(); setSelected(lead); setNextStatus(lead.status === 'new' ? 'contacted' : 'qualified'); setLinkedUserId(lead.linkedUserId ?? ''); setLinkedBookingId(lead.linkedBookingId ?? ''); }}>Update <Icon name="arrow" className="h-3 w-3" /></button> : <span className="text-xs text-muted">View only</span> },
  ];

  async function updateLead(reason: string) {
    if (!selected) return;
    if (nextStatus === 'converted' && !linkedUserId.trim() && !linkedBookingId.trim()) throw new Error('Link a Detour user or booking before marking this lead converted.');
    await adminRequest('leads.update', { id: selected.id, status: nextStatus, linkedUserId: linkedUserId.trim() || undefined, linkedBookingId: linkedBookingId.trim() || undefined, reason, idempotencyKey: idempotencyKey('lead', selected.id) });
    await leads.refresh();
  }

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Operations" title="Website leads" subtitle="Every confirmed website request, its attribution and the human follow-up that turns it into a trip." actions={<Freshness meta={leads.meta} refreshing={leads.refreshing} />} />
      <div className="page-content space-y-4">
        <div className="toolbar">
          <div className="filter-tabs">{['all', 'new', 'contacted', 'qualified', 'converted', 'closed'].map((value) => <button key={value} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setCursor({ previous: [] }); }}>{value}</button>)}</div>
          <label className="table-search"><Icon name="search" className="h-4 w-4" /><input value={query} onChange={(event) => { setQuery(event.target.value); setCursor({ previous: [] }); }} placeholder="Search leads" /></label>
        </div>
        <Warnings warnings={leads.meta.warnings} />
        {leads.error && <ErrorState title="Website leads unavailable" message={leads.error} onRetry={() => void leads.refresh()} />}
        {!leads.error && <DataTable columns={columns} rows={leads.data?.items ?? []} rowKey={(lead) => lead.id} loading={leads.loading} emptyMessage="No website leads match these filters." />}
        {!leads.error && leads.data && <Pagination count={leads.data.items.length} history={{ ...cursor, next: leads.meta.nextCursor }} onChange={setCursor} />}
      </div>
      <CommandDialog open={Boolean(selected)} title="Update lead workflow" description="This records a workflow transition; it does not silently change or erase the original request." confirmLabel="Update lead" onClose={() => setSelected(null)} onConfirm={updateLead}>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="field-label">Linked user ID<input className="field-input mt-2" value={linkedUserId} onChange={(event) => setLinkedUserId(event.target.value)} placeholder="Optional UUID" /></label><label className="field-label">Linked booking ID<input className="field-input mt-2" value={linkedBookingId} onChange={(event) => setLinkedBookingId(event.target.value)} placeholder="Optional UUID" /></label></div>
        <label className="field-label mt-4 block">New status<select className="field-input mt-2" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}><option value="contacted">Contacted</option><option value="qualified">Qualified</option>{(linkedUserId.trim() || linkedBookingId.trim()) && <option value="converted">Converted</option>}<option value="closed">Closed</option></select></label>
      </CommandDialog>
    </div>
  );
}

type BookingView = 'bookings' | 'inquiries' | 'live' | 'disputes';
const bookingCopy: Record<BookingView, { title: string; subtitle: string; operation: 'bookings.list' | 'inquiries.list' | 'live-trips.list'; fixedStatus?: string }> = {
  bookings: { title: 'Bookings', subtitle: 'The complete inquiry-to-review lifecycle. Open a trip for its canonical timeline.', operation: 'bookings.list' },
  inquiries: { title: 'Inquiries', subtitle: 'Inquiry-first conversations waiting for a Buddy, agreement or traveler response.', operation: 'inquiries.list' },
  live: { title: 'Live trips', subtitle: 'Trips happening now or within the operational watch window.', operation: 'live-trips.list' },
  disputes: { title: 'Disputes', subtitle: 'Cases that need evidence and a deliberate, audited resolution.', operation: 'bookings.list', fixedStatus: 'disputed' },
};

export function DisputesPage() {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const canResolve = canMutate(admin?.role, 'operations');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const [selected, setSelected] = useState<DisputeSummary | null>(null);
  const [resolution, setResolution] = useState<'resume_reconciliation' | 'cancel_force_majeure'>('resume_reconciliation');
  const disputes = useAdminQuery<PageData<DisputeSummary>>(() => adminRequest('disputes.list', { cursor: cursor.current, pageSize: PAGE_SIZE }), [cursor.current]);
  const columns: Column<DisputeSummary>[] = [
    { key: 'people', header: 'Traveler → Buddy', render: (row) => <div><p className="font-semibold text-navy">{row.traveler.fullName ?? row.traveler.email}</p><p className="text-xs text-muted">with {row.guide.fullName ?? row.guide.email}</p></div> },
    { key: 'case', header: 'Evidence', render: (row) => <div><p className="text-xs font-semibold">{row.reports.length} linked report{row.reports.length === 1 ? '' : 's'}</p><p className="mt-0.5 max-w-64 truncate text-[10px] text-muted">{row.reports.map((report) => report.reason).join(' · ') || 'No moderation report linked'}</p></div> },
    { key: 'money', header: 'Money', width: '130px', render: (row) => <div><p className="num text-sm font-bold">{formatINR(row.totalAmount)}</p><StatusBadge value={row.paymentStatus} /></div> },
    { key: 'waiting', header: 'Waiting', width: '130px', render: (row) => <div><p className="text-xs font-semibold text-danger">{relative(row.updatedAt ?? row.createdAt)}</p><p className="text-[10px] text-muted">since disputed</p></div> },
    { key: 'open', header: '', width: '210px', align: 'right', render: (row) => <div className="flex justify-end gap-2"><button className="secondary-button compact" onClick={(event) => { event.stopPropagation(); navigate(`/operations/bookings/${row.id}`); }}>Evidence</button>{canResolve && <button className="danger-button compact" onClick={(event) => { event.stopPropagation(); setSelected(row); }}>Resolve</button>}</div> },
  ];
  async function resolve(reason: string) {
    if (!selected) return;
    await adminRequest('disputes.resolve', { id: selected.id, resolution, reason, idempotencyKey: idempotencyKey('dispute', selected.id) });
    await disputes.refresh();
  }
  return <div className="page-wrap"><PageHeader eyebrow="Operations" title="Disputes" subtitle="Evidence-first resolution for trips that cannot leave the disputed state automatically." actions={<Freshness meta={disputes.meta} refreshing={disputes.refreshing} />} /><div className="page-content space-y-4"><Warnings warnings={disputes.meta.warnings} />{disputes.error && <ErrorState title="Disputes unavailable" message={disputes.error} onRetry={() => void disputes.refresh()} />}{!disputes.error && <DataTable columns={columns} rows={disputes.data?.items ?? []} rowKey={(row) => row.id} loading={disputes.loading} onRowClick={(row) => navigate(`/operations/bookings/${row.id}`)} emptyMessage="No disputed trips." />}{!disputes.error && disputes.data && <Pagination count={disputes.data.items.length} history={{ ...cursor, next: disputes.meta.nextCursor }} onChange={setCursor} />}</div><CommandDialog open={Boolean(selected)} title="Resolve disputed trip" description="Choose the only safe next state after reviewing the booking timeline, reports and money movements. The server validates the transition and writes the audit record atomically." confirmLabel="Resolve dispute" tone="danger" onClose={() => setSelected(null)} onConfirm={resolve}><label className="field-label mt-5 block">Resolution<select className="field-input mt-2" value={resolution} onChange={(event) => setResolution(event.target.value as typeof resolution)}><option value="resume_reconciliation">Evidence supports resuming reconciliation</option><option value="cancel_force_majeure">Cancel as force majeure</option></select></label></CommandDialog></div>;
}

export function BookingListPage({ view = 'bookings' }: { view?: BookingView }) {
  const copy = bookingCopy[view];
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const status = copy.fixedStatus ?? params.get('status') ?? 'all';
  const bookings = useAdminQuery<PageData<BookingSummary>>(
    () => adminRequest(copy.operation, { cursor: cursor.current, pageSize: PAGE_SIZE, status: status === 'all' ? undefined : status, query: query || undefined }),
    [copy.operation, cursor.current, status, query],
  );
  const columns: Column<BookingSummary>[] = [
    { key: 'people', header: 'Traveler → Buddy', render: (booking) => <div><p className="font-semibold text-navy">{booking.traveler?.fullName ?? 'Traveler unavailable'}</p><p className="mt-0.5 text-xs text-muted">with {booking.buddy?.fullName ?? 'Unassigned Buddy'}</p></div> },
    { key: 'experience', header: 'Experience', render: (booking) => <div><p className="max-w-52 truncate text-sm">{booking.itineraryTitle ?? 'Custom Detour'}</p><p className="mt-0.5 font-mono text-[10px] text-muted">{booking.id.slice(0, 8)}</p></div> },
    { key: 'status', header: 'Lifecycle', width: '160px', render: (booking) => <StatusBadge value={booking.status} /> },
    { key: 'payment', header: 'Money', width: '120px', render: (booking) => <div><p className="num text-sm font-bold">{formatPaise(booking.totalPaise)}</p><StatusBadge value={booking.paymentStatus} /></div> },
    { key: 'trip', header: 'Trip time', width: '190px', render: (booking) => <div><p className="text-xs">{formatDateTime(booking.tripStartsAt ?? booking.arrivalTime)}</p><p className="mt-0.5 text-[11px] text-muted">{booking.tripStartsAt ? relative(booking.tripStartsAt) : 'Schedule pending'}</p></div> },
    { key: 'updated', header: 'Updated', width: '100px', render: (booking) => <span className="text-xs text-muted">{relative(booking.updatedAt ?? booking.createdAt)}</span> },
    { key: 'open', header: '', width: '38px', render: () => <Icon name="chevron" className="h-4 w-4 text-muted" /> },
  ];
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Operations" title={copy.title} subtitle={copy.subtitle} actions={<Freshness meta={bookings.meta} refreshing={bookings.refreshing} />} />
      <div className="page-content space-y-4">
        <div className="toolbar">
          {!copy.fixedStatus && view === 'bookings' ? <div className="filter-tabs">{['all', 'active', 'awaiting_deposits', 'trip_ready', 'completed', 'cancelled'].map((value) => <button key={value} className={status === value ? 'active' : ''} onClick={() => { setParams(value === 'all' ? {} : { status: value }); setCursor({ previous: [] }); }}>{value.replace(/_/g, ' ')}</button>)}</div> : <div className="text-xs font-semibold text-muted">{bookings.data?.total != null ? `${bookings.data.total.toLocaleString('en-IN')} records` : 'Server-paginated results'}</div>}
          <label className="table-search"><Icon name="search" className="h-4 w-4" /><input value={query} onChange={(event) => { setQuery(event.target.value); setCursor({ previous: [] }); }} placeholder="Search trip or person" /></label>
        </div>
        <Warnings warnings={bookings.meta.warnings} />
        {bookings.error && <ErrorState title={`${copy.title} unavailable`} message={bookings.error} onRetry={() => void bookings.refresh()} />}
        {!bookings.error && <DataTable columns={columns} rows={bookings.data?.items ?? []} rowKey={(booking) => booking.id} loading={bookings.loading} onRowClick={(booking) => navigate(`/operations/bookings/${booking.id}`)} emptyMessage={`No ${copy.title.toLowerCase()} match these filters.`} />}
        {!bookings.error && bookings.data && <Pagination count={bookings.data.items.length} history={{ ...cursor, next: bookings.meta.nextCursor }} onChange={setCursor} />}
      </div>
    </div>
  );
}

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const booking = useAdminQuery<BookingDetail>(() => adminRequest('bookings.get', { id }), [id]);
  if (booking.loading) return <div className="page-wrap"><PageHeader title="Trip workspace" eyebrow="Operations" /><div className="page-content"><LoadingState rows={5} /></div></div>;
  if (booking.error || !booking.data) return <div className="page-wrap"><PageHeader title="Trip workspace" eyebrow="Operations" /><div className="page-content"><ErrorState title="Trip unavailable" message={booking.error ?? 'The server returned no trip.'} onRetry={() => void booking.refresh()} /></div></div>;
  const item = booking.data;
  return (
    <div className="page-wrap">
      <PageHeader eyebrow={`Booking ${item.id.slice(0, 8)}`} title={`${item.traveler?.fullName ?? 'Traveler'} with ${item.buddy?.fullName ?? 'Buddy pending'}`} subtitle={item.itineraryTitle ?? 'Custom inquiry'} actions={<><StatusBadge value={item.status} /><Freshness meta={booking.meta} refreshing={booking.refreshing} /></>} />
      <div className="page-content">
        <Warnings warnings={booking.meta.warnings} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><p className="eyebrow">Canonical timeline</p><h2 className="section-title mt-1">What happened, in order</h2></div><span className="text-xs text-muted">{item.timeline.length} events</span></div>
            {item.timeline.length ? <div className="mt-6 space-y-0">{item.timeline.map((event, index) => (
              <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                {index < item.timeline.length - 1 && <span className="absolute bottom-0 left-[15px] top-8 w-px bg-divider" />}
                <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-divider bg-white text-primary"><span className="h-2 w-2 rounded-full bg-current" /></div>
                <div className="min-w-0 flex-1 pt-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-navy">{event.title}</p><time className="text-[11px] text-muted">{formatDateTime(event.occurredAt)}</time></div>{event.description && <p className="mt-1 text-xs leading-5 text-muted">{event.description}</p>}<div className="mt-2 flex items-center gap-2">{event.status && <StatusBadge value={event.status} />}{event.actor && <span className="text-[11px] text-muted">by {event.actor.fullName ?? event.actor.email}</span>}{event.amountPaise != null && <span className="num text-[11px] font-bold">{formatPaise(event.amountPaise)}</span>}</div></div>
              </div>
            ))}</div> : <EmptyState title="No timeline events" message="The booking exists, but the operational event history has not been assembled yet." />}
          </section>

          <aside className="space-y-4">
            <DetailCard title="Trip window" rows={[
              ['Arrival', formatDateTime(item.arrivalTime)], ['Departure', formatDateTime(item.departureTime)], ['Starts', formatDateTime(item.tripStartsAt ?? item.tourStartTime)], ['Ends', formatDateTime(item.tourEndTime)],
            ]} />
            <DetailCard title="Parties" rows={[
              ['Traveler', item.traveler?.fullName ?? 'Unavailable'], ['Traveler email', item.traveler?.email ?? 'Protected'], ['Buddy', item.buddy?.fullName ?? 'Unassigned'], ['Buddy email', item.buddy?.email ?? 'Protected'],
            ]} />
            <DetailCard title="Money" rows={Object.entries(item.financials ?? {}).map(([key, value]) => [key.replace(/([A-Z])/g, ' $1'), formatPaise(value)] as [string, string])} empty="Ledger details are not available." />
            <section className="card p-5"><p className="eyebrow">Safety rule</p><p className="mt-2 text-sm font-semibold text-navy">No raw lifecycle edits</p><p className="mt-1 text-xs leading-5 text-muted">State-changing actions must run as validated, idempotent server commands with a reason and audit record.</p></section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ title, rows, empty }: { title: string; rows: Array<[string, string]>; empty?: string }) {
  return <section className="card p-5"><p className="eyebrow">{title}</p>{rows.length ? <dl className="mt-3 divide-y divide-divider">{rows.map(([label, value]) => <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0" key={label}><dt className="text-xs capitalize text-muted">{label}</dt><dd className="max-w-[60%] break-words text-right text-xs font-semibold text-ink">{value}</dd></div>)}</dl> : <p className="mt-3 text-xs text-muted">{empty}</p>}</section>;
}
