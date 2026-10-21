import { useCallback, useEffect, useState } from 'react';

/**
 * Calls a service function and exposes loading, error, data and reload.
 * Pass the service function itself (e.g. listClubs) so its identity stays stable.
 */
export function useApi(serviceFn, query) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [attempt, setAttempt] = useState(0);
  const queryKey = JSON.stringify(query ?? null);

  useEffect(() => {
    let cancelled = false;
    serviceFn(JSON.parse(queryKey) ?? undefined)
      .then((data) => !cancelled && setState({ loading: false, error: null, data }))
      .catch((error) => !cancelled && setState({ loading: false, error, data: null }));
    return () => {
      cancelled = true;
    };
  }, [serviceFn, queryKey, attempt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
