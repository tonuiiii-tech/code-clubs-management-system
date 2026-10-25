import { request } from './http.js';
import { localFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/** Schools can be read on the device once synced; changes need a connection (D3-1). */
export const listSchools = localFirst(local.listSchools, (query) => request('/schools', { query }));
export const getSchool = localFirst(local.getSchool, (id) => request(`/schools/${id}`));
export const createSchool = (body) => request('/schools', { method: 'POST', body });
export const updateSchool = (id, body) => request(`/schools/${id}`, { method: 'PATCH', body });
