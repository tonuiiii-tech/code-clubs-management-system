import { ClubChampion, User } from '../../db/models.js';
import { insertUnique, paginate, textSearch, toRecord, updateUnique } from '../../db/records.js';
import { userScopeQuery } from '../../db/scopeQueries.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

/** Only this file talks to the database for users (D1-16). */

export async function findUserById(id) {
  return toRecord(await User.findById(id).lean());
}

export async function findUserByEmail(email) {
  return toRecord(await User.findOne({ email: email.toLowerCase() }).lean());
}

/**
 * Returns the user only if inside the scope filter, otherwise null.
 * { regions }: users sharing a region, champions of clubs in those regions, and champions with
 * no current club (so a coordinator can assign them). The client mock API applies the same rule.
 */
export async function findUserInScope(id, scopeFilter) {
  return toRecord(
    await User.findOne({ $and: [{ _id: id }, await userScopeQuery(scopeFilter)] }).lean(),
  );
}

/** Same scope rule as findUserInScope; query: { role, status, q, page, pageSize }. */
export async function listUsers(scopeFilter, query) {
  const filter = {
    $and: [
      await userScopeQuery(scopeFilter),
      query.role ? { role: query.role } : {},
      query.status ? { status: query.status } : {},
      textSearch(query.q, ['fullName', 'email']),
      query.withoutClub
        ? { _id: { $nin: await ClubChampion.distinct('userId', { endDate: null }) } }
        : {},
    ],
  };
  return paginate(User, filter, query, { fullName: 1 });
}

export async function insertUser(user) {
  return insertUnique(User, user, ERROR_MESSAGES.duplicateEmail);
}

export async function updateUserById(id, changes) {
  return updateUnique(User, id, changes, ERROR_MESSAGES.duplicateEmail);
}
