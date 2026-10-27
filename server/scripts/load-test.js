/**
 * Load test (R4-6): the demo data plus 300 clubs, 9,000 fictional learners, a term of weekly
 * sessions with attendance, equipment, projects and scores; then times the heaviest requests.
 *
 *   MONGODB_URI=mongodb://127.0.0.1:27017/codeclubs_loadtest node scripts/load-test.js
 *
 * Only runs on a database whose name ends in "_loadtest", never with NODE_ENV=production: it
 * fills the database with generated records. Fictional names only (R1-12).
 */
import request from 'supertest';
import { REGION_CODE_PREFIX, REGION_VALUES, TRACKS } from '@code-clubs/shared/enums';
import { createSeedData, DEMO_PASSWORD } from '@code-clubs/shared/demo';
import { env } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/db/index.js';
import {
  Assessment,
  AssessmentScore,
  Attendance,
  Club,
  Consent,
  EquipmentItem,
  Learner,
  LearnerProject,
  School,
  Session,
} from '../src/db/models.js';
import { toDocument } from '../src/db/records.js';
import { createApp } from '../src/app.js';
import { seed } from './seed.js';

const CLUBS = 300;
const LEARNERS_PER_CLUB = 30;
const WEEKS = 10;
const RUNS = 3;

const FIRST = ['Achieng', 'Baraka', 'Chebet', 'Daudi', 'Esther', 'Faraji', 'Gathoni', 'Hassan'];
const LAST = ['Kamau', 'Otieno', 'Wanjiku', 'Mutua', 'Njeri', 'Omondi', 'Kiprono', 'Wafula'];
const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const id = (kind, n) => `00000000-0000-4000-${kind}-${String(n).padStart(12, '0')}`;

async function insert(model, records) {
  for (let i = 0; i < records.length; i += 5000) {
    await model.insertMany(records.slice(i, i + 5000).map(toDocument), { ordered: false });
  }
}

/** Records cloned from the demo ones, so they pass the same schemas. */
function generate() {
  const demo = createSeedData();
  const [schoolTemplate] = demo.schools;
  const [clubTemplate] = demo.clubs;
  const [learnerTemplate] = demo.learners;
  const [sessionTemplate] = demo.sessions;
  const now = new Date();
  const stamp = { createdAt: now, updatedAt: now };
  const out = {
    schools: [],
    clubs: [],
    learners: [],
    consents: [],
    sessions: [],
    attendance: [],
    equipment: [],
    projects: [],
    assessments: [],
    scores: [],
  };
  for (let c = 0; c < CLUBS; c += 1) {
    const region = REGION_VALUES[c % REGION_VALUES.length];
    const code = `${REGION_CODE_PREFIX[region]}-${String(100 + Math.floor(c / 4)).padStart(3, '0')}`;
    const school = {
      ...schoolTemplate,
      id: id('a000', c),
      name: `Load Test School ${c}`,
      region,
      ...stamp,
    };
    const club = {
      ...clubTemplate,
      id: id('b000', c),
      code,
      name: `Load Test Club ${c}`,
      schoolId: school.id,
      region,
      mainTrack: TRACKS[c % TRACKS.length],
      ...stamp,
    };
    out.schools.push(school);
    out.clubs.push(club);
    const learnerIds = [];
    for (let l = 0; l < LEARNERS_PER_CLUB; l += 1) {
      const n = c * LEARNERS_PER_CLUB + l;
      const learner = {
        ...learnerTemplate,
        id: id('c000', n),
        learnerNumber: `${code}-${String(l + 1).padStart(3, '0')}`,
        firstName: FIRST[n % FIRST.length],
        lastName: LAST[(n >> 3) % LAST.length],
        gender: l % 2 ? 'boy' : 'girl',
        admissionNumber: `LT-${n}`,
        clubId: club.id,
        schoolId: school.id,
        region,
        ...stamp,
      };
      learnerIds.push(learner.id);
      out.learners.push(learner);
      out.consents.push({
        id: id('c100', n),
        learnerId: learner.id,
        clubId: club.id,
        region,
        type: 'participation',
        status: 'given',
        signedOn: day(60),
        fileId: null,
        ...stamp,
      });
    }
    for (let w = 0; w < WEEKS; w += 1) {
      const session = {
        ...sessionTemplate,
        id: id('d000', c * WEEKS + w),
        clubId: club.id,
        region,
        date: day(w * 7 + 1),
        ...stamp,
      };
      out.sessions.push(session);
      learnerIds.forEach((learnerId, l) =>
        out.attendance.push({
          id: id('e000', (c * WEEKS + w) * LEARNERS_PER_CLUB + l),
          sessionId: session.id,
          learnerId,
          clubId: club.id,
          region,
          date: session.date,
          status: (l + w) % 6 ? 'present' : 'absent',
          ...stamp,
        }),
      );
    }
    for (let e = 0; e < 2; e += 1) {
      out.equipment.push({
        id: id('f000', c * 2 + e),
        assetTag: `LT-${c * 2 + e}`,
        name: `Load test laptop ${c * 2 + e}`,
        type: 'laptop',
        serialNumber: null,
        condition: e ? 'working' : 'needs_repair',
        region,
        clubId: e ? club.id : null,
        contents: null,
        notes: null,
        ...stamp,
      });
    }
    out.projects.push({
      id: id('f100', c),
      clubId: club.id,
      region,
      learnerIds: learnerIds.slice(0, 3),
      sessionId: null,
      title: 'Load test game',
      track: club.mainTrack,
      link: null,
      fileId: null,
      fileType: null,
      date: day(10),
      note: null,
      ...stamp,
    });
    const assessmentId = id('f200', c);
    out.assessments.push({
      id: assessmentId,
      clubId: club.id,
      region,
      title: 'Load test quiz',
      track: club.mainTrack,
      date: day(8),
      maxScore: 10,
      ...stamp,
    });
    learnerIds.forEach((learnerId, l) =>
      out.scores.push({
        id: id('f300', c * LEARNERS_PER_CLUB + l),
        assessmentId,
        learnerId,
        clubId: club.id,
        region,
        score: l % 11,
        ...stamp,
      }),
    );
  }
  return out;
}

async function time(label, send) {
  const times = [];
  let res;
  for (let i = 0; i < RUNS; i += 1) {
    const start = performance.now();
    res = await send();
    times.push(performance.now() - start);
  }
  if (res.status !== 200) throw new Error(`${label}: HTTP ${res.status}`);
  times.sort((a, b) => a - b);
  const size = res.body?.length ?? JSON.stringify(res.body).length;
  return { label, median: Math.round(times[1]), slowest: Math.round(times[2]), kb: size / 1024 };
}

async function main() {
  if (env.NODE_ENV === 'production' || !/_loadtest(\?|$)/.test(env.MONGODB_URI)) {
    console.error('Refusing to run: use a database whose name ends in _loadtest.');
    process.exit(1);
  }
  await connectDatabase(env.MONGODB_URI);
  await seed({ password: DEMO_PASSWORD });
  const data = generate();
  const started = performance.now();
  await Promise.all(
    [
      School,
      Club,
      Learner,
      Consent,
      Session,
      Attendance,
      EquipmentItem,
      LearnerProject,
      Assessment,
      AssessmentScore,
    ].map((model) =>
      model.deleteMany({ _id: { $regex: /^00000000-0000-4000-[a-f]{1}[0-9]{3}-/ } }),
    ),
  );
  await insert(School, data.schools);
  await insert(Club, data.clubs);
  await insert(Learner, data.learners);
  await insert(Consent, data.consents);
  await insert(Session, data.sessions);
  await insert(Attendance, data.attendance);
  await insert(EquipmentItem, data.equipment);
  await insert(LearnerProject, data.projects);
  await insert(Assessment, data.assessments);
  await insert(AssessmentScore, data.scores);
  console.log(
    `Inserted ${data.clubs.length} clubs, ${data.learners.length} learners, ` +
      `${data.sessions.length} sessions and ${data.attendance.length} attendance marks ` +
      `in ${Math.round((performance.now() - started) / 1000)} s.`,
  );

  const app = createApp();
  const signIn = async (email) =>
    (await request(app).post('/api/v1/auth/login').send({ email, password: DEMO_PASSWORD })).body
      .data.accessToken;
  const pm = await signIn('otieno.ouma@demo.steamlabs.test');
  const coordinator = await signIn('mwende.mutua@demo.steamlabs.test');
  const get = (token, url) =>
    request(app).get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`);
  const terms = (await get(pm, '/terms')).body.data;
  const term = terms.find((t) => t.startDate <= day(0) && t.endDate >= day(0)) ?? terms.at(-1);

  const results = [];
  results.push(await time('HQ dashboard (national)', () => get(pm, '/dashboard/hq')));
  results.push(await time('Alerts (national)', () => get(pm, '/alerts')));
  results.push(
    await time('Termly report (national)', () => get(pm, `/reports/termly?termId=${term.id}`)),
  );
  results.push(
    await time('Termly report PDF (national)', () =>
      get(pm, `/reports/termly.pdf?termId=${term.id}`).buffer(true),
    ),
  );
  results.push(await time('Learners list, page 1', () => get(pm, '/learners?pageSize=50')));
  results.push(
    await time('Coordinator dashboard (region)', () => get(coordinator, '/dashboard/hq')),
  );
  // The demo coordinator runs Nairobi & Central, so a quarter of the generated clubs too.
  results.push(
    await time('Coordinator sync pull, first page (region)', () => get(coordinator, '/sync/pull')),
  );

  console.log('\n| Request | Median (ms) | Slowest of 3 (ms) | Response (KB) |');
  console.log('| --- | --- | --- | --- |');
  for (const r of results) {
    console.log(`| ${r.label} | ${r.median} | ${r.slowest} | ${r.kb.toFixed(0)} |`);
  }
  await disconnectDatabase();
}

await main();
