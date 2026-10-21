import { beforeEach, describe, expect, it } from 'vitest';
import { mockRequest, resetMockDb } from './mockApi.js';
import { DEMO_PASSWORD, uid } from './data.js';

const ADMIN = 'wanjiru.kamau@demo.steamlabs.test';
const COORDINATOR_NAIROBI = 'mwende.mutua@demo.steamlabs.test';
const CHAMPION_FAITH = 'faith.njeri@demo.steamlabs.test'; // leads NAC-001 and NAC-002

async function signIn(email) {
  const res = await mockRequest({
    method: 'POST',
    path: '/auth/login',
    body: { email, password: DEMO_PASSWORD },
  });
  expect(res.status).toBe(200);
  return res.body.data.accessToken;
}

const call = (token, method, path, extra = {}) => mockRequest({ method, path, token, ...extra });

describe('mock API: same contract and rules as the server', () => {
  beforeEach(() => resetMockDb());

  it('rejects a wrong password with the same message as an unknown email', async () => {
    const wrong = await mockRequest({
      method: 'POST',
      path: '/auth/login',
      body: { email: ADMIN, password: 'nope' },
    });
    const unknown = await mockRequest({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'nobody@demo.steamlabs.test', password: 'nope' },
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('requires a token for protected routes', async () => {
    const res = await call(null, 'GET', '/clubs');
    expect(res.status).toBe(401);
  });

  it('never returns passwords', async () => {
    const token = await signIn(ADMIN);
    const res = await call(token, 'GET', '/users');
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const user of res.body.data) expect(user).not.toHaveProperty('password');
  });

  it('lets a champion see only the clubs they run', async () => {
    const token = await signIn(CHAMPION_FAITH);
    const res = await call(token, 'GET', '/clubs');
    expect(res.body.data.map((c) => c.code)).toEqual(['NAC-001', 'NAC-002']);
  });

  it('answers 404, not 403, when a champion opens another club', async () => {
    const token = await signIn(CHAMPION_FAITH);
    const res = await call(token, 'GET', `/clubs/${uid(204)}`); // WNY-001
    expect(res.status).toBe(404);
  });

  it('limits a coordinator to their region', async () => {
    const token = await signIn(COORDINATOR_NAIROBI);
    const clubs = await call(token, 'GET', '/clubs');
    expect(new Set(clubs.body.data.map((c) => c.region))).toEqual(new Set(['nairobi_central']));
    const outside = await call(token, 'POST', '/schools', {
      body: {
        name: 'Kondele Learning Hub',
        type: 'community_centre',
        region: 'western_nyanza',
        county: 'Kisumu',
        subCounty: 'Kisumu Central',
      },
    });
    expect(outside.status).toBe(403);
  });

  it('forbids champions from creating schools', async () => {
    const token = await signIn(CHAMPION_FAITH);
    const res = await call(token, 'POST', '/schools', { body: {} });
    expect(res.status).toBe(403);
  });

  it('validates with the shared schemas and reports each field', async () => {
    const token = await signIn(ADMIN);
    const res = await call(token, 'POST', '/schools', {
      body: { name: 'X', type: 'castle', contactPhone: '0712345678' },
    });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['body.name', 'body.type', 'body.region', 'body.contactPhone']),
    );
  });

  it('blocks duplicate schools in the same sub-county', async () => {
    const token = await signIn(ADMIN);
    const res = await call(token, 'POST', '/schools', {
      body: {
        name: 'mwangaza primary school',
        type: 'primary_school',
        region: 'nairobi_central',
        county: 'Nairobi',
        subCounty: 'Kibra',
      },
    });
    expect(res.status).toBe(409);
  });

  it('gives a new club the next code for its school region', async () => {
    const token = await signIn(ADMIN);
    const res = await call(token, 'POST', '/clubs', {
      body: {
        name: 'Kibra Junior Coders',
        schoolId: uid(101),
        venueType: 'primary_school',
        meetingDay: 'thursday',
        startTime: '15:00',
        endTime: '16:30',
        mainTrack: 'scratch',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'NAC-004', region: 'nairobi_central' });
  });

  it('assigns only active club champions and keeps history when an assignment ends', async () => {
    const token = await signIn(ADMIN);
    const club = uid(209);
    const notChampion = await call(token, 'PUT', `/clubs/${club}/champions/${uid(2)}`, {
      body: { role: 'lead' },
    });
    expect(notChampion.status).toBe(400);

    const assigned = await call(token, 'PUT', `/clubs/${club}/champions/${uid(16)}`, {
      body: { role: 'lead' },
    });
    expect(assigned.status).toBe(200);
    expect((await call(token, 'GET', `/clubs/${club}/champions`)).body.data).toHaveLength(1);

    await call(token, 'DELETE', `/clubs/${club}/champions/${uid(16)}`);
    expect((await call(token, 'GET', `/clubs/${club}/champions`)).body.data).toHaveLength(0);
  });

  it('counts the dashboard inside each role scope', async () => {
    const admin = await call(await signIn(ADMIN), 'GET', '/dashboard/summary');
    const champion = await call(await signIn(CHAMPION_FAITH), 'GET', '/dashboard/summary');
    expect(admin.body.data.activeClubs).toBe(10);
    expect(champion.body.data).toMatchObject({ activeClubs: 2, schools: 2 });
  });

  it('stops admins from changing their own role or deactivating themselves', async () => {
    const token = await signIn(ADMIN);
    const role = await call(token, 'PATCH', `/users/${uid(1)}`, { body: { role: 'champion' } });
    const status = await call(token, 'PATCH', `/users/${uid(1)}/status`, {
      body: { status: 'inactive' },
    });
    expect(role.status).toBe(403);
    expect(status.status).toBe(403);
  });

  it('ends existing sessions when a user is deactivated (R1-4)', async () => {
    const championToken = await signIn(CHAMPION_FAITH);
    const adminToken = await signIn(ADMIN);
    await call(adminToken, 'PATCH', `/users/${uid(11)}/status`, { body: { status: 'inactive' } });
    expect((await call(championToken, 'GET', '/clubs')).status).toBe(401);
  });

  it('ends the session after a password change', async () => {
    const token = await signIn(CHAMPION_FAITH);
    const res = await call(token, 'POST', '/auth/change-password', {
      body: { currentPassword: DEMO_PASSWORD, newPassword: 'a-new-password-1' },
    });
    expect(res.status).toBe(204);
    expect((await call(token, 'GET', '/auth/me')).status).toBe(401);
  });
});
