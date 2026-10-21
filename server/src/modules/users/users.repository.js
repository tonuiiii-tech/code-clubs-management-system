import { databasePending } from '../../db/index.js';

/** Only this file talks to the database for users (D1-16). Engine pending (D1-8). */

export async function findUserById(_id) {
  throw databasePending();
}

export async function findUserByEmail(_email) {
  throw databasePending();
}

/**
 * Returns the user only if inside the scope filter, otherwise null.
 * { regions }: users sharing a region, champions of clubs in those regions, and champions with
 * no current club (so a coordinator can assign them). The client mock API applies the same rule.
 */
export async function findUserInScope(_id, _scopeFilter) {
  throw databasePending();
}

/** Same scope rule as findUserInScope; query: { role, status, q, page, pageSize }. */
export async function listUsers(_scopeFilter, _query) {
  throw databasePending();
}

export async function insertUser(_user) {
  throw databasePending();
}

export async function updateUserById(_id, _changes) {
  throw databasePending();
}
