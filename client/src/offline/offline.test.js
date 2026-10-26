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

describe('records saved online during the first sync', () => {
  it('asks the server for a record the device does not have yet', async () => {
    const { localFirst } = await import('./index.js');
    const { getLearner } = await import('../services/learnersService.js');
    // Saved straight on the server, as when the first pull was still running.
    const created = await mockRequest({
      method: 'POST',
      path: '/learners',
      body: newLearner(),
      token: net.token,
    });
    const id = created.body.data.id;
    await expect(local.getLearner(id)).rejects.toMatchObject({ status: 404 });
    expect((await getLearner(id)).data.id).toBe(id);

    // Offline, a missing record stays missing instead of failing on the network.
    net.offline = true;
    const missing = localFirst(local.getLearner, () => Promise.reject(new Error('online')));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(missing(id)).rejects.toMatchObject({ status: 404 });
    vi.restoreAllMocks();
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

describe('Sprint 5 on the device', () => {
  const AMANI = uid(1007);
  const LAPTOP_1 = uid(2601);
  const WORKSHEET = uid(2804);
  const LOOPS_QUIZ = uid(3001);
  const today = () => new Date().toISOString().slice(0, 10);

  it('pulls the club’s equipment, the resource list, projects and scores', async () => {
    const db = currentDb();
    expect((await db.equipmentItems.toArray()).map((i) => i.id).sort()).toEqual(
      [LAPTOP_1, uid(2602), uid(2603)].sort(),
    );
    expect(await db.resources.count()).toBe(4);
    expect(await db.learnerProjects.count()).toBe(4);
    const quiz = await local.getAssessment(LOOPS_QUIZ);
    expect(quiz.data.scored).toBe(5);
    expect(quiz.data.averageScore).toBe(70);
  });

  it('records a project, an assessment, scores and a report offline, and sends each once', async () => {
    net.offline = true;
    const project = await local.createProject({
      clubId: NAC_002,
      learnerIds: [AMANI],
      title: 'Paper robot',
      track: 'unplugged',
      date: today(),
    });
    await local.updateProject(project.data.id, { title: 'Paper robot arm' });
    const quiz = await local.createAssessment({
      clubId: NAC_002,
      title: 'Sorting quiz',
      track: 'unplugged',
      date: today(),
      maxScore: 5,
    });
    await local.saveScores(quiz.data.id, [{ learnerId: AMANI, score: 4 }]);
    await expect(
      local.saveScores(quiz.data.id, [{ learnerId: AMANI, score: 6 }]),
    ).rejects.toMatchObject({
      status: 400,
    });
    await local.reportEquipment(LAPTOP_1, {
      condition: 'lost',
      note: 'Not found after the session',
    });
    expect((await local.getEquipment(LAPTOP_1)).data.condition).toBe('lost');
    expect(getSyncState().pending).toBe(5);

    net.offline = false;
    await syncNow();
    expect(getSyncState().pending).toBe(0);
    const projects = await mockRequest({
      method: 'GET',
      path: '/progress/projects',
      query: { clubId: NAC_002 },
      token: net.token,
    });
    const mine = projects.body.data.filter((p) => p.id === project.data.id);
    expect(mine.map((p) => p.title)).toEqual(['Paper robot arm']);
    const saved = await mockRequest({
      method: 'GET',
      path: `/progress/assessments/${quiz.data.id}`,
      token: net.token,
    });
    expect(saved.body.data.scores.find((s) => s.learnerId === AMANI).score).toBe(4);
    const item = await mockRequest({
      method: 'GET',
      path: `/equipment/${LAPTOP_1}`,
      token: net.token,
    });
    expect(item.body.data.condition).toBe('lost');
  });

  it('opens a saved resource with no connection, and forgets it on sign-out', async () => {
    const resource = (await local.getResource(WORKSHEET)).data;
    const res = await mockRequest({
      method: 'GET',
      path: `/resources/${WORKSHEET}/file`,
      token: net.token,
    });
    await local.keepResourceFile(resource, res.body);
    expect((await local.savedResourcesSize()).used).toBe(res.body.size);
    net.offline = true;
    const file = await local.savedResourceFile(WORKSHEET);
    expect(file.size).toBe(res.body.size);
    expect((await local.listResources()).data.find((r) => r.id === WORKSHEET).saved).toBe(true);

    await stopOffline({ wipe: true });
    expect(await Dexie.exists(dbName(user.id))).toBe(false);
    await startOffline(user);
    net.offline = false;
    await syncNow();
    expect(await local.savedResourceFile(WORKSHEET)).toBeNull();
  });

  it('drops a record that left the user’s scope', async () => {
    const db = currentDb();
    // An item handed back to the store is no longer the club's.
    await mockRequest({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'wanjiru.kamau@demo.steamlabs.test', password: DEMO_PASSWORD },
    }).then((r) =>
      mockRequest({
        method: 'POST',
        path: `/equipment/${LAPTOP_1}/return`,
        body: { returnedDate: today(), condition: 'working' },
        token: r.body.data.accessToken,
      }),
    );
    await syncNow();
    expect(await db.equipmentItems.get(LAPTOP_1)).toBeUndefined();
  });
});
