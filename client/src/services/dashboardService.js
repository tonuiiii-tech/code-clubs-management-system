import { request } from './http.js';
import { cachedDashboard, saveDashboard } from '../offline/localApi.js';

/** Offline, the last numbers seen online are shown with their date (Sprint 3 plan, section 3). */
export async function getDashboardSummary() {
  try {
    const result = await request('/dashboard/summary');
    await saveDashboard(result.data);
    return result;
  } catch (err) {
    const cached = err.status === 0 ? await cachedDashboard() : null;
    if (!cached) throw err;
    return { data: cached.summary, savedAt: cached.at };
  }
}
