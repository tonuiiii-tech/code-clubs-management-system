import { request } from './http.js';
import { localFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/** Clubs can be read on the device once synced; changes need a connection (D3-1). */
export const listClubs = localFirst(local.listClubs, (query) => request('/clubs', { query }));
export const getClub = localFirst(local.getClub, (id) => request(`/clubs/${id}`));
export const createClub = (body) => request('/clubs', { method: 'POST', body });
export const updateClub = (id, body) => request(`/clubs/${id}`, { method: 'PATCH', body });
export const listClubChampions = (id) => request(`/clubs/${id}/champions`);
export const assignChampion = (id, userId, body) =>
  request(`/clubs/${id}/champions/${userId}`, { method: 'PUT', body });
export const endChampionAssignment = (id, userId) =>
  request(`/clubs/${id}/champions/${userId}`, { method: 'DELETE' });
