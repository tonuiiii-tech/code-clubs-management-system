import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Input,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextLink,
} from 'steamlabsui';
import { SESSION_STATUSES } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { listSessions } from '../../services/sessionsService.js';

/** "2026-11" → first and last day of that month. */
export function monthRange(month) {
  if (!month) return {};
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function SessionsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { filters, page, setFilter, setPage } = useUrlFilters(['clubId', 'status', 'month']);
  const { month, ...rest } = filters;
  const { loading, error, data, reload } = useApi(listSessions, {
    ...rest,
    ...monthRange(month),
    page,
  });
  const { clubs } = useClubOptions();
  const clubName = (id) => clubs.find((c) => c.id === id)?.name ?? '';
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow={t('app.name')}
        title={t('sessions.title')}
        description={t('sessions.description')}
        actions={
          can('session:write') && (
            <Button asChild>
              <Link to={`/sessions/new${filters.clubId ? `?clubId=${filters.clubId}` : ''}`}>
                {t('sessions.add')}
              </Link>
            </Button>
          )
        }
      />
      <div className="filter-bar" role="search">
        <Select
          aria-label={t('sessions.club')}
          value={filters.clubId}
          onChange={(e) => setFilter('clubId', e.target.value)}
        >
          <option value="">{t('sessions.anyClub')}</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </Select>
        <EnumSelect
          aria-label={t('sessions.status')}
          values={SESSION_STATUSES}
          labelKey="sessionStatuses"
          placeholder={t('sessions.anyStatus')}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        />
        <Input
          type="month"
          aria-label={t('sessions.month')}
          value={filters.month}
          onChange={(e) => setFilter('month', e.target.value)}
        />
      </div>
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        emptyTitle={t('sessions.empty')}
        onRetry={reload}
      >
        <SessionTable rows={rows} clubName={clubName} />
        <ListFooter result={data} onPageChange={setPage} />
      </DataState>
    </>
  );
}

export function SessionTable({ rows, clubName }) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('sessions.date')}</TableHead>
          {clubName && <TableHead>{t('sessions.club')}</TableHead>}
          <TableHead>{t('sessions.topic')}</TableHead>
          <TableHead>{t('sessions.attendance')}</TableHead>
          <TableHead>{t('sessions.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <TextLink asChild arrow={false}>
                <Link to={`/sessions/${s.id}`}>{s.date}</Link>
              </TextLink>
            </TableCell>
            {clubName && <TableCell>{clubName(s.clubId)}</TableCell>}
            <TableCell>{s.topic ?? t('common.none')}</TableCell>
            <TableCell>
              {s.attendance?.total ? t('sessions.present', s.attendance) : t('common.none')}
            </TableCell>
            <TableCell>
              <SessionStatusBadge status={s.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const VARIANT = { held: 'secondary', planned: 'primary', cancelled: 'neutral' };

export function SessionStatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <Badge variant={VARIANT[status] ?? 'neutral'} dot>
      {t(`sessionStatuses.${status}`)}
    </Badge>
  );
}
