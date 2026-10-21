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
import { listSchools } from '../../services/schoolsService.js';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'county', label: 'County' },
  { key: 'subCounty', label: 'Sub-county' },
  { key: 'status', label: 'Status' },
];

export function SchoolsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { loading, error, data, reload } = useApi(listSchools);
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('schools.title')}
        description={t('schools.description')}
        actions={can('school:write') && <Button>{t('schools.add')}</Button>}
      />
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
