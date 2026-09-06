import type { ReactNode } from 'react';
import type { ApiMeta } from '@/types/admin';
import Icon from '@/components/Icon';
import { formatDateTime } from '@/lib/format';

export function ErrorState({ message, onRetry, title = 'Data unavailable' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div className="state-panel state-panel-danger" role="alert">
      <div className="state-icon"><Icon name="warning" className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><p className="font-bold text-navy">{title}</p><p className="mt-1 text-sm leading-5 text-muted">{message}</p></div>
      {onRetry && <button className="secondary-button shrink-0" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function UnconfiguredState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="state-panel state-panel-warn">
      <div className="state-icon"><Icon name="settings" className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><p className="font-bold text-navy">{title}</p><p className="mt-1 text-sm leading-5 text-muted">{message}</p></div>
      {action}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-divider bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary"><Icon name="check" className="h-5 w-5" /></div>
      <p className="mt-4 font-heading font-bold text-navy">{title}</p><p className="mx-auto mt-1 max-w-lg text-sm text-muted">{message}</p>
    </div>
  );
}

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-label="Loading">{Array.from({ length: rows }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl border border-divider bg-white/80" />)}</div>;
}

export function Freshness({ meta, refreshing }: { meta: ApiMeta; refreshing?: boolean }) {
  if (!meta.generatedAt && !refreshing) return null;
  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted" title={meta.generatedAt ? formatDateTime(meta.generatedAt) : undefined}>
      <span className={`h-1.5 w-1.5 rounded-full ${refreshing ? 'animate-pulse bg-warn' : 'bg-success'}`} />
      {refreshing ? 'Refreshing…' : `Updated ${formatDateTime(meta.generatedAt ?? null)}`}
    </div>
  );
}

export function Warnings({ warnings }: { warnings?: string[] }) {
  if (!warnings?.length) return null;
  return <div className="space-y-2">{warnings.map((warning) => <div key={warning} className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-ink"><strong>Partial data:</strong> {warning}</div>)}</div>;
}
