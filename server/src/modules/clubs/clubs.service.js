import { randomUUID } from 'node:crypto';
import { REGION_CODE_PREFIX, ROLES } from '@code-clubs/shared/enums';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { scopeFilter } from '../scope.js';
import { recordAudit } from '../audit/audit.service.js';
import { getSchool } from '../schools/schools.service.js';
import { findUserById } from '../users/users.repository.js';
import * as repo from './clubs.repository.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

export function listClubs(actor, scope, query) {
  return repo.listClubs(scopeFilter(actor, scope), query);
}

/** Out-of-scope clubs look exactly like missing ones (404). A champion changing the ID in the URL gets 404. */
export async function getClub(actor, scope, id) {
  const club = await repo.findClubInScope(id, scopeFilter(actor, scope));
  if (!club) throw notFound(ERROR_MESSAGES.clubNotFound);
  return club;
}

/**
 * The club's region comes from its school, never from the request.
 * Online clubs have no school; their region must come from an explicit choice later (open question).
 */
export async function createClub(actor, scope, input, { requestId }) {
  if (!input.schoolId) throw badRequest(ERROR_MESSAGES.onlineClubsNotSupported);
  const school = await getSchool(actor, scope, input.schoolId);
  if (school.status !== 'active') throw badRequest(ERROR_MESSAGES.schoolInactive);
  const filter = scopeFilter(actor, scope);
  if (filter.regions && !filter.regions.includes(school.region)) {
    throw forbidden(ERROR_MESSAGES.clubOwnRegion);
  }
  // One Code Club per school; a closed one does not count (Enock, 2026-10-27, D5-11).
  if (await repo.schoolHasOtherClub(school.id)) throw conflict(ERROR_MESSAGES.schoolHasClub);
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
    region: club.region,
    requestId,
  });
  return club;
}

export async function updateClub(actor, scope, id, changes, { requestId }) {
  const before = await getClub(actor, scope, id);
  // The shared schema only checks times sent together; check against the saved ones too.
  const merged = { ...before, ...changes };
  if (merged.endTime <= merged.startTime) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.endTime', message: 'End time must be after start time' },
    ]);
  }
  const movesOrReopens = changes.schoolId !== undefined || changes.status !== undefined;
  if (
    movesOrReopens &&
    merged.schoolId &&
    merged.status !== 'closed' &&
    (await repo.schoolHasOtherClub(merged.schoolId, id))
  ) {
    throw conflict(ERROR_MESSAGES.schoolHasClub);
  }
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
    region: updated.region,
    requestId,
  });
  return updated;
}

export async function listChampions(actor, scope, clubId) {
  await getClub(actor, scope, clubId);
  return repo.listClubChampions(clubId);
}

export async function assignChampion(actor, scope, clubId, userId, input, { requestId }) {
  const club = await getClub(actor, scope, clubId);
  const champion = await findUserById(userId);
  if (!champion || champion.status !== 'active' || champion.role !== ROLES.CHAMPION) {
    throw badRequest(ERROR_MESSAGES.onlyActiveChampions);
  }
  // A champion runs one club, and so one school (Enock, 2026-10-27, D5-9).
  if (await repo.championHasOtherClub(userId, clubId)) {
    throw conflict(ERROR_MESSAGES.championHasClub);
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
    region: club.region,
    requestId,
  });
  return assignment;
}

export async function unassignChampion(actor, scope, clubId, userId, { requestId }) {
  const club = await getClub(actor, scope, clubId);
  await repo.endChampionAssignment(clubId, userId, new Date().toISOString().slice(0, 10));
  await recordAudit({
    actor,
    action: 'club.unassignChampion',
    entityType: 'club',
    entityId: clubId,
    before: { userId },
    after: { userId: null },
    region: club.region,
    requestId,
  });
}
