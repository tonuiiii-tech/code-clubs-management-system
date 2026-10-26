import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
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
import { EQUIPMENT_CONDITIONS, EQUIPMENT_TYPES } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { useApi } from '../../utils/useApi.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { listEquipment } from '../../services/equipmentService.js';

/** Laptops, tablets and kits in the user's scope, and where each one is (US-25). */
export function EquipmentPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { filters, page, setFilter, setPage } = useUrlFilters([
    'q',
    'type',
    'condition',
    'location',
    'overdue',
  ]);
  const { loading, error, data, reload } = useApi(listEquipment, {
    q: filters.q || undefined,
    type: filters.type || undefined,
    condition: filters.condition || undefined,
    location: filters.location || undefined,
    overdue: filters.overdue || undefined,
    page,
  });
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('equipment.title')}
        description={t('equipment.description')}
        actions={
          can('equipment:manage') && (
            <Button asChild>
              <Link to="/equipment/new">{t('equipment.add')}</Link>
            </Button>
          )
        }
      />
      <div className="filter-bar" role="search">
        <SearchInput value={filters.q} onSearch={(q) => setFilter('q', q)} />
        <EnumSelect
          aria-label={t('equipment.type')}
          values={EQUIPMENT_TYPES}
          labelKey="equipmentTypes"
          placeholder={t('equipment.anyType')}
          value={filters.type}
          onChange={(e) => setFilter('type', e.target.value)}
        />
        <EnumSelect
          aria-label={t('equipment.condition')}
          values={EQUIPMENT_CONDITIONS}
          labelKey="equipmentConditions"
          placeholder={t('equipment.anyCondition')}
          value={filters.condition}
          onChange={(e) => setFilter('condition', e.target.value)}
        />
        <EnumSelect
          aria-label={t('equipment.location')}
          values={['store', 'club', 'overdue']}
          labelKey="equipment.locations"
          placeholder={t('equipment.anyLocation')}
          value={filters.overdue ? 'overdue' : filters.location}
          onChange={(e) => {
            const v = e.target.value;
            setFilter('overdue', v === 'overdue' ? 'true' : '');
            setFilter('location', v === 'overdue' ? '' : v);
          }}
        />
      </div>
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        emptyTitle={t('equipment.empty')}
        onRetry={reload}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('equipment.assetTag')}</TableHead>
              <TableHead>{t('equipment.name')}</TableHead>
              <TableHead>{t('equipment.type')}</TableHead>
              <TableHead>{t('equipment.condition')}</TableHead>
              <TableHead>{t('equipment.where')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.assetTag}</TableCell>
                <TableCell>
                  <TextLink asChild arrow={false}>
                    <Link to={`/equipment/${item.id}`}>{item.name}</Link>
                  </TextLink>
                </TableCell>
                <TableCell>{t(`equipmentTypes.${item.type}`)}</TableCell>
                <TableCell>
                  <ConditionBadge condition={item.condition} />
                </TableCell>
                <TableCell>
                  <Whereabouts item={item} />
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
  working: 'secondary',
  needs_repair: 'primary',
  damaged: 'primary',
  lost: 'primary',
  retired: 'neutral',
};

export function ConditionBadge({ condition }) {
  const { t } = useTranslation();
  return (
    <Badge variant={VARIANT[condition] ?? 'neutral'} dot>
      {t(`equipmentConditions.${condition}`)}
    </Badge>
  );
}

/** "HQ store, Nairobi" or the club holding it, and whether it is overdue. */
export function Whereabouts({ item }) {
  const { t } = useTranslation();
  if (!item.club) return t('equipment.inStore', { region: t(`regions.${item.region}`) });
  return (
    <span className="cell-stack">
      <span>
        {item.club.code} · {item.club.name}
      </span>
      {item.overdue && (
        <Badge variant="primary">{t('equipment.overdue', { date: item.dueDate })}</Badge>
      )}
    </span>
  );
}
