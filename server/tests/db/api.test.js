import request from 'supertest';
import { uid } from '@code-clubs/shared/demo';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { clearDatabase, useTestDatabase } from '../support/database.js';
import { seed } from '../../scripts/seed.js';
import { createApp } from '../../src/app.js';
import * as authService from '../../src/modules/auth/auth.service.js';

/**
 * The real API on a real (in-memory) MongoDB with the demo data. Mirrors the rules the
 * demo mock API is tested for (client/src/services/mock/mockApi.test.js), so both agree (R1-19).
 */
useTestDatabase();

const app = createApp();
const PASSWORD = 'test-password-123';
const EMAIL = {
  admin: 'wanjiru.kamau@demo.steamlabs.test',
  pm: 'otieno.ouma@demo.steamlabs.test',
  coordinator: 'mwende.mutua@demo.steamlabs.test',
  champion: 'faith.njeri@demo.steamlabs.test',
  champion2: 'kevin.omondi@demo.steamlabs.test',
};

/** Each sign-in uses a different email, so the login rate limit (5 per email) is not hit. */
async function signIn(email) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { token: res.body.data.accessToken, cookie: res.headers['set-cookie'] };
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await clearDatabase();
  await seed({ password: PASSWORD });
});

describe('API on MongoDB', () => {
  let admin;
  let coordinator;
  let champion;
  beforeAll(async () => {
    admin = await signIn(EMAIL.admin);
    coordinator = await signIn(EMAIL.coordinator);
    champion = await signIn(EMAIL.champion);
  });

  it('signs in and never returns password hashes', async () => {
    const res = await request(app).get('/api/v1/users').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(14);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion/);
  });

  it('lets a champion see only their clubs, and 404s other clubs', async () => {
    const list = await request(app).get('/api/v1/clubs').set(auth(champion.token));
    expect(list.body.data.map((c) => c.code)).toEqual(['NAC-001']);
    const other = await request(app)
      .get(`/api/v1/clubs/${uid(204)}`)
      .set(auth(champion.token));
    expect(other.status).toBe(404);
  });

  it('keeps a coordinator in their region', async () => {
    const list = await request(app).get('/api/v1/clubs').set(auth(coordinator.token));
    expect(new Set(list.body.data.map((c) => c.region))).toEqual(new Set(['nairobi_central']));
    const outside = await request(app).post('/api/v1/schools').set(auth(coordinator.token)).send({
      name: 'Kondele Learning Hub',
      type: 'community_centre',
      region: 'western_nyanza',
      county: 'Kisumu',
      subCounty: 'Kisumu Central',
    });
    expect(outside.status).toBe(403);
  });

  it('stops a coordinator moving a school out of their region', async () => {
    const res = await request(app)
      .patch(`/api/v1/schools/${uid(101)}`)
      .set(auth(coordinator.token))
      .send({ region: 'coast' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('You can only move schools within your own region');
  });

  it('creates a school, blocks its duplicate, then creates a club with the next code', async () => {
    const body = {
      name: 'Gatina Primary School',
      type: 'primary_school',
      region: 'nairobi_central',
      county: 'Nairobi',
      subCounty: 'Dagoretti North',
      contactPhone: '+254700000999',
    };
    const school = await request(app)
      .post('/api/v1/schools')
      .set(auth(coordinator.token))
      .send(body);
    expect(school.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/schools')
      .set(auth(admin.token))
      .send({ ...body, name: 'gatina primary school' });
    expect(dup.status).toBe(409);

    const newClub = {
      name: 'Gatina Code Club',
      schoolId: school.body.data.id,
      venueType: 'primary_school',
      meetingDay: 'wednesday',
      startTime: '16:00',
      endTime: '17:00',
      mainTrack: 'scratch',
    };
    const club = await request(app)
      .post('/api/v1/clubs')
      .set(auth(coordinator.token))
      .send(newClub);
    expect(club.status).toBe(201);
    expect(club.body.data).toMatchObject({ code: 'NAC-004', region: 'nairobi_central' });

    const badTime = await request(app)
      .patch(`/api/v1/clubs/${club.body.data.id}`)
      .set(auth(coordinator.token))
      .send({ endTime: '15:00' });
    expect(badTime.status).toBe(400);

    // One Code Club per school (D5-11): a second one is refused, unless the first has closed.
    const second = { ...newClub, name: 'Gatina Robotics', schoolId: school.body.data.id };
    const refused = await request(app)
      .post('/api/v1/clubs')
      .set(auth(coordinator.token))
      .send(second);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe(ERROR_MESSAGES.schoolHasClub);
    const free = await request(app).get('/api/v1/schools?withoutClub=true').set(auth(admin.token));
    expect(free.body.data.map((s) => s.id)).not.toContain(school.body.data.id);
    await request(app)
      .patch(`/api/v1/clubs/${club.body.data.id}`)
      .set(auth(coordinator.token))
      .send({ status: 'closed' });
    const replacement = await request(app)
      .post('/api/v1/clubs')
      .set(auth(coordinator.token))
      .send(second);
    expect(replacement.status).toBe(201);
    // Reopening the closed club would make two.
    const reopen = await request(app)
      .patch(`/api/v1/clubs/${club.body.data.id}`)
      .set(auth(coordinator.token))
      .send({ status: 'active' });
    expect(reopen.status).toBe(409);
  });

  it('assigns and ends a champion assignment, and records it in the audit log', async () => {
    const club = uid(209);
    // Joseph Mutiso runs CST-001: a champion has one club, so he must leave it first (D5-9).
    const busy = await request(app)
      .put(`/api/v1/clubs/${club}/champions/${uid(16)}`)
      .set(auth(admin.token))
      .send({ role: 'lead' });
    expect(busy.status).toBe(409);
    expect(busy.body.error.message).toBe(ERROR_MESSAGES.championHasClub);
    await request(app)
      .delete(`/api/v1/clubs/${uid(207)}/champions/${uid(16)}`)
      .set(auth(admin.token));

    const put = await request(app)
      .put(`/api/v1/clubs/${club}/champions/${uid(16)}`)
      .set(auth(admin.token))
      .send({ role: 'lead' });
    expect(put.status).toBe(200);
    let list = await request(app).get(`/api/v1/clubs/${club}/champions`).set(auth(admin.token));
    expect(list.body.data).toEqual([
      expect.objectContaining({ fullName: 'Joseph Mutiso', role: 'lead' }),
    ]);

    const del = await request(app)
      .delete(`/api/v1/clubs/${club}/champions/${uid(16)}`)
      .set(auth(admin.token));
    expect(del.status).toBe(204);
    list = await request(app).get(`/api/v1/clubs/${club}/champions`).set(auth(admin.token));
    expect(list.body.data).toEqual([]);

    const log = await request(app).get('/api/v1/audit').set(auth(admin.token));
    expect(log.body.data.map((e) => e.action)).toEqual(
      expect.arrayContaining(['club.assignChampion', 'club.unassignChampion']),
    );
    // Back to CST-001 for the tests that follow.
    await request(app)
      .put(`/api/v1/clubs/${uid(207)}/champions/${uid(16)}`)
      .set(auth(admin.token))
      .send({ role: 'lead' });
  });

  it('lists the champions who have no club yet, the only ones who can be assigned (D5-9)', async () => {
    const res = await request(app)
      .get('/api/v1/users?role=champion&status=active&withoutClub=true')
      .set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u.fullName)).toEqual(['Peter Kariuki']);
  });

  it('returns dashboard counts within scope', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary').set(auth(champion.token));
    expect(res.body.data).toMatchObject({ activeClubs: 1, schools: 1 });
  });

  it('creates a user with a temporary password that works once', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set(auth(admin.token))
      .send({
        fullName: 'Zawadi Chepngetich',
        email: 'zawadi.chepngetich@demo.steamlabs.test',
        role: 'champion',
        championProfile: { type: 'volunteer' },
      });
    expect(res.status).toBe(201);
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'zawadi.chepngetich@demo.steamlabs.test',
      password: res.body.temporaryPassword,
    });
    expect(login.status).toBe(200);
  });
});

describe('Accounts a Programme Manager manages (D5-12)', () => {
  let pm;
  beforeAll(async () => {
    pm = await signIn('otieno.ouma@demo.steamlabs.test');
  });

  it('creates and deactivates a coordinator account', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set(auth(pm.token))
      .send({
        fullName: 'Baraka Kiprono',
        email: 'baraka.kiprono@demo.steamlabs.test',
        role: 'coordinator',
        regions: ['rift_valley'],
      });
    expect(res.status).toBe(201);
    const off = await request(app)
      .patch(`/api/v1/users/${res.body.data.id}/status`)
      .set(auth(pm.token))
      .send({ status: 'inactive' });
    expect(off.status).toBe(200);
  });

  it('cannot create, promote to or change administrator and manager accounts', async () => {
    const admin = await request(app).post('/api/v1/users').set(auth(pm.token)).send({
      fullName: 'Imani Wekesa',
      email: 'imani.wekesa@demo.steamlabs.test',
      role: 'system_admin',
    });
    expect(admin.status).toBe(403);
    expect(admin.body.error.message).toBe(ERROR_MESSAGES.roleNotManageable);
    // Mwende Mutua (coordinator) cannot be made a Programme Manager by a Programme Manager.
    const promote = await request(app)
      .patch(`/api/v1/users/${uid(3)}`)
      .set(auth(pm.token))
      .send({ role: 'programme_manager' });
    expect(promote.status).toBe(403);
    // Wanjiru Kamau (System Administrator) cannot be deactivated by one.
    const lockout = await request(app)
      .patch(`/api/v1/users/${uid(1)}/status`)
      .set(auth(pm.token))
      .send({ status: 'inactive' });
    expect(lockout.status).toBe(403);
  });
});

describe('Sessions on MongoDB', () => {
  it('rotates refresh tokens and revokes the family when an old one is reused', async () => {
    const { cookie } = await signIn(EMAIL.pm);
    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    const reused = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(reused.status).toBe(401);
    const afterReuse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', first.headers['set-cookie']);
    expect(afterReuse.status).toBe(401);
  });

  it('ends existing sessions when a user is deactivated (R1-4)', async () => {
    const admin = await signIn('wanjiru.kamau@demo.steamlabs.test');
    const victim = await signIn(EMAIL.champion2);
    await request(app)
      .patch(`/api/v1/users/${uid(14)}/status`)
      .set(auth(admin.token))
      .send({ status: 'inactive' })
      .expect(200);
    const res = await request(app).get('/api/v1/clubs').set(auth(victim.token));
    expect(res.status).toBe(401);
  });

  it('counts only failed sign-ins towards the rate limit', async () => {
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: EMAIL.pm, password: PASSWORD });
      expect(res.status).toBe(200);
    }
  });

  it('locks an account after five wrong passwords', async () => {
    const email = 'achieng.odhiambo@demo.steamlabs.test';
    for (let i = 0; i < 5; i += 1) {
      await expect(authService.login({ email, password: 'wrong' }, {})).rejects.toMatchObject({
        status: 401,
      });
    }
    await expect(authService.login({ email, password: PASSWORD }, {})).rejects.toMatchObject({
      status: 401,
    });
  });
});
