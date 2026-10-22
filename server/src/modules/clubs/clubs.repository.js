import { randomUUID } from 'node:crypto';
import { Club, ClubChampion, Counter, User } from '../../db/models.js';
import { insertUnique, paginate, textSearch, toDocument, toRecord } from '../../db/records.js';
import { clubScopeQuery } from '../../db/scopeQueries.js';

/** Only this file talks to the database for clubs and champion assignments (D1-16). */

export async function listClubs(scopeFilter, query) {
  const filter = {
    $and: [
      await clubScopeQuery(scopeFilter),
      query.region ? { region: query.region } : {},
      query.schoolId ? { schoolId: query.schoolId } : {},
      query.status ? { status: query.status } : {},
      query.track ? { mainTrack: query.track } : {},
      textSearch(query.q, ['name', 'code']),
    ],
  };
  return paginate(Club, filter, query, { code: 1 });
}

/** Returns the club only if it is inside the scope filter, otherwise null. */
export async function findClubInScope(id, scopeFilter) {
  return toRecord(
    await Club.findOne({ $and: [{ _id: id }, await clubScopeQuery(scopeFilter)] }).lean(),
  );
}

/** Next readable code for a region, e.g. NAC-014. `$inc` is atomic, so two saves never share a code. */
export async function nextClubCode(regionPrefix) {
  const counter = await Counter.findByIdAndUpdate(
    regionPrefix,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  ).lean();
  return `${regionPrefix}-${String(counter.seq).padStart(3, '0')}`;
}

export async function insertClub(club) {
  return insertUnique(Club, club, 'A club with this code already exists');
}

export async function updateClubById(id, changes) {
  return toRecord(
    await Club.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' }).lean(),
  );
}

/** Current (not ended) assignments for a club, with the champion's name. */
export async function listClubChampions(clubId) {
  const assignments = await ClubChampion.find({ clubId, endDate: null }).sort({ role: 1 }).lean();
  const users = await User.find({ _id: { $in: assignments.map((a) => a.userId) } })
    .select('fullName')
    .lean();
  const names = new Map(users.map((u) => [u._id, u.fullName]));
  return assignments.map(({ _id, ...a }) => ({ ...a, fullName: names.get(a.userId) ?? '' }));
}

/** Creates the assignment, or changes the role of the current one. */
export async function upsertChampionAssignment({ clubId, userId, role, startDate }) {
  const doc = await ClubChampion.findOneAndUpdate(
    { clubId, userId, endDate: null },
    { $set: { role }, $setOnInsert: toDocument({ id: randomUUID(), startDate }) },
    { returnDocument: 'after', upsert: true },
  ).lean();
  const { _id, ...assignment } = doc;
  return assignment;
}

/** Ending keeps the record as history (D1-15). */
export async function endChampionAssignment(clubId, userId, endDate) {
  await ClubChampion.updateMany({ clubId, userId, endDate: null }, { $set: { endDate } });
}
