import { beforeEach, describe, expect, it } from 'vitest';
import { mockRequest, resetMockDb } from './mockApi.js';
import { DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';

/**
 * Sprint 5 rules in demo mode. The same cases run against the real server in
 * server/tests/db/sprint5.test.js, so both agree (R1-19).
 */
const EMAIL = {
  admin: 'wanjiru.kamau@demo.steamlabs.test',
  pm: 'otieno.ouma@demo.steamlabs.test',
  coordinator: 'mwende.mutua@demo.steamlabs.test',
  champion: 'faith.njeri@demo.steamlabs.test',
  otherChampion: 'amina.salim@demo.steamlabs.test',
};
const NAC_001 = uid(201);
const NAC_002 = uid(202);
const NAC_003 = uid(203);
const WNY_001 = uid(204);
const ZAWADI = uid(1001);
const BARAKA = uid(1002);
const IMANI = uid(1003);
const TUMAINI = uid(1004);
const AMANI = uid(1007);
const CURRENT_TERM = uid(2403);
const LAPTOP_1 = uid(2601);
const LAPTOP_3 = uid(2603);
const ROBOTICS_KIT = uid(2604);
const TABLET = uid(2605);
const RPI_KIT = uid(2608);
const WORKSHEET = uid(2804);
const DRAFT_SLIDES = uid(2805);
const VIDEO = uid(2803);
const LOOPS_QUIZ = uid(3001);
const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])], {
  type: 'image/png',
});
const ZIP = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])]);
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const opId = (n) => `00000000-0000-4000-8000-0000000095${String(n).padStart(2, '0')}`;
const newId = (n) => `00000000-0000-4000-8000-0000000096${String(n).padStart(2, '0')}`;

async function as(role) {
  const res = await mockRequest({
    method: 'POST',
    path: '/auth/login',
    body: { email: EMAIL[role], password: DEMO_PASSWORD },
  });
  const token = res.body.data.accessToken;
  return (method, path, extra = {}) => mockRequest({ method, path, token, ...extra });
}
const ids = (res) => res.body.data.map((r) => r.id).sort();

describe('mock API: equipment, resources and progress (Sprint 5)', () => {
  beforeEach(() => resetMockDb());

  it('shows equipment in scope and lends an item once', async () => {
    const admin = await as('admin');
    const coordinator = await as('coordinator');
    const champion = await as('champion');
    expect((await admin('GET', '/equipment', { query: { pageSize: 100 } })).body.total).toBe(10);
    expect((await coordinator('GET', '/equipment', { query: { pageSize: 100 } })).body.total).toBe(
      6,
    );
    expect(ids(await champion('GET', '/equipment'))).toEqual(
      [LAPTOP_1, uid(2602), LAPTOP_3].sort(),
    );
    expect(ids(await (await as('otherChampion'))('GET', '/equipment'))).toEqual([RPI_KIT]);
    const overdue = await admin('GET', '/equipment', { query: { overdue: 'true' } });
    expect(ids(overdue)).toEqual([ROBOTICS_KIT]);

    const lend = { clubId: NAC_002, outDate: day(0), dueDate: day(30) };
    expect((await coordinator('POST', `/equipment/${TABLET}/loans`, { body: lend })).status).toBe(
      201,
    );
    expect((await admin('POST', `/equipment/${TABLET}/loans`, { body: lend })).status).toBe(409);
    expect((await coordinator('POST', `/equipment/${LAPTOP_1}/loans`, { body: lend })).status).toBe(
      409,
    );
    expect((await champion('POST', `/equipment/${TABLET}/loans`, { body: lend })).status).toBe(403);
    const back = await coordinator('POST', `/equipment/${TABLET}/return`, {
      body: { returnedDate: day(0), condition: 'needs_repair' },
    });
    expect(back.body.data).toMatchObject({ clubId: null, condition: 'needs_repair' });
    const report = await champion('POST', `/equipment/${LAPTOP_1}/report`, {
      body: { condition: 'lost', note: 'Not found after the session' },
    });
    expect(report.status).toBe(201);
    expect(report.body.data.reports[0].reportedByName).toBe('Faith Njeri');
    expect(
      (
        await champion('POST', `/equipment/${RPI_KIT}/report`, {
          body: { condition: 'lost', note: 'Gone' },
        })
      ).status,
    ).toBe(404);
  });

  it('keeps drafts for HQ, checks files and gives demo files to open', async () => {
    const champion = await as('champion');
    const pm = await as('pm');
    expect((await champion('GET', '/resources')).body.total).toBe(4);
    expect((await champion('GET', `/resources/${DRAFT_SLIDES}`)).status).toBe(404);
    const file = await champion('GET', `/resources/${WORKSHEET}/file`);
    expect(file.status).toBe(200);
    expect(file.body.type).toBe('application/pdf');
    expect(
      (await pm('PUT', `/resources/${VIDEO}/file`, { query: { filename: 'a.zip' }, body: ZIP }))
        .status,
    ).toBe(400);
    expect(
      (
        await pm('PUT', `/resources/${DRAFT_SLIDES}/file`, {
          query: { filename: 'slides.pdf' },
          body: ZIP,
        })
      ).status,
    ).toBe(400);
    const ok = await pm('PUT', `/resources/${DRAFT_SLIDES}/file`, {
      query: { filename: 'Game design.pptx' },
      body: ZIP,
    });
    expect(ok.body.data).toMatchObject({ hasFile: true, fileName: 'Game design.pptx' });
    expect(
      (await pm('PATCH', `/resources/${DRAFT_SLIDES}`, { body: { status: 'published' } })).status,
    ).toBe(200);
    expect((await champion('GET', '/resources')).body.total).toBe(5);
  });

  it('records projects and scores in scope, and asks about photo consent', async () => {
    const champion = await as('champion');
    const project = await champion('POST', '/progress/projects', {
      body: {
        clubId: NAC_001,
        learnerIds: [IMANI],
        title: 'Robot dance',
        track: 'robotics',
        date: day(0),
      },
    });
    expect(project.status).toBe(201);
    const id = project.body.data.id;
    const asked = await champion('PUT', `/progress/projects/${id}/file`, { body: PNG });
    expect(asked.body.error.code).toBe('PHOTO_CONSENT_MISSING');
    const added = await champion('PUT', `/progress/projects/${id}/file`, {
      body: PNG,
      query: { confirmConsent: 'true' },
    });
    expect(added.body.data.hasFile).toBe(true);
    expect(
      (
        await champion('POST', '/progress/projects', {
          body: {
            clubId: NAC_001,
            learnerIds: [ZAWADI, AMANI],
            title: 'Mixed',
            track: 'scratch',
            date: day(0),
          },
        })
      ).status,
    ).toBe(400);

    const scores = await champion('PUT', `/progress/assessments/${LOOPS_QUIZ}/scores`, {
      body: { scores: [{ learnerId: BARAKA, score: 10 }] },
    });
    expect(scores.body.data.scores.find((s) => s.learnerId === BARAKA).score).toBe(10);
    expect(
      (
        await champion('PUT', `/progress/assessments/${LOOPS_QUIZ}/scores`, {
          body: { scores: [{ learnerId: BARAKA, score: 11 }] },
        })
      ).status,
    ).toBe(400);
    const otherChampion = await as('otherChampion');
    expect((await otherChampion('GET', `/progress/assessments/${LOOPS_QUIZ}`)).status).toBe(404);
    const progress = await champion('GET', `/progress/learners/${ZAWADI}`);
    expect(progress.body.data.results.map((r) => r.assessmentId)).toContain(LOOPS_QUIZ);
    const club = await champion('GET', `/progress/clubs/${NAC_001}`);
    expect(club.body.data.projectsByTrack.scratch).toBe(3);
    expect((await otherChampion('GET', `/progress/clubs/${NAC_001}`)).status).toBe(404);
    expect(WNY_001).toBeTruthy();
  });

  it('adds equipment alerts, dismisses one per person, and reports counts only', async () => {
    const admin = await as('admin');
    const pm = await as('pm');
    const alerts = (await admin('GET', '/alerts')).body.data;
    const overdue = alerts.find((a) => a.type === 'equipmentOverdue');
    expect(overdue).toMatchObject({ clubId: NAC_003, key: `equipmentOverdue:${NAC_003}` });
    expect(alerts.some((a) => a.type === 'equipmentReported' && a.clubId === NAC_001)).toBe(true);
    expect((await admin('POST', '/alerts/dismissals', { body: { key: overdue.key } })).status).toBe(
      201,
    );
    expect((await admin('GET', '/alerts')).body.data.some((a) => a.key === overdue.key)).toBe(
      false,
    );
    expect((await pm('GET', '/alerts')).body.data.some((a) => a.key === overdue.key)).toBe(true);
    const champion = await as('champion');
    expect(
      (await champion('POST', '/alerts/dismissals', { body: { key: overdue.key } })).status,
    ).toBe(404);

    // Retired items are left out of the counts.
    expect((await pm('GET', '/dashboard/hq')).body.data.equipment.total).toBe(9);
    const report = (await pm('GET', '/reports/termly', { query: { termId: CURRENT_TERM } })).body
      .data;
    expect(report.progress.find((r) => r.track === 'scratch').projects).toBe(3);
    expect(JSON.stringify(report)).not.toMatch(/Zawadi|Maze game/);
  });

  it('syncs the new records and applies offline changes once', async () => {
    const champion = await as('champion');
    const pull = (await champion('GET', '/sync/pull')).body.data;
    expect(pull.changes.equipmentItems.map((i) => i.id).sort()).toEqual(
      [LAPTOP_1, uid(2602), LAPTOP_3].sort(),
    );
    expect(pull.changes.resources.map((r) => r.id)).not.toContain(DRAFT_SLIDES);
    expect(pull.changes.resources.every((r) => !('fileId' in r))).toBe(true);
    expect(pull.inScope.events.length).toBeGreaterThan(0);
    const recordedAt = new Date().toISOString();
    const operations = [
      {
        opId: opId(1),
        type: 'project.save',
        data: {
          id: newId(1),
          clubId: NAC_001,
          learnerIds: [TUMAINI],
          title: 'Paper robot',
          track: 'unplugged',
          date: day(0),
        },
        recordedAt,
      },
      {
        opId: opId(2),
        type: 'assessment.save',
        data: {
          id: newId(2),
          clubId: NAC_001,
          title: 'Sorting quiz',
          track: 'unplugged',
          date: day(0),
          maxScore: 5,
        },
        recordedAt,
      },
      {
        opId: opId(3),
        type: 'assessment.scores',
        recordId: newId(2),
        data: { scores: [{ learnerId: TUMAINI, score: 4 }] },
        recordedAt,
      },
      {
        opId: opId(4),
        type: 'equipment.report',
        recordId: uid(2602),
        data: { condition: 'needs_repair', note: 'Fan is loud' },
        recordedAt,
      },
    ];
    const res = await champion('POST', '/sync/push', { body: { operations } });
    expect(res.body.data.results.map((r) => r.status)).toEqual(Array(4).fill('applied'));
    await champion('POST', '/sync/push', { body: { operations } });
    const projects = await champion('GET', '/progress/projects', { query: { clubId: NAC_001 } });
    expect(projects.body.data.filter((p) => p.id === newId(1))).toHaveLength(1);
    const assessment = await champion('GET', `/progress/assessments/${newId(2)}`);
    expect(assessment.body.data.scores.find((s) => s.learnerId === TUMAINI).score).toBe(4);
  });
});
