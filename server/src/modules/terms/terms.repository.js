import { Term } from '../../db/models.js';
import { insertUnique, toRecord, updateUnique } from '../../db/records.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

/** Only this file talks to the database for terms (D1-16). */

export async function listTerms() {
  const docs = await Term.find().sort({ startDate: -1 }).lean();
  return docs.map(toRecord);
}

export async function findTerm(id) {
  return toRecord(await Term.findById(id).lean());
}

export async function insertTerm(term) {
  return insertUnique(Term, term, ERROR_MESSAGES.duplicateTerm);
}

export async function updateTermById(id, changes) {
  return updateUnique(Term, id, changes, ERROR_MESSAGES.duplicateTerm);
}
