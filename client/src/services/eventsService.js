import { request } from './http.js';
import { onlineFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/** Events: read from the device when offline; every change needs a connection (D4-8). */
export const listEvents = onlineFirst((query) => request('/events', { query }), local.listEvents);
export const getEvent = onlineFirst((id) => request(`/events/${id}`), local.getEvent);
export const createEvent = (body) => request('/events', { method: 'POST', body });
export const updateEvent = (id, body) => request(`/events/${id}`, { method: 'PATCH', body });
export const setEventClubs = (id, clubIds) =>
  request(`/events/${id}/clubs`, { method: 'PUT', body: { clubIds } });

export const listParticipants = onlineFirst(
  (id) => request(`/events/${id}/participants`),
  local.listEventParticipants,
);
export const registerParticipants = (id, learnerIds) =>
  request(`/events/${id}/participants`, { method: 'POST', body: { learnerIds } });
export const setParticipantStatus = (id, learnerId, status) =>
  request(`/events/${id}/participants/${learnerId}`, { method: 'PATCH', body: { status } });
export const setEventConsent = (id, learnerId, body) =>
  request(`/events/${id}/consents/${learnerId}`, { method: 'PUT', body });
export const uploadEventConsentFile = (id, learnerId, file) =>
  request(`/events/${id}/consents/${learnerId}/file`, { method: 'PUT', file });
/** Consent forms are opened online only and never kept on a device (D3-8). */
export const downloadEventConsentFile = (id, learnerId) =>
  request(`/events/${id}/consents/${learnerId}/file`, { asBlob: true });

export const listProjects = (id) => request(`/events/${id}/projects`);
export const createProject = (id, body) =>
  request(`/events/${id}/projects`, { method: 'POST', body });
export const updateProject = (id, projectId, body) =>
  request(`/events/${id}/projects/${projectId}`, { method: 'PATCH', body });

export const addEventPhoto = (id, file, confirmConsent = false) =>
  request(`/events/${id}/photos`, {
    method: 'POST',
    file,
    query: { confirmConsent: String(confirmConsent) },
  });
export const getEventPhoto = (id, photoId) =>
  request(`/events/${id}/photos/${photoId}`, { asBlob: true });
export const deleteEventPhoto = (id, photoId) =>
  request(`/events/${id}/photos/${photoId}`, { method: 'DELETE' });
