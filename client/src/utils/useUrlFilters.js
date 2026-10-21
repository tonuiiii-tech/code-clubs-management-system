import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List filters and page number kept in the URL, so a filtered list can be shared,
 * bookmarked and restored with the back button. Changing a filter goes back to page 1.
 */
export function useUrlFilters(keys) {
  const [params, setParams] = useSearchParams();
  const keyList = keys.join(',');

  const filters = useMemo(
    () => Object.fromEntries(keyList.split(',').map((k) => [k, params.get(k) ?? ''])),
    [params, keyList],
  );
  const page = Number(params.get('page')) || 1;

  const setFilter = useCallback(
    (key, value) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          next.delete('page');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const setPage = useCallback(
    (n) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(n));
        return next;
      }),
    [setParams],
  );

  return { filters, page, setFilter, setPage };
}
