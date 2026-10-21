import { databasePending } from '../../db/index.js';

/** Only this file talks to the database for clubs and champion assignments (D1-16). Engine pending (D1-8). */

export async function listClubs(_scopeFilter, _query) {
  throw databasePending();
}

/** Returns the club only if it is inside the scope filter, otherwise null. */
export async function findClubInScope(_id, _scopeFilter) {
  throw databasePending();
}

/** Next readable code for a region, e.g. NAC-014. Must be atomic in the chosen database. */
export async function nextClubCode(_regionPrefix) {
  throw databasePending();
}

export async function insertClub(_club) {
  throw databasePending();
}

export async function updateClubById(_id, _changes) {
  throw databasePending();
}

export async function upsertChampionAssignment(_assignment) {
  throw databasePending();
}

export async function endChampionAssignment(_clubId, _userId, _endDate) {
  throw databasePending();
}
