import { request } from './http.js';
import { cachedValue, saveValue } from '../offline/localApi.js';

/** Online, then the last copy seen, with its date (like the Sprint 3 dashboard). */
async function withCache(key, load) {
  try {
    const result = await load();
    await saveValue(key, result.data);
    return result;
  } catch (err) {
    const cached = err.status === 0 ? await cachedValue(key) : null;
    if (!cached) throw err;
    return { data: cached.value, savedAt: cached.at };
  }
}

export const getHqDashboard = (query) =>
  withCache(`hq:${JSON.stringify(query ?? {})}`, () => request('/dashboard/hq', { query }));
export const getAlerts = (query) =>
  withCache(`alerts:${JSON.stringify(query ?? {})}`, () => request('/alerts', { query }));

/** The termly report's numbers, shown on screen; counts only (D4-3). */
export const getTermReport = (query) => request('/reports/termly', { query });
/** The PDF is made on the server (D4-4); demo mode prints the on-screen report instead. */
export const downloadTermReportPdf = (query) =>
  request('/reports/termly.pdf', { query, asBlob: true });

export const getReportRecipients = () => request('/reports/recipients');
export const saveReportRecipients = (recipients) =>
  request('/reports/recipients', { method: 'PUT', body: { recipients } });
/** Every email, SMS and WhatsApp message the stub providers recorded (US-24). */
export const listOutbox = (query) => request('/notifications/outbox', { query });
