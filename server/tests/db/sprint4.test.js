import request from 'supertest';
import { uid } from '@code-clubs/shared/demo';
import { clearDatabase, useTestDatabase } from '../support/database.js';
import { seed } from '../../scripts/seed.js';
import { createApp } from '../../src/app.js';

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
const WNY_001 = uid(204);
const ZAWADI = uid(1001); // NAC-001
const IMANI = uid(1003); // NAC-001, registered for the showcase without event consent
const NEEMA = uid(1005); // NAC-001
const JABARI = uid(1006); // NAC-001, left the club
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
