import { useSyncExternalStore } from 'react';
import { getSyncState, isLocalReady, subscribe } from './engine.js';

/**
 * Offline support (Sprint 3). Champions and coordinators keep their scope on the device and sync
 * it; everyone else uses the API directly (D3-1).
 */
export {
  isLocalReady,
  refreshCounts,
  requestSync,
  startOffline,
  stopOffline,
  syncNow,
} from './engine.js';
export { offlineProfile, purgeExpired } from './registry.js';

/** The sync status, for the status bar and the sync page. */
export function useSyncState() {
  return useSyncExternalStore(subscribe, getSyncState, getSyncState);
}

/**
 * Calls the device's copy of an API function once it is synced, the server otherwise. A record
 * missing on the device while online is asked from the server: it can be one saved online while
 * the first sync was still running, which the device only gets on the next pull.
 */
export const localFirst =
  (local, online) =>
  async (...args) => {
    if (!isLocalReady()) return online(...args);
    try {
      return await local(...args);
    } catch (err) {
      if (err?.status === 404 && navigator.onLine) return online(...args);
      throw err;
    }
  };
