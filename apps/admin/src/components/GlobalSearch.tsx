import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminRequest, errorMessage } from '@/lib/api';
import type { SearchResult } from '@/types/admin';
import Icon, { type IconName } from '@/components/Icon';
import { useAuth } from '@/auth/AuthProvider';

const resultIcons: Record<SearchResult['type'], IconName> = {
  booking: 'booking', user: 'traveler', lead: 'inbox', report: 'report', sos: 'sos',
};

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { admin } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const visibleResults = admin?.role === 'finance' ? results.filter((result) => result.type === 'booking') : results;

  useEffect(() => {
    if (!open) return;
    setQuery(''); setResults([]); setError(null);
    window.setTimeout(() => input.current?.focus(), 10);
    function close(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); setLoading(false); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const response = await adminRequest('search.global', { query: query.trim(), limit: 20 });
        if (!cancelled) setResults(response.data.items);
      } catch (caught) { if (!cancelled) setError(errorMessage(caught)); }
      finally { if (!cancelled) setLoading(false); }
    }, 260);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop items-start pt-[10vh]" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="flex items-center gap-3 border-b border-divider px-5">
          <Icon name="search" className="h-5 w-5 text-muted" />
          <input ref={input} className="h-16 min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted/60" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, trip ID, lead or report…" />
          <kbd className="rounded border border-divider bg-cream px-2 py-1 text-[10px] text-muted">ESC</kbd>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-2">
          {query.length < 2 && <p className="px-4 py-8 text-center text-sm text-muted">Type at least two characters. Search is performed server-side with your admin permissions.</p>}
          {loading && <p className="px-4 py-8 text-center text-sm text-muted">Searching…</p>}
          {error && <p className="m-2 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">Search unavailable: {error}</p>}
          {!loading && !error && query.length >= 2 && visibleResults.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No matching records available to this role.</p>}
          {visibleResults.map((result) => (
            <Link key={`${result.type}:${result.id}`} to={admin?.role === 'finance' && result.type === 'booking' ? `/money/ledger?booking=${encodeURIComponent(result.id)}` : result.href} onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-primary-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream text-muted"><Icon name={resultIcons[result.type]} className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-navy">{result.title}</p><p className="truncate text-xs text-muted">{result.subtitle ?? result.type}</p></div>
              <Icon name="arrow" className="h-4 w-4 text-muted" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
