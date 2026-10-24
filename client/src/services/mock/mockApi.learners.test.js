import { beforeEach, describe, expect, it } from 'vitest';
import { mockRequest, resetMockDb } from './mockApi.js';
import { DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';

/**
 * Sprint 2 rules in demo mode. The same cases run against the real server in
 * server/tests/db/learners-sessions.test.js, so both agree (R1-19).
 */
const EMAIL = {
  pm: 'otieno.ouma@demo.steamlabs.test',
  coordinator: 'mwende.mutua@demo.steamlabs.test',
  champion: 'faith.njeri@demo.steamlabs.test',
  otherChampion: 'amina.salim@demo.steamlabs.test',
};
const NAC_001 = uid(201);
const ZAWADI = uid(1001);
const AKINYI = uid(1010);
const OLD_SESSION = uid(1601);
const RECENT_SESSION = uid(1603);
const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])], {
  type: 'image/png',
});

async function as(role) {
  const res = await mockRequest({
    method: 'POST',
    path: '/auth/login',
    body: { email: EMAIL[role], password: DEMO_PASSWORD },
  });
  const token = res.body.data.accessToken;
  return (method, path, extra = {}) => mockRequest({ method, path, token, ...extra });
}

const learner = (extra = {}) => ({
  clubId: NAC_001,
  firstName: 'Wanjiku',
  lastName: 'Test',
  age: 11,
  gender: 'girl',
  grade: 'grade_6',
  admissionNumber: 'ADM-9001',
  ...extra,
});

describe('mock API: learners, consent, sessions (Sprint 2)', () => {
  beforeEach(() => resetMockDb());

  it('keeps learners to the champion’s clubs and the coordinator’s region', async () => {
    const champion = await as('champion');
    expect((await champion('GET', `/learners/${AKINYI}`)).status).toBe(404);
    const coordinator = await as('coordinator');
    const list = await coordinator('GET', '/learners', { query: { pageSize: 100 } });
    expect(new Set(list.body.data.map((l) => l.region))).toEqual(new Set(['nairobi_central']));
  });

  it('registers a learner whose guardian contact only HQ can read', async () => {
    const champion = await as('champion');
    const res = await champion('POST', '/learners', {
      body: learner({
        contact: { guardianName: 'Lucy Test', relationship: 'mother', phone: '+254700000901' },
      }),
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ learnerNumber: 'NAC-001-007', hasContact: true });
    expect(JSON.stringify(res.body)).not.toMatch(/Lucy/);
    const id = res.body.data.id;
    expect((await champion('GET', `/learners/${id}/contact`)).status).toBe(403);
    expect((await (await as('coordinator'))('GET', `/learners/${id}/contact`)).status).toBe(403);
    const pm = await (await as('pm'))('GET', `/learners/${id}/contact`);
    expect(pm.body.data.guardianName).toBe('Lucy Test');
  });

  it('warns about a possible duplicate and needs admission numbers at schools', async () => {
    const champion = await as('champion');
    const dup = await champion('POST', '/learners', {
      body: learner({ firstName: 'zawadi', lastName: 'mwangi', admissionNumber: 'ADM-1' }),
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('POSSIBLE_DUPLICATE');
    const missing = await champion('POST', '/learners', {
      body: learner({ admissionNumber: undefined }),
    });
    expect(missing.status).toBe(400);
  });

  it('checks consent files by content and lets only HQ and coordinators open them', async () => {
    const champion = await as('champion');
    const url = `/learners/${ZAWADI}/consents/participation/file`;
    const text = await champion('PUT', url, { body: new Blob(['hello'], { type: 'image/png' }) });
    expect(text.status).toBe(400);
    expect((await champion('PUT', url, { body: PNG })).status).toBe(200);
    expect((await champion('GET', url)).status).toBe(403);
    const file = await (await as('coordinator'))('GET', url);
    expect(file.status).toBe(200);
    expect(file.body.type).toBe('image/png');
  });

  it('takes attendance from the club’s learners only', async () => {
    const champion = await as('champion');
    const wrong = await champion('PUT', `/sessions/${RECENT_SESSION}/attendance`, {
      body: { records: [{ learnerId: AKINYI, status: 'present' }] },
    });
    expect(wrong.status).toBe(400);
    const ok = await champion('PUT', `/sessions/${RECENT_SESSION}/attendance`, {
      body: { records: [{ learnerId: ZAWADI, status: 'late' }] },
    });
    expect(ok.body.data.attendance).toEqual([
      expect.objectContaining({ learnerId: ZAWADI, status: 'late', firstName: 'Zawadi' }),
    ]);
  });

  it('locks reports for champions after 7 days, not for coordinators (D2-5)', async () => {
    const champion = await as('champion');
    const locked = await champion('PATCH', `/sessions/${OLD_SESSION}`, { body: { notes: 'x' } });
    expect(locked.status).toBe(403);
    const coordinator = await as('coordinator');
    const ok = await coordinator('PATCH', `/sessions/${OLD_SESSION}`, { body: { notes: 'x' } });
    expect(ok.status).toBe(200);
  });

  it('asks to confirm photos when a learner present has no photo consent (D2-7)', async () => {
    const champion = await as('champion');
    const url = `/sessions/${RECENT_SESSION}/photos`;
    const first = await champion('POST', url, { body: PNG, query: { confirmConsent: 'false' } });
    expect(first.status).toBe(409);
    expect(first.body.error.details.map((d) => d.name)).toContain('Imani Wekesa');
    const confirmed = await champion('POST', url, { body: PNG, query: { confirmConsent: 'true' } });
    expect(confirmed.status).toBe(201);
    const photoId = confirmed.body.data.photoIds[0];
    expect((await (await as('otherChampion'))('GET', `${url}/${photoId}`)).status).toBe(404);
  });

  it('adds learner and attendance counts to the dashboard', async () => {
    const res = await (await as('otherChampion'))('GET', '/dashboard/summary');
    expect(res.body.data).toMatchObject({ learners: 2, learnersMissingConsent: 1 });
  });
});
