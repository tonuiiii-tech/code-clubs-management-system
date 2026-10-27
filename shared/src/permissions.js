import { ROLES } from './enums.js';

/**
 * Role → permission → scope policy (D1-4, D1-13).
 *
 * This is the one place to change roles after STEAMLabs confirms them.
 * The server enforces it; the client only uses it to decide what to show.
 * It is NOT a security boundary on its own.
 *
 * Scopes:
 *   all      every record
 *   assigned records in the user's assignment (coordinator: regions; champion: clubs)
 *   self     only the user's own record
 */
export const SCOPES = Object.freeze({ ALL: 'all', ASSIGNED: 'assigned', SELF: 'self' });

const { SYSTEM_ADMIN, PROGRAMME_MANAGER, COORDINATOR, CHAMPION } = ROLES;
const { ALL, ASSIGNED, SELF } = SCOPES;

export const POLICY = Object.freeze({
  'user:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: SELF,
  },
  // Which roles' accounts each role may create (user:create) or edit and deactivate
  // (user:manage): MANAGEABLE_ROLES (D5-12, D5-13).
  'user:create': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },
  'user:manage': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL },
  'user:updateSelf': {
    [SYSTEM_ADMIN]: SELF,
    [PROGRAMME_MANAGER]: SELF,
    [COORDINATOR]: SELF,
    [CHAMPION]: SELF,
  },
  'safeguarding:update': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL },

  'school:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'school:write': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },

  'club:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'club:write': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },
  'club:assignChampion': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },

  'audit:read': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },

  // Sprint 2. Learners belong to a club, so "assigned" means the coordinator's regions or the
  // champion's clubs, as for clubs.
  'learner:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'learner:write': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  // Guardian contacts: anyone who registers a learner can enter one, but only STEAMLabs HQ can
  // read it back (questionnaire Q43, D2-1), unless granted to one person.
  'learnerContact:write': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'learnerContact:read': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL },
  // Consent: champions record it and upload the signed form; only HQ and coordinators open it.
  'consent:write': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'consentFile:read': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },
  'session:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'session:write': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  // Changing a session report after the edit window (D2-5).
  'session:editLate': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },

  // Sprint 3. Only champions and coordinators keep data on a device and sync it (D3-1).
  'sync:use': { [COORDINATOR]: ASSIGNED, [CHAMPION]: ASSIGNED },
  // Values overwritten when two people changed the same field offline (D3-5).
  'syncConflict:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
  },

  // Sprint 4 (docs/sprints/sprint-4.md, section 8).
  'dashboard:hq': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },
  'report:read': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },
  // Who gets the termly email, and the log of messages the stub providers recorded (D4-5).
  'report:schedule': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL },
  'term:manage': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL },
  // Champions see events their clubs are invited to; coordinators manage their regions' events.
  'event:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'event:manage': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },
  'eventParticipant:manage': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'announcement:send': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },
  'announcement:read': {
    [SYSTEM_ADMIN]: SELF,
    [PROGRAMME_MANAGER]: SELF,
    [COORDINATOR]: SELF,
    [CHAMPION]: SELF,
  },

  // Sprint 5 (docs/sprints/sprint-5.md, section 8). Champions see and report the items their
  // clubs hold; coordinators manage their regions' items.
  'equipment:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'equipment:manage': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL, [COORDINATOR]: ASSIGNED },
  'equipment:report': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'resource:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ALL,
    [CHAMPION]: ALL,
  },
  'resource:manage': { [SYSTEM_ADMIN]: ALL, [PROGRAMME_MANAGER]: ALL },
  // Projects and scores are learner data: the same scope as learner records (D5-6).
  'progress:read': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
  'progress:record': {
    [SYSTEM_ADMIN]: ALL,
    [PROGRAMME_MANAGER]: ALL,
    [COORDINATOR]: ASSIGNED,
    [CHAMPION]: ASSIGNED,
  },
});

export const PERMISSIONS = Object.freeze(Object.keys(POLICY));

/**
 * Account roles each role may create, and edit and (de)activate where it has user:manage
 * (D5-12, D5-13). The Programme Manager manages Code Clubs Coordinators and Club Champions; a
 * coordinator creates Club Champion accounts only; only a System Administrator manages
 * Programme Managers and other administrators.
 */
export const MANAGEABLE_ROLES = Object.freeze({
  [SYSTEM_ADMIN]: Object.freeze([SYSTEM_ADMIN, PROGRAMME_MANAGER, COORDINATOR, CHAMPION]),
  [PROGRAMME_MANAGER]: Object.freeze([COORDINATOR, CHAMPION]),
  [COORDINATOR]: Object.freeze([CHAMPION]),
});

/**
 * True when the user may create (permission 'user:create') or edit and deactivate
 * ('user:manage') accounts that have this role.
 */
export function canManageRole(user, role, permission = 'user:manage') {
  return can(user, permission) && (MANAGEABLE_ROLES[user.role] ?? []).includes(role);
}

/**
 * Returns the scope a user has for a permission, or null when denied.
 * Deny by default: unknown permissions, unknown roles and inactive users get null.
 * A per-person grant (user.permissionGrants) gives the permission with ASSIGNED scope.
 *
 * @param {{ role: string, status?: string, permissionGrants?: string[] } | null | undefined} user
 * @param {string} permission
 * @returns {'all' | 'assigned' | 'self' | null}
 */
export function scopeFor(user, permission) {
  if (!user || user.status === 'inactive') return null;
  const rule = POLICY[permission];
  if (!rule) return null;
  if (rule[user.role]) return rule[user.role];
  if (user.permissionGrants?.includes(permission)) return ASSIGNED;
  return null;
}

/** True when the user has the permission with any scope. */
export function can(user, permission) {
  return scopeFor(user, permission) !== null;
}
