import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSyncState } from '../offline/index.js';

/** "Offline · 3 changes waiting to sync", always visible to people who sync (US-14). */
export function SyncStatus() {
  const { t } = useTranslation();
  const sync = useSyncState();
  if (!sync.enabled) return null;
  return (
    <Link to="/sync" className={`sync-status sync-status--${syncTone(sync)}`} role="status">
      {syncSummary(t, sync)}
    </Link>
  );
}

export function syncTone(sync) {
  if (sync.attention > 0 || sync.problem === 'signIn') return 'attention';
  if (!sync.online) return 'offline';
  if (sync.pending > 0 || sync.syncing) return 'busy';
  return 'ok';
}

export function syncSummary(t, sync) {
  const parts = [];
  if (!sync.online) parts.push(t('sync.offline'));
  if (sync.attention > 0) parts.push(t('sync.attention', { count: sync.attention }));
  if (sync.problem === 'signIn') parts.push(t('sync.signInAgain'));
  if (sync.pending > 0) parts.push(t('sync.waiting', { count: sync.pending }));
  else if (sync.syncing) parts.push(t('sync.syncing'));
  else if (sync.online && sync.attention === 0 && sync.lastSyncAt) parts.push(t('sync.allSynced'));
  return parts.join(' · ') || t('sync.never');
}
