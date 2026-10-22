import { ROLES } from '@code-clubs/shared/enums';
import { Club, ClubChampion } from './models.js';

/**
 * Turns the engine-neutral scope filter from modules/scope.js into MongoDB queries (D1-4).
 * The same rules are applied by the demo mock API (client/src/services/mock/mockApi.js).
 * A filter that matches nothing returns { _id: null }, so the result is empty, never "everything".
 */
const NOTHING = { _id: null };

/** Club IDs a champion currently runs. */
export async function championClubIds(userId) {
  return ClubChampion.distinct('clubId', { userId, endDate: null });
}

export async function clubScopeQuery(filter) {
  if (filter.all) return {};
  if (filter.regions) return { region: { $in: filter.regions } };
  if (filter.championUserId) return { _id: { $in: await championClubIds(filter.championUserId) } };
  return NOTHING;
}

export async function schoolScopeQuery(filter) {
  if (filter.all) return {};
  if (filter.regions) return { region: { $in: filter.regions } };
  if (filter.championUserId) {
    const clubIds = await championClubIds(filter.championUserId);
    return { _id: { $in: await Club.distinct('schoolId', { _id: { $in: clubIds } }) } };
  }
  return NOTHING;
}

/**
 * Coordinators see people in their regions, champions of their region's clubs, and champions
 * with no current club (so they can assign them). Champions see only themselves.
 */
export async function userScopeQuery(filter) {
  if (filter.all) return {};
  if (filter.userId) return { _id: filter.userId };
  if (filter.regions) {
    const regionClubIds = await Club.distinct('_id', { region: { $in: filter.regions } });
    const [inRegionClubs, withAnyClub] = await Promise.all([
      ClubChampion.distinct('userId', { clubId: { $in: regionClubIds }, endDate: null }),
      ClubChampion.distinct('userId', { endDate: null }),
    ]);
    return {
      $or: [
        { regions: { $in: filter.regions } },
        { _id: { $in: inRegionClubs } },
        { role: ROLES.CHAMPION, _id: { $nin: withAnyClub } },
      ],
    };
  }
  return NOTHING;
}

/** Audit entries carry the region of the school or club they are about. */
export function auditScopeQuery(filter) {
  if (filter.all) return {};
  if (filter.regions) return { region: { $in: filter.regions } };
  if (filter.userId) return { actorId: filter.userId };
  return NOTHING;
}
