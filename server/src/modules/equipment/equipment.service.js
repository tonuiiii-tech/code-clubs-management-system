import { randomUUID } from 'node:crypto';
import { LENDABLE_CONDITIONS } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { scopeFor } from '@code-clubs/shared/permissions';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { recordAudit } from '../audit/audit.service.js';
import { scopeFilter } from '../scope.js';
import * as repo from './equipment.repository.js';

/**
 * Equipment (plan section 4): HQ and coordinators keep the register and lend items to clubs;
 * champions see what their clubs hold and report damage or loss, also offline (D5-1, D5-5).
 */

const today = () => new Date().toISOString().slice(0, 10);
const stampNew = (actor) => {
  const now = new Date();
  return { createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id };
};
const stampChange = (actor) => ({ updatedAt: new Date(), updatedBy: actor.id });
const filterFor = (actor, permission) => scopeFilter(actor, scopeFor(actor, permission));
const clubSummary = (club) =>
  club ? { id: club.id, code: club.code, name: club.name, region: club.region } : null;
const isOverdue = (loan, day = today()) => Boolean(loan?.dueDate && loan.dueDate < day);

async function findItem(actor, id) {
  const item = await repo.findItem(filterFor(actor, 'equipment:read'), id);
  if (!item) throw notFound(ERROR_MESSAGES.equipmentNotFound);
  return item;
}

/** An item the user may change; one they can only read answers 403, others 404. */
async function findManagedItem(actor, scope, id) {
  const item = await repo.findManagedItem(scopeFilter(actor, scope), id);
  if (item) return item;
  await findItem(actor, id);
  throw forbidden(ERROR_MESSAGES.equipmentOwnRegion);
}

function checkRegion(actor, scope, region) {
  const filter = scopeFilter(actor, scope);
  if (filter.regions && !filter.regions.includes(region)) {
    throw forbidden(ERROR_MESSAGES.equipmentOwnRegion);
  }
}

/** Rows for a list: the club holding each item and whether it is overdue. */
async function present(items) {
  const loans = await repo.openLoans(items.map((i) => i.id));
  const loanBy = new Map(loans.map((l) => [l.itemId, l]));
  const clubs = await repo.clubsByIds([...new Set(items.map((i) => i.clubId).filter(Boolean))]);
  const clubBy = new Map(clubs.map((c) => [c.id, c]));
  return items.map((item) => {
    const loan = loanBy.get(item.id);
    return {
      ...item,
      club: clubSummary(clubBy.get(item.clubId)),
      dueDate: loan?.dueDate ?? null,
      overdue: isOverdue(loan),
    };
  });
}

export async function listEquipment(actor, scope, { page, pageSize, ...query }) {
  const result = await repo.listItems(scopeFilter(actor, scope), query, { page, pageSize });
  return { ...result, data: await present(result.data) };
}

/** One item with its loans, repairs and reports, and what the user may do with it. */
export async function getEquipment(actor, _scope, id) {
  const item = await findItem(actor, id);
  const [[row], loans, repairs, reports] = await Promise.all([
    present([item]),
    repo.loansOf(id),
    repo.repairsOf(id),
    repo.reportsOf(id),
  ]);
  const clubs = await repo.clubsByIds([...new Set(loans.map((l) => l.clubId))]);
  const clubBy = new Map(clubs.map((c) => [c.id, c]));
  const canManage = Boolean(
    await repo.findManagedItem(filterFor(actor, 'equipment:manage'), id),
  );
  return {
    ...row,
    loans: loans.map((l) => ({ ...l, club: clubSummary(clubBy.get(l.clubId)) })),
    repairs,
    reports,
    canManage,
  };
}

export async function createEquipment(actor, scope, input, { requestId }) {
  checkRegion(actor, scope, input.region);
  const item = {
    id: randomUUID(),
    assetTag: await repo.nextAssetTag(),
    serialNumber: null,
    contents: null,
    notes: null,
    ...input,
    clubId: null,
    ...stampNew(actor),
  };
  await repo.insertItem(item, ERROR_MESSAGES.duplicateSerial);
  await recordAudit({
    actor,
    action: 'equipment.create',
    entityType: 'equipment',
    entityId: item.id,
    after: { assetTag: item.assetTag, name: item.name, type: item.type, condition: item.condition },
    region: item.region,
    requestId,
  });
  return getEquipment(actor, scope, item.id);
}

export async function updateEquipment(actor, scope, id, changes, { requestId }) {
  const before = await findManagedItem(actor, scope, id);
  if (changes.region && changes.region !== before.region) {
    checkRegion(actor, scope, changes.region);
    // An item changes store only when it is back from its club.
    if (before.clubId) throw conflict(ERROR_MESSAGES.equipmentOnLoan);
  }
  await repo.updateItem(id, { ...changes, ...stampChange(actor) }, ERROR_MESSAGES.duplicateSerial);
  await recordAudit({
    actor,
    action: 'equipment.update',
    entityType: 'equipment',
    entityId: id,
    before,
    after: changes,
    region: changes.region ?? before.region,
    requestId,
  });
  return getEquipment(actor, scope, id);
}

/** Lends an item from the store to a club in the user's scope (US-26). */
export async function lendEquipment(actor, scope, id, input, { requestId }) {
  const item = await findManagedItem(actor, scope, id);
  if (item.clubId) throw conflict(ERROR_MESSAGES.equipmentOnLoan);
  if (!LENDABLE_CONDITIONS.includes(item.condition)) {
    throw conflict(ERROR_MESSAGES.equipmentNotLendable);
  }
  const club = await repo.findClubInScope(scopeFilter(actor, scope), input.clubId);
  if (!club) throw notFound(ERROR_MESSAGES.clubNotFound);
  if (club.status !== 'active') throw badRequest(ERROR_MESSAGES.clubInactive);
  const loan = {
    id: randomUUID(),
    itemId: id,
    clubId: club.id,
    region: club.region,
    outDate: input.outDate,
    dueDate: input.dueDate ?? null,
    returnedDate: null,
    conditionOut: item.condition,
    conditionReturned: null,
    note: input.note ?? null,
    outBy: actor.id,
    outByName: actor.fullName,
    returnedBy: null,
    returnedByName: null,
    open: true,
  };
  await repo.insertLoan(loan, ERROR_MESSAGES.equipmentOnLoan);
  await repo.updateItem(id, { clubId: club.id, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'equipment.lend',
    entityType: 'equipment',
    entityId: id,
    before: { clubId: null },
    after: { clubId: club.id, dueDate: loan.dueDate },
    region: item.region,
    requestId,
  });
  return getEquipment(actor, scope, id);
}

/** Records the item coming back to the store, and its condition. */
export async function returnEquipment(actor, scope, id, input, { requestId }) {
  const item = await findManagedItem(actor, scope, id);
  const [loan] = await repo.openLoans([id]);
  if (!loan) throw conflict(ERROR_MESSAGES.equipmentNotOnLoan);
  if (input.returnedDate < loan.outDate) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.returnedDate', message: 'The item cannot come back before it went out' },
    ]);
  }
  const closed = await repo.closeLoan(loan.id, {
    returnedDate: input.returnedDate,
    conditionReturned: input.condition,
    note: input.note ?? loan.note,
    returnedBy: actor.id,
    returnedByName: actor.fullName,
  });
  if (!closed) throw conflict(ERROR_MESSAGES.equipmentNotOnLoan);
  await repo.updateItem(id, { clubId: null, condition: input.condition, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'equipment.return',
    entityType: 'equipment',
    entityId: id,
    before: { clubId: item.clubId, condition: item.condition },
    after: { clubId: null, condition: input.condition },
    region: item.region,
    requestId,
  });
  return getEquipment(actor, scope, id);
}

export async function addRepair(actor, scope, id, input, { requestId }) {
  const item = await findManagedItem(actor, scope, id);
  const repair = {
    id: randomUUID(),
    itemId: id,
    region: item.region,
    action: null,
    cost: null,
    ...input,
    ...stampNew(actor),
  };
  await repo.insertRepair(repair);
  await repo.updateItem(id, { condition: input.conditionAfter, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'equipment.repair',
    entityType: 'equipment',
    entityId: id,
    before: { condition: item.condition },
    after: { condition: input.conditionAfter, problem: input.problem },
    region: item.region,
    requestId,
  });
  return getEquipment(actor, scope, id);
}

/**
 * A champion (or anyone who can see the item) reports it as needing repair, damaged or lost
 * (US-27). From a device, `recordedAt` is when it was reported offline.
 */
export async function reportEquipment(actor, _scope, id, input, { requestId, recordedAt }) {
  const item = await findItem(actor, id);
  const date = (recordedAt ?? new Date()).toISOString().slice(0, 10);
  await repo.insertReport({
    id: randomUUID(),
    itemId: id,
    clubId: item.clubId,
    region: item.region,
    condition: input.condition,
    note: input.note,
    date,
    reportedBy: actor.id,
    reportedByName: actor.fullName,
  });
  if (item.condition !== 'retired') {
    await repo.updateItem(id, { condition: input.condition, ...stampChange(actor) });
  }
  await recordAudit({
    actor,
    action: 'equipment.report',
    entityType: 'equipment',
    entityId: id,
    before: { condition: item.condition },
    after: { condition: input.condition },
    region: item.region,
    requestId,
  });
  return getEquipment(actor, _scope, id);
}
