import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  PageHeader,
  SegmentedControl,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextLink,
} from 'steamlabsui';
import { EVENT_STATUSES } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { useApi } from '../../utils/useApi.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { listEvents } from '../../services/eventsService.js';

export const eventDates = (e) =>
  e.startDate === e.endDate ? e.startDate : `${e.startDate} – ${e.endDate}`;

/** Events in the user's scope: upcoming first, or all (US-22). */
export function EventsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { filters, page, setFilter, setPage } = useUrlFilters(['when', 'status']);
  const upcoming = filters.when !== 'all';
  const { loading, error, data, reload } = useApi(listEvents, {
    status: filters.status || undefined,
    from: upcoming ? new Date().toISOString().slice(0, 10) : undefined,
    page,
  });
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('events.title')}
        description={t('events.description')}
        actions={
          can('event:manage') && (
            <Button asChild>
              <Link to="/events/new">{t('events.add')}</Link>
            </Button>
          )
        }
      />
      <div className="filter-bar" role="search">
        <SegmentedControl
          aria-label={t('events.dates')}
          options={[
            { value: 'upcoming', label: t('events.upcoming') },
            { value: 'all', label: t('events.all') },
          ]}
          value={upcoming ? 'upcoming' : 'all'}
          onValueChange={(v) => setFilter('when', v === 'all' ? 'all' : '')}
        />
        <EnumSelect
          aria-label={t('events.status')}
          values={EVENT_STATUSES}
          labelKey="eventStatuses"
          placeholder={t('events.anyStatus')}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        />
      </div>
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        emptyTitle={t('events.empty')}
        onRetry={reload}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('events.name')}</TableHead>
              <TableHead>{t('events.dates')}</TableHead>
              <TableHead>{t('events.type')}</TableHead>
              <TableHead>{t('events.region')}</TableHead>
              <TableHead>{t('events.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <TextLink asChild arrow={false}>
                    <Link to={`/events/${e.id}`}>{e.name}</Link>
                  </TextLink>
                </TableCell>
                <TableCell>{eventDates(e)}</TableCell>
                <TableCell>{t(`eventTypes.${e.type}`)}</TableCell>
                <TableCell>{e.region ? t(`regions.${e.region}`) : t('events.national')}</TableCell>
                <TableCell>
                  <EventStatusBadge status={e.status} />
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

const VARIANT = {
  open: 'secondary',
  planned: 'primary',
  held: 'neutral',
  closed: 'neutral',
  cancelled: 'neutral',
};

export function EventStatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <Badge variant={VARIANT[status] ?? 'neutral'} dot>
      {t(`eventStatuses.${status}`)}
    </Badge>
  );
}
