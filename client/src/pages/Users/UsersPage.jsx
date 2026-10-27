import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Dialog,
  Menu,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from 'steamlabsui';
import { ROLE_VALUES, USER_STATUSES } from '@code-clubs/shared/enums';
import { canManageRole } from '@code-clubs/shared/permissions';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { DataState } from '../../components/DataState.jsx';
import { EnumSelect } from '../../components/EnumSelect.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useApi } from '../../utils/useApi.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { listUsers, resendInvite, setUserStatus } from '../../services/usersService.js';
import { InviteSent } from './UserFormPage.jsx';

export function UsersPage() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const manageable = (role) => canManageRole(me, role);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { filters, page, setFilter, setPage } = useUrlFilters(['q', 'role', 'status']);
  const { loading, error, data, reload } = useApi(listUsers, { ...filters, page });
  const [deactivating, setDeactivating] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reinvited, setReinvited] = useState(null);
  const rows = data?.data ?? [];

  async function reinvite(user) {
    try {
      const result = await resendInvite(user.id);
      setReinvited({ user, result });
      reload();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    }
  }

  async function changeStatus(user, status) {
    setBusy(true);
    try {
      await setUserStatus(user.id, status);
      toast({ title: t('users.statusChanged'), tone: 'success' });
      setDeactivating(null);
      reload();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('app.name')}
        title={t('users.title')}
        description={t('users.description')}
        actions={
          <Button asChild>
            <Link to="/users/new">{t('users.add')}</Link>
          </Button>
        }
      />
      <div className="filter-bar" role="search">
        <SearchInput value={filters.q} onSearch={(v) => setFilter('q', v)} />
        <EnumSelect
          aria-label={t('users.role')}
          values={ROLE_VALUES}
          labelKey="roles"
          placeholder={t('users.anyRole')}
          value={filters.role}
          onChange={(e) => setFilter('role', e.target.value)}
        />
        <EnumSelect
          aria-label={t('users.status')}
          values={USER_STATUSES}
          labelKey="status"
          placeholder={t('users.anyStatus')}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        />
      </div>
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
              <TableHead>{t('users.fullName')}</TableHead>
              <TableHead>{t('users.email')}</TableHead>
              <TableHead>{t('users.role')}</TableHead>
              <TableHead>{t('users.regions')}</TableHead>
              <TableHead>{t('users.status')}</TableHead>
              <TableHead>
                <span className="visually-hidden">{t('common.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((user) => {
              const isMe = user.id === me.id;
              // A Programme Manager sees every account but changes only coordinators and
              // champions (D5-12).
              const canChange = manageable(user.role);
              // Same rule as the server: a coordinator resends only invitations they sent (D5-15).
              const canReinvite =
                user.invitePending &&
                canManageRole(me, user.role, 'user:create') &&
                (canChange || user.createdBy === me.id);
              const actions = [
                ...(canChange
                  ? [
                      {
                        label: t('common.edit'),
                        onSelect: () => navigate(`/users/${user.id}/edit`),
                      },
                      // Nobody can lock themselves out (the server refuses it too).
                      ...(isMe
                        ? []
                        : [
                            user.status === 'active'
                              ? {
                                  label: t('users.deactivate'),
                                  tone: 'danger',
                                  onSelect: () => setDeactivating(user),
                                }
                              : {
                                  label: t('users.activate'),
                                  onSelect: () => changeStatus(user, 'active'),
                                },
                          ]),
                    ]
                  : []),
                ...(canReinvite
                  ? [{ label: t('users.resendInvite'), onSelect: () => reinvite(user) }]
                  : []),
              ];
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.fullName}
                    {isMe && ` (${t('users.you')})`}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{t(`roles.${user.role}`)}</TableCell>
                  <TableCell>
                    {user.regions?.map((r) => t(`regions.${r}`)).join(', ') || t('common.none')}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />{' '}
                    {user.invitePending && <Badge variant="primary">{t('users.invited')}</Badge>}
                  </TableCell>
                  <TableCell>
                    {actions.length > 0 && (
                      <Menu label={`${t('common.actions')}: ${user.fullName}`} items={actions} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ListFooter result={data} onPageChange={setPage} />
      </DataState>
      <ConfirmDialog
        open={Boolean(deactivating)}
        title={t('users.deactivate')}
        confirmLabel={t('users.deactivate')}
        busy={busy}
        onConfirm={() => changeStatus(deactivating, 'inactive')}
        onClose={() => setDeactivating(null)}
      >
        {deactivating?.fullName}
      </ConfirmDialog>
      <Dialog
        open={Boolean(reinvited)}
        onClose={() => setReinvited(null)}
        title={t('users.inviteSentTitle')}
        footer={<Button onClick={() => setReinvited(null)}>{t('common.close')}</Button>}
      >
        {reinvited && (
          <InviteSent
            name={reinvited.user.fullName}
            email={reinvited.user.email}
            result={reinvited.result}
          />
        )}
      </Dialog>
    </>
  );
}
