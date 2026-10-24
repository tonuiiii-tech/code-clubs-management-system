/**
 * The only place the client talks to the API (coding principle 3).
 * In Sprint 3 the services built on this read and write the local database first
 * and sync later, so pages do not change (D1-5).
 */
import { ERROR_MESSAGES, errorMessageKey } from '@code-clubs/shared/errors';
import i18n from '../i18n/index.js';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

/** Demo mode: no server or database needed (D1-20). Vite removes the mock code from real builds. */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};

/** Shows a known API error text in the user's language; other texts are shown as sent. */
function localise(message) {
  const key = errorMessageKey(message);
  return key ? i18n.t(`apiErrors.${key}`, { defaultValue: message }) : message;
}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(localise(message));
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function sendToMock(path, { method = 'GET', body, query, file, asBlob } = {}) {
  const { mockRequest } = await import('./mock/mockApi.js');
  const cleanQuery = Object.fromEntries(
    Object.entries(query ?? {}).filter(([, value]) => value !== undefined && value !== ''),
  );
  const res = await mockRequest({
    method,
    path,
    query: cleanQuery,
    body: file ?? body,
    token: accessToken,
  });
  if (res.status === 204) return null;
  if (asBlob && res.status < 400) return res.body;
  if (res.status >= 400) {
    const { code, message, details } = res.body.error;
    throw new ApiError(res.status, code, message, details);
  }
  return res.body;
}

async function send(path, options = {}) {
  if (USE_MOCKS) return sendToMock(path, options);
  const { method = 'GET', body, query, file, asBlob } = options;
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        // Files go as the raw body; the server checks their real type (D2-3).
        ...(file && { 'Content-Type': file.type || 'application/octet-stream' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: file ?? (body ? JSON.stringify(body) : undefined),
      // Consent forms and photos must never be kept by the browser (R2-2).
      ...(asBlob && { cache: 'no-store' }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', ERROR_MESSAGES.network);
  }
  if (res.status === 204) return null;
  if (asBlob && res.ok) return res.blob();
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { code = 'ERROR', message = res.statusText, details } = payload.error ?? {};
    throw new ApiError(res.status, code, message, details);
  }
  return payload;
}

/** Retries once after refreshing the access token when it has expired. */
export async function request(path, options) {
  try {
    return await send(path, options);
  } catch (err) {
    if (err.status !== 401 || path.startsWith('/auth/')) throw err;
    const refreshed = await send('/auth/refresh', { method: 'POST' }).catch(() => null);
    if (!refreshed) throw err;
    setAccessToken(refreshed.data.accessToken);
    return send(path, options);
  }
}
