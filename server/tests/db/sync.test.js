import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { uid } from '@code-clubs/shared/demo';
import { clearDatabase, useTestDatabase } from '../support/database.js';
import { seed } from '../../scripts/seed.js';
import { createApp } from '../../src/app.js';
import { Learner } from '../../src/db/models.js';

/**
 * Sprint 3 sync on a real (in-memory) MongoDB with the demo data (docs/sync-protocol.md):
 * idempotent push, scope on every change, conflicts, joined sessions, attendance merging,
 * the edit window with device time, and pull with cursors, tombstones and scope resets.
 */
useTestDatabase();

const app = createApp();
const PASSWORD = 'test-password-123';
const EMAIL = {
  admin: 'wanjiru.kamau@demo.steamlabs.test',
  coordinator: 'mwende.mutua@demo.steamlabs.test',
  champion: 'faith.njeri@demo.steamlabs.test',
  otherChampion: 'amina.salim@demo.steamlabs.test',
};
const FAITH = uid(11);
const NAC_001 = uid(201);
const NAC_002 = uid(202);
const WNY_001 = uid(204);
const ZAWADI = uid(1001); // NAC-001, guardian contact on file
const BARAKA = uid(1002); // NAC-001
const IMANI = uid(1003); // NAC-001
const AKINYI = uid(1010); // WNY-001
const OLD_SESSION = uid(1601); // NAC-001, 15 days ago
const RECENT_SESSION = uid(1603); // NAC-001, yesterday
const KISUMU_SESSION = uid(1604); // WNY-001

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake image data'),
]);
const DAY = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const at = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();

const tokens = {};
beforeAll(async () => {
  await clearDatabase();
  await seed({ password: PASSWORD });
  for (const [role, email] of Object.entries(EMAIL)) {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    tokens[role] = res.body.data.accessToken;
  }
});

const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });
const api = (role) => ({
  get: (url) => request(app).get(`/api/v1${url}`).set(auth(role)),
  put: (url, body) => request(app).put(`/api/v1${url}`).set(auth(role)).send(body),
  push: (operations) => request(app).post('/api/v1/sync/push').set(auth(role)).send({ operations }),
  pull: (query = {}) => request(app).get('/api/v1/sync/pull').query(query).set(auth(role)),
});

const op = (type, data, extra = {}) => ({
  opId: randomUUID(),
  type,
  recordedAt: at(),
  data,
  ...extra,
});

const newLearner = (extra = {}) => ({
  id: randomUUID(),
  clubId: NAC_001,
  firstName: 'Nafula',
  lastName: 'Offline',
  age: 10,
  gender: 'girl',
  grade: 'grade_5',
  admissionNumber: `ADM-${Math.floor(Math.random() * 1e6)}`,
  ...extra,
});

/** Pulls every page, as a device does. */
async function pullAll(role, query = {}) {
  let res = await api(role).pull(query);
  expect(res.status).toBe(200);
  const pages = [res.body.data];
  while (res.body.data.more) {
    res = await api(role).pull({ ...query, cursor: res.body.data.cursor });
    pages.push(res.body.data);
  }
  return pages;
}

describe('Pull', () => {
  it('sends a champion their own clubs only, without contacts or consent forms', async () => {
    const [page] = await pullAll('champion');
    const { changes } = page;
    expect(changes.clubs.map((c) => c.id)).toEqual([NAC_001]);
    expect(changes.learners.every((l) => l.clubId === NAC_001)).toBe(true);
    expect(changes.learners.some((l) => l.id === AKINYI)).toBe(false);
    expect(changes.sessions.some((s) => s.id === KISUMU_SESSION)).toBe(false);
    const zawadi = changes.learners.find((l) => l.id === ZAWADI);
    expect(zawadi).toMatchObject({ hasContact: true, age: expect.any(Number) });
    expect(JSON.stringify(page)).not.toMatch(/guardianName|254700000500/);
    expect(changes.consents.length).toBeGreaterThan(0);
    for (const consent of changes.consents) {
      expect(consent).not.toHaveProperty('fileId');
      expect(consent).toHaveProperty('hasFile');
    }
    expect(changes.attendance.length).toBeGreaterThan(0);
    expect(page.scopeKey).toMatch(/^[0-9a-f]{32}$/);
    expect(page.reset).toBe(false);
  });

  it('keeps a coordinator to their region and refuses roles that do not sync (D3-1)', async () => {
    const [page] = await pullAll('coordinator');
    expect(page.changes.clubs.every((c) => c.region === 'nairobi_central')).toBe(true);
    const hq = await api('admin').pull();
    expect(hq.status).toBe(403);
    expect(hq.body.error.code).toBe('SYNC_NOT_AVAILABLE');
    const push = await api('admin').push([op('learner.status', { status: 'left' })]);
    expect(push.status).toBe(403);
  });

  it('sends only what changed after the cursor, with a short overlap', async () => {
    const [first] = await pullAll('champion');
    const again = await api('champion').pull({ cursor: first.cursor, scopeKey: first.scopeKey });
    // Only the last 2 minutes before the cursor come again (the overlap), never older changes.
    const newest = Math.max(...first.changes.learners.map((l) => Date.parse(l.updatedAt)));
    for (const l of again.body.data.changes.learners) {
      expect(Date.parse(l.updatedAt)).toBeGreaterThanOrEqual(newest - 2 * 60 * 1000);
    }

    const edit = await api('champion').push([
      op('learner.update', { grade: 'grade_7' }, { recordId: BARAKA }),
    ]);
    expect(edit.body.data.results[0].status).toBe('applied');
    const next = await api('champion').pull({ cursor: first.cursor, scopeKey: first.scopeKey });
    const baraka = next.body.data.changes.learners.find((l) => l.id === BARAKA);
    expect(baraka.grade).toBe('grade_7');
    // A pull that continues from the newest cursor no longer sends older records.
    const later = await api('champion').pull({
      cursor: next.body.data.cursor,
      scopeKey: first.scopeKey,
    });
    expect(later.body.data.changes.learners.map((l) => l.id)).toEqual([BARAKA]);
  });

  it('pages through large changes without missing or repeating records', async () => {
    const pages = await pullAll('coordinator');
    const ids = pages.flatMap((p) => p.changes.learners.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('starts again from scratch when the user’s scope changes', async () => {
    const [before] = await pullAll('champion');
    // Faith moves from NAC-001 to WNY-001 (one club per champion, D5-9), then back.
    const move = async (from, to, role) => {
      await request(app).delete(`/api/v1/clubs/${from}/champions/${FAITH}`).set(auth('admin'));
      return request(app)
        .put(`/api/v1/clubs/${to}/champions/${FAITH}`)
        .set(auth('admin'))
        .send({ role });
    };
    expect((await move(NAC_001, WNY_001, 'assistant')).status).toBe(200);
    const after = await api('champion').pull({ cursor: before.cursor, scopeKey: before.scopeKey });
    expect(after.body.data.reset).toBe(true);
    expect(after.body.data.changes.learners.some((l) => l.id === AKINYI)).toBe(true);
    expect((await move(WNY_001, NAC_001, 'lead')).status).toBe(200);
  });

  it('refuses a cursor it did not make', async () => {
    const res = await api('champion').pull({ cursor: 'not-a-cursor' });
    expect(res.status).toBe(400);
  });
});

describe('Push', () => {
  it('registers a learner made offline, with consent and contact, exactly once (D3-3)', async () => {
    const learner = newLearner();
    const ops = [
      op('learner.create', learner),
      op(
        'consent.set',
        { status: 'given', signedOn: daysAgo(1) },
        {
          recordId: learner.id,
          params: { type: 'participation' },
        },
      ),
      op(
        'learner.contact',
        { guardianName: 'Offline Guardian', relationship: 'mother', phone: '+254700000777' },
        { recordId: learner.id },
      ),
    ];
    const first = await api('champion').push(ops);
    expect(first.status).toBe(200);
    expect(first.body.data.results.map((r) => r.status)).toEqual(['applied', 'applied', 'applied']);

    // The reply was lost; the device sends the same changes again.
    const again = await api('champion').push(ops);
    expect(again.body.data.results).toEqual(first.body.data.results);
    expect(await Learner.countDocuments({ firstName: 'Nafula', lastName: 'Offline' })).toBe(1);

    const saved = await api('champion').get(`/learners/${learner.id}`);
    expect(saved.body.data).toMatchObject({
      id: learner.id,
      learnerNumber: expect.stringMatching(/^NAC-001-\d{3}$/),
      hasContact: true,
      consents: { participation: { status: 'given' } },
    });
    // Champions still cannot read the contact they entered (D2-1).
    expect((await api('champion').get(`/learners/${learner.id}/contact`)).status).toBe(403);
  });

  it('applies the same rules as online, refusing anything outside scope', async () => {
    const outside = newLearner({ clubId: WNY_001 });
    const res = await api('champion').push([
      op('learner.create', outside),
      op('consent.set', { status: 'given' }, { recordId: outside.id, params: { type: 'photo' } }),
      op('learner.update', { grade: 'grade_9' }, { recordId: AKINYI }),
      op('learner.status', { status: 'left' }, { recordId: AKINYI }),
      op(
        'learner.contact',
        { guardianName: 'Someone Else', relationship: 'father', phone: '+254700000778' },
        { recordId: AKINYI },
      ),
      op('session.create', { id: randomUUID(), clubId: WNY_001, date: daysAgo(0), topic: 'x' }),
      op('session.update', { topic: 'Changed' }, { recordId: KISUMU_SESSION }),
      op(
        'session.attendance',
        { records: [{ learnerId: AKINYI, status: 'absent' }] },
        { recordId: KISUMU_SESSION },
      ),
    ]);
    const results = res.body.data.results;
    expect(results[0]).toMatchObject({ status: 'rejected', error: { code: 'NOT_FOUND' } });
    // The consent belongs to the refused learner, so it waits behind it.
    expect(results[1].status).toBe('skipped');
    expect(results[2]).toMatchObject({ status: 'rejected', error: { code: 'NOT_FOUND' } });
    // Later changes to the same refused record are skipped.
    expect(results[3].status).toBe('skipped');
    expect(results[4].status).toBe('skipped');
    expect(results[5]).toMatchObject({ status: 'rejected', error: { code: 'NOT_FOUND' } });
    expect(results[6]).toMatchObject({ status: 'rejected', error: { code: 'NOT_FOUND' } });
    expect(results[7].status).toBe('skipped');
    const akinyi = await api('otherChampion').get(`/learners/${AKINYI}`);
    expect(akinyi.body.data).toMatchObject({ grade: 'grade_6', status: 'active' });
  });

  it('validates each change with its endpoint’s schema', async () => {
    const res = await api('champion').push([
      op('learner.create', { ...newLearner(), age: 7 }),
      op('learner.update', { clubId: NAC_002 }, { recordId: ZAWADI }),
      op('learner.update', { grade: 'grade_5' }),
      op('consent.set', { status: 'given' }, { recordId: BARAKA, params: { type: 'medical' } }),
    ]);
    for (const r of res.body.data.results) {
      expect(r).toMatchObject({ status: 'rejected', error: { code: 'VALIDATION_ERROR' } });
    }
    const bad = await api('champion').push([{ type: 'learner.delete' }]);
    expect(bad.status).toBe(400);
  });

  it('refuses a possible duplicate until the device confirms it (US-07)', async () => {
    const twin = newLearner({
      firstName: 'Zawadi',
      lastName: 'Mwangi',
      age: 11,
      admissionNumber: 'ADM-TWIN-1',
    });
    const { birthYear } = await Learner.findById(ZAWADI).lean();
    twin.age = new Date().getFullYear() - birthYear;
    const first = await api('champion').push([op('learner.create', twin)]);
    expect(first.body.data.results[0]).toMatchObject({
      status: 'rejected',
      error: { code: 'POSSIBLE_DUPLICATE', details: [{ learnerId: ZAWADI }] },
    });
    const confirmed = await api('champion').push([
      op('learner.create', { ...twin, admissionNumber: 'ADM-TWIN-2', confirmDuplicate: true }),
    ]);
    expect(confirmed.body.data.results[0].status).toBe('applied');
  });

  it('refuses a device time in the future', async () => {
    const res = await api('champion').push([
      op(
        'learner.update',
        { grade: 'grade_6' },
        { recordId: IMANI, recordedAt: at(-60 * 60 * 1000) },
      ),
    ]);
    expect(res.body.data.results[0]).toMatchObject({
      status: 'rejected',
      error: { code: 'INVALID_RECORDED_AT' },
    });
  });
});

describe('Conflicts (D3-5)', () => {
  it('keeps both changes when different fields were edited', async () => {
    const { body } = await api('champion').get(`/sessions/${RECENT_SESSION}`);
    const base = { topic: body.data.topic, notes: body.data.notes };
    const a = await api('champion').push([
      op(
        'session.update',
        { topic: 'Variables (champion)' },
        {
          recordId: RECENT_SESSION,
          base: { topic: base.topic },
        },
      ),
    ]);
    const b = await api('coordinator').push([
      op(
        'session.update',
        { notes: 'Notes from the coordinator' },
        {
          recordId: RECENT_SESSION,
          base: { notes: base.notes },
        },
      ),
    ]);
    expect(a.body.data.results[0]).toEqual({ opId: expect.any(String), status: 'applied' });
    expect(b.body.data.results[0]).toEqual({ opId: expect.any(String), status: 'applied' });
    const saved = await api('champion').get(`/sessions/${RECENT_SESSION}`);
    expect(saved.body.data).toMatchObject({
      topic: 'Variables (champion)',
      notes: 'Notes from the coordinator',
    });
  });

  it('lets the last change win the same field and logs what it overwrote', async () => {
    const base = { topic: 'Variables (champion)' };
    await api('champion').push([
      op('session.update', { topic: 'Scores and variables' }, { recordId: RECENT_SESSION, base }),
    ]);
    const late = await api('coordinator').push([
      op(
        'session.update',
        { topic: 'Variables and scoreboards' },
        {
          recordId: RECENT_SESSION,
          base,
        },
      ),
    ]);
    expect(late.body.data.results[0]).toMatchObject({ status: 'applied', conflicts: ['topic'] });
    const saved = await api('champion').get(`/sessions/${RECENT_SESSION}`);
    expect(saved.body.data.topic).toBe('Variables and scoreboards');

    const log = await api('coordinator').get('/sync/conflicts');
    expect(log.status).toBe(200);
    expect(log.body.data[0]).toMatchObject({
      entityType: 'session',
      entityId: RECENT_SESSION,
      field: 'topic',
      overwritten: 'Scores and variables',
      applied: 'Variables and scoreboards',
      actorName: 'Mwende Mutua',
    });
    expect((await api('champion').get('/sync/conflicts')).status).toBe(403);
    expect((await api('otherChampion').get('/sync/conflicts')).status).toBe(403);
  });

  it('does not keep values of sensitive fields in the log', async () => {
    const base = { accessibilityNeeds: null };
    await api('coordinator').push([
      op(
        'learner.update',
        { accessibilityNeeds: 'Needs a larger screen' },
        {
          recordId: IMANI,
          base,
        },
      ),
    ]);
    const res = await api('champion').push([
      op(
        'learner.update',
        { accessibilityNeeds: 'Sits at the front' },
        {
          recordId: IMANI,
          base,
        },
      ),
    ]);
    expect(res.body.data.results[0].conflicts).toEqual(['accessibilityNeeds']);
    const log = await api('coordinator').get('/sync/conflicts');
    const entry = log.body.data.find((c) => c.field === 'accessibilityNeeds');
    expect(entry).toMatchObject({ redacted: true, overwritten: null, applied: null });
    expect(JSON.stringify(log.body)).not.toMatch(/larger screen|Sits at the front/);
  });
});

describe('Sessions and attendance offline', () => {
  it('merges attendance taken on two devices, learner by learner (D2-4)', async () => {
    const session = op('session.create', {
      id: randomUUID(),
      clubId: NAC_001,
      date: daysAgo(2),
      status: 'held',
      topic: 'Unplugged: binary bracelets',
    });
    expect((await api('champion').push([session])).body.data.results[0].status).toBe('applied');
    const id = session.data.id;
    const learners = (await api('champion').get(`/learners?clubId=${NAC_001}&status=active`)).body
      .data;
    const [l1, l2] = learners;
    await api('champion').push([
      op(
        'session.attendance',
        { records: [{ learnerId: l1.id, status: 'present' }] },
        {
          recordId: id,
        },
      ),
    ]);
    await api('coordinator').push([
      op(
        'session.attendance',
        { records: [{ learnerId: l2.id, status: 'late' }] },
        {
          recordId: id,
        },
      ),
    ]);
    const saved = await api('champion').get(`/sessions/${id}`);
    const marks = Object.fromEntries(
      saved.body.data.attendance.map((a) => [a.learnerId, a.status]),
    );
    expect(marks).toEqual({ [l1.id]: 'present', [l2.id]: 'late' });
  });

  it('joins two sessions reported offline for the same club and date (D3-6)', async () => {
    const date = daysAgo(3);
    const first = op('session.create', {
      id: randomUUID(),
      clubId: NAC_001,
      date,
      status: 'held',
      topic: 'Scratch: broadcast messages',
    });
    await api('champion').push([first]);

    const otherId = randomUUID();
    const res = await api('coordinator').push([
      op('session.create', {
        id: otherId,
        clubId: NAC_001,
        date,
        status: 'held',
        topic: 'Something else',
        notes: 'The projector worked today.',
      }),
      op(
        'session.attendance',
        { records: [{ learnerId: ZAWADI, status: 'present' }] },
        {
          recordId: otherId,
        },
      ),
    ]);
    const [created, marks] = res.body.data.results;
    expect(created).toMatchObject({ status: 'applied', joined: true, recordId: first.data.id });
    expect(marks.status).toBe('applied');
    const saved = await api('champion').get(`/sessions/${first.data.id}`);
    expect(saved.body.data).toMatchObject({
      topic: 'Scratch: broadcast messages',
      notes: 'The projector worked today.',
    });
    expect(saved.body.data.attendance.map((a) => a.learnerId)).toContain(ZAWADI);
    expect((await api('champion').get(`/sessions/${otherId}`)).status).toBe(404);
  });

  it('checks the 7-day window against when the change was made (D3-7)', async () => {
    // The session was 15 days ago; the champion edited it offline 9 days ago, on day 6.
    const madeInTime = await api('champion').push([
      op(
        'session.update',
        { notes: 'Written at the venue' },
        {
          recordId: OLD_SESSION,
          recordedAt: at(9 * DAY),
        },
      ),
    ]);
    expect(madeInTime.body.data.results[0].status).toBe('applied');
    const madeToday = await api('champion').push([
      op('session.update', { notes: 'Too late' }, { recordId: OLD_SESSION }),
    ]);
    expect(madeToday.body.data.results[0]).toMatchObject({
      status: 'rejected',
      error: { code: 'FORBIDDEN' },
    });
    // A change more than 14 days old counts as made now.
    const tooOld = await api('champion').push([
      op(
        'session.update',
        { notes: 'Very late' },
        {
          recordId: OLD_SESSION,
          recordedAt: at(15 * DAY),
        },
      ),
    ]);
    expect(tooOld.body.data.results[0].status).toBe('rejected');
  });

  it('adds a photo sent twice with the same opId only once', async () => {
    const opId = randomUUID();
    const send = () =>
      request(app)
        .post(`/api/v1/sessions/${RECENT_SESSION}/photos`)
        .query({ confirmConsent: 'true', opId, recordedAt: at() })
        .set(auth('champion'))
        .set('Content-Type', 'image/png')
        .send(PNG);
    const first = await send();
    expect(first.status).toBe(201);
    const second = await send();
    expect(second.status).toBe(201);
    expect(second.body.data.photoIds).toEqual(first.body.data.photoIds);
  });

  it('tells devices about attendance removed online', async () => {
    const [before] = await pullAll('champion');
    const session = (await api('champion').get(`/sessions/${RECENT_SESSION}`)).body.data;
    const removed = session.attendance[0];
    const keep = session.attendance
      .slice(1)
      .map(({ learnerId, status }) => ({ learnerId, status }));
    expect(
      (await api('champion').put(`/sessions/${RECENT_SESSION}/attendance`, { records: keep }))
        .status,
    ).toBe(200);
    const after = await api('champion').pull({ cursor: before.cursor, scopeKey: before.scopeKey });
    const removedId = before.changes.attendance.find(
      (a) => a.sessionId === RECENT_SESSION && a.learnerId === removed.learnerId,
    ).id;
    expect(after.body.data.deleted.attendance).toContain(removedId);
  });
});
