import { databasePending } from '../../db/index.js';

/** Only this file talks to the database for users (D1-16). Engine pending (D1-8). */

export async function findUserById(_id) {
  throw databasePending();
}

export async function findUserByEmail(_email) {
  throw databasePending();
}

export async function listUsers(_scopeFilter, _query) {
  throw databasePending();
}

export async function insertUser(_user) {
  throw databasePending();
}

export async function updateUserById(_id, _changes) {
  throw databasePending();
}
