import { randomUUID } from 'node:crypto';
import { REGION_CODE_PREFIX, ROLES } from '@code-clubs/shared/enums';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { scopeFilter } from '../scope.js';
import { recordAudit } from '../audit/audit.service.js';
import { getSchool } from '../schools/schools.service.js';
import { findUserById } from '../users/users.repository.js';
import * as repo from './clubs.repository.js';

export function listClubs(actor, scope, query) {
  return repo.listClubs(scopeFilter(actor, scope), query);
}

/** Out-of-scope clubs look exactly like missing ones (404). A champion changing the ID in the URL gets 404. */
export async function getClub(actor, scope, id) {
  const club = await repo.findClubInScope(id, scopeFilter(actor, scope));
  if (!club) throw notFound('Club not found');
  return club;
}

/**
 * The club's region comes from its school, never from the request.
 * Online clubs have no school; their region must come from an explicit choice later (open question).
 */
export async function createClub(actor, scope, input, { requestId }) {
  if (!input.schoolId) throw badRequest('Online clubs are not supported yet');
  const school = await getSchool(actor, scope, input.schoolId);
  if (school.status !== 'active') throw badRequest('The school is inactive');
  const filter = scopeFilter(actor, scope);
  if (filter.regions && !filter.regions.includes(school.region)) {
    throw forbidden('You can only add clubs in your own region');
  }
  const now = new Date();
  const club = {
    id: randomUUID(),
    code: await repo.nextClubCode(REGION_CODE_PREFIX[school.region]),
    ...input,
    region: school.region,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  };
  await repo.insertClub(club);
  await recordAudit({
    actor,
    action: 'club.create',
    entityType: 'club',
    entityId: club.id,
    after: input,
    requestId,
  });
  return club;
}

export async function updateClub(actor, scope, id, changes, { requestId }) {
  const before = await getClub(actor, scope, id);
  const updated = await repo.updateClubById(id, {
    ...changes,
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'club.update',
    entityType: 'club',
    entityId: id,
    before,
    after: changes,
    requestId,
  });
  return updated;
}

export async function assignChampion(actor, scope, clubId, userId, input, { requestId }) {
  await getClub(actor, scope, clubId);
  const champion = await findUserById(userId);
  if (!champion || champion.status !== 'active' || champion.role !== ROLES.CHAMPION) {
    throw badRequest('Only active Club Champions can be assigned to a club');
  }
  const assignment = await repo.upsertChampionAssignment({
    clubId,
    userId,
    role: input.role,
    startDate: input.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: null,
  });
  await recordAudit({
    actor,
    action: 'club.assignChampion',
    entityType: 'club',
    entityId: clubId,
    after: { userId, role: input.role },
    requestId,
  });
  return assignment;
}

export async function unassignChampion(actor, scope, clubId, userId, { requestId }) {
  await getClub(actor, scope, clubId);
  await repo.endChampionAssignment(clubId, userId, new Date().toISOString().slice(0, 10));
  await recordAudit({
    actor,
    action: 'club.unassignChampion',
    entityType: 'club',
    entityId: clubId,
    before: { userId },
    after: { userId: null },
    requestId,
  });
}
