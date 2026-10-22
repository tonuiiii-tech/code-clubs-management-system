import { School } from '../../db/models.js';
import { insertUnique, paginate, textSearch, toRecord, updateUnique } from '../../db/records.js';
import { schoolScopeQuery } from '../../db/scopeQueries.js';

/** Only this file talks to the database for schools (D1-16). */

const caseInsensitive = { locale: 'en', strength: 2 };
const DUPLICATE = 'A school with this name already exists in this sub-county';

export async function listSchools(scopeFilter, query) {
  const filter = {
    $and: [
      await schoolScopeQuery(scopeFilter),
      ...['region', 'county', 'type', 'status'].map((key) =>
        query[key] ? { [key]: query[key] } : {},
      ),
      textSearch(query.q, ['name', 'subCounty', 'ward']),
    ],
  };
  return paginate(School, filter, query, { name: 1 });
}

/** Returns the school only if it is inside the scope filter, otherwise null. */
export async function findSchoolInScope(id, scopeFilter) {
  return toRecord(
    await School.findOne({ $and: [{ _id: id }, await schoolScopeQuery(scopeFilter)] }).lean(),
  );
}

/** Duplicate check: same name (case-insensitive), county and sub-county (R1-11). */
export async function findDuplicateSchool(name, county, subCounty) {
  return toRecord(
    await School.findOne({ name, county, subCounty }).collation(caseInsensitive).lean(),
  );
}

export async function insertSchool(school) {
  return insertUnique(School, school, DUPLICATE);
}

export async function updateSchoolById(id, changes) {
  return updateUnique(School, id, changes, DUPLICATE);
}
