import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Card,
  CardContent,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextLink,
} from 'steamlabsui';
import { LANGUAGES, RESOURCE_TYPES, TRACKS } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { useApi } from '../../utils/useApi.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import {
  canSaveOffline,
  listResources,
  savedResourcesSize,
} from '../../services/resourcesService.js';

/** Lesson plans, slides, worksheets and video links by track and age (US-28). */
export function ResourcesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { filters, page, setFilter, setPage } = useUrlFilters(['q', 'track', 'type', 'language']);
  const { loading, error, data, reload } = useApi(listResources, {
    q: filters.q || undefined,
    track: filters.track || undefined,
    type: filters.type || undefined,
    language: filters.language || undefined,
    page,
  });
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('resources.title')}
        description={t('resources.description')}
        actions={
          can('resource:manage') && (
            <Button asChild>
              <Link to="/resources/new">{t('resources.add')}</Link>
            </Button>
          )
        }
      />
      {canSaveOffline() && <StorageUsed />}
      <div className="filter-bar" role="search">
        <SearchInput value={filters.q} onSearch={(q) => setFilter('q', q)} />
        <EnumSelect
          aria-label={t('resources.track')}
          values={TRACKS}
          labelKey="tracks"
          placeholder={t('resources.anyTrack')}
          value={filters.track}
          onChange={(e) => setFilter('track', e.target.value)}
        />
        <EnumSelect
          aria-label={t('resources.type')}
          values={RESOURCE_TYPES}
          labelKey="resourceTypes"
          placeholder={t('resources.anyType')}
          value={filters.type}
          onChange={(e) => setFilter('type', e.target.value)}
        />
        <EnumSelect
          aria-label={t('resources.language')}
          values={LANGUAGES}
          labelKey="language"
          placeholder={t('resources.anyLanguage')}
          value={filters.language}
          onChange={(e) => setFilter('language', e.target.value)}
        />
      </div>
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        emptyTitle={t('resources.empty')}
        onRetry={reload}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('resources.resourceTitle')}</TableHead>
              <TableHead>{t('resources.type')}</TableHead>
              <TableHead>{t('resources.tracks')}</TableHead>
              <TableHead>{t('resources.ages')}</TableHead>
              <TableHead>{t('resources.language')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="cell-stack">
                    <TextLink asChild arrow={false}>
                      <Link to={`/resources/${r.id}`}>{r.title}</Link>
                    </TextLink>
                    <span className="badge-row">
                      {r.status === 'draft' && <Badge>{t('resourceStatuses.draft')}</Badge>}
                      {r.saved && <Badge variant="secondary">{t('resources.savedBadge')}</Badge>}
                    </span>
                  </span>
                </TableCell>
                <TableCell>{t(`resourceTypes.${r.type}`)}</TableCell>
                <TableCell>{r.tracks.map((tr) => t(`tracks.${tr}`)).join(', ')}</TableCell>
                <TableCell>{r.ageBands.join(', ') || t('resources.allAges')}</TableCell>
                <TableCell>{t(`language.${r.language}`)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ListFooter result={data} onPageChange={setPage} />
      </DataState>
    </>
  );
}

export const megabytes = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

/** Space used by saved resources on this device (R5-1). */
function StorageUsed() {
  const { t } = useTranslation();
  const { data } = useApi(savedResourcesSize);
  if (!data) return null;
  return (
    <Card>
      <CardContent className="card-body--top">
        <p className="muted">
          {t('resources.storageUsed', {
            used: megabytes(data.used),
            limit: megabytes(data.limit),
          })}
        </p>
      </CardContent>
    </Card>
  );
}
