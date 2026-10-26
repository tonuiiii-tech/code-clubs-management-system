import { randomUUID } from 'node:crypto';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { recordAudit } from '../audit/audit.service.js';
import * as repo from './terms.repository.js';

/** School terms (plan section 5). Everyone can read them; HQ sets them (`term:manage`). */

export const listTerms = () => repo.listTerms();

export async function getTerm(id) {
  const term = await repo.findTerm(id);
  if (!term) throw notFound(ERROR_MESSAGES.termNotFound);
  return term;
}

async function assertNoOverlap({ id, startDate, endDate }) {
  const terms = await repo.listTerms();
  if (terms.some((t) => t.id !== id && t.startDate <= endDate && startDate <= t.endDate)) {
    throw conflict(ERROR_MESSAGES.termOverlap);
  }
}

export async function createTerm(actor, input, { requestId }) {
  await assertNoOverlap(input);
  const now = new Date();
  const term = {
    id: randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  };
  await repo.insertTerm(term);
  await recordAudit({
    actor,
    action: 'term.create',
    entityType: 'term',
    entityId: term.id,
    after: input,
    requestId,
  });
  return term;
}

export async function updateTerm(actor, id, changes, { requestId }) {
  const before = await getTerm(id);
  const merged = { ...before, ...changes };
  if (merged.endDate <= merged.startDate) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.endDate', message: 'End date must be after start date' },
    ]);
  }
  await assertNoOverlap(merged);
  const term = await repo.updateTermById(id, {
    ...changes,
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'term.update',
    entityType: 'term',
    entityId: id,
    before,
    after: changes,
    requestId,
  });
  return term;
}
