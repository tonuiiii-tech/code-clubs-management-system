import { request, setAccessToken } from './http.js';

export async function login(email, password) {
  const { data } = await request('/auth/login', { method: 'POST', body: { email, password } });
  setAccessToken(data.accessToken);
  return data.user;
}

/** Restores a session from the refresh cookie when the app opens. */
export async function restoreSession() {
  try {
    const { data } = await request('/auth/refresh', { method: 'POST' });
    setAccessToken(data.accessToken);
    return data.user;
  } catch {
    return null;
  }
}

export async function logout() {
  await request('/auth/logout', { method: 'POST' }).catch(() => {});
  setAccessToken(null);
}
