import { databasePending } from '../../db/index.js';

/** Only this file talks to the database for schools (D1-16). Engine pending (D1-8). */

export async function listSchools(_scopeFilter, _query) {
  throw databasePending();
}

/** Returns the school only if it is inside the scope filter, otherwise null. */
export async function findSchoolInScope(_id, _scopeFilter) {
  throw databasePending();
}

/** Duplicate check: same name (case-insensitive), county and sub-county (R1-11). */
export async function findDuplicateSchool(_name, _county, _subCounty) {
  throw databasePending();
}

export async function insertSchool(_school) {
  throw databasePending();
}

export async function updateSchoolById(_id, _changes) {
  throw databasePending();
}
