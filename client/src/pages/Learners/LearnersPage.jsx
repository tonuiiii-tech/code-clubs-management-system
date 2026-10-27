import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
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
import { LEARNER_STATUSES } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConsentBadges } from '../../components/ConsentBadges.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { listLearners } from '../../services/learnersService.js';

export function LearnersPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { filters, page, setFilter, setPage } = useUrlFilters(['q', 'clubId', 'status']);
  const { loading, error, data, reload } = useApi(listLearners, { ...filters, page });
  const { clubs } = useClubOptions();
  const clubName = (id) => clubs.find((c) => c.id === id)?.name ?? '';
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow={t('app.name')}
        title={t('learners.title')}
        description={t('learners.description')}
        meta={<Badge variant="primary">{t('learners.fictionalOnly')}</Badge>}
        actions={
          can('learner:write') && (
            <Button asChild>
              <Link to={`/learners/new${filters.clubId ? `?clubId=${filters.clubId}` : ''}`}>
                {t('learners.add')}
              </Link>
            </Button>
          )
        }
      />
      <div className="filter-bar" role="search">
        <SearchInput value={filters.q} onSearch={(v) => setFilter('q', v)} />
        <Select
          aria-label={t('learners.club')}
          value={filters.clubId}
          onChange={(e) => setFilter('clubId', e.target.value)}
        >
          <option value="">{t('learners.anyClub')}</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </Select>
        <EnumSelect
          aria-label={t('learners.status')}
          values={LEARNER_STATUSES}
          labelKey="learnerStatuses"
          placeholder={t('learners.anyStatus')}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        />
      </div>
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        emptyTitle={t('learners.empty')}
        onRetry={reload}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('learners.number')}</TableHead>
              <TableHead>{t('learners.name')}</TableHead>
              <TableHead>{t('learners.club')}</TableHead>
              <TableHead>{t('learners.age')}</TableHead>
              <TableHead>{t('learners.grade')}</TableHead>
              <TableHead>{t('learners.consent')}</TableHead>
              <TableHead>{t('learners.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.learnerNumber ?? t('learners.numberPending')}</TableCell>
                <TableCell>
                  <TextLink asChild arrow={false}>
                    <Link to={`/learners/${l.id}`}>
                      {l.firstName} {l.lastName}
                    </Link>
                  </TextLink>
                </TableCell>
                <TableCell>{clubName(l.clubId)}</TableCell>
                <TableCell>{l.age}</TableCell>
                <TableCell>{t(`grades.${l.grade}`)}</TableCell>
                <TableCell>
                  <ConsentBadges consents={l.consents} />
                </TableCell>
                <TableCell>
                  <LearnerStatusBadge status={l.status} />
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

export function LearnerStatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <Badge variant={status === 'active' ? 'secondary' : 'neutral'} dot>
      {t(`learnerStatuses.${status}`)}
    </Badge>
  );
}
