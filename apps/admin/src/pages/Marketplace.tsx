import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DataTable, { type Column } from '@/components/DataTable';
import CommandDialog from '@/components/CommandDialog';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import Pagination, { type CursorHistory } from '@/components/Pagination';
import { EmptyState, ErrorState, Freshness, LoadingState, UnconfiguredState, Warnings } from '@/components/States';
import StatusBadge from '@/components/StatusBadge';
import { adminRequest, idempotencyKey } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useAdminQuery } from '@/lib/useAdminQuery';
import type { PageData, UserDetail, UserSummary } from '@/types/admin';
import { useAuth } from '@/auth/AuthProvider';
import { canMutate } from '@/lib/permissions';

const PAGE_SIZE = 30;

export function PeoplePage({ role }: { role: 'traveler' | 'guide' }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<CursorHistory>({ previous: [] });
  const people = useAdminQuery<PageData<UserSummary>>(
    () => adminRequest('users.list', { cursor: cursor.current, pageSize: PAGE_SIZE, status: role, query: query || undefined }),
    [cursor.current, role, query],
  );
  const isBuddy = role === 'guide';
  const columns: Column<UserSummary>[] = [
    { key: 'person', header: isBuddy ? 'Buddy' : 'Traveler', render: (user) => <Person user={user} /> },
    ...(isBuddy ? [
      { key: 'university', header: 'University', render: (user: UserSummary) => <span className="text-xs">{user.university ?? 'Not provided'}</span> },
      { key: 'readiness', header: 'Profile ready', width: '130px', render: (user: UserSummary) => <Completeness value={user.profileCompleteness} /> },
      { key: 'quality', header: 'Quality', width: '130px', render: (user: UserSummary) => <div><p className="num text-xs font-bold">{user.rating != null ? `★ ${user.rating.toFixed(1)}` : 'No rating'}</p><p className="text-[11px] text-muted">{user.totalTrips ?? 0} trips</p></div> },
      { key: 'response', header: 'Response', width: '110px', render: (user: UserSummary) => <span className="text-xs text-muted">{user.responseTimeMinutes != null ? `${user.responseTimeMinutes} min` : '—'}</span> },
    ] as Column<UserSummary>[] : [
      { key: 'country', header: 'Country', render: (user: UserSummary) => <span className="text-xs">{user.nationality ?? 'Not provided'}</span> },
      { key: 'trips', header: 'Trips', width: '90px', render: (user: UserSummary) => <span className="num text-sm font-bold">{user.totalTrips ?? 0}</span> },
    ] as Column<UserSummary>[]),
    { key: 'trust', header: 'Trust', width: '120px', render: (user) => user.isBanned ? <StatusBadge value="suspended" /> : user.isVerified ? <StatusBadge value="verified" /> : <StatusBadge value="unverified" /> },
    { key: 'joined', header: 'Joined', width: '120px', render: (user) => <span className="text-xs text-muted">{formatDate(user.joinedAt)}</span> },
    { key: 'open', header: '', width: '38px', render: () => <Icon name="chevron" className="h-4 w-4 text-muted" /> },
  ];
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Marketplace" title={isBuddy ? 'Buddies' : 'Travelers'} subtitle={isBuddy ? 'Readiness, response quality and trust—not an approval gate. Buddies still auto-activate per product policy.' : 'Profiles, trip history and service context for every traveler.'} actions={<Freshness meta={people.meta} refreshing={people.refreshing} />} />
      <div className="page-content space-y-4">
        <div className="toolbar"><p className="text-xs font-semibold text-muted">Server-paginated · newest first</p><label className="table-search"><Icon name="search" className="h-4 w-4" /><input value={query} onChange={(event) => { setQuery(event.target.value); setCursor({ previous: [] }); }} placeholder={`Search ${isBuddy ? 'Buddies' : 'travelers'}`} /></label></div>
        <Warnings warnings={people.meta.warnings} />
        {people.error && <ErrorState title={`${isBuddy ? 'Buddy' : 'Traveler'} data unavailable`} message={people.error} onRetry={() => void people.refresh()} />}
        {!people.error && <DataTable columns={columns} rows={people.data?.items ?? []} rowKey={(user) => user.id} loading={people.loading} onRowClick={(user) => navigate(`/marketplace/users/${user.id}`)} emptyMessage={`No ${isBuddy ? 'Buddies' : 'travelers'} match this search.`} />}
        {!people.error && people.data && <Pagination count={people.data.items.length} history={{ ...cursor, next: people.meta.nextCursor }} onChange={setCursor} />}
      </div>
    </div>
  );
}

export function UserDetailPage() {
  const { id = '' } = useParams();
  const { admin } = useAuth();
  const [suspensionOpen, setSuspensionOpen] = useState(false);
  const user = useAdminQuery<UserDetail>(() => adminRequest('users.get', { id }), [id]);
  if (user.loading) return <div className="page-wrap"><PageHeader eyebrow="Marketplace" title="Profile workspace" /><div className="page-content"><LoadingState rows={5} /></div></div>;
  if (user.error || !user.data) return <div className="page-wrap"><PageHeader eyebrow="Marketplace" title="Profile workspace" /><div className="page-content"><ErrorState title="Profile unavailable" message={user.error ?? 'The server returned no profile.'} onRetry={() => void user.refresh()} /></div></div>;
  const item = user.data;
  const canSuspend = canMutate(admin?.role, 'operations');
  async function updateSuspension(reason: string) {
    const result = await adminRequest('users.suspension', { id: item.id, suspended: !item.isBanned, reason, idempotencyKey: idempotencyKey('suspension', item.id) });
    if (!result.data.authBanEnforced) throw new Error('The identity ban was not enforced. The server kept the account state unchanged; review platform health.');
    await user.refresh();
  }
  return (
    <div className="page-wrap">
      <PageHeader eyebrow={`${item.role === 'guide' ? 'Buddy' : 'Traveler'} profile`} title={item.fullName ?? 'Unnamed member'} subtitle={`${item.email ?? 'Email protected'} · joined ${formatDate(item.joinedAt)}`} actions={<><StatusBadge value={item.isBanned ? 'suspended' : item.isVerified ? 'verified' : 'unverified'} />{canSuspend && <button className={item.isBanned ? 'secondary-button' : 'danger-button'} onClick={() => setSuspensionOpen(true)}>{item.isBanned ? 'Reinstate account' : 'Suspend account'}</button>}<Freshness meta={user.meta} refreshing={user.refreshing} /></>} />
      <div className="page-content space-y-6">
        <Warnings warnings={user.meta.warnings} />
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="card p-6 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] bg-gradient-to-br from-primary to-secondary text-2xl font-extrabold text-white">{item.avatarUrl ? <img className="h-full w-full object-cover" src={item.avatarUrl} alt="" /> : (item.fullName ?? item.email ?? '?').slice(0, 1).toUpperCase()}</div><h2 className="mt-4 font-heading text-xl font-bold">{item.fullName ?? 'Unnamed member'}</h2><p className="mt-1 text-xs text-muted">{item.email}</p>{item.bio && <p className="mt-4 text-left text-sm leading-6 text-muted">{item.bio}</p>}</section>
            <section className="card p-5"><p className="eyebrow">Profile readiness</p><div className="mt-3"><Completeness value={item.profileCompleteness} large /></div><p className="mt-3 text-xs leading-5 text-muted">Completeness helps operations offer coaching; it never replaces Detour’s Buddy auto-approval rule.</p></section>
            <section className="card p-5"><p className="eyebrow">Trust signals</p><dl className="mt-3 space-y-2">{Object.entries(item.verification ?? {}).map(([label, value]) => <div key={label} className="flex items-center justify-between"><dt className="text-xs capitalize text-muted">{label.replace(/_/g, ' ')}</dt><dd className={value ? 'text-success' : 'text-muted'}>{value ? '✓' : '—'}</dd></div>)}{!Object.keys(item.verification ?? {}).length && <p className="text-xs text-muted">No verification detail available.</p>}</dl></section>
          </aside>
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(item.stats ?? {}).map(([label, value]) => <div key={label} className="metric-card"><p className="meta-label capitalize">{label.replace(/([A-Z])/g, ' $1')}</p><p className="metric-value">{value.toLocaleString('en-IN')}</p></div>)}{!Object.keys(item.stats ?? {}).length && <div className="col-span-full"><EmptyState title="No operational metrics yet" message="Trip, response and review metrics will appear after activity is recorded." /></div>}</section>
            <section className="card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Recent activity</p><h2 className="section-title mt-1">Trips</h2></div></div><div className="mt-4 divide-y divide-divider">{item.recentBookings?.length ? item.recentBookings.map((booking) => <Link key={booking.id} to={`/operations/bookings/${booking.id}`} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{booking.itineraryTitle ?? 'Custom Detour'}</p><p className="mt-0.5 text-xs text-muted">{formatDate(booking.tripStartsAt ?? booking.createdAt)}</p></div><StatusBadge value={booking.status} /><Icon name="chevron" className="h-4 w-4 text-muted" /></Link>) : <p className="py-8 text-center text-sm text-muted">No recent trips.</p>}</div></section>
            <section className="card p-5 sm:p-6"><p className="eyebrow">Reviews</p><div className="mt-4 space-y-3">{item.reviews?.length ? item.reviews.map((review) => <blockquote key={review.id} className="rounded-xl bg-cream p-4"><p className="text-sm font-bold text-warn">{'★'.repeat(Math.round(review.rating))}</p><p className="mt-2 text-sm leading-6 text-ink">{review.comment ?? 'Rating only'}</p><footer className="mt-2 text-[11px] text-muted">{formatDate(review.createdAt)}</footer></blockquote>) : <p className="py-8 text-center text-sm text-muted">No reviews yet.</p>}</div></section>
          </div>
        </div>
      </div>
      <CommandDialog open={suspensionOpen} title={item.isBanned ? 'Reinstate account' : 'Suspend account'} description={item.isBanned ? 'Restore sign-in only after the case and identity have been verified. The server applies the Auth change and database audit transaction together.' : 'This blocks sign-in as well as recording the marketplace suspension. If identity enforcement fails, the command fails closed.'} confirmLabel={item.isBanned ? 'Reinstate member' : 'Suspend member'} tone={item.isBanned ? 'primary' : 'danger'} onClose={() => setSuspensionOpen(false)} onConfirm={updateSuspension} />
    </div>
  );
}

export function MarketplaceCapabilityPage({ kind }: { kind: 'itineraries' | 'reviews' }) {
  const copy = kind === 'itineraries'
    ? { title: 'Itineraries', message: 'The secure admin API does not expose itinerary moderation yet. This page is intentionally blocked instead of falling back to privileged browser table access.' }
    : { title: 'Reviews', message: 'The secure admin API does not expose review moderation yet. Reviews remain visible inside user and booking workspaces where the server provides them.' };
  return <div className="page-wrap"><PageHeader eyebrow="Marketplace" title={copy.title} subtitle="A bounded operations surface; no silent browser database fallback." /><div className="page-content"><UnconfiguredState title={`${copy.title} API not connected`} message={copy.message} /></div></div>;
}

function Person({ user }: { user: UserSummary }) {
  return <div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-secondary text-xs font-extrabold text-white">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (user.fullName ?? user.email ?? '?').slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold text-navy">{user.fullName ?? 'Unnamed'}</p><p className="truncate text-xs text-muted">{user.email ?? 'Email protected'}</p></div></div>;
}

function Completeness({ value, large }: { value?: number | null; large?: boolean }) {
  if (value == null) return <span className="text-xs text-muted">Unavailable</span>;
  const percentage = Math.max(0, Math.min(100, Math.round(value)));
  return <div className={large ? '' : 'min-w-24'}><div className="flex items-center justify-between gap-3"><span className={`num font-bold ${large ? 'text-xl' : 'text-xs'}`}>{percentage}%</span>{large && <span className="text-xs text-muted">complete</span>}</div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-divider"><div className={`h-full rounded-full ${percentage >= 80 ? 'bg-success' : percentage >= 50 ? 'bg-warn' : 'bg-danger'}`} style={{ width: `${percentage}%` }} /></div></div>;
}
