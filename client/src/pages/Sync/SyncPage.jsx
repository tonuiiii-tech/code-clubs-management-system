import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from 'steamlabsui';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { DataState } from '../../components/DataState.jsx';
import { ListFooter } from '../../components/ListFooter.jsx';
import { syncSummary } from '../../components/SyncStatus.jsx';
import { syncNow, useSyncState } from '../../offline/index.js';
import { discardChange, listAttention, retryChange } from '../../offline/attention.js';
import { useApi } from '../../utils/useApi.js';
import { listSyncConflicts } from '../../services/syncService.js';

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '');

/** Sync status, changes the server refused, and values overwritten by later changes (US-15–17). */
export function SyncPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const sync = useSyncState();

  return (
    <>
      <PageHeader title={t('sync.title')} description={t('sync.description')} />
      <div className="page-grid">
        {sync.enabled ? (
          <>
            <DeviceCard sync={sync} />
            <AttentionCard sync={sync} />
          </>
        ) : (
          can('sync:use') || <Alert tone="info">{t('sync.notSyncing')}</Alert>
        )}
        {can('syncConflict:read') && <ConflictsCard />}
      </div>
    </>
  );
}

function DeviceCard({ sync }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <div className="row-between">
          <CardTitle>{t('sync.statusTitle')}</CardTitle>
          <Button
            size="sm"
            onClick={() => syncNow()}
            loading={sync.syncing}
            disabled={!sync.online}
          >
            {t('sync.syncNow')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="stack">
          <p role="status">{syncSummary(t, sync)}</p>
          <div className="stat-grid">
            <Stat variant="tile" value={sync.pending} label={t('sync.pendingLabel')} />
            <Stat variant="tile" value={sync.attention} label={t('sync.attentionLabel')} />
          </div>
          <p className="muted">
            {sync.lastSyncAt
              ? t('sync.lastSync', { time: when(sync.lastSyncAt) })
              : t('sync.never')}
          </p>
          {sync.problem === 'server' && <Alert tone="warning">{t('sync.serverProblem')}</Alert>}
          <p className="muted">{t('sync.deviceNote')}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Refused changes stay until the user chooses: send again (confirming) or discard (US-16). */
function AttentionCard({ sync }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [discarding, setDiscarding] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => listAttention().then(setItems), []);
  useEffect(() => {
    load();
  }, [load, sync.attention, sync.pending, sync.lastSyncAt]);

  async function act(fn) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sync.attentionTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title={t('sync.attentionEmpty')} />
        ) : (
          <div className="stack">
            <p className="muted">{t('sync.attentionHint')}</p>
            <ul className="attention-list">
              {items.map((item) => (
                <li key={item.seq} className="attention-item">
                  <div>
                    <strong>{t(`sync.ops.${item.type}`, { label: item.label ?? '' })}</strong>
                    <p>{item.error?.message}</p>
                    {item.waiting > 0 && (
                      <small className="muted">
                        {t('sync.waitingBehind', { count: item.waiting })}
                      </small>
                    )}
                  </div>
                  <span className="badge-row">
                    {item.error?.code === 'POSSIBLE_DUPLICATE' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => act(() => retryChange(item.seq, { confirmDuplicate: true }))}
                      >
                        {t('sync.differentChild')}
                      </Button>
                    ) : item.error?.code === 'PHOTO_CONSENT_MISSING' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => act(() => retryChange(item.seq, { confirmConsent: true }))}
                      >
                        {t('sync.confirmPhoto')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => act(() => retryChange(item.seq))}
                      >
                        {t('sync.tryAgain')}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setDiscarding(item)}>
                      {t('sync.discard')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={Boolean(discarding)}
        title={t('sync.discardTitle')}
        confirmLabel={t('sync.discard')}
        busy={busy}
        onConfirm={() =>
          act(async () => {
            await discardChange(discarding.seq);
            setDiscarding(null);
          })
        }
        onClose={() => setDiscarding(null)}
      >
        {t('sync.discardBody')}
      </ConfirmDialog>
    </Card>
  );
}

/** Values replaced when two people changed the same thing; online only (D3-5). */
function ConflictsCard() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const conflicts = useApi(listSyncConflicts, { page });
  const rows = conflicts.data?.data ?? [];
  const show = (c, value) => (c.redacted ? t('sync.hidden') : String(value ?? t('common.none')));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sync.conflictsTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="muted">{t('sync.conflictsHint')}</p>
        <DataState
          loading={conflicts.loading}
          error={conflicts.error}
          isEmpty={rows.length === 0}
          emptyTitle={t('sync.conflictsEmpty')}
          onRetry={conflicts.reload}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sync.conflictField')}</TableHead>
                <TableHead>{t('sync.conflictBefore')}</TableHead>
                <TableHead>{t('sync.conflictAfter')}</TableHead>
                <TableHead>{t('sync.conflictBy')}</TableHead>
                <TableHead>{t('sync.conflictWhen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Badge variant="neutral">{t(`sync.entities.${c.entityType}`)}</Badge>{' '}
                    {c.label ?? c.field}
                  </TableCell>
                  <TableCell>{show(c, c.overwritten)}</TableCell>
                  <TableCell>{show(c, c.applied)}</TableCell>
                  <TableCell>{c.actorName}</TableCell>
                  <TableCell>{when(c.at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ListFooter result={conflicts.data} onPageChange={setPage} />
        </DataState>
      </CardContent>
    </Card>
  );
}
