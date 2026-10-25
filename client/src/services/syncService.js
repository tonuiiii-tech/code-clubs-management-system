import { request } from './http.js';

/** Values overwritten when two people changed the same field (D3-5). Coordinators and HQ. */
export const listSyncConflicts = (query) => request('/sync/conflicts', { query });
