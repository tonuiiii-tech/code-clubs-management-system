import { randomUUID } from 'node:crypto';
import { Consent, Counter, Learner, LearnerContact } from '../../db/models.js';
import {
  insertUnique,
  paginate,
  textSearch,
  toDocument,
  toRecord,
  updateUnique,
} from '../../db/records.js';
import { clubRecordScopeQuery } from '../../db/scopeQueries.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

/** Only this file talks to the database for learners, guardian contacts and consent (D1-16). */

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactly = (text) => new RegExp(`^${escape(text)}$`, 'i');

export async function listLearners(scopeFilter, query) {
  const filter = {
    $and: [
      await clubRecordScopeQuery(scopeFilter),
      query.clubId ? { clubId: query.clubId } : {},
      query.status ? { status: query.status } : {},
      textSearch(query.q, ['firstName', 'lastName', 'learnerNumber', 'admissionNumber']),
    ],
  };
  return paginate(Learner, filter, query, { lastName: 1, firstName: 1 });
}

/** Returns the learner only if it is inside the scope filter, otherwise null. */
export async function findLearnerInScope(id, scopeFilter) {
  return toRecord(
    await Learner.findOne({ $and: [{ _id: id }, await clubRecordScopeQuery(scopeFilter)] }).lean(),
  );
}

export async function activeLearnersInClub(clubId) {
  const docs = await Learner.find({ clubId, status: 'active' })
    .sort({ lastName: 1, firstName: 1 })
    .lean();
  return docs.map(toRecord);
}

export async function countActiveLearners(clubId) {
  return Learner.countDocuments({ clubId, status: 'active' });
}

/** Same first and last name (any case) and year of birth in the same club (US-07). */
export async function findPossibleDuplicate({ clubId, firstName, lastName, birthYear }) {
  return toRecord(
    await Learner.findOne({
      clubId,
      birthYear,
      firstName: exactly(firstName),
      lastName: exactly(lastName),
    }).lean(),
  );
}

/** Next learner number in a club, e.g. NAC-004-012. */
export async function nextLearnerNumber(clubCode) {
  const counter = await Counter.findByIdAndUpdate(
    `learner:${clubCode}`,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  ).lean();
  return `${clubCode}-${String(counter.seq).padStart(3, '0')}`;
}

export async function insertLearner(learner) {
  return insertUnique(Learner, learner, ERROR_MESSAGES.duplicateAdmissionNumber);
}

export async function updateLearnerById(id, changes) {
  return updateUnique(Learner, id, changes, ERROR_MESSAGES.duplicateAdmissionNumber);
}

export async function findContact(learnerId) {
  const doc = await LearnerContact.findOne({ learnerId }).lean();
  if (!doc) return null;
  const { _id, learnerId: _l, createdBy: _c, updatedBy: _u, ...contact } = doc;
  return contact;
}

export async function hasContact(learnerId) {
  return (await LearnerContact.countDocuments({ learnerId })) > 0;
}

/** Enters or replaces the guardian contact. */
export async function replaceContact(learnerId, contact, actorId) {
  const { altPhone, ...required } = contact;
  await LearnerContact.findOneAndUpdate(
    { learnerId },
    {
      $set: { ...required, ...(altPhone && { altPhone }), updatedBy: actorId },
      ...(!altPhone && { $unset: { altPhone: 1 } }),
      $setOnInsert: { _id: randomUUID(), createdBy: actorId },
    },
    { upsert: true },
  );
}

/** Consents for several learners: { learnerId: { participation: {...}, photo: {...} } }. */
export async function consentsByLearner(learnerIds) {
  const docs = await Consent.find({ learnerId: { $in: learnerIds } }).lean();
  const result = {};
  for (const { learnerId, type, status, signedOn, fileId } of docs) {
    result[learnerId] ??= {};
    result[learnerId][type] = { status, signedOn: signedOn ?? null, hasFile: Boolean(fileId) };
  }
  return result;
}

export async function findConsent(learnerId, type) {
  return toRecord(await Consent.findOne({ learnerId, type }).lean());
}

/** Creates or changes the consent record for one learner and type. */
export async function upsertConsent(learner, type, changes, actorId) {
  const doc = await Consent.findOneAndUpdate(
    { learnerId: learner.id, type },
    {
      $set: { ...changes, updatedBy: actorId },
      $setOnInsert: toDocument({
        id: randomUUID(),
        clubId: learner.clubId,
        region: learner.region,
        createdBy: actorId,
        ...(changes.status ? {} : { status: 'pending' }),
      }),
    },
    { returnDocument: 'after', upsert: true },
  ).lean();
  return toRecord(doc);
}

/** Learner ids, from the given ones, that do not have photo consent given. */
export async function withoutPhotoConsent(learnerIds) {
  const given = await Consent.distinct('learnerId', {
    learnerId: { $in: learnerIds },
    type: 'photo',
    status: 'given',
  });
  const set = new Set(given);
  return learnerIds.filter((id) => !set.has(id));
}
