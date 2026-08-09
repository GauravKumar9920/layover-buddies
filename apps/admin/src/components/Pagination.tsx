import Icon from '@/components/Icon';

export interface CursorHistory {
  current?: string;
  previous: Array<string | undefined>;
  next?: string | null;
}

export default function Pagination({ history, count, onChange }: { history: CursorHistory; count: number; onChange: (next: CursorHistory) => void }) {
  const page = history.previous.length + 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider bg-white px-4 py-3 text-xs text-muted">
      <span>{count.toLocaleString('en-IN')} on page {page}</span>
      <div className="flex items-center gap-2">
        <button className="table-nav" disabled={history.previous.length === 0} onClick={() => {
          const previous = [...history.previous];
          const current = previous.pop();
          onChange({ current, previous, next: undefined });
        }}><Icon name="chevron" className="h-3.5 w-3.5 rotate-180" /> Previous</button>
        <button className="table-nav" disabled={!history.next} onClick={() => onChange({ current: history.next ?? undefined, previous: [...history.previous, history.current], next: undefined })}>Next <Icon name="chevron" className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
