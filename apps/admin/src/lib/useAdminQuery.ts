import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiMeta } from '@/types/admin';
import { errorMessage } from '@/lib/api';

export interface QueryState<T> {
  data: T | null;
  meta: ApiMeta;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAdminQuery<T>(
  loader: () => Promise<{ data: T; meta: ApiMeta }>,
  dependencies: readonly unknown[] = [],
): QueryState<T> {
  // The caller supplies the query inputs. Keep a stable loader for this query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, dependencies);
  const [snapshot, setSnapshot] = useState<{
    load: typeof load;
    response: { data: T; meta: ApiMeta } | null;
    pending: boolean;
    error: string | null;
  }>();
  const active = useRef<{ load: typeof load | null; sequence: number }>({ load: null, sequence: 0 });

  const refresh = useCallback(async () => {
    if (active.current.load !== load) return;
    const requestId = ++active.current.sequence;
    setSnapshot((previous) => ({
      load,
      response: previous?.load === load ? previous.response : null,
      pending: true,
      error: null,
    }));
    try {
      const response = await load();
      if (requestId !== active.current.sequence) return;
      setSnapshot({ load, response, pending: false, error: null });
    } catch (caught) {
      if (requestId !== active.current.sequence) return;
      setSnapshot((previous) => ({
        load,
        response: previous?.load === load ? previous.response : null,
        pending: false,
        error: errorMessage(caught),
      }));
    }
  }, [load]);

  useEffect(() => {
    const request = active.current;
    request.load = load;
    void refresh();
    return () => {
      request.load = null;
      request.sequence += 1;
    };
  }, [load, refresh]);

  const current = snapshot?.load === load ? snapshot : null;
  return {
    data: current?.response?.data ?? null,
    meta: current?.response?.meta ?? {},
    loading: current === null || (current.pending && !current.response),
    refreshing: Boolean(current?.pending && current.response),
    error: current?.error ?? null,
    refresh,
  };
}
