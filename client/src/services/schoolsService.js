import { request } from './http.js';

export const listSchools = (query) => request('/schools', { query });
export const getSchool = (id) => request(`/schools/${id}`);
export const createSchool = (body) => request('/schools', { method: 'POST', body });
export const updateSchool = (id, body) => request(`/schools/${id}`, { method: 'PATCH', body });
