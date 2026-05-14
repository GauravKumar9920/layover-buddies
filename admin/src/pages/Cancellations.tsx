// ============================================================================
// CANCELLATIONS PAGE — Admin (Phase 3+4)
// ============================================================================
// Shows all bookings with a cancelled_* status. Columns: trigger, tier,
// parties, refund summary, payout dispatch status. "Re-issue" button calls
// issue-refund Edge fn for stuck stub-mode rows.
// ============================================================================

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatINR, relative } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';

interface DispatchRow {
  id: string;
  kind: string;
  net_paise: number;
  status: string;
  failed_reason: string | null;
  completed_at: string | null;
}

interface CancellationRow {
  id: string;
  status: string;
  cancellation_trigger_event: string | null;
  cancelled_at: string | null;
  cancelled_resolution_jsonb: Record<string, unknown> | null;
  traveler: { full_name: string | null; email: string } | null;
  guide:    { full_name: string | null; email: string } | null;
  payout_dispatches: DispatchRow[];
}

type TierFilter = 'all' | 'voluntary' | 't_minus_12_no_pay' | 'force_majeure_verified' | 'deposit_window_expired';

function tierLabel(trigger: string | null): string {
  switch (trigger) {
    case 'voluntary':                   return 'Voluntary';
    case 't_minus_12_no_pay':           return 'No-pay cancel';
    case 'force_majeure_verified':      return 'Force majeure';
    case 'deposit_window_expired':      return 'Pre-signing';
    default:                            return trigger ?? '—';
  }
}

function dispatchStatusColor(status: string): string {
  if (status === 'sent') return 'text-green-700 bg-green-50';
  if (status === 'failed') return 'text-red-700 bg-red-50';
  return 'text-yellow-700 bg-yellow-50';
}

export default function CancellationsPage() {
  const [rows,    setRows]    = useState<CancellationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<TierFilter>('all');
  const [reissuing, setReissuing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('bookings')
          .select(`
            id, status, cancellation_trigger_event, cancelled_at,
            cancelled_resolution_jsonb,
            traveler:traveler_id(full_name, email),
            guide:guide_id(full_name, email),
            payout_dispatches(id, kind, net_paise, status, failed_reason, completed_at)
          `)
          .in('status', [
            'cancelled',
            'cancelled_no_pay',
            'cancelled_traveler_voluntary',
            'cancelled_buddy',
            'cancelled_force_majeure',
            'cancelled_pre_signing',
            'cancelled_no_deposit',
          ])
          .order('cancelled_at', { ascending: false })
          .limit(200);

        if (qErr) throw qErr;
        if (!cancelled) setRows((data ?? []) as unknown as CancellationRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleReissue(bookingId: string) {
    setReissuing(bookingId);
    try {
      const { error } = await supabase.functions.invoke('issue-refund', {
        body: { booking_id: bookingId },
      });
      if (error) throw error;
      alert('Re-issue dispatched. Refresh to see updated statuses.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Re-issue failed');
    } finally {
      setReissuing(null);
    }
  }

  const filtered = filter === 'all'
    ? rows
    : rows.filter(r => r.cancellation_trigger_event === filter);

  const columns: Column<CancellationRow>[] = [
    {
      key: 'cancelled_at',
      header: 'Cancelled',
      render: (r) => <span className="text-sm text-muted">{relative(r.cancelled_at)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: 'cancellation_trigger_event',
      header: 'Trigger',
      render: (r) => (
        <span className="text-sm font-medium">
          {tierLabel(r.cancellation_trigger_event)}
        </span>
      ),
    },
    {
      key: 'traveler',
      header: 'Traveler',
      render: (r) => (
        <span className="text-sm">
          {r.traveler?.full_name ?? r.traveler?.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'guide',
      header: 'Buddy',
      render: (r) => (
        <span className="text-sm">
          {r.guide?.full_name ?? r.guide?.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'payout_dispatches',
      header: 'Payout dispatches',
      render: (r) => (
        <div className="flex flex-col gap-1">
          {r.payout_dispatches?.length ? r.payout_dispatches.map(d => (
            <div key={d.id} className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dispatchStatusColor(d.status)}`}>
                {d.kind} · {formatINR(d.net_paise / 100)} · {d.status}
              </span>
              {d.failed_reason === 'razorpay_live_not_configured' && (
                <span className="text-xs text-yellow-600">stubbed</span>
              )}
            </div>
          )) : <span className="text-sm text-muted">—</span>}
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (r) => {
        const hasStuck = r.payout_dispatches?.some(
          d => d.status === 'pending' || d.failed_reason === 'razorpay_live_not_configured',
        );
        if (!hasStuck) return null;
        return (
          <button
            className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            disabled={reissuing === r.id}
            onClick={() => handleReissue(r.id)}
          >
            {reissuing === r.id ? 'Reissuing…' : 'Re-issue'}
          </button>
        );
      },
    },
  ];

  const TIER_FILTERS: { value: TierFilter; label: string }[] = [
    { value: 'all',                        label: 'All' },
    { value: 'voluntary',                  label: 'Voluntary' },
    { value: 't_minus_12_no_pay',          label: 'No-pay' },
    { value: 'force_majeure_verified',     label: 'Force majeure' },
    { value: 'deposit_window_expired',     label: 'Pre-signing' },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Cancellations"
        subtitle={`${rows.length} cancelled booking${rows.length === 1 ? '' : 's'}`}
      />

      {/* Filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TIER_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition',
              filter === value
                ? 'bg-primary text-white'
                : 'bg-white border border-divider text-ink hover:border-primary',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No cancellations yet."
      />
    </div>
  );
}
