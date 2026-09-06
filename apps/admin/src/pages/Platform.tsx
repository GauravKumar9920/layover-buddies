import { useState } from 'react';
import CommandDialog from '@/components/CommandDialog';
import DataTable, { type Column } from '@/components/DataTable';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import Pagination, { type CursorHistory } from '@/components/Pagination';
import { ErrorState, Freshness, LoadingState, UnconfiguredState, Warnings } from '@/components/States';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/auth/AuthProvider';
import { adminRequest, idempotencyKey } from '@/lib/api';
import { formatDateTime, relative } from '@/lib/format';
import { useAdminQuery } from '@/lib/useAdminQuery';
import { configState } from '@/lib/supabase';
import type { AdminMember, AdminRole, AuditEntry, HealthCheck, PageData, PlatformHealth } from '@/types/admin';

export function HealthPage({ focus = 'all' }: { focus?: 'all' | 'notifications' | 'jobs' }) {
  const health = useAdminQuery<PlatformHealth>(() => adminRequest('platform.health'), []);
  const checks = health.data?.checks.filter((check) => focus === 'all' || check.id.toLowerCase().includes(focus === 'notifications' ? 'notification' : 'job')) ?? [];
  const title = focus === 'notifications' ? 'Notification delivery' : focus === 'jobs' ? 'Background jobs' : 'System health';
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Platform" title={title} subtitle="Provider configuration, delivery failures and stale jobs stay visible; an unavailable check is never reported healthy." actions={<><button className="secondary-button" onClick={() => void health.refresh()}><Icon name="refresh" className="h-4 w-4" /> Check now</button><Freshness meta={health.meta} refreshing={health.refreshing} /></>} />
      <div className="page-content space-y-4">
        <Warnings warnings={health.meta.warnings} />
        {health.loading && <LoadingState rows={6} />}
        {health.error && <ErrorState title="Health checks unavailable" message={health.error} onRetry={() => void health.refresh()} />}
        {health.data && !health.error && (checks.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{checks.map((check) => <HealthCard key={check.id} check={check} />)}</div> : <UnconfiguredState title="No matching health checks" message={`The backend returned no ${focus === 'all' ? 'platform' : focus} checks. Add the check server-side before relying on this view.`} />)}
      </div>
    </div>
  );
}

export function AuditPage() {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const audit = useAdminQuery<PageData<AuditEntry>>(() => adminRequest('audit.list', { cursor: cursor.current, pageSize: 50, query: query || undefined }), [cursor.current, query]);
  const columns: Column<AuditEntry>[] = [
    { key: 'when', header: 'When', width: '180px', render: (entry) => <div><p className="text-xs font-semibold">{formatDateTime(entry.createdAt)}</p><p className="text-[10px] text-muted">{relative(entry.createdAt)}</p></div> },
    { key: 'actor', header: 'Actor', width: '190px', render: (entry) => <div><p className="text-xs font-semibold">{entry.actor?.fullName ?? entry.actor?.email ?? 'System'}</p><p className="font-mono text-[10px] text-muted">{entry.actor?.id?.slice(0, 8) ?? ''}</p></div> },
    { key: 'action', header: 'Action', render: (entry) => <div><p className="text-sm font-semibold text-navy">{entry.action.replace(/_/g, ' ')}</p><p className="mt-0.5 text-xs text-muted">{entry.targetType}{entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ''}</p></div> },
    { key: 'reason', header: 'Reason', render: (entry) => <p className="max-w-sm text-xs leading-5 text-muted">{entry.reason ?? 'No reason recorded'}</p> },
    { key: 'diff', header: 'Change', width: '110px', render: (entry) => entry.before != null || entry.after != null ? <details><summary className="cursor-pointer text-xs font-bold text-primary">View diff</summary><pre className="absolute right-8 z-20 mt-2 max-h-72 w-96 overflow-auto rounded-xl bg-navy p-3 text-[10px] text-white shadow-xl">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre></details> : <span className="text-xs text-muted">—</span> },
  ];
  return <div className="page-wrap"><PageHeader eyebrow="Platform" title="Audit log" subtitle="Append-only evidence for every privileged command and sensitive admin decision." actions={<Freshness meta={audit.meta} refreshing={audit.refreshing} />} /><div className="page-content space-y-4"><div className="toolbar"><p className="text-xs text-muted">Newest first · append-only</p><label className="table-search"><Icon name="search" className="h-4 w-4" /><input value={query} onChange={(event) => { setQuery(event.target.value); setCursor({ previous: [] }); }} placeholder="Search actions or targets" /></label></div><Warnings warnings={audit.meta.warnings} />{audit.error && <ErrorState title="Audit log unavailable" message={audit.error} onRetry={() => void audit.refresh()} />}{!audit.error && <DataTable columns={columns} rows={audit.data?.items ?? []} rowKey={(entry) => entry.id} loading={audit.loading} emptyMessage="No audit events match this search." />}{!audit.error && audit.data && <Pagination count={audit.data.items.length} history={{ ...cursor, next: audit.meta.nextCursor }} onChange={setCursor} />}</div></div>;
}

export function TeamPage() {
  const auth = useAuth();
  const [selected, setSelected] = useState<AdminMember | null>(null);
  const [role, setRole] = useState<AdminRole>('operations');
  const [active, setActive] = useState(true);
  const members = useAdminQuery<PageData<AdminMember>>(() => adminRequest('admins.list', { pageSize: 100 }), []);
  const canManage = auth.admin?.role === 'owner';
  const columns: Column<AdminMember>[] = [
    { key: 'person', header: 'Administrator', render: (member) => <div><p className="font-semibold text-navy">{member.email ?? member.userId}</p><p className="font-mono text-[10px] text-muted">{member.userId.slice(0, 8)}</p></div> },
    { key: 'role', header: 'Role', width: '130px', render: (member) => <StatusBadge value={member.role} /> },
    { key: 'status', header: 'Access', width: '110px', render: (member) => <StatusBadge value={member.active ? 'active' : 'inactive'} /> },
    { key: 'seen', header: 'Last seen', width: '170px', render: (member) => <span className="text-xs text-muted">{member.lastSeenAt ? relative(member.lastSeenAt) : 'Never'}</span> },
    { key: 'action', header: '', width: '100px', align: 'right', render: (member) => canManage ? <button className="secondary-button compact" onClick={() => { setSelected(member); setRole(member.role); setActive(member.active); }}>Manage</button> : <span className="text-xs text-muted">View only</span> },
  ];
  async function update(reason: string) {
    if (!selected) return;
    await adminRequest('admins.membership.update', { id: selected.id, role, active, reason, idempotencyKey: idempotencyKey('membership', selected.id) });
    await members.refresh();
  }
  return (
    <div className="page-wrap"><PageHeader eyebrow="Platform" title="Admin team" subtitle="Least-privilege roles with mandatory MFA. Backend authorization remains canonical even when an affordance is hidden." actions={<Freshness meta={members.meta} refreshing={members.refreshing} />} /><div className="page-content space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><RoleCard role="owner" body="Everything, including team and pricing." /><RoleCard role="operations" body="Trips, people, leads and safety." /><RoleCard role="finance" body="Ledger, refunds, payouts and pricing." /><RoleCard role="growth" body="Analytics, search and publishing." /></div><Warnings warnings={members.meta.warnings} />{members.error && <ErrorState title="Admin memberships unavailable" message={members.error} onRetry={() => void members.refresh()} />}{!members.error && <DataTable columns={columns} rows={members.data?.items ?? []} rowKey={(member) => member.id} loading={members.loading} emptyMessage="No admin memberships returned." />}</div><CommandDialog open={Boolean(selected)} title="Update admin membership" description="Role and active-state changes take effect server-side and are written to the permanent audit trail." confirmLabel="Update membership" tone={!active ? 'danger' : 'primary'} onClose={() => setSelected(null)} onConfirm={update}><div className="mt-5 grid grid-cols-2 gap-3"><label className="field-label">Role<select className="field-input mt-2" value={role} onChange={(event) => setRole(event.target.value as AdminRole)}><option value="owner">Owner</option><option value="operations">Operations</option><option value="finance">Finance</option><option value="growth">Growth</option></select></label><label className="field-label">Access<select className="field-input mt-2" value={active ? 'active' : 'inactive'} onChange={(event) => setActive(event.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div></CommandDialog></div>
  );
}

export function PlatformSettingsPage() {
  const health = useAdminQuery<PlatformHealth>(() => adminRequest('platform.health'), []);
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Platform" title="Console settings" subtitle="Public browser configuration and server-owned integrations. Secrets are never accepted here." />
      <div className="page-content grid gap-6 xl:grid-cols-2">
        <section className="card p-6"><p className="eyebrow">Browser configuration</p><dl className="mt-4 divide-y divide-divider"><ConfigRow label="Supabase URL" value={configState.config?.supabaseUrl ?? 'Missing'} state={configState.configured} /><ConfigRow label="Public anon key" value={configState.configured ? 'Configured (hidden)' : 'Missing'} state={configState.configured} /><ConfigRow label="Sanity Studio" value={import.meta.env.VITE_SANITY_STUDIO_URL || 'Not configured'} state={Boolean(import.meta.env.VITE_SANITY_STUDIO_URL)} /><ConfigRow label="Support email" value={import.meta.env.VITE_SUPPORT_EMAIL || 'Not configured'} state={Boolean(import.meta.env.VITE_SUPPORT_EMAIL)} /></dl></section>
        <section className="card p-6"><p className="eyebrow">Server integrations</p>{health.loading && <div className="mt-4"><LoadingState rows={3} /></div>}{health.error && <div className="mt-4"><ErrorState title="Integration state unavailable" message={health.error} onRetry={() => void health.refresh()} /></div>}{health.data && <div className="mt-4 space-y-2">{health.data.checks.slice(0, 8).map((check) => <HealthCard key={check.id} check={check} compact />)}</div>}</section>
        <section className="card p-6 xl:col-span-2"><div className="flex gap-3"><Icon name="shield" className="h-5 w-5 shrink-0 text-success" /><div><p className="text-sm font-bold">Credential boundary</p><p className="mt-1 text-xs leading-5 text-muted">This app stores only the public project URL and anon key. Privileged database access, Google service-account credentials and deployment tokens stay behind authenticated Edge Functions.</p></div></div></section>
      </div>
    </div>
  );
}

function HealthCard({ check, compact }: { check: HealthCheck; compact?: boolean }) { return <article className={compact ? 'flex items-center gap-3 rounded-xl border border-divider px-4 py-3' : 'card p-5'}><div className={`health-icon health-${check.state}`}><Icon name={check.state === 'healthy' ? 'check' : check.state === 'unconfigured' ? 'settings' : 'warning'} className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-navy">{check.label}</h2><StatusBadge value={check.state} /></div>{check.message && <p className="mt-1 text-xs leading-5 text-muted">{check.message}</p>}<p className="mt-2 text-[10px] text-muted">{check.checkedAt ? `Checked ${formatDateTime(check.checkedAt)}` : 'Freshness unavailable'}</p></div>{check.href && <a href={check.href} target="_blank" rel="noreferrer" className="text-muted hover:text-primary"><Icon name="external" className="h-4 w-4" /></a>}</article>; }
function RoleCard({ role, body }: { role: string; body: string }) { return <div className="card p-4"><StatusBadge value={role} /><p className="mt-2 text-xs leading-5 text-muted">{body}</p></div>; }
function ConfigRow({ label, value, state }: { label: string; value: string; state: boolean }) { return <div className="flex items-start justify-between gap-5 py-3 first:pt-0 last:pb-0"><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="max-w-[65%] break-all text-right text-xs font-semibold text-ink"><span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${state ? 'bg-success' : 'bg-warn'}`} />{value}</dd></div>; }
