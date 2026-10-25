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

/** Calls the device's copy of an API function once it is synced, the server otherwise. */
export const localFirst =
  (local, online) =>
  (...args) =>
    isLocalReady() ? local(...args) : online(...args);

/**
 * Asks the server first and falls back to the device's copy when there is no connection: for
 * records that are only read on the device, such as events and announcements (D4-8).
 */
export const onlineFirst =
  (online, local) =>
  async (...args) => {
    try {
      return await online(...args);
    } catch (err) {
      if (err?.status === 0 && isLocalReady()) return local(...args);
      throw err;
    }
  };
