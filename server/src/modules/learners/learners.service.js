import { randomUUID } from 'node:crypto';
import { CONSENT_TYPES } from '@code-clubs/shared/enums';
import { ageFromBirthYear, birthYearFromAge } from '@code-clubs/shared/schemas';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { BUCKETS, deleteFile, readFile, saveFile } from '../../db/files.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { fileExtension } from '../../utils/fileType.js';
import { scopeFilter } from '../scope.js';
import { recordAudit } from '../audit/audit.service.js';
import { getClub } from '../clubs/clubs.service.js';
import * as repo from './learners.repository.js';

/** Today, or the day a change was made on a device that synced it later (docs/sync-protocol.md). */
const today = (recordedAt) => (recordedAt ?? new Date()).toISOString().slice(0, 10);
const PENDING = { status: 'pending', signedOn: null, hasFile: false };

/** Every consent type, with "pending" for any not recorded yet. */
const consentSummary = (recorded = {}) =>
  Object.fromEntries(CONSENT_TYPES.map((type) => [type, recorded[type] ?? PENDING]));

/** The API shape of a learner: the age is worked out from the year of birth (D2-2). */
const present = (learner, consents) => ({
  ...learner,
  age: ageFromBirthYear(learner.birthYear),
  consents: consentSummary(consents),
});

export async function listLearners(actor, scope, query) {
  const result = await repo.listLearners(scopeFilter(actor, scope), query);
  const consents = await repo.consentsByLearner(result.data.map((l) => l.id));
  return { ...result, data: result.data.map((l) => present(l, consents[l.id])) };
}

/** Out-of-scope learners look exactly like missing ones (404). */
export async function findLearner(actor, scope, id) {
  const learner = await repo.findLearnerInScope(id, scopeFilter(actor, scope));
  if (!learner) throw notFound(ERROR_MESSAGES.learnerNotFound);
  return learner;
}

/** A learner with consent status and whether a guardian contact exists, never the contact. */
export async function getLearner(actor, scope, id) {
  const learner = await findLearner(actor, scope, id);
  const [consents, hasContact] = await Promise.all([
    repo.consentsByLearner([id]),
    repo.hasContact(id),
  ]);
  return { ...present(learner, consents[id]), hasContact };
}

/**
 * Registers a learner in a club in scope. Region and school come from the club (D2-6).
 * The guardian contact, if given, is stored apart and not returned (D2-1).
 */
export async function createLearner(actor, scope, input, { requestId, recordedAt }) {
  const { id, contact, confirmDuplicate, clubId, age, ...details } = input;
  const club = await getClub(actor, scope, clubId);
  if (club.status !== 'active') throw badRequest(ERROR_MESSAGES.clubInactive);
  if (club.venueType === 'primary_school' && !details.admissionNumber) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.admissionNumber', message: ERROR_MESSAGES.admissionNumberRequired },
    ]);
  }
  if ((await repo.countActiveLearners(clubId)) >= club.capacity) {
    throw conflict(ERROR_MESSAGES.clubFull);
  }
  if (id && (await repo.learnerExists(id))) throw conflict(ERROR_MESSAGES.duplicateId);
  const birthYear = birthYearFromAge(age);
  if (!confirmDuplicate) {
    const duplicate = await repo.findPossibleDuplicate({ clubId, birthYear, ...details });
    if (duplicate) {
      const err = conflict(ERROR_MESSAGES.duplicateLearner);
      err.code = 'POSSIBLE_DUPLICATE';
      err.details = [{ learnerId: duplicate.id, learnerNumber: duplicate.learnerNumber }];
      throw err;
    }
  }
  const now = new Date();
  const learner = {
    id: id ?? randomUUID(),
    learnerNumber: await repo.nextLearnerNumber(club.code),
    ...details,
    birthYear,
    clubId,
    schoolId: club.schoolId ?? null,
    region: club.region,
    status: 'active',
    joinedAt: today(recordedAt),
    leftAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  };
  await repo.insertLearner(learner);
  await recordAudit({
    actor,
    action: 'learner.create',
    entityType: 'learner',
    entityId: learner.id,
    after: { ...details, birthYear, clubId },
    region: club.region,
    requestId,
  });
  if (contact) await saveContact(actor, learner, contact, { requestId });
  return { ...present(learner), hasContact: Boolean(contact) };
}

export async function updateLearner(actor, scope, id, input, { requestId }) {
  const before = await findLearner(actor, scope, id);
  const { age, ...changes } = input;
  if (age !== undefined) changes.birthYear = birthYearFromAge(age);
  const updated = await repo.updateLearnerById(id, {
    ...changes,
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'learner.update',
    entityType: 'learner',
    entityId: id,
    before,
    after: changes,
    region: before.region,
    requestId,
  });
  return getLearner(actor, scope, updated.id);
}

/** Leaving keeps the learner's attendance history; coming back needs a free place. */
export async function setLearnerStatus(actor, scope, id, { status }, { requestId, recordedAt }) {
  const before = await findLearner(actor, scope, id);
  if (before.status === status) return getLearner(actor, scope, id);
  if (status === 'active') {
    const club = await getClub(actor, scope, before.clubId);
    if ((await repo.countActiveLearners(club.id)) >= club.capacity) {
      throw conflict(ERROR_MESSAGES.clubFull);
    }
  }
  const changes = { status, leftAt: status === 'left' ? today(recordedAt) : null };
  await repo.updateLearnerById(id, { ...changes, updatedAt: new Date(), updatedBy: actor.id });
  await recordAudit({
    actor,
    action: 'learner.status',
    entityType: 'learner',
    entityId: id,
    before,
    after: changes,
    region: before.region,
    requestId,
  });
  return getLearner(actor, scope, id);
}

async function saveContact(actor, learner, contact, { requestId }) {
  const before = (await repo.findContact(learner.id)) ?? {};
  await repo.replaceContact(learner.id, contact, actor.id);
  // Devices learn that a contact is on file from the learner's record (hasContact).
  await repo.updateLearnerById(learner.id, { updatedAt: new Date() });
  await recordAudit({
    actor,
    action: 'learner.contactSet',
    entityType: 'learner',
    entityId: learner.id,
    before,
    after: { altPhone: undefined, ...contact },
    region: learner.region,
    requestId,
  });
}

/** Champions and coordinators can enter a contact but not read it (D2-1). Returns nothing. */
export async function putContact(actor, scope, id, contact, { requestId }) {
  const learner = await findLearner(actor, scope, id);
  await saveContact(actor, learner, contact, { requestId });
}

/** HQ only (or a granted person). Reading a child's guardian contact is audited. */
export async function getContact(actor, scope, id, { requestId }) {
  const learner = await findLearner(actor, scope, id);
  const contact = await repo.findContact(id);
  if (!contact) throw notFound(ERROR_MESSAGES.contactNotFound);
  await recordAudit({
    actor,
    action: 'learner.contactRead',
    entityType: 'learner',
    entityId: id,
    region: learner.region,
    requestId,
  });
  return contact;
}

export async function setConsent(actor, scope, id, type, input, { requestId }) {
  const learner = await findLearner(actor, scope, id);
  const before = (await repo.findConsent(id, type)) ?? {};
  const consent = await repo.upsertConsent(learner, type, input, actor.id);
  await recordAudit({
    actor,
    action: 'learner.consent',
    entityType: 'learner',
    entityId: id,
    before: { [`${type}Consent`]: before.status, signedOn: before.signedOn },
    after: { [`${type}Consent`]: consent.status, signedOn: consent.signedOn },
    region: learner.region,
    requestId,
  });
  return (await getLearner(actor, scope, id)).consents;
}

/** Stores the signed form; a new upload replaces the old file. */
export async function uploadConsentFile(actor, scope, id, type, file, { requestId }) {
  const learner = await findLearner(actor, scope, id);
  const fileId = await saveFile(BUCKETS.consentFiles, file.buffer, {
    contentType: file.type,
    metadata: { learnerId: id, type, uploadedBy: actor.id },
  });
  const before = await repo.findConsent(id, type);
  await repo.upsertConsent(learner, type, { fileId }, actor.id);
  if (before?.fileId) await deleteFile(BUCKETS.consentFiles, before.fileId);
  await recordAudit({
    actor,
    action: 'learner.consentFile',
    entityType: 'learner',
    entityId: id,
    before: { [`${type}ConsentFile`]: before?.fileId ? 'previous file' : null },
    after: { [`${type}ConsentFile`]: file.type },
    region: learner.region,
    requestId,
  });
  return (await getLearner(actor, scope, id)).consents;
}

/** The signed form, for HQ and the region's coordinator. Every download is audited (R2-2). */
export async function downloadConsentFile(actor, scope, id, type, { requestId }) {
  const learner = await findLearner(actor, scope, id);
  const consent = await repo.findConsent(id, type);
  const file = consent?.fileId && (await readFile(BUCKETS.consentFiles, consent.fileId));
  if (!file) throw notFound(ERROR_MESSAGES.consentFileNotFound);
  await recordAudit({
    actor,
    action: 'learner.consentFileRead',
    entityType: 'learner',
    entityId: id,
    region: learner.region,
    requestId,
  });
  return {
    file,
    filename: `consent-${type}-${learner.learnerNumber}.${fileExtension(file.contentType)}`,
  };
}
