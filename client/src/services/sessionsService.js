import { request } from './http.js';
import { isLocalReady, localFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/** Champions and coordinators work on the device's copy once it is synced (D3-1). */
export const listSessions = localFirst(local.listSessions, (query) =>
  request('/sessions', { query }),
);
export const getSession = localFirst(local.getSession, (id) => request(`/sessions/${id}`));
export const createSession = localFirst(local.createSession, (body) =>
  request('/sessions', { method: 'POST', body }),
);
export const updateSession = localFirst(local.updateSession, (id, body) =>
  request(`/sessions/${id}`, { method: 'PATCH', body }),
);
export const saveAttendance = localFirst(local.saveAttendance, (id, records) =>
  request(`/sessions/${id}/attendance`, { method: 'PUT', body: { records } }),
);
/** `confirmConsent`: the user confirmed learners without photo consent are not in it (D2-7). */
export const addSessionPhoto = localFirst(
  local.addSessionPhoto,
  (id, file, confirmConsent = false) =>
    request(`/sessions/${id}/photos`, {
      method: 'POST',
      file,
      query: { confirmConsent: String(confirmConsent) },
    }),
);
/** Photos are viewed online only and never kept on a device (D3-8). */
export const getSessionPhoto = (id, photoId) =>
  request(`/sessions/${id}/photos/${photoId}`, { asBlob: true });
export async function deleteSessionPhoto(id, photoId) {
  await request(`/sessions/${id}/photos/${photoId}`, { method: 'DELETE' });
  if (isLocalReady()) await local.forgetPhoto(id, photoId);
}
export const removePendingPhoto = (opId) => local.removePendingPhoto(opId);
