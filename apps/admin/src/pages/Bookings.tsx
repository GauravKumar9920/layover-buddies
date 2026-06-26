import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, formatINR, relative } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';

type BookingStatus =
  | 'pending'
  | 'guide_accepted'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'partial_refund';

interface BookingRow {
  id: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  buddy_cost: number;
  platform_fee: number | null;
  arrival_time: string | null;
  departure_time: string | null;
  created_at: string;
  traveler_id: string;
  guide_id: string;
  traveler: { full_name: string | null; email: string } | null;
  guide: { full_name: string | null; email: string } | null;
}

type StatusFilter = 'all' | 'active' | BookingStatus;

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('bookings')
        .select(
          `
          id, status, payment_status, total_amount, buddy_cost, platform_fee,
          arrival_time, departure_time, created_at, traveler_id, guide_id,
          traveler:users!traveler_id(full_name, email),
          guide:users!guide_id(full_name, email)
        `,
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (filter === 'active') {
        query = query.in('status', ['pending', 'guide_accepted', 'confirmed', 'in_progress']);
      } else if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) setError(error.message);
      else setBookings((data ?? []) as unknown as BookingRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const columns: Column<BookingRow>[] = [
    {
      key: 'parties',
      header: 'Parties',
      render: (b) => (
        <div className="min-w-0">
          <div className="font-medium truncate">
            <span className="text-muted text-xs">T:</span> {b.traveler?.full_name ?? '—'}
          </div>
          <div className="text-xs text-muted truncate">
            <span>G:</span> {b.guide?.full_name ?? '—'}
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge value={b.status} />, width: '140px' },
    {
      key: 'payment',
      header: 'Payment',
      render: (b) => <StatusBadge value={b.payment_status} />,
      width: '120px',
    },
    {
      key: 'total',
      header: 'Total',
      render: (b) => <span className="font-semibold">{formatINR(b.total_amount)}</span>,
      width: '110px',
      align: 'right',
      numeric: true,
    },
    {
      key: 'arrival',
      header: 'Arrival',
      render: (b) => <span className="text-xs text-muted">{formatDateTime(b.arrival_time)}</span>,
      width: '180px',
    },
    {
      key: 'created',
      header: 'Created',
      render: (b) => <span className="text-xs text-muted">{relative(b.created_at)}</span>,
      width: '120px',
    },
    {
      key: 'id',
      header: 'ID',
      render: (b) => <code className="text-[11px] text-muted">{b.id.slice(0, 8)}</code>,
      width: '100px',
    },
  ];

  const pillButton = (key: StatusFilter, label: string) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className={[
        'px-3 h-8 rounded-lg text-xs font-medium transition border capitalize',
        filter === key
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
        title="Bookings"
        subtitle={`${bookings.length} loaded (cap 500)`}
        actions={
          <div className="flex flex-wrap gap-2">
            {pillButton('all', 'All')}
            {pillButton('active', 'Active')}
            {pillButton('pending', 'pending')}
            {pillButton('confirmed', 'confirmed')}
            {pillButton('in_progress', 'in progress')}
            {pillButton('completed', 'completed')}
            {pillButton('cancelled', 'cancelled')}
            {pillButton('disputed', 'disputed')}
          </div>
        }
      />
      {error && (
        <div className="mx-8 mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/30">
          {error}
        </div>
      )}
      <DataTable columns={columns} rows={bookings} rowKey={(b) => b.id} loading={loading} />
    </div>
  );
}
