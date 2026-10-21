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
} from 'steamlabsui';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { useApi } from '../../utils/useApi.js';
import { listClubs } from '../../services/clubsService.js';

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
  { key: 'mainTrack', label: 'Track' },
  { key: 'status', label: 'Status' },
];

export function ClubsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { loading, error, data, reload } = useApi(listClubs);
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('clubs.title')}
        description={t('clubs.description')}
        actions={can('club:write') && <Button>{t('clubs.add')}</Button>}
      />
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
              {COLUMNS.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {COLUMNS.map((c) => (
                  <TableCell key={c.key}>{row[c.key]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataState>
    </>
  );
}
