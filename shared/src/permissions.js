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
  'user:manage': { [SYSTEM_ADMIN]: ALL },
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
});

export const PERMISSIONS = Object.freeze(Object.keys(POLICY));

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
