import { request } from './http.js';
import { localFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/** Champions and coordinators work on the device's copy once it is synced (D3-1). */
export const listLearners = localFirst(local.listLearners, (query) =>
  request('/learners', { query }),
);
export const getLearner = localFirst(local.getLearner, (id) => request(`/learners/${id}`));
export const createLearner = localFirst(local.createLearner, (body) =>
  request('/learners', { method: 'POST', body }),
);
export const updateLearner = localFirst(local.updateLearner, (id, body) =>
  request(`/learners/${id}`, { method: 'PATCH', body }),
);
export const setLearnerStatus = localFirst(local.setLearnerStatus, (id, status) =>
  request(`/learners/${id}/status`, { method: 'PATCH', body: { status } }),
);
/** HQ only; every read is recorded in the audit log (D2-1). Never kept on a device. */
export const getLearnerContact = (id) => request(`/learners/${id}/contact`);
export const saveLearnerContact = localFirst(local.saveLearnerContact, (id, body) =>
  request(`/learners/${id}/contact`, { method: 'PUT', body }),
);
export const setConsent = localFirst(local.setConsent, (id, type, body) =>
  request(`/learners/${id}/consents/${type}`, { method: 'PUT', body }),
);
export const uploadConsentFile = localFirst(local.uploadConsentFile, (id, type, file) =>
  request(`/learners/${id}/consents/${type}/file`, { method: 'PUT', file }),
);
/** Consent forms are only ever opened online, never kept on a device (D3-8). */
export const downloadConsentFile = (id, type) =>
  request(`/learners/${id}/consents/${type}/file`, { asBlob: true });
