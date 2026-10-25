import { SYNC_PUSH_MAX_OPERATIONS } from '@code-clubs/shared/enums';
import { request } from '../services/http.js';
import {
  attendanceKey,
  consentKey,
  DATA_TABLES,
  deleteUserDb,
  getMeta,
  openUserDb,
  setMeta,
} from './db.js';
import { FILE_OPERATIONS, applyLocal, renameSession, targetOf } from './operations.js';
import { forgetUser, recordSync, rememberUser } from './registry.js';

/**
 * Keeps the device and the server in step (docs/sync-protocol.md). Pushes the outbox, then
 * pulls what changed, then applies unsent changes again on top. One sync at a time, also across
 * tabs; network failures retry with growing waits.
 */
const RETRY_DELAYS = [5_000, 15_000, 60_000, 300_000];
const EVERY = 5 * 60 * 1000;
const AFTER_CHANGE = 1_500;

let db = null;
let user = null;
let running = null;
let again = false;
let timers = { change: null, retry: null, interval: null };
let failures = 0;

let state = {
  enabled: false,
  ready: false,
  syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
  attention: 0,
  lastSyncAt: null,
  problem: null,
};
const listeners = new Set();

function setState(changes) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

export const getSyncState = () => state;
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const currentDb = () => db;
export const currentUser = () => user;
/** Screens read from the device once the first full pull has finished. */
export const isLocalReady = () => Boolean(db && state.ready);

const onOnline = () => {
  setState({ online: true });
  requestSync();
};
const onOffline = () => setState({ online: false });
const onVisible = () => document.visibilityState === 'visible' && requestSync();

/** Starts offline support for a champion or coordinator who has just signed in (D3-1). */
export async function startOffline(signedInUser) {
  if (user?.id !== signedInUser.id) await stopOffline();
  user = signedInUser;
  rememberUser(signedInUser);
  if (!db) {
    db = openUserDb(signedInUser.id);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    timers.interval = setInterval(requestSync, EVERY);
    // Ask the browser not to clear the data when space runs low (R3-1).
    navigator.storage?.persist?.().catch(() => {});
  }
  setState({
    enabled: true,
    ready: await getMeta(db, 'ready', false),
    lastSyncAt: await getMeta(db, 'lastSyncAt'),
    online: navigator.onLine,
  });
  await refreshCounts();
  requestSync({ now: true });
}

/** Stops syncing; with `wipe` the user's local database is deleted (signing out, D3-2). */
export async function stopOffline({ wipe = false } = {}) {
  const userId = user?.id;
  Object.values(timers).forEach((t) => {
    clearTimeout(t);
    clearInterval(t);
  });
  timers = { change: null, retry: null, interval: null };
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVisible);
  await running?.catch(() => {});
  db?.close();
  db = null;
  user = null;
  if (wipe && userId) {
    await deleteUserDb(userId).catch(() => {});
    forgetUser(userId);
  }
  setState({ enabled: false, ready: false, syncing: false, pending: 0, attention: 0 });
}

export async function refreshCounts() {
  if (!db) return;
  const [pending, attention] = await Promise.all([
    db.outbox.where('state').equals('pending').count(),
    db.outbox.where('state').equals('rejected').count(),
  ]);
  setState({ pending, attention });
}

/** Queues a sync: soon after a change, or at once. */
export function requestSync({ now = false } = {}) {
  if (!db) return;
  clearTimeout(timers.change);
  timers.change = setTimeout(() => syncNow().catch(() => {}), now ? 0 : AFTER_CHANGE);
}

/** Runs one sync. Resolves when it is done; a second call during a sync runs once more after. */
export function syncNow() {
  if (!db) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  const run = async () => {
    setState({ syncing: true });
    try {
      const locks = navigator.locks;
      const work = () => syncOnce();
      if (locks) await locks.request(`cc-sync-${user.id}`, work);
      else await work();
      failures = 0;
      setState({ problem: null, online: true });
    } catch (err) {
      handleFailure(err);
    } finally {
      setState({ syncing: false });
      await refreshCounts();
    }
  };
  running = run().finally(() => {
    running = null;
    if (again) {
      again = false;
      requestSync({ now: true });
    }
  });
  return running;
}

function handleFailure(err) {
  if (err?.status === 0) {
    setState({ online: false, problem: 'offline' });
  } else if (err?.status === 401) {
    setState({ problem: 'signIn' });
    return;
  } else {
    setState({ problem: 'server' });
  }
  if (!navigator.onLine) return;
  const delay = RETRY_DELAYS[Math.min(failures, RETRY_DELAYS.length - 1)];
  failures += 1;
  clearTimeout(timers.retry);
  timers.retry = setTimeout(() => requestSync({ now: true }), delay);
}

async function syncOnce() {
  const syncing = db;
  await push(syncing);
  await pull(syncing);
  if (db !== syncing) return;
  const at = new Date().toISOString();
  await setMeta(syncing, 'lastSyncAt', at);
  recordSync(user.id, new Date(at));
  setState({ lastSyncAt: at });
}

// ---------------------------------------------------------------------------
// Push

/** Unsent changes in order, leaving out those waiting behind a refused change. */
async function sendable(local) {
  const all = await local.outbox.orderBy('seq').toArray();
  const refused = new Set(all.filter((op) => op.state === 'rejected').map(targetOf));
  return all.filter((op) => op.state === 'pending' && !refused.has(targetOf(op)));
}

const forServer = ({ opId, type, recordId, params, data, base, recordedAt }) => ({
  opId,
  type,
  recordedAt,
  data,
  ...(recordId && { recordId }),
  ...(params && { params }),
  ...(base && { base }),
});

async function push(local) {
  for (;;) {
    const ops = await sendable(local);
    if (!ops.length) return;
    if (FILE_OPERATIONS.has(ops[0].type)) {
      await uploadFile(local, ops[0]);
      continue;
    }
    const batch = [];
    for (const op of ops) {
      if (FILE_OPERATIONS.has(op.type) || batch.length === SYNC_PUSH_MAX_OPERATIONS) break;
      batch.push(op);
    }
    const { data } = await request('/sync/push', {
      method: 'POST',
      body: { operations: batch.map(forServer) },
    });
    const byOpId = new Map(batch.map((op) => [op.opId, op]));
    for (const result of data.results) {
      const op = byOpId.get(result.opId);
      if (!op) continue;
      if (result.status === 'applied') {
        await local.outbox.delete(op.seq);
        if (result.joined && result.recordId !== op.data.id) {
          await renameSession(local, op.data.id, result.recordId);
        }
      } else if (result.status === 'rejected') {
        await local.outbox.update(op.seq, { state: 'rejected', error: result.error });
      }
    }
    await refreshCounts();
    // Stop if nothing moved, so a skipped change cannot loop.
    if (data.results.every((r) => r.status === 'skipped')) return;
  }
}

async function uploadFile(local, op) {
  const stored = await local.pendingFiles.get(op.opId);
  const file = stored && new Blob([stored.bytes], { type: stored.type });
  try {
    if (file && op.type === 'file.consent') {
      await request(`/learners/${op.recordId}/consents/${op.params.type}/file`, {
        method: 'PUT',
        file,
      });
    } else if (file) {
      await request(`/sessions/${op.recordId}/photos`, {
        method: 'POST',
        file,
        query: {
          confirmConsent: String(Boolean(op.data?.confirmConsent)),
          opId: op.opId,
          recordedAt: op.recordedAt,
        },
      });
    }
  } catch (err) {
    // Refused by the server: keep it for the user. Anything else stops this sync.
    if (err.status >= 400 && err.status < 500 && err.status !== 401) {
      await local.outbox.update(op.seq, {
        state: 'rejected',
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    throw err;
  }
  await local.transaction('rw', local.outbox, local.pendingFiles, async () => {
    await local.outbox.delete(op.seq);
    await local.pendingFiles.delete(op.opId);
  });
}

// ---------------------------------------------------------------------------
// Pull

const learnerRecord = ({ age: _age, ...learner }) => learner;
const consentRecord = (c) => ({ ...c, key: consentKey(c.learnerId, c.type) });
const attendanceRecord = (a) => ({ ...a, key: attendanceKey(a.sessionId, a.learnerId) });

async function pull(local) {
  // After a discarded change the device reloads everything, so nothing of it is left (§4).
  let fresh = await getMeta(local, 'resync', false);
  let cursor = fresh ? null : await getMeta(local, 'cursor');
  let scopeKey = fresh ? null : await getMeta(local, 'scopeKey');
  for (;;) {
    const { data } = await request('/sync/pull', { query: { cursor, scopeKey } });
    if (db !== local) return;
    const { changes } = data;
    await local.transaction('rw', [...DATA_TABLES.map((t) => local[t]), local.meta], async () => {
      if (data.reset || fresh) await Promise.all(DATA_TABLES.map((t) => local[t].clear()));
      await local.schools.bulkPut(changes.schools);
      await local.clubs.bulkPut(changes.clubs);
      await local.learners.bulkPut(changes.learners.map(learnerRecord));
      await local.consents.bulkPut(changes.consents.map(consentRecord));
      await local.sessions.bulkPut(changes.sessions);
      await local.attendance.bulkPut(changes.attendance.map(attendanceRecord));
      if (data.deleted.attendance.length) {
        await local.attendance.where('id').anyOf(data.deleted.attendance).delete();
      }
      await setMeta(local, 'cursor', data.cursor);
      await setMeta(local, 'scopeKey', data.scopeKey);
      await setMeta(local, 'resync', false);
    });
    fresh = false;
    cursor = data.cursor;
    scopeKey = data.scopeKey;
    if (!data.more) break;
  }
  await replayOutbox(local);
  await setMeta(local, 'ready', true);
  setState({ ready: true });
}

/** Applies unsent changes again on top of what the server sent. */
export async function replayOutbox(local = db) {
  const ops = await local.outbox.orderBy('seq').toArray();
  for (const op of ops) await applyLocal(local, op);
}
