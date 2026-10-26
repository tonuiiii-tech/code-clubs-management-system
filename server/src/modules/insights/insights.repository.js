import {
  Attendance,
  Club,
  Consent,
  Event,
  EventConsent,
  EventParticipant,
  Learner,
  Session,
} from '../../db/models.js';
import { toRecord } from '../../db/records.js';
import { clubScopeQuery, eventScopeQuery } from '../../db/scopeQueries.js';

/**
 * Plain rows in a user's scope for the HQ dashboard, alerts and termly report. The numbers are
 * computed from them in shared/src/insights.js, which the demo mock API uses too.
 */

const clubFields = 'code name region mainTrack status capacity';

/** Clubs in scope, optionally limited to a region or one club. */
export async function clubRows(scopeFilter, { region, clubId } = {}) {
  const docs = await Club.find({
    $and: [
      await clubScopeQuery(scopeFilter),
      region ? { region } : {},
      clubId ? { _id: clubId } : {},
    ],
  })
    .select(clubFields)
    .lean();
  return docs.map(toRecord);
}

export async function learnerRows(clubIds) {
  const docs = await Learner.find({ clubId: { $in: clubIds } })
    .select('clubId gender birthYear status')
    .lean();
  return docs.map(toRecord);
}

export async function sessionRows(clubIds, { from, to } = {}) {
  const docs = await Session.find({
    clubId: { $in: clubIds },
    ...((from || to) && { date: { ...(from && { $gte: from }), ...(to && { $lte: to }) } }),
  })
    .select('clubId date status')
    .lean();
  return docs.map(toRecord);
}

/** Present (late counts as present) and total marks per session. */
export async function sessionAttendanceRows(sessionIds) {
  const rows = await Attendance.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    {
      $group: {
        _id: '$sessionId',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
      },
    },
  ]);
  return rows.map((r) => ({ sessionId: r._id, present: r.present, total: r.total }));
}

export async function participationConsentGiven(clubIds) {
  return Consent.distinct('learnerId', {
    clubId: { $in: clubIds },
    type: 'participation',
    status: 'given',
  });
}

const eventFields = 'name type startDate endDate venue region status clubIds';

/** Events the scope may see (event:read rules), optionally from a date on. */
export async function eventRows(scopeFilter, { endingFrom, startingTo } = {}) {
  const docs = await Event.find({
    $and: [
      await eventScopeQuery(scopeFilter),
      endingFrom ? { endDate: { $gte: endingFrom } } : {},
      startingTo ? { startDate: { $lte: startingTo } } : {},
    ],
  })
    .select(eventFields)
    .lean();
  return docs.map(toRecord);
}

export async function participantRows(clubIds, eventIds) {
  const docs = await EventParticipant.find({
    clubId: { $in: clubIds },
    ...(eventIds && { eventId: { $in: eventIds } }),
  })
    .select('eventId learnerId clubId status')
    .lean();
  return docs.map(toRecord);
}

export async function eventConsentRows(eventIds) {
  const docs = await EventConsent.find({ eventId: { $in: eventIds } })
    .select('eventId learnerId status')
    .lean();
  return docs.map(toRecord);
}
