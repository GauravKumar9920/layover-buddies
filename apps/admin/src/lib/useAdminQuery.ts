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
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++request.current;
    setError(null);
    if (data === null) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await loader();
      if (requestId !== request.current) return;
      setData(response.data);
      setMeta(response.meta);
    } catch (caught) {
      if (requestId !== request.current) return;
      setError(errorMessage(caught));
    } finally {
      if (requestId === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  return { data, meta, loading, refreshing, error, refresh };
}
