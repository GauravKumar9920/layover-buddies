// ============================================================================
// PAYOUTS PAGE — Admin (Phase 4)
// ============================================================================
// Shows all payout_dispatches rows. Highlights stuck rows (pending > 1h or
// failed). "Retry" button calls issue-refund Edge fn per dispatch row.
// ============================================================================

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, formatINR, relative } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';

interface PayoutRow {
  id: string;
  booking_id: string;
  kind: string;
  gross_paise: number;
  net_paise: number;
  tds_paise: number | null;
  status: string;
  failed_reason: string | null;
  created_at: string;
  completed_at: string | null;
  recipient: { full_name: string | null; email: string } | null;
}

type StatusFilter = 'all' | 'pending' | 'sent' | 'failed';

function statusStyle(status: string): string {
  if (status === 'sent')    return 'text-green-700 bg-green-50';
  if (status === 'failed')  return 'text-red-700 bg-red-50';
  if (status === 'pending') return 'text-yellow-700 bg-yellow-50';
  return 'text-gray-600 bg-gray-100';
}

function isStuck(row: PayoutRow): boolean {
  if (row.status === 'failed') return true;
  if (row.status === 'pending') {
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    return ageMs > 60 * 60 * 1_000; // > 1 hour
  }
  return false;
}

export default function PayoutsPage() {
  const [rows,      setRows]      = useState<PayoutRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [filter,    setFilter]    = useState<StatusFilter>('all');
  const [retrying,  setRetrying]  = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('payout_dispatches')
        .select(`
          id, booking_id, kind, gross_paise, net_paise, tds_paise,
          status, failed_reason, created_at, completed_at,
          recipient:recipient_user_id(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(500);
      if (qErr) throw qErr;
      setRows((data ?? []) as unknown as PayoutRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRetry(dispatchId: string) {
    setRetrying(dispatchId);
    try {
      const { error } = await supabase.functions.invoke('issue-refund', {
        body: { payout_dispatch_id: dispatchId },
      });
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRetrying(null);
    }
  }

  const filtered = filter === 'all'
    ? rows
    : rows.filter(r => r.status === filter);

  const stuckCount = rows.filter(isStuck).length;

  const columns: Column<PayoutRow>[] = [
    {
      key: 'created_at',
      label: 'Created',
      render: r => <span className="text-sm text-muted">{relative(r.created_at)}</span>,
    },
    {
      key: 'kind',
      label: 'Kind',
      render: r => <span className="text-sm font-mono">{r.kind}</span>,
    },
    {
      key: 'recipient',
      label: 'Recipient',
      render: r => (
        <div className="text-sm">
          <div className="font-medium">{r.recipient?.full_name ?? '—'}</div>
          <div className="text-muted text-xs">{r.recipient?.email ?? ''}</div>
        </div>
      ),
    },
    {
      key: 'net_paise',
      label: 'Net amount',
      render: r => (
        <span className="text-sm font-semibold tabular-nums">
          {formatINR(r.net_paise / 100)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: r => (
        <div className="flex flex-col gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${statusStyle(r.status)}`}>
            {r.status}
          </span>
          {r.failed_reason && (
            <span className="text-xs text-muted max-w-[200px] truncate" title={r.failed_reason}>
              {r.failed_reason}
            </span>
          )}
          {r.completed_at && (
            <span className="text-xs text-green-600">{formatDateTime(r.completed_at)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'id',
      label: 'Action',
      render: r => {
        if (!isStuck(r)) return null;
        return (
          <button
            className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            disabled={retrying === r.id}
            onClick={() => handleRetry(r.id)}
          >
            {retrying === r.id ? 'Retrying…' : 'Retry'}
          </button>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Payouts"
        subtitle={
          stuckCount > 0
            ? `${rows.length} total · ⚠️ ${stuckCount} stuck`
            : `${rows.length} total`
        }
      />

      {/* Filter chips */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'sent', 'failed'] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition',
              filter === s
                ? 'bg-primary text-white'
                : 'bg-white border border-divider text-ink hover:border-primary',
            ].join(' ')}
          >
            {s}
          </button>
        ))}
        <button
          className="ml-auto text-sm text-primary hover:underline"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {stuckCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ {stuckCount} payout row{stuckCount === 1 ? '' : 's'} are stuck (pending {'>'} 1h or failed).
          Set <code className="font-mono">RAZORPAY_LIVE_FEATURES_ENABLED=true</code> and click Retry to dispatch.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="No payout dispatches yet."
        keyExtractor={r => r.id}
      />
    </div>
  );
}
