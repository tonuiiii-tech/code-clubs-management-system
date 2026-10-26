import { request } from './http.js';
import { onlineFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/** Announcements: readable offline, and opening one offline marks it read on the next sync. */
export const listAnnouncements = onlineFirst(
  (query) => request('/announcements', { query }),
  local.listAnnouncements,
);
export const getAnnouncement = onlineFirst(
  (id) => request(`/announcements/${id}`),
  local.getAnnouncement,
);
export const markAnnouncementRead = onlineFirst(
  (id) => request(`/announcements/${id}/read`, { method: 'POST' }),
  local.markAnnouncementRead,
);
/** How many people and messages, before sending (R4-3). */
export const previewAnnouncement = (body) =>
  request('/announcements/preview', { method: 'POST', body });
export const sendAnnouncement = (body) => request('/announcements', { method: 'POST', body });
