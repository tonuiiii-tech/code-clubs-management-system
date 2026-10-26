import {
  AlertDismissal,
  Assessment,
  AssessmentScore,
  Attendance,
  Club,
  Consent,
  Event,
  EventConsent,
  EquipmentItem,
  EquipmentLoan,
  EquipmentReport,
  EventParticipant,
  Learner,
  LearnerProject,
  Session,
} from '../../db/models.js';
import { toRecord } from '../../db/records.js';
import {
  clubScopeQuery,
  equipmentScopeQuery,
  eventScopeQuery,
} from '../../db/scopeQueries.js';

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

// Sprint 5: equipment, projects and assessments.

/** Items in scope, limited like the clubs: a region's store or the chosen club's items. */
export async function equipmentRows(scopeFilter, { region, clubId } = {}) {
  const docs = await EquipmentItem.find({
    $and: [
      await equipmentScopeQuery(scopeFilter),
      region ? { region } : {},
      clubId ? { clubId } : {},
    ],
  })
    .select('region clubId condition type')
    .lean();
  return docs.map(toRecord);
}

export async function openLoanRows(clubIds) {
  const docs = await EquipmentLoan.find({ clubId: { $in: clubIds }, open: true })
    .select('itemId clubId dueDate')
    .lean();
  return docs.map(toRecord);
}

export async function equipmentReportRows(clubIds, since) {
  const docs = await EquipmentReport.find({ clubId: { $in: clubIds }, date: { $gte: since } })
    .select('itemId clubId condition date')
    .lean();
  return docs.map(toRecord);
}

const dateRange = (from, to) =>
  from || to ? { date: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {};

export async function projectRows(clubIds, { from, to } = {}) {
  const docs = await LearnerProject.find({ clubId: { $in: clubIds }, ...dateRange(from, to) })
    .select('clubId track date')
    .lean();
  return docs.map(toRecord);
}

export async function assessmentRows(clubIds, { from, to } = {}) {
  const docs = await Assessment.find({ clubId: { $in: clubIds }, ...dateRange(from, to) })
    .select('clubId track date maxScore')
    .lean();
  return docs.map(toRecord);
}

export async function assessmentScoreRows(assessmentIds) {
  const docs = await AssessmentScore.find({ assessmentId: { $in: assessmentIds } })
    .select('assessmentId score')
    .lean();
  return docs.map(toRecord);
}

/** Alerts this person hid, until their time is up (R4-4). */
export async function dismissedKeys(userId, now = new Date()) {
  return AlertDismissal.distinct('key', { userId, until: { $gt: now } });
}

export async function dismissAlert(userId, key, until) {
  await AlertDismissal.updateOne(
    { _id: `${userId}:${key}` },
    { $set: { userId, key, until } },
    { upsert: true },
  );
}
