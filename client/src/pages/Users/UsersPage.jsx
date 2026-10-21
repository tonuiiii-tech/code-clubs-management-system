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
import { listUsers } from '../../services/usersService.js';

const COLUMNS = [
  { key: 'fullName', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
];

export function UsersPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { loading, error, data, reload } = useApi(listUsers);
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={can('user:manage') && <Button>{t('users.add')}</Button>}
      />
      <DataState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        emptyTitle={t('users.empty')}
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
