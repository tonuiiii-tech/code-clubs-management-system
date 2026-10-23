/**
 * In-browser stand-in for the API, for demos without a server or database (D1-20).
 *
 * It answers the same /api/v1 URLs with the same shapes, status codes and error codes as the
 * real server, validates with the same shared Zod schemas and applies the same permission
 * policy and scopes, so pages do not change when VITE_USE_MOCKS is switched off.
 * It is a demo tool only: it is never bundled into a real build and protects nothing.
 */
import { REGION_CODE_PREFIX, ROLES } from '@code-clubs/shared/enums';
import { SCOPES, scopeFor } from '@code-clubs/shared/permissions';
import {
  assignChampionSchema,
  changePasswordSchema,
  createClubSchema,
  createSchoolSchema,
  createUserSchema,
  idSchema,
  listClubsQuerySchema,
  listSchoolsQuerySchema,
  listUsersQuerySchema,
  loginSchema,
  updateClubSchema,
  updateOwnProfileSchema,
  updateSchoolSchema,
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
const conflict = (message) => new MockHttpError(409, 'CONFLICT', message);

// ---------------------------------------------------------------------------
// Store: kept in localStorage so demo changes survive a page reload.

let db = null;

function load() {
  if (db) return db;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) db = JSON.parse(saved);
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
  save();
}

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
    const [status, payload] = route.handler({ actor, params: route.params, query, body });
    if (method !== 'GET') save();
    return { status, body: payload };
  } catch (err) {
    if (!(err instanceof MockHttpError)) throw err;
    const { status, code, message, details } = err;
    return { status, body: { error: { code, message, ...(details && { details }) } } };
  }
}
