/**
 * The only place the client talks to the API (coding principle 3).
 * In Sprint 3 the services built on this read and write the local database first
 * and sync later, so pages do not change (D1-5).
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function send(path, { method = 'GET', body, query } = {}) {
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
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server');
  }
  if (res.status === 204) return null;
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
