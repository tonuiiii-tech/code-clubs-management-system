import { listClubs } from '../services/clubsService.js';
import { useApi } from './useApi.js';

const clubsInScope = () => listClubs({ pageSize: 100 });
const activeClubsInScope = () => listClubs({ status: 'active', pageSize: 100 });

/** The clubs the user can see (or only active ones), for filters and forms. */
export function useClubOptions({ activeOnly = false } = {}) {
  const clubs = useApi(activeOnly ? activeClubsInScope : clubsInScope);
  return { ...clubs, clubs: clubs.data?.data ?? [] };
}
