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
