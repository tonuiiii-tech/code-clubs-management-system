import { request } from './http.js';

export const listLearners = (query) => request('/learners', { query });
export const getLearner = (id) => request(`/learners/${id}`);
export const createLearner = (body) => request('/learners', { method: 'POST', body });
export const updateLearner = (id, body) => request(`/learners/${id}`, { method: 'PATCH', body });
export const setLearnerStatus = (id, status) =>
  request(`/learners/${id}/status`, { method: 'PATCH', body: { status } });
/** HQ only; every read is recorded in the audit log (D2-1). */
export const getLearnerContact = (id) => request(`/learners/${id}/contact`);
export const saveLearnerContact = (id, body) =>
  request(`/learners/${id}/contact`, { method: 'PUT', body });
export const setConsent = (id, type, body) =>
  request(`/learners/${id}/consents/${type}`, { method: 'PUT', body });
export const uploadConsentFile = (id, type, file) =>
  request(`/learners/${id}/consents/${type}/file`, { method: 'PUT', file });
export const downloadConsentFile = (id, type) =>
  request(`/learners/${id}/consents/${type}/file`, { asBlob: true });
