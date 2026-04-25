import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';
import PageHeader from '@/components/PageHeader';

interface BookingFinancials {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number | null;
  buddy_cost: number | null;
  platform_fee: number | null;
  gst_amount: number | null;
  created_at: string;
}

type Window = '7d' | '30d' | '90d' | 'all';

function windowToSince(w: Window): Date | null {
  if (w === 'all') return null;
  const days = w === '7d' ? 7 : w === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export default function RevenuePage() {
  const [rows, setRows] = useState<BookingFinancials[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState<Window>('30d');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('bookings')
        .select('id, status, payment_status, total_amount, buddy_cost, platform_fee, gst_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      const since = windowToSince(window);
      if (since) query = query.gte('created_at', since.toISOString());
      const { data, error } = await query;
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as BookingFinancials[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [window]);

  // Only completed + paid bookings count as "earned" revenue. Confirmed but
  // not-yet-completed count as "pipeline". The rest (pending, cancelled) are
  // excluded from revenue math but shown in the count pill.
  const metrics = useMemo(() => {
    let earnedGross = 0;
    let earnedPlatform = 0;
    let earnedGst = 0;
    let earnedGuidePayout = 0;
    let earnedCount = 0;

    let pipelineGross = 0;
    let pipelineCount = 0;

    let cancelledCount = 0;

    for (const r of rows) {
      const total = Number(r.total_amount ?? 0);
      const platformFee = Number(r.platform_fee ?? 0);
      const gst = Number(r.gst_amount ?? 0);
      const buddyCost = Number(r.buddy_cost ?? 0);

      if (r.status === 'completed' && r.payment_status === 'paid') {
        earnedGross += total;
        earnedPlatform += platformFee;
        earnedGst += gst;
        earnedGuidePayout += buddyCost;
        earnedCount += 1;
      } else if (
        (r.status === 'confirmed' || r.status === 'in_progress' || r.status === 'guide_accepted') &&
        r.payment_status !== 'refunded'
      ) {
        pipelineGross += total;
        pipelineCount += 1;
      } else if (r.status === 'cancelled') {
        cancelledCount += 1;
      }
    }

    return {
      earnedGross,
      earnedPlatform,
      earnedGst,
      earnedGuidePayout,
      earnedCount,
      pipelineGross,
      pipelineCount,
      cancelledCount,
      avgOrderValue: earnedCount > 0 ? earnedGross / earnedCount : 0,
    };
  }, [rows]);

  const windowLabel = window === 'all' ? 'all time' : `last ${window.replace('d', ' days')}`;

  const pillButton = (key: Window, label: string) => (
    <button
      key={key}
      onClick={() => setWindow(key)}
      className={[
        'px-3 h-8 rounded-lg text-xs font-medium transition border',
        window === key
          ? 'bg-primary text-white border-primary'
          : 'bg-white text-ink border-divider hover:border-primary',
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="pb-10">
      <PageHeader
        title="Revenue"
        subtitle={`Completed + paid · ${windowLabel}`}
        actions={
          <div className="flex gap-2">
            {pillButton('7d', '7d')}
            {pillButton('30d', '30d')}
            {pillButton('90d', '90d')}
            {pillButton('all', 'All')}
          </div>
        }
      />

      {error && (
        <div className="mx-8 mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/30">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mx-8 p-10 text-center text-muted">Loading…</div>
      ) : (
        <>
          <div className="px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Gross revenue"
              value={formatINR(metrics.earnedGross)}
              sub={`${metrics.earnedCount} bookings`}
              accent="primary"
            />
            <MetricCard
              label="Platform take"
              value={formatINR(metrics.earnedPlatform)}
              sub="before GST"
              accent="secondary"
            />
            <MetricCard
              label="Guide payouts"
              value={formatINR(metrics.earnedGuidePayout)}
              sub="owed to guides"
            />
            <MetricCard
              label="Avg booking"
              value={formatINR(metrics.avgOrderValue)}
              sub="earned / bookings"
            />
          </div>

          <div className="px-8 mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="Pipeline (confirmed / active)"
              value={formatINR(metrics.pipelineGross)}
              sub={`${metrics.pipelineCount} bookings`}
            />
            <MetricCard
              label="GST collected"
              value={formatINR(metrics.earnedGst)}
              sub="on platform fee"
            />
            <MetricCard
              label="Cancelled"
              value={`${metrics.cancelledCount}`}
              sub="excluded from revenue"
            />
          </div>

          <div className="mx-8 mt-8 p-4 rounded-xl bg-white border border-divider text-xs text-muted">
            <strong className="text-ink">Methodology.</strong> Revenue counts bookings with{' '}
            <code>status = 'completed'</code> AND <code>payment_status = 'paid'</code>. Pipeline
            counts <code>confirmed</code>, <code>in_progress</code>, and{' '}
            <code>guide_accepted</code> bookings whose payment isn't refunded. Numbers come from{' '}
            <code>bookings.total_amount</code> / <code>platform_fee</code> /{' '}
            <code>buddy_cost</code> / <code>gst_amount</code> — i.e. what was{' '}
            <em>charged</em>, not necessarily what has reached the bank. When Razorpay is wired
            up, swap to reconciling against payment webhook events.
          </div>
        </>
      )}
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'primary' | 'secondary';
}

function MetricCard({ label, value, sub, accent }: MetricProps) {
  const accentClass =
    accent === 'primary'
      ? 'text-primary'
      : accent === 'secondary'
        ? 'text-secondary-dark'
        : 'text-navy';
  return (
    <div className="bg-white rounded-2xl border border-divider shadow-card p-5">
      <div className="text-xs text-muted uppercase tracking-wider">{label}</div>
      <div className={`num mt-2 text-3xl font-extrabold ${accentClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
