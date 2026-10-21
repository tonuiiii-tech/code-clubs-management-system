import { randomUUID } from 'node:crypto';
import { conflict, forbidden, notFound } from '../../utils/httpError.js';
import { scopeFilter } from '../scope.js';
import { recordAudit } from '../audit/audit.service.js';
import * as repo from './schools.repository.js';

export function listSchools(actor, scope, query) {
  return repo.listSchools(scopeFilter(actor, scope), query);
}

/** Out-of-scope schools look exactly like missing ones (404), so their existence is not revealed. */
export async function getSchool(actor, scope, id) {
  const school = await repo.findSchoolInScope(id, scopeFilter(actor, scope));
  if (!school) throw notFound('School not found');
  return school;
}

export async function createSchool(actor, scope, input, { requestId }) {
  const filter = scopeFilter(actor, scope);
  if (filter.regions && !filter.regions.includes(input.region)) {
    throw forbidden('You can only add schools in your own region');
  }
  if (await repo.findDuplicateSchool(input.name, input.county, input.subCounty)) {
    throw conflict('A school with this name already exists in this sub-county');
  }
  const now = new Date();
  const school = {
    id: randomUUID(),
    ...input,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  };
  await repo.insertSchool(school);
  await recordAudit({
    actor,
    action: 'school.create',
    entityType: 'school',
    entityId: school.id,
    after: input,
    requestId,
  });
  return school;
}

export async function updateSchool(actor, scope, id, changes, { requestId }) {
  const before = await getSchool(actor, scope, id);
  const updated = await repo.updateSchoolById(id, {
    ...changes,
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'school.update',
    entityType: 'school',
    entityId: id,
    before,
    after: changes,
    requestId,
  });
  return updated;
}
