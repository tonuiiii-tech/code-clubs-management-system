import { request } from './http.js';

/** School terms; everyone reads them, HQ sets them (Sprint 4, plan section 5). */
export const listTerms = () => request('/terms');
export const createTerm = (body) => request('/terms', { method: 'POST', body });
export const updateTerm = (id, body) => request(`/terms/${id}`, { method: 'PATCH', body });
