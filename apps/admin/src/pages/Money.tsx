import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CommandDialog from '@/components/CommandDialog';
import DataTable, { type Column } from '@/components/DataTable';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import Pagination, { type CursorHistory } from '@/components/Pagination';
import { ErrorState, Freshness, LoadingState, Warnings } from '@/components/States';
import StatusBadge from '@/components/StatusBadge';
import { adminRequest, idempotencyKey } from '@/lib/api';
import { formatDateTime, formatPaise, relative } from '@/lib/format';
import { useAdminQuery } from '@/lib/useAdminQuery';
import type { BookingSummary, FinanceSummary, MoneyRow, PageData, SettingsData } from '@/types/admin';
import { useAuth } from '@/auth/AuthProvider';
import { canMutate } from '@/lib/permissions';

const PAGE_SIZE = 30;

function periodDates(days: number | 'all') {
  const endDate = new Date().toISOString().slice(0, 10);
  if (days === 'all') return { startDate: undefined, endDate };
  const start = new Date(); start.setUTCDate(start.getUTCDate() - days + 1);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

export function LedgerPage() {
  const { admin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingQuery = searchParams.get('booking') ?? '';
  const [period, setPeriod] = useState<7 | 30 | 90 | 'all'>(30);
  const [status, setStatus] = useState('all');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const dates = useMemo(() => periodDates(period), [period]);
  const summary = useAdminQuery<FinanceSummary>(() => adminRequest('finance.summary', dates), [dates.startDate, dates.endDate]);
  const payments = useAdminQuery<PageData<MoneyRow>>(() => adminRequest('payments.list', { cursor: cursor.current, pageSize: PAGE_SIZE, status: status === 'all' ? undefined : status, query: bookingQuery || undefined }), [cursor.current, status, bookingQuery]);
  const columns: Column<MoneyRow>[] = [
    { key: 'event', header: 'Event', render: (row) => <div><p className="font-semibold capitalize text-navy">{row.kind.replace(/_/g, ' ')}</p><p className="mt-0.5 font-mono text-[10px] text-muted">{row.id.slice(0, 8)}</p></div> },
    { key: 'booking', header: 'Booking', width: '120px', render: (row) => row.bookingId ? <a className="text-link font-mono" href={admin?.role === 'finance' ? `/money/ledger?booking=${encodeURIComponent(row.bookingId)}` : `/operations/bookings/${row.bookingId}`}>{row.bookingId.slice(0, 8)}</a> : <span className="text-xs text-muted">—</span> },
    { key: 'person', header: 'Person', render: (row) => <div><p className="text-xs font-semibold">{row.person?.fullName ?? 'Unavailable'}</p><p className="text-[10px] text-muted">{row.person?.email ?? ''}</p></div> },
    { key: 'status', header: 'Status', width: '120px', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'amount', header: 'Amount', align: 'right', numeric: true, width: '130px', render: (row) => <span className="font-bold text-navy">{formatPaise(row.amountPaise)}</span> },
    { key: 'time', header: 'Occurred', width: '170px', render: (row) => <div><p className="text-xs">{formatDateTime(row.occurredAt)}</p><p className="text-[10px] text-muted">{relative(row.occurredAt)}</p></div> },
  ];
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Money" title="Ledger" subtitle="Captured and refunded payment events are the source of truth—not legacy booking totals." actions={<Freshness meta={summary.meta} refreshing={summary.refreshing || payments.refreshing} />} />
      <div className="page-content space-y-6">
        <div className="toolbar"><div className="filter-tabs">{([7, 30, 90, 'all'] as const).map((value) => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value === 'all' ? 'All time' : `${value} days`}</button>)}</div></div>
        <Warnings warnings={[...(summary.meta.warnings ?? []), ...(payments.meta.warnings ?? [])]} />
        {summary.loading && <LoadingState rows={2} />}
        {summary.error && <ErrorState title="Finance summary unavailable" message={summary.error} onRetry={() => void summary.refresh()} />}
        {summary.data && !summary.error && <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><MoneyMetric label="Captured" value={summary.data.capturedPaise} tone="green" /><MoneyMetric label="Refunded" value={summary.data.refundedPaise} tone="orange" /><MoneyMetric label="Payouts" value={summary.data.payoutPaise} tone="blue" /><MoneyMetric label="Platform revenue" value={summary.data.platformRevenuePaise} tone="purple" /><MoneyMetric label="Pending" value={summary.data.pendingPaise} tone="pink" /><MoneyMetric label="Reconciliation delta" value={summary.data.reconciliationDeltaPaise} tone={summary.data.reconciliationDeltaPaise === 0 ? 'green' : 'red'} /></div>}
        <section>
          <div className="section-heading"><div><p className="eyebrow">Money movements</p><h2 className="section-title">Payment events</h2></div><div className="flex flex-wrap items-center gap-3"><div className="filter-tabs">{['all', 'captured', 'initiated', 'failed', 'refunded'].map((value) => <button key={value} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setCursor({ previous: [] }); }}>{value}</button>)}</div>{bookingQuery && <button className="secondary-button compact" onClick={() => setSearchParams({})}>Booking {bookingQuery.slice(0, 8)} <Icon name="close" className="h-3 w-3" /></button>}</div></div>
          {payments.error && <ErrorState title="Payment ledger unavailable" message={payments.error} onRetry={() => void payments.refresh()} />}
          {!payments.error && <DataTable columns={columns} rows={payments.data?.items ?? []} rowKey={(row) => row.id} loading={payments.loading} emptyMessage="No payment events match this filter." />}
          {!payments.error && payments.data && <Pagination count={payments.data.items.length} history={{ ...cursor, next: payments.meta.nextCursor }} onChange={setCursor} />}
        </section>
      </div>
    </div>
  );
}

export function MoneyListPage({ kind }: { kind: 'payouts' | 'refunds' }) {
  const { admin } = useAuth();
  const canRun = canMutate(admin?.role, 'finance');
  const [status, setStatus] = useState('all');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const [selected, setSelected] = useState<MoneyRow | null>(null);
  const fixedStatus = status === 'all' ? undefined : status;
  const rows = useAdminQuery<PageData<MoneyRow>>(() => adminRequest('payouts.list', { cursor: cursor.current, pageSize: PAGE_SIZE, status: fixedStatus }), [cursor.current, fixedStatus]);
  const refundKinds = new Set(['traveler_refund', 'traveler_deposit_refund', 'buddy_deposit_refund', 'trip_fund_cancellation_refund', 'buddy_fee_cancellation_refund', 'cancellation_refund', 'force_majeure_refund']);
  const payoutKinds = new Set(['buddy_fee_final', 'trip_pot_release']);
  const visibleRows = (rows.data?.items ?? []).filter((row) => (kind === 'refunds' ? refundKinds : payoutKinds).has(row.kind));
  const eligible = (row: MoneyRow) => canRun && ['pending', 'failed'].includes(row.status) && (kind === 'refunds' ? refundKinds : payoutKinds).has(row.kind);
  const columns: Column<MoneyRow>[] = [
    { key: 'kind', header: kind === 'payouts' ? 'Payout' : 'Refund', render: (row) => <div><p className="font-semibold capitalize">{row.kind.replace(/_/g, ' ')}</p><p className="font-mono text-[10px] text-muted">{row.id.slice(0, 8)}</p></div> },
    { key: 'booking', header: 'Booking', render: (row) => row.bookingId ? <a className="text-link font-mono" href={admin?.role === 'finance' ? `/money/ledger?booking=${encodeURIComponent(row.bookingId)}` : `/operations/bookings/${row.bookingId}`}>{row.bookingId.slice(0, 8)}</a> : <span className="text-xs text-muted">—</span> },
    { key: 'recipient', header: kind === 'payouts' ? 'Recipient' : 'Traveler', render: (row) => <span className="text-xs font-semibold">{row.person?.fullName ?? 'Unavailable'}</span> },
    { key: 'status', header: 'Status', width: '130px', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'amount', header: 'Amount', width: '130px', align: 'right', numeric: true, render: (row) => <span className="font-bold">{formatPaise(row.amountPaise)}</span> },
    { key: 'time', header: 'Updated', width: '170px', render: (row) => <span className="text-xs text-muted">{formatDateTime(row.occurredAt)}</span> },
    { key: 'problem', header: 'Failure', render: (row) => <span className="max-w-56 truncate text-xs text-danger">{row.failureReason ?? '—'}</span> },
    { key: 'action', header: '', width: '120px', align: 'right', render: (row) => eligible(row) ? <button className={row.status === 'failed' ? 'danger-button compact' : 'secondary-button compact'} onClick={() => setSelected(row)}>{kind === 'refunds' ? 'Issue refund' : row.status === 'failed' ? 'Retry payout' : 'Dispatch'}</button> : <span className="text-xs text-muted">{canRun ? 'Not actionable' : 'View only'}</span> },
  ];
  async function runCommand(reason: string) {
    if (!selected) return;
    if (kind === 'refunds') await adminRequest('refunds.issue', { id: selected.id, reason, idempotencyKey: idempotencyKey('refund', selected.id) });
    else await adminRequest('payouts.retry', { id: selected.id, reason, idempotencyKey: idempotencyKey('payout', selected.id) });
    await rows.refresh();
  }
  return <div className="page-wrap"><PageHeader eyebrow="Money" title={kind === 'payouts' ? 'Payouts' : 'Refunds'} subtitle={kind === 'payouts' ? 'Every escrow release, its processing state and failures requiring attention.' : 'Refund dispatches issued through validated, idempotent server workflows.'} actions={<Freshness meta={rows.meta} refreshing={rows.refreshing} />} /><div className="page-content space-y-4"><div className="toolbar"><div className="filter-tabs">{['all', 'pending', 'sent', 'failed'].map((value) => <button key={value} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setCursor({ previous: [] }); }}>{value}</button>)}</div></div><Warnings warnings={rows.meta.warnings} />{rows.error && <ErrorState title={`${kind} unavailable`} message={rows.error} onRetry={() => void rows.refresh()} />}{!rows.error && <DataTable columns={columns} rows={visibleRows} rowKey={(row) => row.id} loading={rows.loading} emptyMessage={`No ${kind} match this filter on this page.`} />}{!rows.error && rows.data && <Pagination count={visibleRows.length} history={{ ...cursor, next: rows.meta.nextCursor }} onChange={setCursor} />}</div><CommandDialog open={Boolean(selected)} title={kind === 'refunds' ? 'Issue refund' : selected?.status === 'failed' ? 'Retry failed payout' : 'Dispatch payout'} description={kind === 'refunds' ? 'The server revalidates the dispatch kind, status and idempotency before contacting the payment provider.' : 'The server revalidates payout eligibility and prevents duplicate money movement before retrying.'} confirmLabel={kind === 'refunds' ? 'Issue refund' : 'Run payout'} tone={selected?.status === 'failed' ? 'danger' : 'primary'} onClose={() => setSelected(null)} onConfirm={runCommand} /></div>;
}

export function CancellationsPage() {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const rows = useAdminQuery<PageData<BookingSummary>>(() => adminRequest('cancellations.list', { cursor: cursor.current, pageSize: PAGE_SIZE }), [cursor.current]);
  const columns: Column<BookingSummary>[] = [
    { key: 'people', header: 'Trip', render: (row) => <div><p className="font-semibold">{row.traveler?.fullName ?? 'Traveler'} with {row.buddy?.fullName ?? 'Buddy'}</p><p className="font-mono text-[10px] text-muted">{row.id.slice(0, 8)}</p></div> },
    { key: 'experience', header: 'Experience', render: (row) => <span className="text-xs">{row.itineraryTitle ?? 'Custom Detour'}</span> },
    { key: 'status', header: 'Resolution', width: '170px', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'money', header: 'Trip value', width: '130px', align: 'right', numeric: true, render: (row) => <span className="font-bold">{formatPaise(row.totalPaise)}</span> },
    { key: 'updated', header: 'Updated', width: '160px', render: (row) => <span className="text-xs text-muted">{formatDateTime(row.updatedAt ?? row.createdAt)}</span> },
    { key: 'open', header: '', width: '38px', render: () => <Icon name="chevron" className="h-4 w-4 text-muted" /> },
  ];
  return <div className="page-wrap"><PageHeader eyebrow="Money" title="Cancellations" subtitle="Cancellation resolution, deposits and refund outcomes remain tied to the canonical trip timeline." actions={<Freshness meta={rows.meta} refreshing={rows.refreshing} />} /><div className="page-content space-y-4"><Warnings warnings={rows.meta.warnings} />{rows.error && <ErrorState title="Cancellations unavailable" message={rows.error} onRetry={() => void rows.refresh()} />}{!rows.error && <DataTable columns={columns} rows={rows.data?.items ?? []} rowKey={(row) => row.id} loading={rows.loading} onRowClick={admin?.role === 'owner' ? (row) => navigate(`/operations/bookings/${row.id}`) : undefined} emptyMessage="No cancellation records." />}{!rows.error && rows.data && <Pagination count={rows.data.items.length} history={{ ...cursor, next: rows.meta.nextCursor }} onChange={setCursor} />}</div></div>;
}

export function PricingPage() {
  const settings = useAdminQuery<SettingsData>(() => adminRequest('settings.get'), []);
  const [form, setForm] = useState<SettingsData | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deploymentId, setDeploymentId] = useState('');
  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);
  if (settings.loading && !form) return <div className="page-wrap"><PageHeader eyebrow="Money" title="Pricing" /><div className="page-content"><LoadingState rows={4} /></div></div>;
  if (settings.error || !form) return <div className="page-wrap"><PageHeader eyebrow="Money" title="Pricing" /><div className="page-content"><ErrorState title="Pricing configuration unavailable" message={settings.error ?? 'The server returned no settings.'} onRetry={() => void settings.refresh()} /></div></div>;
  const rateFields: Array<{ key: keyof SettingsData; label: string; hint: string }> = [
    { key: 'platformFeeUpRate', label: 'Traveler platform fee', hint: 'Added to the Buddy fee' }, { key: 'platformFeeDownRate', label: 'Buddy platform fee', hint: 'Deducted at payout' }, { key: 'commissionRate', label: 'Estimate commission', hint: 'Pre-chat estimate only' }, { key: 'gstRate', label: 'GST', hint: 'Applied to traveler subtotal' }, { key: 'tdsRate', label: 'TDS', hint: 'Withheld from payout' },
  ];
  function setNumber(key: keyof SettingsData, value: number) { setForm((current) => current ? { ...current, [key]: value } : current); }
  async function save(reason: string) {
    const current = form;
    if (!current) throw new Error('Pricing configuration is unavailable. Reload before saving.');
    await adminRequest('settings.update', { ...current, reason, idempotencyKey: idempotencyKey('settings', 'platform'), contentDeploymentId: deploymentId || undefined });
    await settings.refresh();
  }
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Money" title="Pricing & commercial mode" subtitle="Rates are snapshotted into agreements. Changes are audited and can be coupled to a matching content deployment." actions={<Freshness meta={settings.meta} refreshing={settings.refreshing} />} />
      <div className="page-content">
        <Warnings warnings={settings.meta.warnings} />
        <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]" onSubmit={(event: FormEvent) => { event.preventDefault(); setConfirming(true); }}>
          <div className="space-y-5">
            <section className="card p-6"><div className="flex items-start justify-between gap-5"><div><p className="eyebrow">Commercial mode</p><h2 className="mt-1 font-heading text-lg font-bold">{form.earlyAccessMode ? 'Early access is free' : 'Monetisation is live'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Switching mode changes new agreements only. Existing signed economics remain fixed.</p></div><button type="button" role="switch" aria-checked={form.earlyAccessMode} className={`switch ${form.earlyAccessMode ? 'switch-on' : ''}`} onClick={() => setForm({ ...form, earlyAccessMode: !form.earlyAccessMode })}><span /></button></div></section>
            <section className="card p-6"><p className="eyebrow">Rate card</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{rateFields.map((field) => <label key={field.key} className="field-label">{field.label}<span className="mt-1 block text-[10px] font-normal text-muted">{field.hint}</span><div className="relative mt-2"><input className="field-input pr-10" type="number" min="0" max="100" step="0.01" value={Number(form[field.key]) * 100} onChange={(event) => setNumber(field.key, Number(event.target.value) / 100)} /><span className="absolute right-3 top-3 text-xs text-muted">%</span></div></label>)}<label className="field-label">Late fee<span className="mt-1 block text-[10px] font-normal text-muted">Flat amount at the deadline</span><div className="relative mt-2"><span className="absolute left-3 top-3 text-xs text-muted">₹</span><input className="field-input pl-8" type="number" min="0" step="1" value={form.lateFeePaise / 100} onChange={(event) => setNumber('lateFeePaise', Number(event.target.value) * 100)} /></div></label></div></section>
            <section className="card p-6"><label className="field-label">Matching content deployment ID <span className="font-normal text-muted">(recommended)</span><input className="field-input mt-2" value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)} placeholder={form.currentContentDeploymentId ?? 'Paste successful preview/deployment ID'} /></label><p className="mt-2 text-xs leading-5 text-muted">Link pricing to the website publish that removes stale “free” messaging. The server may require this when commercial mode changes.</p></section>
            <button className="primary-button" type="submit">Review and save</button>
          </div>
          <aside className="card h-fit bg-navy p-6 text-white xl:sticky xl:top-20"><p className="eyebrow text-white/55">Worked example</p><h2 className="mt-1 font-heading text-lg font-bold">₹2,000 Buddy fee</h2><div className="mt-5 space-y-3 text-sm"><PreviewRow label="Traveler fee uplift" value={form.earlyAccessMode ? '₹0' : formatPaise(Math.round(200000 * form.platformFeeUpRate))} /><PreviewRow label="Buddy fee deduction" value={form.earlyAccessMode ? '₹0' : formatPaise(Math.round(200000 * form.platformFeeDownRate))} /><PreviewRow label="TDS on net fee" value={form.earlyAccessMode ? '₹0' : formatPaise(Math.round(200000 * (1 - form.platformFeeDownRate) * form.tdsRate))} /><PreviewRow label="Late fee" value={formatPaise(form.lateFeePaise)} /></div><p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/55">This is a preview only. Agreement snapshots and server reconciliation remain canonical.</p></aside>
        </form>
      </div>
      <CommandDialog open={confirming} title="Save pricing configuration" description="This affects new agreement snapshots. Confirm the website content deployment and record why the commercial terms are changing." confirmLabel="Save pricing" onClose={() => setConfirming(false)} onConfirm={save} />
    </div>
  );
}

function MoneyMetric({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="metric-card"><span className={`metric-accent accent-${tone}`} /><p className="meta-label">{label}</p><p className="num mt-3 text-xl font-extrabold tracking-tight text-navy">{formatPaise(value)}</p></div>; }
function PreviewRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-white/60">{label}</span><strong className="num">{value}</strong></div>; }
