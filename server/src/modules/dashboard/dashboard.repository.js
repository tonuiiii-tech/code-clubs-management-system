import {
  Attendance,
  Club,
  ClubChampion,
  Consent,
  Learner,
  School,
  Session,
} from '../../db/models.js';
import { clubRecordScopeQuery, clubScopeQuery, schoolScopeQuery } from '../../db/scopeQueries.js';

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
  return {
    activeClubs,
    schools,
    champions: champions.length,
    clubsByRegion,
    clubsByTrack,
    ...(await learnerAndSessionCounts(scopeFilter)),
  };
}

/**
 * Sprint 2 counts (US-12). Gender appears only as totals (D2-9). "This month" is the calendar
 * month so far; the attendance rate counts late as present.
 */
async function learnerAndSessionCounts(scopeFilter, now = new Date()) {
  const scope = await clubRecordScopeQuery(scopeFilter);
  const monthStart = `${now.toISOString().slice(0, 7)}-01`;
  const activeLearners = { $and: [scope, { status: 'active' }] };
  const thisMonth = { $and: [scope, { date: { $gte: monthStart } }] };
  const activeIds = await Learner.distinct('_id', activeLearners);
  const [learners, byGender, sessionsThisMonth, attendance, withConsent] = await Promise.all([
    Learner.countDocuments(activeLearners),
    Learner.aggregate([{ $match: activeLearners }, { $group: { _id: '$gender', n: { $sum: 1 } } }]),
    Session.countDocuments({ $and: [thisMonth, { status: 'held' }] }),
    Attendance.aggregate([
      { $match: thisMonth },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
        },
      },
    ]),
    Consent.distinct('learnerId', {
      learnerId: { $in: activeIds },
      type: 'participation',
      status: 'given',
    }),
  ]);
  const [{ total = 0, present = 0 } = {}] = attendance;
  return {
    learners,
    learnersByGender: Object.fromEntries(byGender.map((r) => [r._id, r.n])),
    sessionsThisMonth,
    attendanceRate: total ? Math.round((present / total) * 100) : null,
    learnersMissingConsent: learners - withConsent.length,
  };
}
