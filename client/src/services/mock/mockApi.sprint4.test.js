import { beforeEach, describe, expect, it } from 'vitest';
import { mockRequest, resetMockDb } from './mockApi.js';
import { DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';

/**
 * Sprint 4 rules in demo mode. The same cases run against the real server in
 * server/tests/db/sprint4.test.js, so both agree (R1-19).
 */
const EMAIL = {
  pm: 'otieno.ouma@demo.steamlabs.test',
  coordinator: 'mwende.mutua@demo.steamlabs.test',
  otherCoordinator: 'achieng.odhiambo@demo.steamlabs.test',
  champion: 'faith.njeri@demo.steamlabs.test',
  otherChampion: 'amina.salim@demo.steamlabs.test',
};
const NAC_001 = uid(201);
const NAC_002 = uid(202);
const WNY_001 = uid(204);
const ZAWADI = uid(1001);
const IMANI = uid(1003);
const TUMAINI = uid(1004);
const NEEMA = uid(1005);
const CURRENT_TERM = uid(2403);
const SHOWCASE = uid(1801);
const HACKATHON = uid(1802);
const GAME_JAM = uid(1803);
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

describe('mock API: dashboard, reports, events, announcements (Sprint 4)', () => {
  beforeEach(() => resetMockDb());

  it('gives the same HQ dashboard and alerts as the server', async () => {
    const pm = await as('pm');
    const hq = await pm('GET', '/dashboard/hq');
    expect(hq.body.data.term.id).toBe(CURRENT_TERM);
    expect(hq.body.data.totals.sessionsHeld).toBe(4);
    expect(hq.body.data.upcomingEvents.map((e) => e.id)).toEqual([SHOWCASE, HACKATHON]);
    const coordinator = await as('coordinator');
    const mine = await coordinator('GET', '/dashboard/hq');
    expect(Object.keys(mine.body.data.sessionsByRegion)).toEqual(['nairobi_central']);
    expect((await (await as('champion'))('GET', '/dashboard/hq')).status).toBe(403);

    const alerts = (await pm('GET', '/alerts')).body.data;
    const types = (clubId) => alerts.filter((a) => a.clubId === clubId).map((a) => a.type);
    expect(types(NAC_002)).toContain('noRecentSession');
    expect(types(NAC_001)).toEqual(
      expect.arrayContaining(['missingConsent', 'eventConsentMissing']),
    );
  });

  it('keeps the termly report to counts', async () => {
    const pm = await as('pm');
    const res = await pm('GET', '/reports/termly', { query: { termId: CURRENT_TERM } });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data)).not.toContain('Zawadi');
    expect((await pm('GET', '/reports/termly')).status).toBe(400);
    expect(
      (await (await as('champion'))('GET', '/reports/termly', { query: { termId: CURRENT_TERM } }))
        .status,
    ).toBe(403);
  });

  it('applies the event rules: scope, invitation and photo consent', async () => {
    const champion = await as('champion');
    const list = await champion('GET', '/events');
    expect(list.body.data.map((e) => e.id).sort()).toEqual([SHOWCASE, HACKATHON].sort());
    expect((await champion('GET', `/events/${GAME_JAM}`)).status).toBe(404);
    expect(
      (
        await champion('POST', `/events/${SHOWCASE}/participants`, {
          body: { learnerIds: [ZAWADI] },
        })
      ).status,
    ).toBe(409);
    const ok = await champion('POST', `/events/${SHOWCASE}/participants`, {
      body: { learnerIds: [NEEMA, TUMAINI] },
    });
    expect(ok.status).toBe(201);
    const photo = await champion('POST', `/events/${SHOWCASE}/photos`, { body: PNG });
    expect(photo.body.error.code).toBe('PHOTO_CONSENT_MISSING');
    expect(photo.body.error.details.map((d) => d.learnerId)).toContain(IMANI);
    const coordinator = await as('coordinator');
    expect(
      (await coordinator('PATCH', `/events/${HACKATHON}`, { body: { venue: 'Elsewhere' } })).status,
    ).toBe(403);
  });

  it('sends announcements to the chosen audience and counts reads', async () => {
    const pm = await as('pm');
    const sent = await pm('POST', '/announcements', {
      body: {
        title: 'Laptops arriving',
        body: 'New laptops next week.',
        audience: { roles: [], regions: [], clubIds: [WNY_001] },
        channels: ['sms'],
      },
    });
    expect(sent.body.data).toMatchObject({ recipientCount: 1, messages: 1 });
    const other = await as('otherChampion');
    const inbox = await other('GET', '/announcements');
    expect(inbox.body.unread).toBe(2);
    await other('POST', `/announcements/${sent.body.data.id}/read`);
    expect((await pm('GET', `/announcements/${sent.body.data.id}`)).body.data.readCount).toBe(1);
    expect(
      (await (await as('champion'))('GET', `/announcements/${sent.body.data.id}`)).status,
    ).toBe(404);
    const outbox = await pm('GET', '/notifications/outbox');
    expect(outbox.body.data[0]).toMatchObject({ channel: 'sms', provider: 'stub' });
  });
});
