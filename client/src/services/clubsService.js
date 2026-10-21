import { request } from './http.js';

export const listClubs = (query) => request('/clubs', { query });
export const getClub = (id) => request(`/clubs/${id}`);
export const createClub = (body) => request('/clubs', { method: 'POST', body });
export const updateClub = (id, body) => request(`/clubs/${id}`, { method: 'PATCH', body });
