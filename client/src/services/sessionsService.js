import { request } from './http.js';

export const listSessions = (query) => request('/sessions', { query });
export const getSession = (id) => request(`/sessions/${id}`);
export const createSession = (body) => request('/sessions', { method: 'POST', body });
export const updateSession = (id, body) => request(`/sessions/${id}`, { method: 'PATCH', body });
export const saveAttendance = (id, records) =>
  request(`/sessions/${id}/attendance`, { method: 'PUT', body: { records } });
/** `confirmConsent`: the user confirmed learners without photo consent are not in it (D2-7). */
export const addSessionPhoto = (id, file, confirmConsent = false) =>
  request(`/sessions/${id}/photos`, {
    method: 'POST',
    file,
    query: { confirmConsent: String(confirmConsent) },
  });
export const getSessionPhoto = (id, photoId) =>
  request(`/sessions/${id}/photos/${photoId}`, { asBlob: true });
export const deleteSessionPhoto = (id, photoId) =>
  request(`/sessions/${id}/photos/${photoId}`, { method: 'DELETE' });
