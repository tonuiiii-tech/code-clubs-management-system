import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Button,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextLink,
} from 'steamlabsui';
import { CLUB_STATUSES, REGION_VALUES, TRACKS } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useApi } from '../../utils/useApi.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { listClubs } from '../../services/clubsService.js';

export function ClubsPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const { filters, page, setFilter, setPage } = useUrlFilters(['q', 'region', 'status', 'track']);
  const { loading, error, data, reload } = useApi(listClubs, { ...filters, page });
  const rows = data?.data ?? [];
  // A champion only ever sees their own clubs, so region filtering adds nothing for them.
  const showRegionFilter = user.role !== 'champion';

  return (
    <>
      <PageHeader
        eyebrow={t('app.name')}
        title={t('clubs.title')}
        description={t('clubs.description')}
        actions={
          can('club:write') && (
            <Button asChild>
              <Link to="/clubs/new">{t('clubs.add')}</Link>
            </Button>
          )
        }
      />
      <div className="filter-bar" role="search">
        <SearchInput value={filters.q} onSearch={(v) => setFilter('q', v)} />
        {showRegionFilter && (
          <EnumSelect
            aria-label={t('clubs.region')}
            values={REGION_VALUES}
            labelKey="regions"
            placeholder={t('clubs.anyRegion')}
            value={filters.region}
            onChange={(e) => setFilter('region', e.target.value)}
          />
        )}
        <EnumSelect
          aria-label={t('clubs.status')}
          values={CLUB_STATUSES}
          labelKey="status"
          placeholder={t('clubs.anyStatus')}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        />
        <EnumSelect
          aria-label={t('clubs.track')}
          values={TRACKS}
          labelKey="tracks"
          placeholder={t('clubs.anyTrack')}
          value={filters.track}
          onChange={(e) => setFilter('track', e.target.value)}
        />
      </div>
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        emptyTitle={t('clubs.empty')}
        onRetry={reload}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('clubs.code')}</TableHead>
              <TableHead>{t('clubs.name')}</TableHead>
              <TableHead>{t('clubs.region')}</TableHead>
              <TableHead>{t('clubs.schedule')}</TableHead>
              <TableHead>{t('clubs.track')}</TableHead>
              <TableHead>{t('clubs.capacity')}</TableHead>
              <TableHead>{t('clubs.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((club) => (
              <TableRow key={club.id}>
                <TableCell>{club.code}</TableCell>
                <TableCell>
                  <TextLink asChild arrow={false}>
                    <Link to={`/clubs/${club.id}`}>{club.name}</Link>
                  </TextLink>
                </TableCell>
                <TableCell>{t(`regions.${club.region}`)}</TableCell>
                <TableCell>
                  {t(`days.${club.meetingDay}`)} {club.startTime}–{club.endTime}
                </TableCell>
                <TableCell>{t(`tracks.${club.mainTrack}`)}</TableCell>
                <TableCell>{club.capacity}</TableCell>
                <TableCell>
                  <StatusBadge status={club.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ListFooter result={data} onPageChange={setPage} />
      </DataState>
    </>
  );
}
