import { useCallback, useEffect, useState } from 'react';
import { useSyncState } from '../offline/index.js';

/**
 * Calls a service function and exposes loading, error, data and reload.
 * Pass the service function itself (e.g. listClubs) so its identity stays stable.
 * After each sync the data is fetched again quietly, so changes from others appear (US-15).
 */
export function useApi(serviceFn, query) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [attempt, setAttempt] = useState(0);
  const queryKey = JSON.stringify(query ?? null);
  const { lastSyncAt } = useSyncState();

  useEffect(() => {
    let cancelled = false;
    serviceFn(JSON.parse(queryKey) ?? undefined)
      .then((data) => !cancelled && setState({ loading: false, error: null, data }))
      .catch((error) => !cancelled && setState({ loading: false, error, data: null }));
    return () => {
      cancelled = true;
    };
  }, [serviceFn, queryKey, attempt, lastSyncAt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
