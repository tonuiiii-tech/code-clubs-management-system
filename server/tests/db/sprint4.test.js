import request from 'supertest';
import { uid } from '@code-clubs/shared/demo';
import { clearDatabase, useTestDatabase } from '../support/database.js';
import { seed } from '../../scripts/seed.js';
import { createApp } from '../../src/app.js';
import { OutboundMessage, ReportRun, Term } from '../../src/db/models.js';
import { runTermlyReports } from '../../src/modules/reports/reports.service.js';

/**
 * Sprint 4 on a real (in-memory) MongoDB with the demo data: terms, the HQ dashboard, alerts,
 * the termly report, events and announcements, each with allowed and refused cases.
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
};
// Demo records: NAC-001 and NAC-002 are Faith's clubs in Nairobi; WNY-001 is Amina's in Kisumu.
const NAC_001 = uid(201);
const NAC_002 = uid(202);
const NAC_003 = uid(203); // Brian's club in Nairobi, not invited
const WNY_001 = uid(204);
const ZAWADI = uid(1001); // NAC-001
const BARAKA = uid(1002); // NAC-001
const IMANI = uid(1003); // NAC-001, photo consent refused, no event consent
const NEEMA = uid(1005); // NAC-001
const JABARI = uid(1006); // NAC-001, left the club
const AMANI = uid(1007); // NAC-002
const AKINYI = uid(1010); // WNY-001
const CURRENT_TERM = uid(2403);
const SHOWCASE = uid(1801); // Nairobi, in 5 days, NAC-001 and NAC-002 invited
const HACKATHON = uid(1802); // national, in 30 days
const GAME_JAM = uid(1803); // Kisumu, held 20 days ago

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake image data'),
]);
const PDF = Buffer.from('%PDF-1.4 signed consent form');
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

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

describe('Terms', () => {
  it('lets everyone read terms and only HQ change them', async () => {
    const list = await api('champion').get('/terms');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(3);

    const refused = await api('coordinator').post('/terms', {
      year: 2030,
      number: 1,
      startDate: '2030-01-06',
      endDate: '2030-04-04',
    });
    expect(refused.status).toBe(403);

    const created = await api('pm').post('/terms', {
      year: 2030,
      number: 1,
      startDate: '2030-01-06',
      endDate: '2030-04-04',
    });
    expect(created.status).toBe(201);

    const duplicate = await api('pm').post('/terms', {
      year: 2030,
      number: 1,
      startDate: '2030-05-01',
      endDate: '2030-06-01',
    });
    expect(duplicate.status).toBe(409);

    const overlap = await api('pm').post('/terms', {
      year: 2030,
      number: 2,
      startDate: '2030-04-01',
      endDate: '2030-08-01',
    });
    expect(overlap.status).toBe(409);

    const backwards = await api('admin').patch(`/terms/${created.body.data.id}`, {
      endDate: '2030-01-01',
    });
    expect(backwards.status).toBe(400);
  });
});

describe('HQ dashboard', () => {
  it('shows national trends to HQ for the current term', async () => {
    const res = await api('pm').get('/dashboard/hq');
    expect(res.status).toBe(200);
    const { term, totals, sessionsByRegion, learnersByTrack, upcomingEvents } = res.body.data;
    expect(term.id).toBe(CURRENT_TERM);
    expect(totals.sessionsHeld).toBe(4);
    expect(Object.keys(sessionsByRegion)).toEqual(
      expect.arrayContaining(['nairobi_central', 'western_nyanza']),
    );
    expect(learnersByTrack.scratch.total).toBeGreaterThan(0);
    expect(upcomingEvents.map((e) => e.id)).toEqual([SHOWCASE, HACKATHON]);
  });

  it('limits a coordinator to their regions and refuses champions', async () => {
    const res = await api('coordinator').get('/dashboard/hq');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.sessionsByRegion)).toEqual(['nairobi_central']);
    expect(res.body.data.totals.sessionsHeld).toBe(3);

    expect((await api('champion').get('/dashboard/hq')).status).toBe(403);
    expect((await api('pm').get('/dashboard/hq?termId=not-a-uuid')).status).toBe(400);
    expect((await api('pm').get(`/dashboard/hq?termId=${uid(9999)}`)).status).toBe(404);
  });
});

describe('Alerts', () => {
  it("flags clubs that need attention, in each role's scope", async () => {
    const hq = await api('pm').get('/alerts');
    expect(hq.status).toBe(200);
    const types = (clubId) => hq.body.data.filter((a) => a.clubId === clubId).map((a) => a.type);
    // NAC-002 has learners but no session this term; NAC-001 has learners without consent.
    expect(types(NAC_002)).toContain('noRecentSession');
    expect(types(NAC_001)).toEqual(
      expect.arrayContaining(['missingConsent', 'eventConsentMissing']),
    );

    const champion = await api('otherChampion').get('/alerts');
    expect(champion.body.data.every((a) => a.clubId !== NAC_001)).toBe(true);
    const coordinator = await api('otherCoordinator').get('/alerts');
    expect(coordinator.body.data.every((a) => a.region === 'western_nyanza')).toBe(true);
  });
});

describe('Termly report', () => {
  const NAMES = ['Zawadi', 'Mwangi', 'Imani', 'Akinyi', '+254700000'];

  it('gives counts only, with small groups hidden (D4-3, R4-1)', async () => {
    const res = await api('pm').get(`/reports/termly?termId=${CURRENT_TERM}`);
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body.data);
    for (const name of NAMES) expect(text).not.toContain(name);
    expect(res.body.data.summary.sessionsHeld).toBe(4);
    // Seven girls and five boys are active in the demo, but the age groups are small.
    expect(res.body.data.byAge.some((row) => row.girl === '<5')).toBe(true);
  });

  it('keeps coordinators to their regions and refuses champions', async () => {
    const res = await api('coordinator').get(`/reports/termly?termId=${CURRENT_TERM}`);
    expect(res.body.data.byRegion.map((r) => r.region)).toEqual(['nairobi_central']);
    expect(res.body.data.scope.regions).toEqual(['nairobi_central']);
    const other = await api('otherCoordinator').get(
      `/reports/termly?termId=${CURRENT_TERM}&clubId=${NAC_001}`,
    );
    expect(other.status).toBe(404);
    expect((await api('champion').get(`/reports/termly?termId=${CURRENT_TERM}`)).status).toBe(403);
    expect((await api('pm').get('/reports/termly')).status).toBe(400);
  });

  it('downloads a PDF', async () => {
    const res = await api('pm')
      .get(`/reports/termly.pdf?termId=${CURRENT_TERM}&clubId=${NAC_001}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('nac-001.pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('lets only HQ keep the recipients list', async () => {
    const recipients = [{ name: 'Funder Contact', email: 'reports@funder.steamlabs.test' }];
    expect((await api('coordinator').put('/reports/recipients', { recipients })).status).toBe(403);
    expect(
      (await api('pm').put('/reports/recipients', { recipients: [{ name: 'X', email: 'no' }] }))
        .status,
    ).toBe(400);
    expect((await api('pm').put('/reports/recipients', { recipients })).status).toBe(200);
    expect((await api('admin').get('/reports/recipients')).body.data).toEqual(recipients);
  });

  it('emails each ended term once, even when two servers run at the same time (R4-2)', async () => {
    const ended = await Term.findById(uid(2402)).lean();
    const dayAfter = new Date(`${ended.endDate}T06:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

    const [a, b] = await Promise.all([
      runTermlyReports({ today: dayAfter }),
      runTermlyReports({ today: dayAfter }),
    ]);
    expect([...a, ...b]).toHaveLength(1);
    expect(await runTermlyReports({ today: dayAfter })).toEqual([]);

    const sent = await OutboundMessage.find({ channel: 'email', termId: uid(2402) }).lean();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ provider: 'stub', status: 'recorded' });
    expect(sent[0].to).toBe('reports@funder.steamlabs.test');
    expect(sent[0].attachments.length).toBeGreaterThan(1);
    expect((await ReportRun.findById(`termly:${uid(2402)}`).lean()).state).toBe('sent');

    const outbox = await api('pm').get('/notifications/outbox');
    expect(outbox.body.total).toBeGreaterThanOrEqual(1);
    expect((await api('coordinator').get('/notifications/outbox')).status).toBe(403);
  });
});

describe('Events', () => {
  const newEvent = (extra = {}) => ({
    name: 'Nairobi Robotics Day',
    type: 'competition',
    startDate: day(10),
    endDate: day(10),
    venue: 'Thika Road Hall',
    region: 'nairobi_central',
    capacity: 3,
    clubIds: [NAC_001],
    ...extra,
  });

  it('shows champions only events their clubs are invited to', async () => {
    const mine = await api('champion').get('/events');
    expect(mine.body.data.map((e) => e.id).sort()).toEqual([SHOWCASE, HACKATHON].sort());
    expect((await api('champion').get(`/events/${GAME_JAM}`)).status).toBe(404);
    const coordinator = await api('coordinator').get('/events');
    expect(coordinator.body.data.map((e) => e.id)).not.toContain(GAME_JAM);
    expect(coordinator.body.data.map((e) => e.id)).toContain(HACKATHON);
  });

  it('lets coordinators run events in their own region only', async () => {
    const created = await api('coordinator').post('/events', newEvent());
    expect(created.status).toBe(201);
    expect(created.body.data.clubs.map((c) => c.id)).toEqual([NAC_001]);

    expect((await api('coordinator').post('/events', newEvent({ region: null }))).status).toBe(403);
    expect(
      (await api('coordinator').post('/events', newEvent({ region: 'coast', clubIds: [] }))).status,
    ).toBe(403);
    expect((await api('pm').post('/events', newEvent({ clubIds: [WNY_001] }))).status).toBe(400);
    expect((await api('champion').post('/events', newEvent())).status).toBe(403);
    expect(
      (await api('pm').post('/events', newEvent({ endDate: day(5), startDate: day(6) }))).status,
    ).toBe(400);

    // The national hackathon is HQ's: a coordinator can read it but not change it.
    expect(
      (await api('coordinator').patch(`/events/${HACKATHON}`, { venue: 'Elsewhere' })).status,
    ).toBe(403);
    expect(
      (await api('otherCoordinator').patch(`/events/${SHOWCASE}`, { venue: 'Kisumu Hall' })).status,
    ).toBe(404);
    const invited = await api('pm').put(`/events/${HACKATHON}/clubs`, {
      clubIds: [NAC_001, WNY_001, NAC_003],
    });
    expect(invited.status).toBe(200);
    expect(invited.body.data.clubs).toHaveLength(3);
  });

  it('registers learners with invitation, capacity, closing date and status checks', async () => {
    const { body } = await api('coordinator').post('/events', newEvent());
    const id = body.data.id;
    const champion = api('champion');

    expect(
      (await champion.post(`/events/${id}/participants`, { learnerIds: [AMANI] })).status,
    ).toBe(409); // NAC-002 not invited
    expect(
      (await champion.post(`/events/${id}/participants`, { learnerIds: [JABARI] })).status,
    ).toBe(409); // left
    expect(
      (await champion.post(`/events/${id}/participants`, { learnerIds: [AKINYI] })).status,
    ).toBe(404); // not her learner

    const ok = await champion.post(`/events/${id}/participants`, {
      learnerIds: [ZAWADI, BARAKA, IMANI],
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.map((p) => p.consent)).toEqual(['pending', 'pending', 'pending']);
    const twice = await champion.post(`/events/${id}/participants`, { learnerIds: [ZAWADI] });
    expect(twice.status).toBe(409);
    expect(twice.body.error.details[0].learnerId).toBe(ZAWADI);
    const full = await champion.post(`/events/${id}/participants`, { learnerIds: [NEEMA] });
    expect(full.status).toBe(409);
    expect(full.body.error.message).toMatch(/full/);

    // Withdrawing frees a place.
    await champion.patch(`/events/${id}/participants/${BARAKA}`, { status: 'withdrawn' });
    expect(
      (await champion.post(`/events/${id}/participants`, { learnerIds: [NEEMA] })).status,
    ).toBe(201);

    await api('coordinator').patch(`/events/${id}`, { registrationCloses: day(-1) });
    const closed = await champion.post(`/events/${id}/participants`, { learnerIds: [BARAKA] });
    expect(closed.status).toBe(409);
    expect(closed.body.error.message).toMatch(/closed/);
  });

  it('records event consent with the signed form, apart from club consent (D4-6)', async () => {
    const champion = api('champion');
    const saved = await champion.put(`/events/${SHOWCASE}/consents/${IMANI}`, {
      status: 'given',
      signedOn: day(-1),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.find((p) => p.learnerId === IMANI).consent).toBe('given');
    const form = await champion.upload(
      'put',
      `/events/${SHOWCASE}/consents/${IMANI}/file`,
      PDF,
      'application/pdf',
    );
    expect(form.status).toBe(200);
    expect(form.body.data.find((p) => p.learnerId === IMANI).hasConsentFile).toBe(true);

    expect((await champion.get(`/events/${SHOWCASE}/consents/${IMANI}/file`)).status).toBe(403);
    const download = await api('coordinator').get(`/events/${SHOWCASE}/consents/${IMANI}/file`);
    expect(download.status).toBe(200);
    expect(
      (await api('champion').put(`/events/${SHOWCASE}/consents/${NEEMA}`, { status: 'given' }))
        .status,
    ).toBe(404);
  });

  it('records projects and results; only organisers give awards', async () => {
    const champion = api('champion');
    const project = { title: 'Matatu Route Finder', learnerIds: [ZAWADI, BARAKA] };
    const created = await champion.post(`/events/${SHOWCASE}/projects`, project);
    expect(created.status).toBe(201);
    const row = created.body.data.find((p) => p.title === project.title);
    expect(row.learners.map((l) => l.name)).toEqual(['Zawadi Mwangi', 'Baraka Otieno']);
    expect(row.clubCode).toBe('NAC-001');

    expect(
      (await champion.patch(`/events/${SHOWCASE}/projects/${row.id}`, { award: 'Winner' })).status,
    ).toBe(403);
    expect(
      (await champion.post(`/events/${SHOWCASE}/projects`, { title: 'X1', learnerIds: [NEEMA] }))
        .status,
    ).toBe(400); // not registered
    const award = await api('pm').patch(`/events/${SHOWCASE}/projects/${row.id}`, {
      award: 'Best idea',
      rank: 1,
    });
    expect(award.body.data.find((p) => p.id === row.id)).toMatchObject({
      award: 'Best idea',
      rank: 1,
    });

    // Kisumu's coordinator sees the project at a national event without names of other regions.
    const jam = await api('otherChampion').get(`/events/${GAME_JAM}/projects`);
    expect(jam.body.data[0].learners).toHaveLength(2);
  });

  it('asks before adding a photo with learners lacking consent (R4-5)', async () => {
    const champion = api('champion');
    const refused = await champion.upload('post', `/events/${SHOWCASE}/photos`, PNG, 'image/png');
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('PHOTO_CONSENT_MISSING');
    // Imani refused photo consent for the club, even with event consent.
    expect(refused.body.error.details.map((d) => d.learnerId)).toContain(IMANI);

    const added = await champion.upload(
      'post',
      `/events/${SHOWCASE}/photos?confirmConsent=true`,
      PNG,
      'image/png',
    );
    expect(added.status).toBe(201);
    const photoId = added.body.data.photoIds[0];
    expect((await api('coordinator').get(`/events/${SHOWCASE}/photos/${photoId}`)).status).toBe(
      200,
    );
    expect((await champion.delete(`/events/${SHOWCASE}/photos/${photoId}`)).status).toBe(403);
    expect((await api('coordinator').delete(`/events/${SHOWCASE}/photos/${photoId}`)).status).toBe(
      204,
    );
  });
});
