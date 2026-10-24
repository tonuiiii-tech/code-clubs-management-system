/**
 * In-browser stand-in for the API, for demos without a server or database (D1-20).
 *
 * It answers the same /api/v1 URLs with the same shapes, status codes and error codes as the
 * real server, validates with the same shared Zod schemas and applies the same permission
 * policy and scopes, so pages do not change when VITE_USE_MOCKS is switched off.
 * It is a demo tool only: it is never bundled into a real build and protects nothing.
 */
import {
  CONSENT_TYPES,
  PHOTO_TYPES,
  REGION_CODE_PREFIX,
  ROLES,
  SESSION_MAX_PHOTOS,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
} from '@code-clubs/shared/enums';
import { SCOPES, scopeFor } from '@code-clubs/shared/permissions';
import {
  assignChampionSchema,
  attendanceSchema,
  birthYearFromAge,
  changePasswordSchema,
  consentSchema,
  consentTypeSchema,
  createClubSchema,
  createLearnerSchema,
  createSessionSchema,
  createSchoolSchema,
  createUserSchema,
  idSchema,
  learnerContactSchema,
  learnerStatusSchema,
  listClubsQuerySchema,
  listLearnersQuerySchema,
  listSchoolsQuerySchema,
  listSessionsQuerySchema,
  listUsersQuerySchema,
  loginSchema,
  sessionEditWindowOpen,
  sessionPhotoQuerySchema,
  updateClubSchema,
  updateLearnerSchema,
  updateOwnProfileSchema,
  updateSchoolSchema,
  updateSessionSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from '@code-clubs/shared/schemas';
import { createSeedData, DEMO_PASSWORD } from '@code-clubs/shared/demo';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

const STORAGE_KEY = 'cc-mock-db';
const INVALID_LOGIN = ERROR_MESSAGES.invalidLogin;

class MockHttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
const badRequest = (message, details) =>
  new MockHttpError(400, 'VALIDATION_ERROR', message, details);
const unauthorized = (message = ERROR_MESSAGES.signIn) =>
  new MockHttpError(401, 'UNAUTHENTICATED', message);
const forbidden = (message = ERROR_MESSAGES.forbidden) =>
  new MockHttpError(403, 'FORBIDDEN', message);
const notFound = (message = ERROR_MESSAGES.notFound) =>
  new MockHttpError(404, 'NOT_FOUND', message);
const conflict = (message, code = 'CONFLICT', details) =>
  new MockHttpError(409, code, message, details);

// ---------------------------------------------------------------------------
// Store: kept in localStorage so demo changes survive a page reload.

let db = null;

function load() {
  if (db) return db;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) db = JSON.parse(saved);
    // Demo data saved before Sprint 2 has no learners; start again from the seed.
    if (db && !db.learners) db = null;
  } catch {
    db = null;
  }
  db ??= freshDb();
  return db;
}

function freshDb() {
  const seed = createSeedData();
  for (const u of seed.users) Object.assign(u, { password: DEMO_PASSWORD, tokenVersion: 0 });
  return { ...seed, refresh: null };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage can be blocked (private mode); the demo still works for this page load.
  }
}

/** Puts the demo data back to its starting state. */
export function resetMockDb() {
  db = freshDb();
  files.clear();
  save();
}

/**
 * Uploaded consent forms and photos stay in memory only: they are gone after a reload,
 * like everything else they are fictional (R2-1).
 */
const files = new Map();

// ---------------------------------------------------------------------------
// Helpers that mirror the server's middleware and services.

const toPublicUser = (user) => {
  if (!user) return user;
  const { password: _p, tokenVersion: _t, ...safe } = user;
  return safe;
};
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

function validate(schema, input, part) {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  throw badRequest(
    ERROR_MESSAGES.invalidFields,
    result.error.issues.map((i) => ({ field: [part, ...i.path].join('.'), message: i.message })),
  );
}

/** Access tokens look like `mock.<userId>.<tokenVersion>`; changing the version ends old sessions (R1-4). */
const tokenFor = (user) => `mock.${user.id}.${user.tokenVersion}`;

function authenticate(token) {
  const [, userId, version] = token?.split('.') ?? [];
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.status !== 'active' || String(user.tokenVersion) !== version) {
    throw unauthorized();
  }
  return user;
}

function authorize(user, permission) {
  const scope = scopeFor(user, permission);
  if (!scope) throw forbidden();
  return scope;
}

/** Same shape as server/src/modules/scope.js. */
function scopeFilter(user, scope) {
  if (scope === SCOPES.ALL) return { all: true };
  if (scope === SCOPES.SELF) return { userId: user.id };
  if (user.role === ROLES.COORDINATOR) return { regions: user.regions ?? [] };
  if (user.role === ROLES.CHAMPION) return { championUserId: user.id };
  return { none: true };
}

const currentAssignments = (clubId) =>
  db.assignments.filter((a) => a.clubId === clubId && !a.endDate);

function clubInFilter(club, filter) {
  if (filter.all) return true;
  if (filter.regions) return filter.regions.includes(club.region);
  if (filter.championUserId) {
    return currentAssignments(club.id).some((a) => a.userId === filter.championUserId);
  }
  return false;
}

function schoolInFilter(school, filter) {
  if (filter.all) return true;
  if (filter.regions) return filter.regions.includes(school.region);
  if (filter.championUserId) {
    return db.clubs.some((c) => c.schoolId === school.id && clubInFilter(c, filter));
  }
  return false;
}

/**
 * Coordinators see people in their regions, champions of their region's clubs, and champions
 * with no current club (so they can assign them). Same rule as users.repository findUserInScope.
 */
function userInFilter(user, filter) {
  if (filter.all) return true;
  if (filter.userId) return user.id === filter.userId;
  if (filter.regions) {
    if (user.regions?.some((r) => filter.regions.includes(r))) return true;
    if (user.role !== ROLES.CHAMPION) return false;
    const clubs = db.assignments
      .filter((a) => a.userId === user.id && !a.endDate)
      .map((a) => db.clubs.find((c) => c.id === a.clubId));
    return clubs.length === 0 || clubs.some((c) => filter.regions.includes(c?.region));
  }
  return false;
}

function paginate(rows, { page, pageSize }) {
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), page, pageSize, total: rows.length };
}

const matches = (q, ...values) =>
  !q || values.some((v) => v?.toLowerCase().includes(q.toLowerCase()));

const byName = (key) => (a, b) => a[key].localeCompare(b[key]);

// ---------------------------------------------------------------------------
// Route handlers. Each returns [status, body] or throws a MockHttpError.

const idParam = (id) => validate(idSchema, id, 'params.id');

function login(body) {
  const { email, password } = validate(loginSchema, body, 'body');
  const user = db.users.find((u) => u.email === email);
  if (!user || user.status !== 'active' || user.password !== password) {
    throw unauthorized(INVALID_LOGIN);
  }
  db.refresh = user.id;
  return [200, { data: { user: toPublicUser(user), accessToken: tokenFor(user) } }];
}

/** The refresh "cookie" is the signed-in user's id held in the store. */
function refresh() {
  const user = db.users.find((u) => u.id === db.refresh);
  if (!user || user.status !== 'active') throw unauthorized();
  return [200, { data: { user: toPublicUser(user), accessToken: tokenFor(user) } }];
}

function logout() {
  db.refresh = null;
  return [204, null];
}

function changePassword(actor, body) {
  const { currentPassword, newPassword } = validate(changePasswordSchema, body, 'body');
  if (actor.password !== currentPassword) {
    throw badRequest(ERROR_MESSAGES.currentPasswordIncorrect, [
      { field: 'body.currentPassword', message: ERROR_MESSAGES.currentPasswordIncorrect },
    ]);
  }
  Object.assign(actor, { password: newPassword, tokenVersion: actor.tokenVersion + 1 });
  db.refresh = null;
  return [204, null];
}

function findSchool(actor, scope, id) {
  const filter = scopeFilter(actor, scope);
  const school = db.schools.find((s) => s.id === id);
  if (!school || !schoolInFilter(school, filter)) throw notFound(ERROR_MESSAGES.schoolNotFound);
  return school;
}

function findClub(actor, scope, id) {
  const filter = scopeFilter(actor, scope);
  const club = db.clubs.find((c) => c.id === id);
  if (!club || !clubInFilter(club, filter)) throw notFound(ERROR_MESSAGES.clubNotFound);
  return club;
}

// ---------------------------------------------------------------------------
// Sprint 2: learners, consent, sessions and attendance. Same rules as
// server/src/modules/learners and server/src/modules/sessions (R1-19).

/** Learners, sessions and attendance carry their club's id and region (D2-6). */
function clubRecordInFilter(record, filter) {
  if (filter.all) return true;
  if (filter.regions) return filter.regions.includes(record.region);
  if (filter.championUserId) {
    return currentAssignments(record.clubId).some((a) => a.userId === filter.championUserId);
  }
  return false;
}

const PENDING = { status: 'pending', signedOn: null, hasFile: false };

function consentSummary(learnerId) {
  return Object.fromEntries(
    CONSENT_TYPES.map((type) => {
      const c = db.consents.find((x) => x.learnerId === learnerId && x.type === type);
      return [
        type,
        c
          ? { status: c.status, signedOn: c.signedOn ?? null, hasFile: Boolean(c.fileId) }
          : PENDING,
      ];
    }),
  );
}

const presentLearner = (l) => ({
  ...l,
  age: new Date().getFullYear() - l.birthYear,
  consents: consentSummary(l.id),
});

function findLearner(actor, scope, id) {
  const filter = scopeFilter(actor, scope);
  const learner = db.learners.find((l) => l.id === id);
  if (!learner || !clubRecordInFilter(learner, filter)) {
    throw notFound(ERROR_MESSAGES.learnerNotFound);
  }
  return learner;
}

const learnerDetail = (l) => ({
  ...presentLearner(l),
  hasContact: db.learnerContacts.some((c) => c.learnerId === l.id),
});

const activeCount = (clubId) =>
  db.learners.filter((l) => l.clubId === clubId && l.status === 'active').length;

const sameText = (a, b) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

async function readBytes(blob, count) {
  const part = blob.slice(0, count);
  if (typeof part.arrayBuffer === 'function') return new Uint8Array(await part.arrayBuffer());
  return new Uint8Array(
    await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(part);
    }),
  );
}

/** The real type from the first bytes, as server/src/utils/fileType.js does (D2-3). */
async function checkFile(body, allowed, typeMessage) {
  if (!(body instanceof Blob)) throw badRequest(typeMessage);
  if (body.size > UPLOAD_MAX_BYTES) {
    throw new MockHttpError(413, 'TOO_LARGE', ERROR_MESSAGES.fileTooLarge);
  }
  const b = await readBytes(body, 8);
  const type =
    b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
      ? 'image/jpeg'
      : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
        ? 'image/png'
        : b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46
          ? 'application/pdf'
          : null;
  if (!type || !allowed.includes(type)) throw badRequest(typeMessage);
  const id = crypto.randomUUID();
  files.set(id, new Blob([body], { type }));
  return id;
}

function learnerRoutes() {
  const consentParams = (params) => ({
    id: idParam(params.id),
    type: validate(consentTypeSchema, params.type, 'params.type'),
  });
  return [
    [
      'GET',
      '/learners',
      ({ actor, query }) => {
        const filter = scopeFilter(actor, authorize(actor, 'learner:read'));
        const q = validate(listLearnersQuerySchema, query, 'query');
        const rows = db.learners
          .filter((l) => clubRecordInFilter(l, filter))
          .filter(
            (l) => (!q.clubId || l.clubId === q.clubId) && (!q.status || l.status === q.status),
          )
          .filter((l) => matches(q.q, l.firstName, l.lastName, l.learnerNumber, l.admissionNumber))
          .sort(
            (a, b) =>
              a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
          )
          .map(presentLearner);
        return [200, paginate(rows, q)];
      },
    ],
    [
      'POST',
      '/learners',
      ({ actor, body }) => {
        const scope = authorize(actor, 'learner:write');
        const input = validate(createLearnerSchema, body, 'body');
        const { contact, confirmDuplicate, clubId, age, ...details } = input;
        const club = findClub(actor, scope, clubId);
        if (club.status !== 'active') throw badRequest(ERROR_MESSAGES.clubInactive);
        if (club.venueType === 'primary_school' && !details.admissionNumber) {
          throw badRequest(ERROR_MESSAGES.invalidFields, [
            { field: 'body.admissionNumber', message: ERROR_MESSAGES.admissionNumberRequired },
          ]);
        }
        if (activeCount(clubId) >= club.capacity) throw conflict(ERROR_MESSAGES.clubFull);
        const birthYear = birthYearFromAge(age);
        const duplicate = db.learners.find(
          (l) =>
            l.clubId === clubId &&
            l.birthYear === birthYear &&
            sameText(l.firstName, details.firstName) &&
            sameText(l.lastName, details.lastName),
        );
        if (duplicate && !confirmDuplicate) {
          throw conflict(ERROR_MESSAGES.duplicateLearner, 'POSSIBLE_DUPLICATE', [
            { learnerId: duplicate.id, learnerNumber: duplicate.learnerNumber },
          ]);
        }
        if (
          details.admissionNumber &&
          db.learners.some(
            (l) =>
              l.schoolId === club.schoolId && sameText(l.admissionNumber, details.admissionNumber),
          )
        ) {
          throw conflict(ERROR_MESSAGES.duplicateAdmissionNumber);
        }
        const used = db.learners
          .filter((l) => l.clubId === clubId)
          .reduce((max, l) => Math.max(max, Number(l.learnerNumber.slice(-3))), 0);
        const learner = {
          id: crypto.randomUUID(),
          learnerNumber: `${club.code}-${String(used + 1).padStart(3, '0')}`,
          ...details,
          birthYear,
          clubId,
          schoolId: club.schoolId ?? null,
          region: club.region,
          status: 'active',
          joinedAt: today(),
          leftAt: null,
          createdAt: now(),
          updatedAt: now(),
          createdBy: actor.id,
          updatedBy: actor.id,
        };
        db.learners.push(learner);
        if (contact)
          db.learnerContacts.push({ id: crypto.randomUUID(), learnerId: learner.id, ...contact });
        return [201, { data: learnerDetail(learner) }];
      },
    ],
    [
      'GET',
      '/learners/:id',
      ({ actor, params }) => [
        200,
        {
          data: learnerDetail(
            findLearner(actor, authorize(actor, 'learner:read'), idParam(params.id)),
          ),
        },
      ],
    ],
    [
      'PATCH',
      '/learners/:id',
      ({ actor, params, body }) => {
        const learner = findLearner(actor, authorize(actor, 'learner:write'), idParam(params.id));
        const { age, ...changes } = validate(updateLearnerSchema, body, 'body');
        if (age !== undefined) changes.birthYear = birthYearFromAge(age);
        if (
          changes.admissionNumber &&
          db.learners.some(
            (l) =>
              l.id !== learner.id &&
              l.schoolId === learner.schoolId &&
              sameText(l.admissionNumber, changes.admissionNumber),
          )
        ) {
          throw conflict(ERROR_MESSAGES.duplicateAdmissionNumber);
        }
        Object.assign(learner, changes, { updatedAt: now(), updatedBy: actor.id });
        return [200, { data: learnerDetail(learner) }];
      },
    ],
    [
      'PATCH',
      '/learners/:id/status',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'learner:write');
        const learner = findLearner(actor, scope, idParam(params.id));
        const { status } = validate(learnerStatusSchema, body, 'body');
        if (status !== learner.status) {
          if (status === 'active') {
            const club = findClub(actor, scope, learner.clubId);
            if (activeCount(club.id) >= club.capacity) throw conflict(ERROR_MESSAGES.clubFull);
          }
          Object.assign(learner, {
            status,
            leftAt: status === 'left' ? today() : null,
            updatedAt: now(),
            updatedBy: actor.id,
          });
        }
        return [200, { data: learnerDetail(learner) }];
      },
    ],
    [
      'GET',
      '/learners/:id/contact',
      ({ actor, params }) => {
        const learner = findLearner(
          actor,
          authorize(actor, 'learnerContact:read'),
          idParam(params.id),
        );
        const contact = db.learnerContacts.find((c) => c.learnerId === learner.id);
        if (!contact) throw notFound(ERROR_MESSAGES.contactNotFound);
        const { id: _id, learnerId: _l, ...data } = contact;
        return [200, { data }];
      },
    ],
    [
      'PUT',
      '/learners/:id/contact',
      ({ actor, params, body }) => {
        const learner = findLearner(
          actor,
          authorize(actor, 'learnerContact:write'),
          idParam(params.id),
        );
        const contact = validate(learnerContactSchema, body, 'body');
        db.learnerContacts = db.learnerContacts.filter((c) => c.learnerId !== learner.id);
        db.learnerContacts.push({ id: crypto.randomUUID(), learnerId: learner.id, ...contact });
        return [204, null];
      },
    ],
    [
      'PUT',
      '/learners/:id/consents/:type',
      ({ actor, params, body }) => {
        const { id, type } = consentParams(params);
        const learner = findLearner(actor, authorize(actor, 'consent:write'), id);
        const input = validate(consentSchema, body, 'body');
        upsertConsent(actor, learner, type, input);
        return [200, { data: consentSummary(learner.id) }];
      },
    ],
    [
      'PUT',
      '/learners/:id/consents/:type/file',
      async ({ actor, params, body }) => {
        const { id, type } = consentParams(params);
        const learner = findLearner(actor, authorize(actor, 'consent:write'), id);
        const fileId = await checkFile(body, UPLOAD_TYPES, ERROR_MESSAGES.fileTypeNotAllowed);
        const before = db.consents.find((c) => c.learnerId === id && c.type === type);
        if (before?.fileId) files.delete(before.fileId);
        upsertConsent(actor, learner, type, { fileId });
        return [200, { data: consentSummary(learner.id) }];
      },
    ],
    [
      'GET',
      '/learners/:id/consents/:type/file',
      ({ actor, params }) => {
        const { id, type } = consentParams(params);
        findLearner(actor, authorize(actor, 'consentFile:read'), id);
        const consent = db.consents.find((c) => c.learnerId === id && c.type === type);
        const file = consent?.fileId && files.get(consent.fileId);
        if (!file) throw notFound(ERROR_MESSAGES.consentFileNotFound);
        return [200, file];
      },
    ],
  ];
}

function upsertConsent(actor, learner, type, changes) {
  let consent = db.consents.find((c) => c.learnerId === learner.id && c.type === type);
  if (!consent) {
    consent = {
      id: crypto.randomUUID(),
      learnerId: learner.id,
      clubId: learner.clubId,
      region: learner.region,
      type,
      status: 'pending',
      fileId: null,
      createdAt: now(),
      createdBy: actor.id,
    };
    db.consents.push(consent);
  }
  Object.assign(consent, changes, { updatedAt: now(), updatedBy: actor.id });
}

function findSession(actor, scope, id) {
  const filter = scopeFilter(actor, scope);
  const session = db.sessions.find((s) => s.id === id);
  if (!session || !clubRecordInFilter(session, filter)) {
    throw notFound(ERROR_MESSAGES.sessionNotFound);
  }
  return session;
}

/** Champions can change a report for 7 days; coordinators and HQ at any time (D2-5). */
function assertEditable(actor, date) {
  if (!sessionEditWindowOpen(date) && !scopeFor(actor, 'session:editLate')) {
    throw forbidden(ERROR_MESSAGES.sessionLocked);
  }
}

function assertDateFitsStatus({ date, status }) {
  if (date > today() && status !== 'planned') {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.status', message: ERROR_MESSAGES.futureSessionPlanned },
    ]);
  }
}

const isPresent = (status) => status === 'present' || status === 'late';

function sessionDetail(session) {
  const attendance = db.attendance
    .filter((a) => a.sessionId === session.id)
    .map(({ learnerId, status }) => {
      const l = db.learners.find((x) => x.id === learnerId) ?? {};
      return {
        learnerId,
        status,
        firstName: l.firstName ?? '',
        lastName: l.lastName ?? '',
        learnerNumber: l.learnerNumber ?? '',
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  return { ...session, attendance };
}

const reported = (actor, status) =>
  status === 'held' ? { reportedBy: actor.id, reportedAt: now() } : {};

function sessionRoutes() {
  const photoParams = (params) => ({
    id: idParam(params.id),
    photoId: validate(idSchema, params.photoId, 'params.photoId'),
  });
  return [
    [
      'GET',
      '/sessions',
      ({ actor, query }) => {
        const filter = scopeFilter(actor, authorize(actor, 'session:read'));
        const q = validate(listSessionsQuerySchema, query, 'query');
        const rows = db.sessions
          .filter((s) => clubRecordInFilter(s, filter))
          .filter(
            (s) =>
              (!q.clubId || s.clubId === q.clubId) &&
              (!q.status || s.status === q.status) &&
              (!q.from || s.date >= q.from) &&
              (!q.to || s.date <= q.to),
          )
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((s) => {
            const marks = db.attendance.filter((a) => a.sessionId === s.id);
            return {
              ...s,
              attendance: {
                present: marks.filter((a) => isPresent(a.status)).length,
                total: marks.length,
              },
            };
          });
        return [200, paginate(rows, q)];
      },
    ],
    [
      'POST',
      '/sessions',
      ({ actor, body }) => {
        const scope = authorize(actor, 'session:write');
        const input = validate(createSessionSchema, body, 'body');
        const club = findClub(actor, scope, input.clubId);
        if (club.status !== 'active') throw badRequest(ERROR_MESSAGES.clubInactive);
        assertDateFitsStatus(input);
        assertEditable(actor, input.date);
        if (db.sessions.some((s) => s.clubId === club.id && s.date === input.date)) {
          throw conflict(ERROR_MESSAGES.duplicateSession);
        }
        const session = {
          id: crypto.randomUUID(),
          startTime: club.startTime,
          endTime: club.endTime,
          ...input,
          region: club.region,
          photoIds: [],
          ...reported(actor, input.status),
          createdAt: now(),
          updatedAt: now(),
          createdBy: actor.id,
          updatedBy: actor.id,
        };
        db.sessions.push(session);
        return [201, { data: sessionDetail(session) }];
      },
    ],
    [
      'GET',
      '/sessions/:id',
      ({ actor, params }) => [
        200,
        {
          data: sessionDetail(
            findSession(actor, authorize(actor, 'session:read'), idParam(params.id)),
          ),
        },
      ],
    ],
    [
      'PATCH',
      '/sessions/:id',
      ({ actor, params, body }) => {
        const session = findSession(actor, authorize(actor, 'session:write'), idParam(params.id));
        const changes = validate(updateSessionSchema, body, 'body');
        assertEditable(actor, session.date);
        if (changes.date) assertEditable(actor, changes.date);
        const merged = { ...session, ...changes };
        assertDateFitsStatus(merged);
        if (merged.status === 'held' && !merged.topic) {
          throw badRequest(ERROR_MESSAGES.invalidFields, [
            { field: 'body.topic', message: 'Add the topic covered' },
          ]);
        }
        if (merged.endTime <= merged.startTime) {
          throw badRequest(ERROR_MESSAGES.invalidFields, [
            { field: 'body.endTime', message: 'End time must be after start time' },
          ]);
        }
        if (
          changes.date &&
          db.sessions.some(
            (s) => s.id !== session.id && s.clubId === session.clubId && s.date === changes.date,
          )
        ) {
          throw conflict(ERROR_MESSAGES.duplicateSession);
        }
        Object.assign(session, changes, {
          ...(changes.status &&
            changes.status !== session.status &&
            reported(actor, changes.status)),
          updatedAt: now(),
          updatedBy: actor.id,
        });
        for (const a of db.attendance) if (a.sessionId === session.id) a.date = session.date;
        return [200, { data: sessionDetail(session) }];
      },
    ],
    [
      'PUT',
      '/sessions/:id/attendance',
      ({ actor, params, body }) => {
        const session = findSession(actor, authorize(actor, 'session:write'), idParam(params.id));
        const { records } = validate(attendanceSchema, body, 'body');
        assertEditable(actor, session.date);
        if (session.status !== 'held') throw badRequest(ERROR_MESSAGES.attendanceHeldOnly);
        const inClub = records.every((r) =>
          db.learners.some((l) => l.id === r.learnerId && l.clubId === session.clubId),
        );
        if (!inClub) throw badRequest(ERROR_MESSAGES.attendanceNotInClub);
        db.attendance = db.attendance.filter((a) => a.sessionId !== session.id);
        for (const { learnerId, status } of records) {
          db.attendance.push({
            id: crypto.randomUUID(),
            sessionId: session.id,
            learnerId,
            clubId: session.clubId,
            region: session.region,
            date: session.date,
            status,
            createdAt: now(),
            updatedAt: now(),
            createdBy: actor.id,
            updatedBy: actor.id,
          });
        }
        return [200, { data: sessionDetail(session) }];
      },
    ],
    [
      'POST',
      '/sessions/:id/photos',
      async ({ actor, params, query, body }) => {
        const session = findSession(actor, authorize(actor, 'session:write'), idParam(params.id));
        const { confirmConsent } = validate(sessionPhotoQuerySchema, query, 'query');
        assertEditable(actor, session.date);
        if (session.photoIds.length >= SESSION_MAX_PHOTOS)
          throw conflict(ERROR_MESSAGES.tooManyPhotos);
        const missing = db.attendance
          .filter((a) => a.sessionId === session.id && isPresent(a.status))
          .filter(
            (a) =>
              !db.consents.some(
                (c) => c.learnerId === a.learnerId && c.type === 'photo' && c.status === 'given',
              ),
          )
          .map((a) => {
            const l = db.learners.find((x) => x.id === a.learnerId);
            return { learnerId: a.learnerId, name: `${l?.firstName} ${l?.lastName}` };
          });
        if (missing.length && !confirmConsent) {
          throw conflict(ERROR_MESSAGES.photoConsentMissing, 'PHOTO_CONSENT_MISSING', missing);
        }
        const photoId = await checkFile(body, PHOTO_TYPES, ERROR_MESSAGES.photoTypeNotAllowed);
        session.photoIds = [...session.photoIds, photoId];
        Object.assign(session, { updatedAt: now(), updatedBy: actor.id });
        return [201, { data: sessionDetail(session) }];
      },
    ],
    [
      'GET',
      '/sessions/:id/photos/:photoId',
      ({ actor, params }) => {
        const { id, photoId } = photoParams(params);
        const session = findSession(actor, authorize(actor, 'session:read'), id);
        const file = session.photoIds.includes(photoId) && files.get(photoId);
        if (!file) throw notFound(ERROR_MESSAGES.photoNotFound);
        return [200, file];
      },
    ],
    [
      'DELETE',
      '/sessions/:id/photos/:photoId',
      ({ actor, params }) => {
        const { id, photoId } = photoParams(params);
        const session = findSession(actor, authorize(actor, 'session:write'), id);
        assertEditable(actor, session.date);
        if (!session.photoIds.includes(photoId)) throw notFound(ERROR_MESSAGES.photoNotFound);
        session.photoIds = session.photoIds.filter((p) => p !== photoId);
        files.delete(photoId);
        return [204, null];
      },
    ],
  ];
}

/** Same counts as server/src/modules/dashboard (US-12). */
function learnerAndSessionCounts(filter) {
  const monthStart = `${today().slice(0, 7)}-01`;
  const learners = db.learners.filter(
    (l) => l.status === 'active' && clubRecordInFilter(l, filter),
  );
  const byGender = learners.reduce(
    (acc, l) => ({ ...acc, [l.gender]: (acc[l.gender] ?? 0) + 1 }),
    {},
  );
  const sessionsThisMonth = db.sessions.filter(
    (s) => s.status === 'held' && s.date >= monthStart && clubRecordInFilter(s, filter),
  ).length;
  const marks = db.attendance.filter((a) => a.date >= monthStart && clubRecordInFilter(a, filter));
  const present = marks.filter((a) => isPresent(a.status)).length;
  const withConsent = learners.filter((l) =>
    db.consents.some(
      (c) => c.learnerId === l.id && c.type === 'participation' && c.status === 'given',
    ),
  ).length;
  return {
    learners: learners.length,
    learnersByGender: byGender,
    sessionsThisMonth,
    attendanceRate: marks.length ? Math.round((present / marks.length) * 100) : null,
    learnersMissingConsent: learners.length - withConsent,
  };
}

const routes = [
  ['POST', '/auth/login', ({ body }) => login(body), { public: true }],
  ['POST', '/auth/refresh', () => refresh(), { public: true }],
  ['POST', '/auth/logout', () => logout(), { public: true }],
  ['GET', '/auth/me', ({ actor }) => [200, { data: toPublicUser(actor) }]],
  ['POST', '/auth/change-password', ({ actor, body }) => changePassword(actor, body)],

  [
    'GET',
    '/users',
    ({ actor, query }) => {
      const scope = authorize(actor, 'user:read');
      const q = validate(listUsersQuerySchema, query, 'query');
      const filter = scopeFilter(actor, scope);
      const rows = db.users
        .filter((u) => userInFilter(u, filter))
        .filter((u) => (!q.role || u.role === q.role) && (!q.status || u.status === q.status))
        .filter((u) => matches(q.q, u.fullName, u.email))
        .sort(byName('fullName'))
        .map(toPublicUser);
      return [200, paginate(rows, q)];
    },
  ],
  [
    'PATCH',
    '/users/me',
    ({ actor, body }) => {
      authorize(actor, 'user:updateSelf');
      const changes = validate(updateOwnProfileSchema, body, 'body');
      Object.assign(actor, changes, { updatedAt: now(), updatedBy: actor.id });
      return [200, { data: toPublicUser(actor) }];
    },
  ],
  [
    'GET',
    '/users/:id',
    ({ actor, params }) => {
      const filter = scopeFilter(actor, authorize(actor, 'user:read'));
      const user = db.users.find((u) => u.id === idParam(params.id));
      if (!user || !userInFilter(user, filter)) throw notFound(ERROR_MESSAGES.userNotFound);
      return [200, { data: toPublicUser(user) }];
    },
  ],
  [
    'POST',
    '/users',
    ({ actor, body }) => {
      authorize(actor, 'user:manage');
      const input = validate(createUserSchema, body, 'body');
      if (db.users.some((u) => u.email === input.email)) {
        throw conflict(ERROR_MESSAGES.duplicateEmail);
      }
      const temporaryPassword = `Temp-${crypto.randomUUID().slice(0, 8)}`;
      const user = {
        id: crypto.randomUUID(),
        ...input,
        status: 'active',
        permissionGrants: [],
        password: temporaryPassword,
        tokenVersion: 0,
        createdAt: now(),
        updatedAt: now(),
        createdBy: actor.id,
        updatedBy: actor.id,
      };
      db.users.push(user);
      return [201, { data: toPublicUser(user), temporaryPassword }];
    },
  ],
  [
    'PATCH',
    '/users/:id/status',
    ({ actor, params, body }) => {
      authorize(actor, 'user:manage');
      const id = idParam(params.id);
      const { status } = validate(updateUserStatusSchema, body, 'body');
      if (id === actor.id) throw forbidden(ERROR_MESSAGES.ownStatus);
      const user = db.users.find((u) => u.id === id);
      if (!user) throw notFound();
      Object.assign(user, {
        status,
        ...(status === 'inactive' && { tokenVersion: user.tokenVersion + 1 }),
        updatedAt: now(),
        updatedBy: actor.id,
      });
      return [200, { data: toPublicUser(user) }];
    },
  ],
  [
    'PATCH',
    '/users/:id',
    ({ actor, params, body }) => {
      authorize(actor, 'user:manage');
      const id = idParam(params.id);
      const changes = validate(updateUserSchema, body, 'body');
      if (id === actor.id && changes.role !== undefined) {
        throw forbidden(ERROR_MESSAGES.ownRole);
      }
      const user = db.users.find((u) => u.id === id);
      if (!user) throw notFound();
      Object.assign(user, changes, { updatedAt: now(), updatedBy: actor.id });
      return [200, { data: toPublicUser(user) }];
    },
  ],

  [
    'GET',
    '/schools',
    ({ actor, query }) => {
      const filter = scopeFilter(actor, authorize(actor, 'school:read'));
      const q = validate(listSchoolsQuerySchema, query, 'query');
      const rows = db.schools
        .filter((s) => schoolInFilter(s, filter))
        .filter(
          (s) =>
            (!q.region || s.region === q.region) &&
            (!q.county || s.county === q.county) &&
            (!q.type || s.type === q.type) &&
            (!q.status || s.status === q.status),
        )
        .filter((s) => matches(q.q, s.name, s.subCounty, s.ward))
        .sort(byName('name'));
      return [200, paginate(rows, q)];
    },
  ],
  [
    'POST',
    '/schools',
    ({ actor, body }) => {
      const filter = scopeFilter(actor, authorize(actor, 'school:write'));
      const input = validate(createSchoolSchema, body, 'body');
      if (filter.regions && !filter.regions.includes(input.region)) {
        throw forbidden(ERROR_MESSAGES.schoolOwnRegion);
      }
      const duplicate = db.schools.some(
        (s) =>
          s.name.toLowerCase() === input.name.toLowerCase() &&
          s.county === input.county &&
          s.subCounty.toLowerCase() === input.subCounty.toLowerCase(),
      );
      if (duplicate) throw conflict(ERROR_MESSAGES.duplicateSchool);
      const school = {
        id: crypto.randomUUID(),
        ...input,
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
        createdBy: actor.id,
        updatedBy: actor.id,
      };
      db.schools.push(school);
      return [201, { data: school }];
    },
  ],
  [
    'GET',
    '/schools/:id',
    ({ actor, params }) => [
      200,
      { data: findSchool(actor, authorize(actor, 'school:read'), idParam(params.id)) },
    ],
  ],
  [
    'PATCH',
    '/schools/:id',
    ({ actor, params, body }) => {
      const scope = authorize(actor, 'school:write');
      const school = findSchool(actor, scope, idParam(params.id));
      const changes = validate(updateSchoolSchema, body, 'body');
      const filter = scopeFilter(actor, scope);
      if (changes.region && filter.regions && !filter.regions.includes(changes.region)) {
        throw forbidden(ERROR_MESSAGES.schoolMoveOwnRegion);
      }
      Object.assign(school, changes, { updatedAt: now(), updatedBy: actor.id });
      return [200, { data: school }];
    },
  ],

  [
    'GET',
    '/clubs',
    ({ actor, query }) => {
      const filter = scopeFilter(actor, authorize(actor, 'club:read'));
      const q = validate(listClubsQuerySchema, query, 'query');
      const rows = db.clubs
        .filter((c) => clubInFilter(c, filter))
        .filter(
          (c) =>
            (!q.region || c.region === q.region) &&
            (!q.schoolId || c.schoolId === q.schoolId) &&
            (!q.status || c.status === q.status) &&
            (!q.track || c.mainTrack === q.track),
        )
        .filter((c) => matches(q.q, c.name, c.code))
        .sort(byName('code'));
      return [200, paginate(rows, q)];
    },
  ],
  [
    'POST',
    '/clubs',
    ({ actor, body }) => {
      const scope = authorize(actor, 'club:write');
      const input = validate(createClubSchema, body, 'body');
      if (!input.schoolId) throw badRequest(ERROR_MESSAGES.onlineClubsNotSupported);
      const school = findSchool(actor, scope, input.schoolId);
      if (school.status !== 'active') throw badRequest(ERROR_MESSAGES.schoolInactive);
      const filter = scopeFilter(actor, scope);
      if (filter.regions && !filter.regions.includes(school.region)) {
        throw forbidden(ERROR_MESSAGES.clubOwnRegion);
      }
      const prefix = REGION_CODE_PREFIX[school.region];
      const used = db.clubs.filter((c) => c.code.startsWith(`${prefix}-`)).length;
      const club = {
        id: crypto.randomUUID(),
        code: `${prefix}-${String(used + 1).padStart(3, '0')}`,
        ...input,
        region: school.region,
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
        createdBy: actor.id,
        updatedBy: actor.id,
      };
      db.clubs.push(club);
      return [201, { data: club }];
    },
  ],
  [
    'GET',
    '/clubs/:id',
    ({ actor, params }) => [
      200,
      { data: findClub(actor, authorize(actor, 'club:read'), idParam(params.id)) },
    ],
  ],
  [
    'PATCH',
    '/clubs/:id',
    ({ actor, params, body }) => {
      const club = findClub(actor, authorize(actor, 'club:write'), idParam(params.id));
      const changes = validate(updateClubSchema, body, 'body');
      const merged = { ...club, ...changes };
      if (merged.endTime <= merged.startTime) {
        throw badRequest(ERROR_MESSAGES.invalidFields, [
          { field: 'body.endTime', message: 'End time must be after start time' },
        ]);
      }
      Object.assign(club, changes, { updatedAt: now(), updatedBy: actor.id });
      return [200, { data: club }];
    },
  ],
  [
    'GET',
    '/clubs/:id/champions',
    ({ actor, params }) => {
      const club = findClub(actor, authorize(actor, 'club:read'), idParam(params.id));
      const data = currentAssignments(club.id).map((a) => {
        const user = db.users.find((u) => u.id === a.userId);
        return { ...a, fullName: user?.fullName ?? '' };
      });
      return [200, { data }];
    },
  ],
  [
    'PUT',
    '/clubs/:id/champions/:userId',
    ({ actor, params, body }) => {
      const club = findClub(actor, authorize(actor, 'club:assignChampion'), idParam(params.id));
      const userId = idParam(params.userId);
      const input = validate(assignChampionSchema, body, 'body');
      const champion = db.users.find((u) => u.id === userId);
      if (!champion || champion.status !== 'active' || champion.role !== ROLES.CHAMPION) {
        throw badRequest(ERROR_MESSAGES.onlyActiveChampions);
      }
      let assignment = currentAssignments(club.id).find((a) => a.userId === userId);
      if (assignment) {
        assignment.role = input.role;
      } else {
        assignment = {
          clubId: club.id,
          userId,
          role: input.role,
          startDate: input.startDate ?? today(),
          endDate: null,
        };
        db.assignments.push(assignment);
      }
      return [200, { data: assignment }];
    },
  ],
  [
    'DELETE',
    '/clubs/:id/champions/:userId',
    ({ actor, params }) => {
      const club = findClub(actor, authorize(actor, 'club:assignChampion'), idParam(params.id));
      const userId = idParam(params.userId);
      // Ending keeps the history (D1-15).
      for (const a of currentAssignments(club.id)) if (a.userId === userId) a.endDate = today();
      return [204, null];
    },
  ],

  ...learnerRoutes(),
  ...sessionRoutes(),
  [
    'GET',
    '/dashboard/summary',
    ({ actor }) => {
      const filter = scopeFilter(actor, authorize(actor, 'club:read'));
      const clubs = db.clubs.filter((c) => clubInFilter(c, filter));
      const active = clubs.filter((c) => c.status === 'active');
      const count = (key) =>
        active.reduce((acc, c) => ({ ...acc, [c[key]]: (acc[c[key]] ?? 0) + 1 }), {});
      const champions = new Set(
        clubs.flatMap((c) => currentAssignments(c.id).map((a) => a.userId)),
      );
      return [
        200,
        {
          data: {
            activeClubs: active.length,
            schools: db.schools.filter((s) => s.status === 'active' && schoolInFilter(s, filter))
              .length,
            champions: champions.size,
            clubsByRegion: count('region'),
            clubsByTrack: count('mainTrack'),
            ...learnerAndSessionCounts(filter),
          },
        },
      ];
    },
  ],
];

function match(method, path) {
  const parts = path.split('/').filter(Boolean);
  for (const [m, pattern, handler, options = {}] of routes) {
    if (m !== method) continue;
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    const ok = pp.every((p, i) => {
      if (p.startsWith(':')) return ((params[p.slice(1)] = decodeURIComponent(parts[i])), true);
      return p === parts[i];
    });
    if (ok) return { handler, params, options };
  }
  return null;
}

/**
 * Handles one API call. Returns { status, body } like a fetch response would carry.
 * @param {{ method: string, path: string, query?: object, body?: object, token?: string | null }} req
 */
export async function mockRequest({ method, path, query = {}, body, token }) {
  load();
  // A short delay so loading states are visible, as on a real network.
  await new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : 150));
  try {
    const route = match(method, path);
    if (!route) throw notFound('Route not found');
    const actor = route.options.public ? null : authenticate(token);
    const [status, payload] = await route.handler({ actor, params: route.params, query, body });
    if (method !== 'GET') save();
    return { status, body: payload };
  } catch (err) {
    if (!(err instanceof MockHttpError)) throw err;
    const { status, code, message, details } = err;
    return { status, body: { error: { code, message, ...(details && { details }) } } };
  }
}
