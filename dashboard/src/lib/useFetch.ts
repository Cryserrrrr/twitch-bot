import { useCallback, useEffect, useState } from "react";

import { api } from "./api";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Minimal data hook: fetch on mount, expose a refetch and keep the previous
 * value while reloading so tables do not flash empty on every refresh.
 */
export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: Boolean(path),
    error: null,
  });

  const load = useCallback(async () => {
    if (!path) return;
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const data = await api.get<T>(path);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState((current) => ({
        data: current.data,
        loading: false,
        error: error instanceof Error ? error.message : "request_failed",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load, setData: (data: T) => setState({ data, loading: false, error: null }) };
}
