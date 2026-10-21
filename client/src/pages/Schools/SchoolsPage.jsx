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
import { COUNTIES, RECORD_STATUSES, REGION_VALUES, SCHOOL_TYPES } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useApi } from '../../utils/useApi.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { listSchools } from '../../services/schoolsService.js';

export function SchoolsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { filters, page, setFilter, setPage } = useUrlFilters([
    'q',
    'region',
    'county',
    'type',
    'status',
  ]);
  const { loading, error, data, reload } = useApi(listSchools, { ...filters, page });
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('schools.title')}
        description={t('schools.description')}
        actions={
          can('school:write') && (
            <Button asChild>
              <Link to="/schools/new">{t('schools.add')}</Link>
            </Button>
          )
        }
      />
      <div className="filter-bar" role="search">
        <SearchInput value={filters.q} onSearch={(v) => setFilter('q', v)} />
        <EnumSelect
          aria-label={t('schools.region')}
          values={REGION_VALUES}
          labelKey="regions"
          placeholder={t('schools.anyRegion')}
          value={filters.region}
          onChange={(e) => setFilter('region', e.target.value)}
        />
        <EnumSelect
          aria-label={t('schools.county')}
          values={COUNTIES}
          placeholder={t('schools.anyCounty')}
          value={filters.county}
          onChange={(e) => setFilter('county', e.target.value)}
        />
        <EnumSelect
          aria-label={t('schools.type')}
          values={SCHOOL_TYPES}
          labelKey="schoolTypes"
          placeholder={t('schools.anyType')}
          value={filters.type}
          onChange={(e) => setFilter('type', e.target.value)}
        />
        <EnumSelect
          aria-label={t('schools.status')}
          values={RECORD_STATUSES}
          labelKey="status"
          placeholder={t('schools.anyStatus')}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        />
      </div>
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        emptyTitle={t('schools.empty')}
        onRetry={reload}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('schools.name')}</TableHead>
              <TableHead>{t('schools.type')}</TableHead>
              <TableHead>{t('schools.county')}</TableHead>
              <TableHead>{t('schools.subCounty')}</TableHead>
              <TableHead>{t('schools.region')}</TableHead>
              <TableHead>{t('schools.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((school) => (
              <TableRow key={school.id}>
                <TableCell>
                  <TextLink asChild arrow={false}>
                    <Link to={`/schools/${school.id}`}>{school.name}</Link>
                  </TextLink>
                </TableCell>
                <TableCell>{t(`schoolTypes.${school.type}`)}</TableCell>
                <TableCell>{school.county}</TableCell>
                <TableCell>{school.subCounty}</TableCell>
                <TableCell>{t(`regions.${school.region}`)}</TableCell>
                <TableCell>
                  <StatusBadge status={school.status} />
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
