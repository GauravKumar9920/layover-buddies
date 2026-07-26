import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, relative } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';

type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
type ReportReason = 'harassment' | 'safety' | 'inappropriate' | 'spam' | 'scam' | 'other';

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  booking_id: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reporter: { full_name: string | null; email: string; role: string } | null;
  reported: { full_name: string | null; email: string; role: string } | null;
}

type StatusFilter = 'all' | 'open' | ReportStatus;

const REASON_LABEL: Record<ReportReason, string> = {
  harassment: 'Harassment / abuse',
  safety: 'Safety concern',
  inappropriate: 'Inappropriate',
  scam: 'Scam / fraud',
  spam: 'Spam',
  other: 'Other',
};

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState(0);

  // Independent of `rows`/`filter` — rows is scoped to whatever view the user
  // has selected, so deriving the "open" count from it made the subtitle wrong
  // whenever the user was looking at e.g. the "actioned" filter.
  const loadOpenCount = async () => {
    const { count, error } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'reviewing']);
    if (!error) setOpenCount(count ?? 0);
  };

  const load = async (f: StatusFilter) => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from('reports')
      .select(
        `
        id, reporter_id, reported_user_id, booking_id, reason, details,
        status, admin_notes, created_at, reviewed_at,
        reporter:users!reporter_id(full_name, email, role),
        reported:users!reported_user_id(full_name, email, role)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(500);
    if (f === 'open') {
      query = query.in('status', ['open', 'reviewing']);
    } else if (f !== 'all') {
      query = query.eq('status', f);
    }
    const { data, error } = await query;
    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as ReportRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load(filter);
    void loadOpenCount();
  }, [filter]);

  async function updateStatus(row: ReportRow, next: ReportStatus) {
    setBusyId(row.id);
    const patch: Partial<Pick<ReportRow, 'status' | 'reviewed_at'>> = { status: next };
    if (next !== 'open') patch.reviewed_at = new Date().toISOString();
    const { error } = await supabase.from('reports').update(patch).eq('id', row.id);
    if (error) {
      setError(error.message);
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, ...(patch as Partial<ReportRow>) } : r)),
      );
      void loadOpenCount();
    }
    setBusyId(null);
  }

  const columns: Column<ReportRow>[] = [
    {
      key: 'when',
      header: 'When',
      render: (r) => (
        <div>
          <div className="font-medium">{relative(r.created_at)}</div>
          <div className="text-xs text-muted">{formatDateTime(r.created_at)}</div>
        </div>
      ),
      width: '180px',
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} />, width: '120px' },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => <span className="text-sm font-medium">{REASON_LABEL[r.reason] ?? r.reason}</span>,
      width: '150px',
    },
    {
      key: 'reported',
      header: 'Reported user',
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{r.reported?.full_name ?? '—'}</div>
          <div className="text-xs text-muted truncate">
            {r.reported?.email} · {r.reported?.role}
          </div>
        </div>
      ),
    },
    {
      key: 'reporter',
      header: 'Reported by',
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{r.reporter?.full_name ?? '—'}</div>
          <div className="text-xs text-muted truncate">{r.reporter?.email}</div>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (r) => (
        <div className="max-w-[240px]">
          {r.details ? (
            <span className="text-xs text-ink">{r.details}</span>
          ) : (
            <span className="text-xs text-muted italic">No details</span>
          )}
          {r.booking_id && (
            <code className="block text-[11px] text-muted mt-1">booking {r.booking_id.slice(0, 8)}</code>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === 'open' && (
            <button
              disabled={busyId === r.id}
              onClick={() => updateStatus(r, 'reviewing')}
              className="px-2.5 h-8 rounded-md text-xs font-medium bg-warn/10 text-warn border border-warn/30 hover:bg-warn/20 disabled:opacity-50"
            >
              Review
            </button>
          )}
          {r.status !== 'actioned' && r.status !== 'dismissed' && (
            <>
              <button
                disabled={busyId === r.id}
                onClick={() => updateStatus(r, 'actioned')}
                className="px-2.5 h-8 rounded-md text-xs font-medium bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 disabled:opacity-50"
              >
                Action
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => updateStatus(r, 'dismissed')}
                className="px-2.5 h-8 rounded-md text-xs font-medium bg-white text-muted border border-divider hover:border-ink disabled:opacity-50"
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      ),
      width: '210px',
    },
  ];

  const pillButton = (key: StatusFilter, label: string) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className={[
        'px-3 h-8 rounded-lg text-xs font-medium transition border capitalize',
        filter === key
          ? 'bg-danger text-white border-danger'
          : 'bg-white text-ink border-divider hover:border-danger',
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Reports"
        subtitle={
          openCount > 0
            ? `⚠ ${openCount} open — review and action or dismiss`
            : 'No open reports right now.'
        }
        actions={
          <div className="flex gap-2">
            {pillButton('open', 'Open')}
            {pillButton('reviewing', 'reviewing')}
            {pillButton('actioned', 'actioned')}
            {pillButton('dismissed', 'dismissed')}
            {pillButton('all', 'All')}
          </div>
        }
      />
      {error && (
        <div className="mx-8 mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/30">
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage={filter === 'open' ? 'No open reports — all clear.' : 'No reports in this view.'}
      />
    </div>
  );
}
