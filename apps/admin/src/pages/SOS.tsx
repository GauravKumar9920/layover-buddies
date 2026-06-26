import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, relative } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import DataTable, { Column } from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';

type SosStatus = 'triggered' | 'acknowledged' | 'resolved';

interface SosRow {
  id: string;
  booking_id: string;
  triggered_by: string;
  latitude: number;
  longitude: number;
  status: SosStatus;
  resolution_notes: string | null;
  triggered_at: string;
  resolved_at: string | null;
  user: { full_name: string | null; email: string; role: string } | null;
  booking: { id: string; status: string } | null;
}

type StatusFilter = 'all' | 'open' | SosStatus;

// ── Map preview modal ────────────────────────────────────────────────────────
function MapPreviewModal({
  row,
  onClose,
}: {
  row: SosRow;
  onClose: () => void;
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const src = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${row.latitude},${row.longitude}&zoom=16&maptype=roadmap`
    : '';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-[520px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-divider">
          <div>
            <p className="font-semibold text-ink text-sm">SOS Location</p>
            <p className="text-xs text-muted mt-0.5">
              {row.user?.full_name ?? row.user?.email ?? 'Unknown'} ·{' '}
              {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-xl leading-none ml-4 mt-0.5"
            aria-label="Close map"
          >
            ×
          </button>
        </div>

        {/* Map */}
        <div className="relative" style={{ height: 340 }}>
          {src ? (
            <iframe
              src={src}
              width="100%"
              height="340"
              style={{ border: 'none', display: 'block' }}
              allowFullScreen
              loading="lazy"
              title="SOS alert location"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-divider/30 text-muted text-sm">
              VITE_GOOGLE_MAPS_API_KEY not set — add it to admin/.env.local
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-divider">
          <p className="text-xs text-muted">
            Triggered {formatDateTime(row.triggered_at)}
          </p>
          <a
            href={`https://maps.google.com/?q=${row.latitude},${row.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-xs font-medium hover:underline"
          >
            Open in Google Maps ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SosPage() {
  const [rows, setRows] = useState<SosRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mapPreviewRow, setMapPreviewRow] = useState<SosRow | null>(null);

  const load = async (f: StatusFilter) => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from('sos_alerts')
      .select(
        `
        id, booking_id, triggered_by, latitude, longitude, status,
        resolution_notes, triggered_at, resolved_at,
        user:users!triggered_by(full_name, email, role),
        booking:bookings!booking_id(id, status)
      `,
      )
      .order('triggered_at', { ascending: false })
      .limit(500);
    if (f === 'open') {
      query = query.in('status', ['triggered', 'acknowledged']);
    } else if (f !== 'all') {
      query = query.eq('status', f);
    }
    const { data, error } = await query;
    if (error) setError(error.message);
    else setRows((data ?? []) as unknown as SosRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  async function updateStatus(row: SosRow, next: SosStatus) {
    setBusyId(row.id);
    const patch: Partial<Pick<SosRow, 'status' | 'resolved_at'>> = { status: next };
    if (next === 'resolved') patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('sos_alerts').update(patch).eq('id', row.id);
    if (error) {
      setError(error.message);
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, ...(patch as Partial<SosRow>) } : r)),
      );
    }
    setBusyId(null);
  }

  const columns: Column<SosRow>[] = [
    {
      key: 'when',
      header: 'When',
      render: (r) => (
        <div>
          <div className="font-medium">{relative(r.triggered_at)}</div>
          <div className="text-xs text-muted">{formatDateTime(r.triggered_at)}</div>
        </div>
      ),
      width: '190px',
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} />, width: '130px' },
    {
      key: 'who',
      header: 'Triggered by',
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{r.user?.full_name ?? '—'}</div>
          <div className="text-xs text-muted truncate">
            {r.user?.email} · {r.user?.role}
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (r) => (
        <div className="space-y-1">
          <a
            href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-xs block"
          >
            {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)} ↗
          </a>
          <button
            onClick={() => setMapPreviewRow(r)}
            className="text-xs text-muted hover:text-primary transition flex items-center gap-1"
          >
            <span>🗺️</span> Preview map
          </button>
        </div>
      ),
      width: '180px',
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (r) => (
        <code className="text-[11px] text-muted">{r.booking_id.slice(0, 8)}</code>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-2">
          {r.status === 'triggered' && (
            <button
              disabled={busyId === r.id}
              onClick={() => updateStatus(r, 'acknowledged')}
              className="px-2.5 h-8 rounded-md text-xs font-medium bg-warn/10 text-warn border border-warn/30 hover:bg-warn/20 disabled:opacity-50"
            >
              Ack
            </button>
          )}
          {r.status !== 'resolved' && (
            <button
              disabled={busyId === r.id}
              onClick={() => updateStatus(r, 'resolved')}
              className="px-2.5 h-8 rounded-md text-xs font-medium bg-success/10 text-success border border-success/30 hover:bg-success/20 disabled:opacity-50"
            >
              Resolve
            </button>
          )}
        </div>
      ),
      width: '170px',
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

  const openCount = rows.filter((r) => r.status !== 'resolved').length;

  return (
    <div className="pb-10">
      <PageHeader
        title="SOS events"
        subtitle={
          openCount > 0
            ? `⚠ ${openCount} open — acknowledge & resolve when handled`
            : 'No open SOS events right now.'
        }
        actions={
          <div className="flex gap-2">
            {pillButton('open', 'Open')}
            {pillButton('triggered', 'triggered')}
            {pillButton('acknowledged', 'acknowledged')}
            {pillButton('resolved', 'resolved')}
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
        emptyMessage={
          filter === 'open'
            ? 'No open SOS events — all clear.'
            : 'No SOS events in this view.'
        }
      />

      {/* Map preview modal */}
      {mapPreviewRow && (
        <MapPreviewModal row={mapPreviewRow} onClose={() => setMapPreviewRow(null)} />
      )}
    </div>
  );
}
