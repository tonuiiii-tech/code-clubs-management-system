import request from 'supertest';
import { uid } from '@code-clubs/shared/demo';
import { clearDatabase, useTestDatabase } from '../support/database.js';
import { seed } from '../../scripts/seed.js';
import { createApp } from '../../src/app.js';

/**
 * Sprint 5 on a real (in-memory) MongoDB with the demo data: equipment, the resource library,
 * learner projects and assessments, alerts, the termly report and sync, each with allowed and
 * refused cases.
 */
useTestDatabase();

const app = createApp();
const PASSWORD = 'test-password-123';
const EMAIL = {
  admin: 'wanjiru.kamau@demo.steamlabs.test',
  pm: 'otieno.ouma@demo.steamlabs.test',
  coordinator: 'mwende.mutua@demo.steamlabs.test',
  champion: 'faith.njeri@demo.steamlabs.test',
  otherChampion: 'amina.salim@demo.steamlabs.test',
  grace: 'grace.wambui@demo.steamlabs.test', // NAC-002
};
// NAC-001 and NAC-002 are Faith's clubs in Nairobi; WNY-001 is Amina's in Kisumu.
const NAC_001 = uid(201);
const NAC_002 = uid(202);
const NAC_003 = uid(203);
const WNY_001 = uid(204);
const ZAWADI = uid(1001); // NAC-001
const BARAKA = uid(1002); // NAC-001
const IMANI = uid(1003); // NAC-001, photo consent refused
const JABARI = uid(1006); // NAC-001, left the club
const TUMAINI = uid(1004); // NAC-001
const AMANI = uid(1007); // NAC-002
const CURRENT_TERM = uid(2403);
const SHOWCASE = uid(1801); // Nairobi, NAC-001 and NAC-002 invited

const LAPTOP_1 = uid(2601); // lent to NAC-001
const LAPTOP_3 = uid(2603); // lent to NAC-001, reported damaged two days ago
const ROBOTICS_KIT = uid(2604); // lent to NAC-003, overdue
const TABLET = uid(2605); // Nairobi store
const LAPTOP_4 = uid(2606); // Nairobi store, needs repair
const MICROBITS = uid(2607); // lent to CST-001
const RPI_KIT = uid(2608); // lent to WNY-001
const OLD_TABLET = uid(2610); // Coast store, retired
const DRAFT_SLIDES = uid(2805);
const VIDEO = uid(2803);
const LOOPS_QUIZ = uid(3001); // NAC-001, out of 10

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake image data'),
]);
const PDF = Buffer.from('%PDF-1.4 a worksheet');
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('fake slides')]);
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const opId = (n) => `00000000-0000-4000-8000-0000000095${String(n).padStart(2, '0')}`;
const newId = (n) => `00000000-0000-4000-8000-0000000096${String(n).padStart(2, '0')}`;

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
  upload: (url, buffer, type = 'application/octet-stream') =>
    request(app)
      .put(`/api/v1${url}`)
      .set(auth(tokens[role]))
      .set('Content-Type', type)
      .send(buffer),
});
const ids = (res) => res.body.data.map((r) => r.id).sort();

describe('Equipment (US-25 to US-27)', () => {
  it('shows each role the items in its scope', async () => {
    expect((await api('admin').get('/equipment?pageSize=100')).body.total).toBe(10);
    const nairobi = await api('coordinator').get('/equipment?pageSize=100');
    expect(nairobi.body.data.every((i) => i.region === 'nairobi_central')).toBe(true);
    expect(nairobi.body.total).toBe(6);
    expect(ids(await api('champion').get('/equipment'))).toEqual(
      [LAPTOP_1, uid(2602), LAPTOP_3].sort(),
    );
    expect(ids(await api('otherChampion').get('/equipment'))).toEqual([RPI_KIT]);
    expect((await api('champion').get(`/equipment/${TABLET}`)).status).toBe(404);
    const overdue = await api('admin').get('/equipment?overdue=true');
    expect(ids(overdue)).toEqual([ROBOTICS_KIT]);
    expect(overdue.body.data[0].overdue).toBe(true);
    expect(overdue.body.data[0].club.code).toBe('NAC-003');
  });

  it('lets HQ and coordinators add items in their own region only', async () => {
    const body = {
      name: 'Laptop 6',
      type: 'laptop',
      serialNumber: 'HP-NEW-6',
      region: 'nairobi_central',
    };
    const created = await api('coordinator').post('/equipment', body);
    expect(created.status).toBe(201);
    expect(created.body.data.assetTag).toBe('EQ-0011');
    expect(created.body.data.clubId).toBeNull();
    const coast = await api('coordinator').post('/equipment', {
      ...body,
      serialNumber: 'X-2',
      region: 'coast',
    });
    expect(coast.status).toBe(403);
    expect(
      (await api('champion').post('/equipment', { ...body, serialNumber: 'X-3' })).status,
    ).toBe(403);
    const duplicate = await api('admin').post('/equipment', { ...body, region: 'coast' });
    expect(duplicate.status).toBe(409);
    expect((await api('coordinator').patch(`/equipment/${MICROBITS}`, { notes: 'x' })).status).toBe(
      404,
    );
  });

  it('lends an item from the store once, and takes it back with its condition', async () => {
    const lend = { clubId: NAC_002, outDate: day(0), dueDate: day(30) };
    const [a, b] = await Promise.all([
      api('coordinator').post(`/equipment/${TABLET}/loans`, lend),
      api('admin').post(`/equipment/${TABLET}/loans`, lend),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const item = (await api('coordinator').get(`/equipment/${TABLET}`)).body.data;
    expect(item.club.code).toBe('NAC-002');
    expect(item.loans.filter((l) => l.open)).toHaveLength(1);
    // Champions of the club now see it.
    expect(ids(await api('grace').get('/equipment?clubId=' + NAC_002))).toEqual([TABLET]);

    expect(
      (
        await api('admin').post(`/equipment/${OLD_TABLET}/loans`, {
          clubId: uid(207),
          outDate: day(0),
        })
      ).status,
    ).toBe(409);
    const wrongRegion = await api('coordinator').post(`/equipment/${LAPTOP_4}/loans`, {
      clubId: WNY_001,
      outDate: day(0),
    });
    expect(wrongRegion.status).toBe(404);
    const early = await api('coordinator').post(`/equipment/${TABLET}/return`, {
      returnedDate: day(-1),
      condition: 'working',
    });
    expect(early.status).toBe(400);
    const back = await api('coordinator').post(`/equipment/${TABLET}/return`, {
      returnedDate: day(0),
      condition: 'needs_repair',
      note: 'Charger missing',
    });
    expect(back.status).toBe(200);
    expect(back.body.data.clubId).toBeNull();
    expect(back.body.data.condition).toBe('needs_repair');
    expect(
      (
        await api('coordinator').post(`/equipment/${TABLET}/return`, {
          returnedDate: day(0),
          condition: 'working',
        })
      ).status,
    ).toBe(409);
  });

  it('lets champions report their own club’s items, and HQ record repairs', async () => {
    const report = { condition: 'lost', note: 'Not found after the session' };
    const res = await api('champion').post(`/equipment/${LAPTOP_1}/report`, report);
    expect(res.status).toBe(201);
    expect(res.body.data.condition).toBe('lost');
    expect(res.body.data.reports[0].reportedByName).toBe('Faith Njeri');
    expect((await api('champion').post(`/equipment/${MICROBITS}/report`, report)).status).toBe(404);
    expect(
      (await api('champion').patch(`/equipment/${LAPTOP_1}`, { condition: 'working' })).status,
    ).toBe(403);
    expect(
      (
        await api('champion').post(`/equipment/${LAPTOP_1}/loans`, {
          clubId: NAC_001,
          outDate: day(0),
        })
      ).status,
    ).toBe(403);

    const repair = await api('admin').post(`/equipment/${LAPTOP_4}/repairs`, {
      date: day(0),
      problem: 'Keyboard',
      action: 'Replaced the keyboard',
      cost: 2500,
      conditionAfter: 'working',
    });
    expect(repair.status).toBe(201);
    expect(repair.body.data.condition).toBe('working');
    expect(repair.body.data.repairs).toHaveLength(2);
  });
});

describe('Resource library (US-28)', () => {
  it('shows published resources to everyone and drafts to HQ only', async () => {
    const champion = await api('champion').get('/resources');
    expect(champion.body.total).toBe(4);
    expect(champion.body.data.every((r) => r.status === 'published' && !('createdBy' in r))).toBe(
      true,
    );
    expect((await api('champion').get(`/resources/${DRAFT_SLIDES}`)).status).toBe(404);
    expect((await api('admin').get('/resources')).body.total).toBe(5);
    expect(ids(await api('champion').get('/resources?track=unplugged'))).toEqual(
      [VIDEO, uid(2804)].sort(),
    );
    expect((await api('champion').get('/resources?language=sw')).body.total).toBe(1);
    expect(
      (
        await api('coordinator').post('/resources', {
          title: 'Mine',
          type: 'other',
          tracks: ['scratch'],
        })
      ).status,
    ).toBe(403);
  });

  it('stores files up to 20 MB and checks they are what their name says', async () => {
    const empty = await api('pm').post('/resources', {
      title: 'Robot arm build guide',
      type: 'lesson_plan',
      tracks: ['robotics'],
      status: 'published',
    });
    expect(empty.status).toBe(400);
    const created = await api('pm').post('/resources', {
      title: 'Robot arm build guide',
      type: 'slides',
      tracks: ['robotics'],
      ageBands: ['13-14'],
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const wrong = await api('pm').upload(`/resources/${id}/file?filename=guide.pptx`, PDF);
    expect(wrong.status).toBe(400);
    expect((await api('pm').upload(`/resources/${id}/file?filename=virus.exe`, ZIP)).status).toBe(
      400,
    );
    const big = await api('pm').upload(
      `/resources/${id}/file?filename=big.pdf`,
      Buffer.concat([PDF, Buffer.alloc(21 * 1024 * 1024)]),
    );
    expect(big.status).toBe(413);
    const ok = await api('pm').upload(`/resources/${id}/file?filename=Robot arm "v2".pptx`, ZIP);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      hasFile: true,
      size: ZIP.length,
      fileName: 'Robot arm _v2_.pptx',
    });
    expect(ok.body.data.fileType).toContain('presentationml');
    const published = await api('pm').patch(`/resources/${id}`, { status: 'published' });
    expect(published.status).toBe(200);
    const file = await api('champion')
      .get(`/resources/${id}/file`)
      .buffer(true)
      .parse((res, done) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(file.status).toBe(200);
    expect(file.body.equals(ZIP)).toBe(true);
    expect(file.headers['content-disposition']).toContain('Robot arm _v2_.pptx');
    // Videos are links only (D5-2).
    expect((await api('pm').upload(`/resources/${VIDEO}/file?filename=clip.zip`, ZIP)).status).toBe(
      400,
    );
    // Removing the file of a published resource without a link is refused.
    expect((await api('pm').delete(`/resources/${id}/file`)).status).toBe(400);
    expect((await api('pm').delete(`/resources/${id}`)).status).toBe(204);
    expect((await api('champion').get(`/resources/${id}`)).status).toBe(404);
  });
});

describe('Learner projects (US-29)', () => {
  let projectId;

  it('records a project for learners of one club in the user’s scope', async () => {
    const body = {
      clubId: NAC_001,
      learnerIds: [ZAWADI, BARAKA],
      title: 'Snake game',
      track: 'scratch',
      date: day(-1),
      link: 'https://scratch.mit.edu/projects/123',
    };
    const res = await api('champion').post('/progress/projects', body);
    expect(res.status).toBe(201);
    projectId = res.body.data.id;
    expect(res.body.data.learners.map((l) => l.name)).toEqual(['Zawadi Mwangi', 'Baraka Otieno']);
    expect(
      (await api('champion').post('/progress/projects', { ...body, learnerIds: [ZAWADI, AMANI] }))
        .status,
    ).toBe(400);
    expect(
      (await api('champion').post('/progress/projects', { ...body, learnerIds: [JABARI] })).status,
    ).toBe(400);
    expect(
      (await api('champion').post('/progress/projects', { ...body, date: day(2) })).status,
    ).toBe(400);
    expect((await api('otherChampion').post('/progress/projects', body)).status).toBe(404);
    expect((await api('otherChampion').get(`/progress/projects/${projectId}`)).status).toBe(404);
    expect((await api('coordinator').get(`/progress/projects?clubId=${NAC_001}`)).body.total).toBe(
      4,
    );
  });

  it('asks before adding a photo of members without photo consent, and adds it once', async () => {
    const withImani = await api('champion').post('/progress/projects', {
      clubId: NAC_001,
      learnerIds: [IMANI],
      title: 'Robot dance',
      track: 'robotics',
      date: day(0),
    });
    const id = withImani.body.data.id;
    const asked = await api('champion').upload(`/progress/projects/${id}/file`, PNG, 'image/png');
    expect(asked.status).toBe(409);
    expect(asked.body.error.code).toBe('PHOTO_CONSENT_MISSING');
    const url = `/progress/projects/${id}/file?confirmConsent=true&opId=${opId(1)}`;
    expect((await api('champion').upload(url, PNG, 'image/png')).body.data.hasFile).toBe(true);
    expect((await api('champion').upload(url, PNG, 'image/png')).status).toBe(200);
    // A PDF has no photo, so no consent question.
    expect(
      (await api('champion').upload(`/progress/projects/${projectId}/file`, PDF, 'application/pdf'))
        .status,
    ).toBe(200);
    expect((await api('otherChampion').get(`/progress/projects/${id}/file`)).status).toBe(404);
  });
});

describe('Assessments (US-30)', () => {
  it('saves scores learner by learner, never above the maximum', async () => {
    const created = await api('champion').post('/progress/assessments', {
      clubId: NAC_001,
      title: 'Variables quiz',
      track: 'scratch',
      date: day(0),
      maxScore: 10,
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    // One row per active learner, nobody scored yet.
    expect(created.body.data.scores.map((s) => s.learnerId)).not.toContain(JABARI);
    expect(created.body.data.scores.every((s) => s.score === null)).toBe(true);

    const first = await api('champion').put(`/progress/assessments/${id}/scores`, {
      scores: [{ learnerId: ZAWADI, score: 9 }],
    });
    expect(first.status).toBe(200);
    const second = await api('champion').put(`/progress/assessments/${id}/scores`, {
      scores: [{ learnerId: BARAKA, score: 7.5 }],
    });
    const scores = Object.fromEntries(second.body.data.scores.map((s) => [s.learnerId, s.score]));
    expect(scores[ZAWADI]).toBe(9);
    expect(scores[BARAKA]).toBe(7.5);
    expect(second.body.data.averageScore).toBe(83);

    expect(
      (
        await api('champion').put(`/progress/assessments/${id}/scores`, {
          scores: [{ learnerId: ZAWADI, score: 11 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api('champion').put(`/progress/assessments/${id}/scores`, {
          scores: [{ learnerId: AMANI, score: 5 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (await api('champion').patch(`/progress/assessments/${id}`, { maxScore: 8 })).status,
    ).toBe(400);
    expect((await api('otherChampion').get(`/progress/assessments/${id}`)).status).toBe(404);
  });

  it('shows a learner’s and a club’s progress in scope', async () => {
    const res = await api('champion').get(`/progress/learners/${ZAWADI}`);
    expect(res.status).toBe(200);
    const { projects, results, attendance, averageScore } = res.body.data;
    expect(projects.map((p) => p.title)).toEqual(
      expect.arrayContaining(['Maze game', 'Snake game']),
    );
    expect(results.map((r) => r.assessmentId)).toContain(LOOPS_QUIZ);
    expect(averageScore).toBeGreaterThan(0);
    expect(attendance.allTime.total).toBeGreaterThan(0);
    expect((await api('otherChampion').get(`/progress/learners/${ZAWADI}`)).status).toBe(404);

    const club = await api('coordinator').get(`/progress/clubs/${NAC_001}`);
    expect(club.status).toBe(200);
    expect(club.body.data.projectsByTrack.scratch).toBeGreaterThanOrEqual(4);
    expect(club.body.data.assessments.find((a) => a.id === LOOPS_QUIZ).averageScore).toBe(70);
    expect((await api('otherChampion').get(`/progress/clubs/${NAC_001}`)).status).toBe(404);
  });
});

describe('Alerts, dashboard and report', () => {
  it('flags overdue and reported equipment, and hides a dismissed alert for that person only', async () => {
    const alerts = (await api('admin').get('/alerts')).body.data;
    const overdue = alerts.find((a) => a.type === 'equipmentOverdue');
    expect(overdue).toMatchObject({
      clubId: NAC_003,
      value: 1,
      key: `equipmentOverdue:${NAC_003}`,
    });
    expect(alerts.find((a) => a.type === 'equipmentReported' && a.clubId === NAC_001)).toBeTruthy();
    expect((await api('champion').get('/alerts')).body.data.some((a) => a.clubId === NAC_003)).toBe(
      false,
    );

    const dismissed = await api('admin').post('/alerts/dismissals', { key: overdue.key });
    expect(dismissed.status).toBe(201);
    expect((await api('admin').get('/alerts')).body.data.some((a) => a.key === overdue.key)).toBe(
      false,
    );
    expect((await api('pm').get('/alerts')).body.data.some((a) => a.key === overdue.key)).toBe(
      true,
    );
    expect((await api('champion').post('/alerts/dismissals', { key: overdue.key })).status).toBe(
      404,
    );
  });

  it('adds equipment to the dashboard and progress to the termly report, counts only', async () => {
    const hq = (await api('pm').get('/dashboard/hq')).body.data;
    expect(hq.equipment.total).toBeGreaterThan(0);
    expect(hq.equipment.byCondition).toHaveProperty('working');

    const report = (await api('pm').get(`/reports/termly?termId=${CURRENT_TERM}`)).body.data;
    const scratch = report.progress.find((r) => r.track === 'scratch');
    expect(scratch.projects).toBeGreaterThanOrEqual(4);
    expect(scratch.averageScore).toEqual(expect.any(Number));
    expect(report.equipment.byRegion.length).toBeGreaterThan(0);
    // No names or individual scores (D5-6).
    expect(JSON.stringify(report)).not.toMatch(/Zawadi|Baraka|Snake game/);
    const pdf = await api('pm').get(`/reports/termly.pdf?termId=${CURRENT_TERM}`);
    expect(pdf.status).toBe(200);
  });
});

describe('Offline (plan section 7)', () => {
  it('pulls the new records in scope, with the ids a device may keep', async () => {
    const res = await api('champion').get('/sync/pull');
    expect(res.status).toBe(200);
    const { equipmentItems, resources, learnerProjects, assessments, assessmentScores } =
      res.body.data.changes;
    expect(equipmentItems.every((i) => i.clubId === NAC_001)).toBe(true);
    expect(resources.every((r) => r.status === 'published' && !('fileId' in r))).toBe(true);
    expect(resources.map((r) => r.id)).not.toContain(DRAFT_SLIDES);
    expect(learnerProjects.every((p) => p.clubId === NAC_001 && !('fileId' in p))).toBe(true);
    expect(assessments.length).toBeGreaterThanOrEqual(2);
    expect(assessmentScores.every((s) => s.clubId === NAC_001)).toBe(true);
    const { inScope } = res.body.data;
    expect(inScope.events).toContain(SHOWCASE);
    expect(inScope.equipmentItems).toContain(LAPTOP_3);
    expect(inScope.resources).not.toContain(DRAFT_SLIDES);
  });

  it('applies reports, projects and scores made offline once each', async () => {
    const recordedAt = new Date(Date.now() - 3_600_000).toISOString();
    const project = {
      id: newId(1),
      clubId: NAC_001,
      learnerIds: [TUMAINI],
      title: 'Paper robot',
      track: 'unplugged',
      date: day(0),
    };
    const assessment = {
      id: newId(2),
      clubId: NAC_001,
      title: 'Sorting quiz',
      track: 'unplugged',
      date: day(0),
      maxScore: 5,
    };
    const operations = [
      {
        opId: opId(10),
        type: 'equipment.report',
        recordId: uid(2602),
        data: { condition: 'needs_repair', note: 'Fan is loud' },
        recordedAt,
      },
      { opId: opId(11), type: 'project.save', data: project, recordedAt },
      {
        opId: opId(12),
        type: 'project.save',
        data: { ...project, title: 'Paper robot arm' },
        recordedAt,
      },
      { opId: opId(13), type: 'assessment.save', data: assessment, recordedAt },
      {
        opId: opId(14),
        type: 'assessment.scores',
        recordId: newId(2),
        data: { scores: [{ learnerId: TUMAINI, score: 4 }] },
        recordedAt,
      },
    ];
    const res = await api('champion').post('/sync/push', { operations });
    expect(res.body.data.results.map((r) => r.status)).toEqual(Array(5).fill('applied'));
    const again = await api('champion').post('/sync/push', { operations });
    expect(again.body.data.results.map((r) => r.status)).toEqual(Array(5).fill('applied'));
    expect((await api('champion').get(`/progress/projects/${newId(1)}`)).body.data.title).toBe(
      'Paper robot arm',
    );
    expect(
      (await api('champion').get(`/progress/projects?clubId=${NAC_001}`)).body.data.filter(
        (p) => p.id === newId(1),
      ),
    ).toHaveLength(1);
    const saved = (await api('champion').get(`/progress/assessments/${newId(2)}`)).body.data;
    expect(saved.scores.find((s) => s.learnerId === TUMAINI).score).toBe(4);
    const item = (await api('admin').get(`/equipment/${uid(2602)}`)).body.data;
    expect(item.condition).toBe('needs_repair');
    expect(item.reports[0].date).toBe(recordedAt.slice(0, 10));
    // Outside their clubs: refused.
    const refused = await api('otherChampion').post('/sync/push', {
      operations: [
        {
          opId: opId(20),
          type: 'equipment.report',
          recordId: uid(2602),
          data: { condition: 'lost', note: 'Gone' },
          recordedAt,
        },
      ],
    });
    expect(refused.body.data.results[0].status).toBe('rejected');
  });

  it('drops an event from the device when its club is no longer invited (D4-8)', async () => {
    const res = await api('coordinator').put(`/events/${SHOWCASE}/clubs`, { clubIds: [NAC_003] });
    expect(res.status).toBe(200);
    const pulled = await api('champion').get('/sync/pull');
    expect(pulled.body.data.inScope.events).not.toContain(SHOWCASE);
  });
});
