import request from 'supertest';
import { uid } from '@code-clubs/shared/demo';
import { clearDatabase, useTestDatabase } from '../support/database.js';
import { seed } from '../../scripts/seed.js';
import { createApp } from '../../src/app.js';

/**
 * Sprint 2 on a real (in-memory) MongoDB with the demo data: learners, guardian contacts,
 * consent, sessions, attendance and photos, each with allowed and refused cases.
 */
useTestDatabase();

const app = createApp();
const PASSWORD = 'test-password-123';
const EMAIL = {
  admin: 'wanjiru.kamau@demo.steamlabs.test',
  pm: 'otieno.ouma@demo.steamlabs.test',
  coordinator: 'mwende.mutua@demo.steamlabs.test',
  otherCoordinator: 'achieng.odhiambo@demo.steamlabs.test',
  champion: 'faith.njeri@demo.steamlabs.test',
  otherChampion: 'amina.salim@demo.steamlabs.test',
  // Leads NAC-002, which meets at a community centre (one club per champion, D5-9).
  grace: 'grace.wambui@demo.steamlabs.test',
};
// Demo records: NAC-001 is Faith's club and NAC-002 Grace's, in Nairobi; WNY-001 is Amina's in Kisumu.
const NAC_001 = uid(201);
const NAC_002 = uid(202);
const NAC_003 = uid(203);
const ZAWADI = uid(1001); // NAC-001, guardian contact on file
const IMANI = uid(1003); // NAC-001, photo consent refused
const AKINYI = uid(1010); // WNY-001
const OLD_SESSION = uid(1601); // NAC-001, 15 days ago
const RECENT_SESSION = uid(1603); // NAC-001, yesterday

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake image data'),
]);
const PDF = Buffer.from('%PDF-1.4 signed consent form');
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function signIn(email) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const tokens = {};
beforeAll(async () => {
  await clearDatabase();
  await seed({ password: PASSWORD });
  for (const [role, email] of Object.entries(EMAIL)) tokens[role] = await signIn(email);
});

const api = (role) => ({
  get: (url) => request(app).get(`/api/v1${url}`).set(auth(tokens[role])),
  post: (url, body) => request(app).post(`/api/v1${url}`).set(auth(tokens[role])).send(body),
  put: (url, body) => request(app).put(`/api/v1${url}`).set(auth(tokens[role])).send(body),
  patch: (url, body) => request(app).patch(`/api/v1${url}`).set(auth(tokens[role])).send(body),
  delete: (url) => request(app).delete(`/api/v1${url}`).set(auth(tokens[role])),
  upload: (method, url, buffer, type) => {
    const agent = request(app);
    const call = method === 'put' ? agent.put(`/api/v1${url}`) : agent.post(`/api/v1${url}`);
    return call.set(auth(tokens[role])).set('Content-Type', type).send(buffer);
  },
});

const newLearner = (extra = {}) => ({
  clubId: NAC_001,
  firstName: 'Wanjiku',
  lastName: 'Test',
  age: 11,
  gender: 'girl',
  grade: 'grade_6',
  admissionNumber: 'ADM-9001',
  ...extra,
});

describe('Learners', () => {
  it('shows a champion only the learners of their clubs, and 404s others', async () => {
    const list = await api('champion').get('/learners?pageSize=100');
    expect(list.status).toBe(200);
    expect(new Set(list.body.data.map((l) => l.clubId))).toEqual(new Set([NAC_001]));
    expect((await api('champion').get(`/learners/${AKINYI}`)).status).toBe(404);
    expect((await api('otherChampion').get(`/learners/${ZAWADI}`)).status).toBe(404);
  });

  it('keeps a coordinator to their region', async () => {
    const list = await api('coordinator').get('/learners?pageSize=100');
    expect(new Set(list.body.data.map((l) => l.region))).toEqual(new Set(['nairobi_central']));
    expect((await api('coordinator').get(`/learners/${AKINYI}`)).status).toBe(404);
  });

  it('returns age and consent status, never the guardian contact', async () => {
    const res = await api('admin').get(`/learners/${ZAWADI}`);
    expect(res.body.data).toMatchObject({
      age: 11,
      hasContact: true,
      consents: { participation: { status: 'given' }, photo: { status: 'given' } },
    });
    const all = await api('admin').get('/learners?pageSize=100');
    expect(JSON.stringify([res.body, all.body])).not.toMatch(/guardianName|\+254700000500/);
  });

  it('registers a learner with a contact the champion cannot read back', async () => {
    const res = await api('champion').post(
      '/learners',
      newLearner({
        contact: { guardianName: 'Lucy Test', relationship: 'mother', phone: '+254700000901' },
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      learnerNumber: 'NAC-001-007',
      age: 11,
      region: 'nairobi_central',
      hasContact: true,
      consents: { participation: { status: 'pending' } },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/Lucy|254700000901/);
    const id = res.body.data.id;

    expect((await api('champion').get(`/learners/${id}/contact`)).status).toBe(403);
    expect((await api('coordinator').get(`/learners/${id}/contact`)).status).toBe(403);
    const contact = await api('pm').get(`/learners/${id}/contact`);
    expect(contact.status).toBe(200);
    expect(contact.body.data).toMatchObject({ guardianName: 'Lucy Test', phone: '+254700000901' });

    // The read is audited, and the audit log never holds the contact itself.
    const audit = await api('admin').get(`/audit?entityType=learner&entityId=${id}`);
    const actions = audit.body.data.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['learner.contactSet', 'learner.contactRead']));
    expect(JSON.stringify(audit.body)).not.toMatch(/Lucy|254700000901/);
  });

  it('warns about a possible duplicate and refuses a reused admission number', async () => {
    const dup = await api('champion').post(
      '/learners',
      newLearner({ firstName: 'zawadi', lastName: 'MWANGI', admissionNumber: 'ADM-9002' }),
    );
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('POSSIBLE_DUPLICATE');

    const confirmed = await api('champion').post(
      '/learners',
      newLearner({
        firstName: 'Zawadi',
        lastName: 'Mwangi',
        admissionNumber: 'ADM-9002',
        confirmDuplicate: true,
      }),
    );
    expect(confirmed.status).toBe(201);

    const sameAdmission = await api('champion').post(
      '/learners',
      newLearner({ firstName: 'Other', admissionNumber: 'adm-9002' }),
    );
    expect(sameAdmission.status).toBe(409);
    expect(sameAdmission.body.error.message).toBe(
      'A learner with this admission number is already registered at this school',
    );
  });

  it('needs an admission number at school clubs only, and validates the fields', async () => {
    const noAdmission = await api('champion').post(
      '/learners',
      newLearner({ admissionNumber: undefined, firstName: 'Nuru' }),
    );
    expect(noAdmission.status).toBe(400);
    // NAC-002 meets at a community centre.
    const community = await api('grace').post(
      '/learners',
      newLearner({ clubId: NAC_002, admissionNumber: undefined, firstName: 'Nuru' }),
    );
    expect(community.status).toBe(201);

    const tooYoung = await api('champion').post('/learners', newLearner({ age: 6 }));
    expect(tooYoung.status).toBe(400);
    const extra = await api('champion').post('/learners', newLearner({ homeAddress: 'Kibra' }));
    expect(extra.status).toBe(400);
  });

  it('refuses registration in a club outside scope or above capacity', async () => {
    const outside = await api('champion').post(
      '/learners',
      newLearner({ clubId: uid(204), admissionNumber: 'ADM-9100' }),
    );
    expect(outside.status).toBe(404);

    expect((await api('admin').patch(`/clubs/${NAC_003}`, { capacity: 1 })).status).toBe(200);
    const first = await api('admin').post(
      '/learners',
      newLearner({ clubId: NAC_003, firstName: 'First', admissionNumber: undefined }),
    );
    expect(first.status).toBe(201);
    const second = await api('admin').post(
      '/learners',
      newLearner({ clubId: NAC_003, firstName: 'Second', admissionNumber: undefined }),
    );
    expect(second.status).toBe(409);
    expect(second.body.error.message).toBe('This club is full');

    // Leaving frees the place; coming back needs one.
    const left = await api('admin').patch(`/learners/${first.body.data.id}/status`, {
      status: 'left',
    });
    expect(left.body.data).toMatchObject({ status: 'left', leftAt: daysAgo(0) });
  });

  it('updates the agreed fields only; a learner cannot move club', async () => {
    const res = await api('champion').patch(`/learners/${ZAWADI}`, { grade: 'grade_7', age: 12 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ grade: 'grade_7', age: 12 });
    const move = await api('admin').patch(`/learners/${ZAWADI}`, { clubId: NAC_002 });
    expect(move.status).toBe(400);
  });
});

describe('Consent', () => {
  it('records consent and stores the signed form for HQ and coordinators only', async () => {
    const id = uid(1005); // Neema: no consent yet
    const set = await api('champion').put(`/learners/${id}/consents/participation`, {
      status: 'given',
      signedOn: '2026-10-20',
    });
    expect(set.status).toBe(200);
    expect(set.body.data.participation).toMatchObject({ status: 'given', hasFile: false });

    const up = await api('champion').upload(
      'put',
      `/learners/${id}/consents/participation/file`,
      PDF,
      'application/pdf',
    );
    expect(up.status).toBe(200);
    expect(up.body.data.participation.hasFile).toBe(true);

    const url = `/learners/${id}/consents/participation/file`;
    expect((await api('champion').get(url)).status).toBe(403);
    expect((await api('otherCoordinator').get(url)).status).toBe(404);
    const file = await api('coordinator').get(url).buffer(true);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['cache-control']).toBe('no-store, private');
    expect(file.headers['content-disposition']).toMatch(/^attachment/);
    expect(Buffer.from(file.body).equals(PDF)).toBe(true);

    const audit = await api('admin').get(`/audit?entityType=learner&entityId=${id}`);
    expect(audit.body.data.map((e) => e.action)).toContain('learner.consentFileRead');
  });

  it('checks the file by its content and size, not its name or header', async () => {
    const url = `/learners/${ZAWADI}/consents/photo/file`;
    const text = await api('champion').upload('put', url, Buffer.from('hello'), 'image/png');
    expect(text.status).toBe(400);
    expect(text.body.error.message).toBe('Upload a JPG, PNG or PDF file');
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const tooBig = await api('champion').upload('put', url, big, 'image/png');
    expect(tooBig.status).toBe(413);
  });

  it('refuses an unknown consent type', async () => {
    const res = await api('champion').put(`/learners/${ZAWADI}/consents/events`, {
      status: 'given',
    });
    expect(res.status).toBe(400);
  });
});

describe('Sessions and attendance', () => {
  it('lists sessions in scope with attendance counts', async () => {
    const res = await api('champion').get(`/sessions?clubId=${NAC_001}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.date)).toEqual([daysAgo(1), daysAgo(8), daysAgo(15)]);
    expect(res.body.data[0].attendance).toEqual({ present: 4, total: 5 });
    const other = await api('otherChampion').get(`/sessions/${RECENT_SESSION}`);
    expect(other.status).toBe(404);
  });

  it('reports a session with the club times and takes attendance in one step', async () => {
    const created = await api('grace').post('/sessions', {
      clubId: NAC_002,
      date: daysAgo(0),
      topic: 'Unplugged: binary bracelets',
      notes: 'Used beads.',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      status: 'held',
      startTime: '10:00',
      endTime: '12:00',
    });
    const id = created.body.data.id;

    const again = await api('grace').post('/sessions', {
      clubId: NAC_002,
      date: daysAgo(0),
      topic: 'Again',
    });
    expect(again.status).toBe(409);

    const wrongClub = await api('grace').put(`/sessions/${id}/attendance`, {
      records: [{ learnerId: ZAWADI, status: 'present' }],
    });
    expect(wrongClub.status).toBe(400);

    const saved = await api('grace').put(`/sessions/${id}/attendance`, {
      records: [
        { learnerId: uid(1007), status: 'present' },
        { learnerId: uid(1008), status: 'late' },
        { learnerId: uid(1009), status: 'absent' },
      ],
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.attendance).toHaveLength(3);
    expect(saved.body.data.attendance[0]).toMatchObject({ firstName: 'Kamau', status: 'late' });

    // Saving again replaces the list.
    const replaced = await api('grace').put(`/sessions/${id}/attendance`, {
      records: [{ learnerId: uid(1007), status: 'absent' }],
    });
    expect(replaced.body.data.attendance).toEqual([
      expect.objectContaining({ learnerId: uid(1007), status: 'absent' }),
    ]);
  });

  it('needs a topic for a held session and allows only planned ones in the future', async () => {
    const noTopic = await api('grace').post('/sessions', { clubId: NAC_002, date: daysAgo(2) });
    expect(noTopic.status).toBe(400);
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const held = await api('grace').post('/sessions', {
      clubId: NAC_002,
      date: future,
      topic: 'Later',
    });
    expect(held.status).toBe(400);
    const planned = await api('grace').post('/sessions', {
      clubId: NAC_002,
      date: future,
      status: 'planned',
    });
    expect(planned.status).toBe(201);
    const attendance = await api('grace').put(`/sessions/${planned.body.data.id}/attendance`, {
      records: [],
    });
    expect(attendance.status).toBe(400);
    expect(attendance.body.error.message).toBe(
      'Attendance can only be taken for a session that was held',
    );
  });

  it('locks a report for champions after 7 days, but not for coordinators (D2-5)', async () => {
    const champion = await api('champion').patch(`/sessions/${OLD_SESSION}`, { notes: 'Late' });
    expect(champion.status).toBe(403);
    const backdated = await api('grace').post('/sessions', {
      clubId: NAC_002,
      date: daysAgo(10),
      topic: 'Old',
    });
    expect(backdated.status).toBe(403);
    const coordinator = await api('coordinator').patch(`/sessions/${OLD_SESSION}`, {
      notes: 'Corrected by the coordinator',
    });
    expect(coordinator.status).toBe(200);
    expect(coordinator.body.data.notes).toBe('Corrected by the coordinator');
  });
});

describe('Session photos', () => {
  const url = `/sessions/${RECENT_SESSION}/photos`;

  it('asks for confirmation when a learner present has no photo consent (D2-7)', async () => {
    const res = await api('champion').upload('post', url, PNG, 'image/png');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHOTO_CONSENT_MISSING');
    const names = res.body.error.details.map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(['Imani Wekesa']));
    expect(res.body.error.details.map((d) => d.learnerId)).toContain(IMANI);
  });

  it('adds up to 3 photos once confirmed, serves them in scope and deletes them', async () => {
    const ids = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await api('champion').upload(
        'post',
        `${url}?confirmConsent=true`,
        PNG,
        'image/png',
      );
      expect(res.status).toBe(201);
      ids.push(res.body.data.photoIds.at(-1));
    }
    const fourth = await api('champion').upload(
      'post',
      `${url}?confirmConsent=true`,
      PNG,
      'image/png',
    );
    expect(fourth.status).toBe(409);

    const pdf = await api('admin').upload('post', `${url}?confirmConsent=true`, PDF, 'image/png');
    expect(pdf.status).toBe(400);

    const photo = await api('coordinator').get(`${url}/${ids[0]}`).buffer(true);
    expect(photo.status).toBe(200);
    expect(photo.headers['content-type']).toBe('image/png');
    expect((await api('otherChampion').get(`${url}/${ids[0]}`)).status).toBe(404);

    expect((await api('champion').delete(`${url}/${ids[0]}`)).status).toBe(204);
    expect((await api('champion').get(`${url}/${ids[0]}`)).status).toBe(404);
  });
});

describe('Every write is refused outside scope', () => {
  it('answers 404 to another club’s champion and 403 without the permission', async () => {
    const other = api('otherChampion');
    const learner = `/learners/${ZAWADI}`;
    const session = `/sessions/${RECENT_SESSION}`;
    const contact = { guardianName: 'Someone Else', relationship: 'other', phone: '+254700000902' };
    const refused = [
      await other.patch(learner, { grade: 'grade_9' }),
      await other.patch(`${learner}/status`, { status: 'left' }),
      await other.put(`${learner}/contact`, contact),
      await other.put(`${learner}/consents/photo`, { status: 'given' }),
      await other.upload('put', `${learner}/consents/photo/file`, PNG, 'image/png'),
      await other.patch(session, { notes: 'x' }),
      await other.put(`${session}/attendance`, { records: [] }),
      await other.upload('post', `${session}/photos?confirmConsent=true`, PNG, 'image/png'),
      await other.post('/sessions', { clubId: NAC_001, date: daysAgo(3), topic: 'x' }),
    ];
    expect(refused.map((r) => r.status)).toEqual(Array(refused.length).fill(404));
    // Coordinators can read learners but never guardian contacts.
    expect((await api('coordinator').get(`${learner}/contact`)).status).toBe(403);
  });
});

describe('Dashboard', () => {
  it('adds learner, session and attendance counts within scope', async () => {
    const champion = await api('champion').get('/dashboard/summary');
    expect(champion.body.data).toMatchObject({
      learners: expect.any(Number),
      learnersByGender: expect.objectContaining({ girl: expect.any(Number) }),
      sessionsThisMonth: expect.any(Number),
      learnersMissingConsent: expect.any(Number),
    });
    const other = await api('otherChampion').get('/dashboard/summary');
    expect(other.body.data.learners).toBe(2);
  });
});
