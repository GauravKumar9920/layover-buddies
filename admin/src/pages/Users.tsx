import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: 'traveler' | 'guide' | 'admin';
  is_verified: boolean | null;
  avatar_url: string | null;
  created_at: string;
}

type RoleFilter = 'all' | 'traveler' | 'guide' | 'admin';

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoleFilter>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('users')
        .select('id, email, full_name, role, is_verified, avatar_url, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (filter !== 'all') query = query.eq('role', filter);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) setError(error.message);
      else setUsers((data ?? []) as UserRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const counts = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(u.full_name ?? u.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{u.full_name ?? '—'}</div>
            <div className="text-xs text-muted truncate">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <StatusBadge value={u.role} />, width: '120px' },
    {
      key: 'verified',
      header: 'Verified',
      render: (u) =>
        u.is_verified ? (
          <span className="text-success">✓</span>
        ) : (
          <span className="text-muted">—</span>
        ),
      width: '100px',
      align: 'center',
    },
    {
      key: 'created',
      header: 'Joined',
      render: (u) => <span className="text-muted">{formatDate(u.created_at)}</span>,
      width: '140px',
    },
    {
      key: 'id',
      header: 'ID',
      render: (u) => <code className="text-[11px] text-muted">{u.id.slice(0, 8)}</code>,
      width: '100px',
    },
  ];

  const filterButton = (key: RoleFilter, label: string, count?: number) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className={[
        'px-3 h-8 rounded-lg text-xs font-medium transition border',
        filter === key
          ? 'bg-primary text-white border-primary'
          : 'bg-white text-ink border-divider hover:border-primary',
      ].join(' ')}
    >
      {label}
      {count !== undefined && <span className="ml-1 opacity-70">· {count}</span>}
    </button>
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Users"
        subtitle={`${users.length} loaded (cap 500) · sorted by signup, newest first`}
        actions={
          <div className="flex gap-2">
            {filterButton('all', 'All')}
            {filterButton('traveler', 'Travelers', counts.traveler)}
            {filterButton('guide', 'Guides', counts.guide)}
            {filterButton('admin', 'Admins', counts.admin)}
          </div>
        }
      />
      {error && (
        <div className="mx-8 mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/30">
          {error}
        </div>
      )}
      <DataTable columns={columns} rows={users} rowKey={(u) => u.id} loading={loading} />
    </div>
  );
}
