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
const CURRENT_TERM = uid(2403);
const SHOWCASE = uid(1801); // Nairobi, in 5 days, NAC-001 and NAC-002 invited
const HACKATHON = uid(1802); // national, in 30 days

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
