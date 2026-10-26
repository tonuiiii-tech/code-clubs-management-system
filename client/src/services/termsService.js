import { request } from './http.js';
import { saveValue } from '../offline/localApi.js';

/** School terms; everyone reads them, HQ sets them (Sprint 4, plan section 5). */
export async function listTerms() {
  const result = await request('/terms');
  // Kept for the learner progress page offline.
  await saveValue('terms', result.data);
  return result;
}
export const createTerm = (body) => request('/terms', { method: 'POST', body });
export const updateTerm = (id, body) => request(`/terms/${id}`, { method: 'PATCH', body });
