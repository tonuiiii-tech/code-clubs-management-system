import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';
import { mockRequest, resetMockDb } from '../services/mock/mockApi.js';

/**
 * The device side of sync (docs/sync-protocol.md), run against the demo API: changes saved
 * offline, sent once when back online, refused changes kept for the user, and local data
 * deleted on sign-out or after 14 days.
 */
const net = { offline: false, token: null };

vi.mock('../services/http.js', async (importOriginal) => {
  const actual = await importOriginal();
  const request = async (path, { method = 'GET', body, query, file } = {}) => {
    if (net.offline) throw new actual.ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server');
    const clean = Object.fromEntries(
      Object.entries(query ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    const res = await mockRequest({
      method,
      path,
      query: clean,
      body: file ?? body,
      token: net.token,
    });
    if (res.status === 204) return null;
    if (res.status >= 400) {
      const { code, message, details } = res.body.error;
      throw new actual.ApiError(res.status, code, message, details);
    }
    return res.body;
  };
  return { ...actual, request };
});

const { startOffline, stopOffline, syncNow, getSyncState, currentDb } = await import('./engine.js');
const local = await import('./localApi.js');
const { listAttention, retryChange, discardChange } = await import('./attention.js');
const registry = await import('./registry.js');
const { dbName } = await import('./db.js');

const NAC_001 = uid(201);
const NAC_002 = uid(202);
const ZAWADI = uid(1001);
const RECENT_SESSION = uid(1603);

async function signIn(email) {
  const res = await mockRequest({
    method: 'POST',
    path: '/auth/login',
    body: { email, password: DEMO_PASSWORD },
  });
  net.token = res.body.data.accessToken;
  return res.body.data.user;
}

const newLearner = (extra = {}) => ({
  clubId: NAC_001,
  firstName: 'Nafula',
  lastName: 'Offline',
  age: 10,
  gender: 'girl',
  grade: 'grade_5',
  admissionNumber: `ADM-${Math.floor(Math.random() * 1e6)}`,
  ...extra,
});

let user;
beforeEach(async () => {
  resetMockDb();
  net.offline = false;
  user = await signIn('faith.njeri@demo.steamlabs.test');
  await startOffline(user);
  await syncNow();
});

afterEach(async () => {
  await stopOffline({ wipe: true });
});

describe('the device copy', () => {
  it('holds the champion’s own clubs after the first sync, and answers like the API', async () => {
    expect(getSyncState()).toMatchObject({ enabled: true, ready: true, pending: 0 });
    const clubs = await local.listClubs();
    expect(clubs.data.map((c) => c.id).sort()).toEqual([NAC_001, NAC_002].sort());
    const learners = await local.listLearners({ clubId: NAC_001, pageSize: 100 });
    expect(learners.data.length).toBeGreaterThan(0);
    expect(learners.data[0]).toMatchObject({
      age: expect.any(Number),
      consents: expect.any(Object),
    });
    const { data: session } = await local.getSession(RECENT_SESSION);
    expect(session.attendance.length).toBeGreaterThan(0);
    // Guardian contacts never reach the device, only whether one is on file.
    const { data: zawadi } = await local.getLearner(ZAWADI);
    expect(zawadi.hasContact).toBe(true);
    expect(JSON.stringify(await currentDb().learners.toArray())).not.toMatch(/guardianName/);
  });
});

describe('working offline', () => {
  it('saves changes on the device and sends them once when back online (US-14, US-15)', async () => {
    net.offline = true;
    const { data: learner } = await local.createLearner(newLearner());
    expect(learner.learnerNumber).toBeNull();
    await local.setConsent(learner.id, 'participation', {
      status: 'given',
      signedOn: '2026-11-20',
    });
    await local.saveLearnerContact(learner.id, {
      guardianName: 'Offline Guardian',
      relationship: 'mother',
      phone: '+254700000777',
    });
    const { data: session } = await local.createSession({
      clubId: NAC_002,
      date: new Date().toISOString().slice(0, 10),
      topic: 'Unplugged: sorting networks',
    });
    const marks = (await local.listLearners({ clubId: NAC_002, status: 'active' })).data.map(
      (l) => ({ learnerId: l.id, status: 'present' }),
    );
    await local.saveAttendance(session.id, marks);
    await syncNow();
    expect(getSyncState()).toMatchObject({ online: false, pending: 5 });

    net.offline = false;
    await syncNow();
    expect(getSyncState()).toMatchObject({ online: true, pending: 0, attention: 0 });
    const saved = await local.getLearner(learner.id);
    expect(saved.data.learnerNumber).toMatch(/^NAC-001-\d{3}$/);
    expect(saved.data.consents.participation.status).toBe('given');
    expect(saved.data.hasContact).toBe(true);
    // The contact went to the server and is not kept on the device.
    expect(await currentDb().outbox.count()).toBe(0);
    const server = await mockRequest({
      method: 'GET',
      path: `/sessions/${session.id}`,
      token: net.token,
    });
    expect(server.body.data.attendance).toHaveLength(marks.length);
  });

  it('applies the same rules on the device as the server does', async () => {
    net.offline = true;
    await expect(local.createLearner(newLearner({ age: 7 }))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    const { data: zawadi } = await local.getLearner(ZAWADI);
    await expect(
      local.createLearner(newLearner({ firstName: 'Zawadi', lastName: 'Mwangi', age: zawadi.age })),
    ).rejects.toMatchObject({ code: 'POSSIBLE_DUPLICATE' });
    await expect(
      local.saveAttendance(RECENT_SESSION, [{ learnerId: uid(1010), status: 'present' }]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(local.getLearner(uid(1010))).rejects.toMatchObject({ status: 404 });
  });

  it('keeps a change the server refuses until the user decides (US-16)', async () => {
    // Someone else registers the same child online after this device last synced.
    const twin = newLearner({ firstName: 'Neno', lastName: 'Pacha' });
    net.offline = true;
    await mockRequest({ method: 'POST', path: '/learners', body: twin, token: net.token });
    const { data: mine } = await local.createLearner({ ...twin, admissionNumber: 'ADM-OTHER' });
    await local.setConsent(mine.id, 'photo', { status: 'given' });
    net.offline = false;
    await syncNow();
    expect(getSyncState()).toMatchObject({ attention: 1, pending: 1 });
    const [item] = await listAttention();
    expect(item).toMatchObject({ type: 'learner.create', waiting: 1 });
    expect(item.error.code).toBe('POSSIBLE_DUPLICATE');

    await retryChange(item.seq, { confirmDuplicate: true });
    await syncNow();
    expect(getSyncState()).toMatchObject({ attention: 0, pending: 0 });
    expect((await local.getLearner(mine.id)).data.consents.photo.status).toBe('given');
  });

  it('removes a discarded new record and what waited behind it', async () => {
    const twin = newLearner({ firstName: 'Tabu', lastName: 'Rudi' });
    net.offline = true;
    await mockRequest({ method: 'POST', path: '/learners', body: twin, token: net.token });
    const { data: mine } = await local.createLearner({ ...twin, admissionNumber: 'ADM-THIRD' });
    await local.setConsent(mine.id, 'photo', { status: 'refused' });
    net.offline = false;
    await syncNow();
    const [item] = await listAttention();
    await discardChange(item.seq);
    await syncNow();
    expect(getSyncState()).toMatchObject({ attention: 0, pending: 0 });
    await expect(local.getLearner(mine.id)).rejects.toMatchObject({ status: 404 });
  });

  it('queues photos and shows them as waiting until they upload', async () => {
    net.offline = true;
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])], {
      type: 'image/png',
    });
    // A learner present without photo consent needs confirming first (D2-7).
    await expect(local.addSessionPhoto(RECENT_SESSION, png)).rejects.toMatchObject({
      code: 'PHOTO_CONSENT_MISSING',
    });
    const { data } = await local.addSessionPhoto(RECENT_SESSION, png, true);
    expect(data.pendingPhotos).toHaveLength(1);
    net.offline = false;
    await syncNow();
    const { data: after } = await local.getSession(RECENT_SESSION);
    expect(after.pendingPhotos).toHaveLength(0);
    expect(after.photoIds).toHaveLength(1);
    expect(await currentDb().pendingFiles.count()).toBe(0);
  });
});

describe('shared devices (D3-2)', () => {
  it('deletes the user’s data when they sign out', async () => {
    expect(await Dexie.exists(dbName(user.id))).toBe(true);
    await stopOffline({ wipe: true });
    expect(await Dexie.exists(dbName(user.id))).toBe(false);
    expect(registry.offlineProfile()).toBeNull();
  });

  it('lets the last user open the app offline for 14 days only', async () => {
    expect(registry.offlineProfile()).toMatchObject({ id: user.id });
    const in15Days = Date.now() + 15 * 24 * 60 * 60 * 1000;
    expect(registry.offlineProfile(in15Days)).toBeNull();
    await stopOffline();
    await registry.purgeExpired(in15Days);
    expect(await Dexie.exists(dbName(user.id))).toBe(false);
  });
});
