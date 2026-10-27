import { PERMISSIONS, POLICY, can, canManageRole, scopeFor } from '@code-clubs/shared/permissions';
import { ROLES, ROLE_VALUES } from '@code-clubs/shared/enums';

const user = (role, extra = {}) => ({ id: 'u1', role, status: 'active', ...extra });

describe('Permission policy', () => {
  it('denies by default: unknown permission, unknown role, no user', () => {
    expect(scopeFor(user(ROLES.SYSTEM_ADMIN), 'rocket:launch')).toBeNull();
    expect(scopeFor(user('visitor'), 'club:read')).toBeNull();
    expect(scopeFor(null, 'club:read')).toBeNull();
  });

  it('denies everything to inactive users', () => {
    for (const permission of PERMISSIONS) {
      expect(can(user(ROLES.SYSTEM_ADMIN, { status: 'inactive' }), permission)).toBe(false);
    }
  });

  it('only uses roles that exist', () => {
    for (const rule of Object.values(POLICY)) {
      for (const role of Object.keys(rule)) expect(ROLE_VALUES).toContain(role);
    }
  });

  it('lets the System Administrator manage every account, the Programme Manager only coordinators and champions (D5-12)', () => {
    const admin = user(ROLES.SYSTEM_ADMIN);
    const pm = user(ROLES.PROGRAMME_MANAGER);
    expect(Object.values(ROLES).every((r) => canManageRole(admin, r))).toBe(true);
    expect(canManageRole(pm, ROLES.COORDINATOR)).toBe(true);
    expect(canManageRole(pm, ROLES.CHAMPION)).toBe(true);
    expect(canManageRole(pm, ROLES.PROGRAMME_MANAGER)).toBe(false);
    expect(canManageRole(pm, ROLES.SYSTEM_ADMIN)).toBe(false);
    expect(can(user(ROLES.COORDINATOR), 'user:manage')).toBe(false);
    expect(can(user(ROLES.CHAMPION), 'user:manage')).toBe(false);
    expect(canManageRole(user(ROLES.COORDINATOR), ROLES.CHAMPION)).toBe(false);
  });

  it('lets a coordinator create Club Champion accounts only (D5-13)', () => {
    const coordinator = user(ROLES.COORDINATOR);
    expect(canManageRole(coordinator, ROLES.CHAMPION, 'user:create')).toBe(true);
    expect(canManageRole(coordinator, ROLES.COORDINATOR, 'user:create')).toBe(false);
    expect(canManageRole(coordinator, ROLES.PROGRAMME_MANAGER, 'user:create')).toBe(false);
    expect(can(user(ROLES.CHAMPION), 'user:create')).toBe(false);
  });

  it('limits coordinators and champions to their assignments', () => {
    expect(scopeFor(user(ROLES.COORDINATOR), 'club:write')).toBe('assigned');
    expect(scopeFor(user(ROLES.CHAMPION), 'club:read')).toBe('assigned');
    expect(scopeFor(user(ROLES.PROGRAMME_MANAGER), 'club:read')).toBe('all');
  });

  it('does not let champions change schools, clubs or assignments', () => {
    for (const permission of ['school:write', 'club:write', 'club:assignChampion', 'audit:read']) {
      expect(can(user(ROLES.CHAMPION), permission)).toBe(false);
    }
  });

  it('keeps guardian contacts HQ-only unless granted to one person', () => {
    expect(can(user(ROLES.COORDINATOR), 'learnerContact:read')).toBe(false);
    expect(can(user(ROLES.CHAMPION), 'learnerContact:read')).toBe(false);
    const granted = user(ROLES.CHAMPION, { permissionGrants: ['learnerContact:read'] });
    expect(scopeFor(granted, 'learnerContact:read')).toBe('assigned');
  });

  it('lets champions enter guardian contacts and consent, but not open consent forms', () => {
    const champion = user(ROLES.CHAMPION);
    expect(scopeFor(champion, 'learnerContact:write')).toBe('assigned');
    expect(scopeFor(champion, 'consent:write')).toBe('assigned');
    expect(can(champion, 'consentFile:read')).toBe(false);
    expect(scopeFor(user(ROLES.COORDINATOR), 'consentFile:read')).toBe('assigned');
  });

  it('lets only coordinators and HQ change a session report after 7 days (D2-5)', () => {
    expect(can(user(ROLES.CHAMPION), 'session:editLate')).toBe(false);
    expect(scopeFor(user(ROLES.COORDINATOR), 'session:editLate')).toBe('assigned');
    expect(scopeFor(user(ROLES.PROGRAMME_MANAGER), 'session:editLate')).toBe('all');
  });

  it('lets only champions and coordinators sync, and coordinators and HQ read conflicts (D3-1)', () => {
    expect(scopeFor(user(ROLES.CHAMPION), 'sync:use')).toBe('assigned');
    expect(scopeFor(user(ROLES.COORDINATOR), 'sync:use')).toBe('assigned');
    expect(can(user(ROLES.SYSTEM_ADMIN), 'sync:use')).toBe(false);
    expect(can(user(ROLES.PROGRAMME_MANAGER), 'sync:use')).toBe(false);
    expect(can(user(ROLES.CHAMPION), 'syncConflict:read')).toBe(false);
    expect(scopeFor(user(ROLES.COORDINATOR), 'syncConflict:read')).toBe('assigned');
  });

  it('matches the Sprint 4 table (docs/sprints/sprint-4.md, section 8)', () => {
    const table = {
      'dashboard:hq': ['all', 'all', 'assigned', null],
      'report:read': ['all', 'all', 'assigned', null],
      'report:schedule': ['all', 'all', null, null],
      'term:manage': ['all', 'all', null, null],
      'event:read': ['all', 'all', 'assigned', 'assigned'],
      'event:manage': ['all', 'all', 'assigned', null],
      'eventParticipant:manage': ['all', 'all', 'assigned', 'assigned'],
      'announcement:send': ['all', 'all', 'assigned', null],
      'announcement:read': ['self', 'self', 'self', 'self'],
    };
    const roles = [ROLES.SYSTEM_ADMIN, ROLES.PROGRAMME_MANAGER, ROLES.COORDINATOR, ROLES.CHAMPION];
    for (const [permission, scopes] of Object.entries(table)) {
      expect(roles.map((role) => scopeFor(user(role), permission))).toEqual(scopes);
    }
  });

  it('matches the Sprint 5 table (docs/sprints/sprint-5.md, section 8)', () => {
    const table = {
      'equipment:read': ['all', 'all', 'assigned', 'assigned'],
      'equipment:manage': ['all', 'all', 'assigned', null],
      'equipment:report': ['all', 'all', 'assigned', 'assigned'],
      'resource:read': ['all', 'all', 'all', 'all'],
      'resource:manage': ['all', 'all', null, null],
      'progress:read': ['all', 'all', 'assigned', 'assigned'],
      'progress:record': ['all', 'all', 'assigned', 'assigned'],
    };
    const roles = [ROLES.SYSTEM_ADMIN, ROLES.PROGRAMME_MANAGER, ROLES.COORDINATOR, ROLES.CHAMPION];
    for (const [permission, scopes] of Object.entries(table)) {
      expect(roles.map((role) => scopeFor(user(role), permission))).toEqual(scopes);
    }
  });
});
