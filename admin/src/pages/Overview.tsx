import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';

// ============================================================================
// OVERVIEW — the panel's landing page
// ============================================================================
// One screen that answers "is anything on fire, and how are we doing?":
//   1. Action needed — bookings stuck in states the lifecycle can't exit on
//      its own (APP_REVIEW §1.3), open SOS alerts, overdue proofs, disputes.
//   2. Topline counts — users by role, bookings in flight, completed trips.
//   3. Pricing mode — early access on/off at a glance, links to Settings.
// ============================================================================

interface Counts {
  travelers: number;
  guides: number;
  bookingsTotal: number;
  inFlight: number;
  completed: number;
  cancelled: number;
  // Action-needed buckets
  stuckDepositsHeld: number;
  lateFeeDue: number;
  overdueProofs: number;
  reconciling: number;
  disputed: number;
  openSos: number;
}

const IN_FLIGHT = [
  'chat_open', 'agreement_drafting', 'agreement_sent', 'agreement_signed_traveler',
  'agreement_signed_buddy', 'awaiting_deposits', 'deposits_held', 'awaiting_balance',
  'late_fee_due', 'balance_paid', 'trip_ready', 'in_progress', 'awaiting_proofs',
  'reconciling',
  // legacy
  'pending', 'guide_accepted', 'confirmed',
];

export default function OverviewPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [earlyAccess, setEarlyAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nowIso = new Date().toISOString();
        const [users, bookings, sos, settings, overdue] = await Promise.all([
          supabase.from('users').select('role'),
          supabase.from('bookings').select('status, created_at'),
          supabase.from('sos_alerts').select('id', { count: 'exact', head: true })
            .in('status', ['triggered', 'acknowledged']),
          supabase.from('platform_settings').select('early_access_mode').eq('id', 1).maybeSingle(),
          supabase.from('bookings').select('id', { count: 'exact', head: true })
            .eq('status', 'awaiting_proofs').lt('proofs_due_at', nowIso),
        ]);
        if (cancelled) return;

        if (users.error) throw users.error;
        if (bookings.error) throw bookings.error;

        const byStatus = (bookings.data ?? []).reduce<Record<string, number>>((acc, b) => {
          acc[b.status] = (acc[b.status] ?? 0) + 1;
          return acc;
        }, {});

        const roleCount = (users.data ?? []).reduce<Record<string, number>>((acc, u) => {
          acc[u.role] = (acc[u.role] ?? 0) + 1;
          return acc;
        }, {});

        setCounts({
          travelers: roleCount.traveler ?? 0,
          guides: roleCount.guide ?? 0,
          bookingsTotal: bookings.data?.length ?? 0,
          inFlight: IN_FLIGHT.reduce((s, st) => s + (byStatus[st] ?? 0), 0),
          completed: (byStatus.completed ?? 0) + (byStatus.rated ?? 0),
          cancelled: Object.keys(byStatus)
            .filter((s) => s === 'cancelled' || s.startsWith('cancelled_'))
            .reduce((s, k) => s + byStatus[k], 0),
          stuckDepositsHeld: byStatus.deposits_held ?? 0,
          lateFeeDue: byStatus.late_fee_due ?? 0,
          overdueProofs: overdue.count ?? 0,
          reconciling: byStatus.reconciling ?? 0,
          disputed: byStatus.disputed ?? 0,
          openSos: sos.count ?? 0,
        });
        setEarlyAccess(settings.data?.early_access_mode ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load overview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const attention: { label: string; count: number; to: string; desc: string }[] = counts ? [
    { label: 'Open SOS alerts', count: counts.openSos, to: '/sos', desc: 'Triggered or acknowledged — resolve them' },
    { label: 'Disputed trips', count: counts.disputed, to: '/bookings', desc: 'Terminal until you resolve manually' },
    { label: 'Stuck in deposits_held', count: counts.stuckDepositsHeld, to: '/bookings', desc: 'Webhook should advance these within minutes' },
    { label: 'Proofs overdue', count: counts.overdueProofs, to: '/bookings', desc: 'Buddy missed the 24h upload window' },
    { label: 'Late fee due', count: counts.lateFeeDue, to: '/bookings', desc: 'Balance unpaid at T-72h' },
    { label: 'Reconciling', count: counts.reconciling, to: '/bookings', desc: 'Should settle in minutes — investigate if old' },
  ] : [];

  const needsAttention = attention.filter((a) => a.count > 0);

  return (
    <div className="pb-10">
      <PageHeader
        title="Overview"
        subtitle="Detour at a glance"
        actions={
          earlyAccess !== null ? (
            <Link
              to="/settings"
              className={[
                'px-3 h-8 inline-flex items-center rounded-full text-xs font-bold uppercase tracking-wide transition',
                earlyAccess
                  ? 'bg-success/15 text-success hover:bg-success/25'
                  : 'bg-primary/15 text-primary-dark hover:bg-primary/25',
              ].join(' ')}
            >
              {earlyAccess ? '● Early access — free' : '● Monetisation live'}
            </Link>
          ) : undefined
        }
      />

      {error && (
        <div className="mx-8 mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/30">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mx-8 p-10 text-center text-muted">Loading…</div>
      ) : counts && (
        <>
          {/* Action needed */}
          <div className="px-8">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-muted mb-3">
              Needs attention
            </h2>
            {needsAttention.length === 0 ? (
              <div className="p-5 rounded-2xl bg-success/5 border border-success/30 text-sm text-ink">
                ✅ All clear — no SOS alerts, no stuck bookings, no disputes.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {needsAttention.map((a) => (
                  <Link
                    key={a.label}
                    to={a.to}
                    className="bg-white rounded-2xl border border-danger/30 shadow-card p-5 hover:border-danger transition"
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="text-sm font-semibold text-ink">{a.label}</div>
                      <div className="num text-2xl font-extrabold text-danger">{a.count}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted">{a.desc}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Topline counts */}
          <div className="px-8 mt-8">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-muted mb-3">
              Topline
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Stat label="Travelers" value={counts.travelers} to="/users" />
              <Stat label="Buddies" value={counts.guides} to="/users" />
              <Stat label="Bookings" value={counts.bookingsTotal} to="/bookings" />
              <Stat label="In flight" value={counts.inFlight} to="/bookings" accent />
              <Stat label="Completed" value={counts.completed} to="/bookings" />
              <Stat label="Cancelled" value={counts.cancelled} to="/cancellations" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, to, accent }: { label: string; value: number; to: string; accent?: boolean }) {
  return (
    <Link to={to} className="bg-white rounded-2xl border border-divider shadow-card p-5 hover:border-primary transition">
      <div className="text-xs text-muted uppercase tracking-wider">{label}</div>
      <div className={['num mt-2 text-3xl font-extrabold', accent ? 'text-primary' : 'text-navy'].join(' ')}>
        {value.toLocaleString('en-IN')}
      </div>
    </Link>
  );
}
