import { ROLES } from '@code-clubs/shared/enums';
import { can } from '@code-clubs/shared/permissions';
import { request, setAccessToken } from './http.js';
import { offlineProfile, startOffline, stopOffline } from '../offline/index.js';

/** Champions and coordinators keep their data on the device and sync it (D3-1). */
const syncsOffline = (user) =>
  can(user, 'sync:use') && [ROLES.CHAMPION, ROLES.COORDINATOR].includes(user.role);

async function signedIn(user) {
  if (syncsOffline(user)) await startOffline(user);
  else await stopOffline();
  return user;
}

export async function login(email, password) {
  const { data } = await request('/auth/login', { method: 'POST', body: { email, password } });
  setAccessToken(data.accessToken);
  return signedIn(data.user);
}

/**
 * Restores a session from the refresh cookie when the app opens. Without a connection, a
 * champion or coordinator who synced in the last 14 days continues offline (§8 of the protocol).
 */
export async function restoreSession() {
  try {
    const { data } = await request('/auth/refresh', { method: 'POST' });
    setAccessToken(data.accessToken);
    return await signedIn(data.user);
  } catch (err) {
    const profile = err?.status === 0 ? offlineProfile() : null;
    if (!profile) return null;
    await startOffline(profile);
    return profile;
  }
}

/** Signing out deletes the user's data from this device (D3-2). */
export async function logout() {
  await request('/auth/logout', { method: 'POST' }).catch(() => {});
  setAccessToken(null);
  await stopOffline({ wipe: true });
}

/** Signs out every session, including this one; the user signs in again with the new password. */
export async function changePassword(currentPassword, newPassword) {
  await request('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
  setAccessToken(null);
  await stopOffline();
}
