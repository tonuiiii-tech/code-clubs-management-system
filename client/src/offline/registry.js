import { OFFLINE_MAX_DAYS } from '@code-clubs/shared/enums';
import { deleteUserDb } from './db.js';

/**
 * Which users have data on this device, with the profile needed to open the app offline and the
 * time of their last successful sync (docs/sync-protocol.md §8). Kept in localStorage; it holds
 * no learner data.
 */
const KEY = 'cc-offline';
const MAX_AGE_MS = OFFLINE_MAX_DAYS * 24 * 60 * 60 * 1000;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? { users: {} };
  } catch {
    return { users: {} };
  }
}

function write(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the app then simply needs a connection to open.
  }
}

export function rememberUser(user) {
  const value = read();
  const entry = value.users[user.id] ?? { lastSyncAt: null, since: new Date().toISOString() };
  value.users[user.id] = { ...entry, profile: user };
  value.current = user.id;
  write(value);
}

export function recordSync(userId, at = new Date()) {
  const value = read();
  if (!value.users[userId]) return;
  value.users[userId].lastSyncAt = at.toISOString();
  write(value);
}

export function forgetUser(userId) {
  const value = read();
  delete value.users[userId];
  if (value.current === userId) delete value.current;
  write(value);
}

/** True while the user's last sync (or first sign-in) is at most 14 days old. */
const fresh = (entry, now) => now - Date.parse(entry.lastSyncAt ?? entry.since) <= MAX_AGE_MS;

/** The profile of whoever used the app last, if they may still open it offline. */
export function offlineProfile(now = Date.now()) {
  const value = read();
  const entry = value.current && value.users[value.current];
  return entry && entry.lastSyncAt && fresh(entry, now) ? entry.profile : null;
}

/** Deletes the local data of users who have not synced for 14 days (D3-2). */
export async function purgeExpired(now = Date.now()) {
  const value = read();
  for (const [userId, entry] of Object.entries(value.users)) {
    if (fresh(entry, now)) continue;
    await deleteUserDb(userId).catch(() => {});
    forgetUser(userId);
  }
}
