import { Club, ClubChampion, School } from '../../db/models.js';
import { clubScopeQuery, schoolScopeQuery } from '../../db/scopeQueries.js';

const countBy = async (match, field) => {
  const rows = await Club.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
};

/**
 * Counts inside a scope filter:
 * { activeClubs, schools, champions, clubsByRegion: { region: n }, clubsByTrack: { track: n } }
 */
export async function summaryCounts(scopeFilter) {
  const clubScope = await clubScopeQuery(scopeFilter);
  const active = { $and: [clubScope, { status: 'active' }] };
  const scopedClubIds = await Club.distinct('_id', clubScope);
  const [activeClubs, schools, champions, clubsByRegion, clubsByTrack] = await Promise.all([
    Club.countDocuments(active),
    School.countDocuments({ $and: [await schoolScopeQuery(scopeFilter), { status: 'active' }] }),
    ClubChampion.distinct('userId', { clubId: { $in: scopedClubIds }, endDate: null }),
    countBy(active, 'region'),
    countBy(active, 'mainTrack'),
  ]);
  return { activeClubs, schools, champions: champions.length, clubsByRegion, clubsByTrack };
}
