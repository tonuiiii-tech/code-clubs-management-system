import { randomUUID } from 'node:crypto';
import { Attendance, Learner, Session } from '../../db/models.js';
import { insertUnique, paginate, toRecord, updateUnique } from '../../db/records.js';
import { clubRecordScopeQuery } from '../../db/scopeQueries.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

/** Only this file talks to the database for sessions and attendance (D1-16). */

export async function listSessions(scopeFilter, query) {
  const filter = {
    $and: [
      await clubRecordScopeQuery(scopeFilter),
      query.clubId ? { clubId: query.clubId } : {},
      query.status ? { status: query.status } : {},
      query.from ? { date: { $gte: query.from } } : {},
      query.to ? { date: { $lte: query.to } } : {},
    ],
  };
  const result = await paginate(Session, filter, query, { date: -1 });
  const counts = await attendanceCounts(result.data.map((s) => s.id));
  return {
    ...result,
    data: result.data.map((s) => ({ ...s, attendance: counts[s.id] ?? { present: 0, total: 0 } })),
  };
}

/** { sessionId: { present, total } }, where late counts as present. */
async function attendanceCounts(sessionIds) {
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
  return Object.fromEntries(rows.map((r) => [r._id, { present: r.present, total: r.total }]));
}

/** Returns the session only if it is inside the scope filter, otherwise null. */
export async function findSessionInScope(id, scopeFilter) {
  return toRecord(
    await Session.findOne({ $and: [{ _id: id }, await clubRecordScopeQuery(scopeFilter)] }).lean(),
  );
}

export async function insertSession(session) {
  return insertUnique(Session, session, ERROR_MESSAGES.duplicateSession);
}

export async function updateSessionById(id, changes) {
  return updateUnique(Session, id, changes, ERROR_MESSAGES.duplicateSession);
}

/** Attendance for a session with each learner's name and number. */
export async function attendanceForSession(sessionId) {
  const records = await Attendance.find({ sessionId }).lean();
  const learners = await Learner.find({ _id: { $in: records.map((r) => r.learnerId) } })
    .select('firstName lastName learnerNumber')
    .lean();
  const byId = new Map(learners.map((l) => [l._id, l]));
  return records
    .map(({ learnerId, status }) => {
      const { firstName = '', lastName = '', learnerNumber = '' } = byId.get(learnerId) ?? {};
      return { learnerId, status, firstName, lastName, learnerNumber };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

/** Ids, from the given ones, of learners that belong to the club. */
export async function learnerIdsInClub(clubId, learnerIds) {
  return Learner.distinct('_id', { _id: { $in: learnerIds }, clubId });
}

/** Saves the whole list at once: one record per learner (D2-4); learners left out are removed. */
export async function replaceAttendance(session, records, actorId) {
  const now = new Date();
  await Attendance.bulkWrite([
    ...records.map(({ learnerId, status }) => ({
      updateOne: {
        filter: { sessionId: session.id, learnerId },
        update: {
          $set: { status, updatedBy: actorId, updatedAt: now },
          $setOnInsert: {
            _id: randomUUID(),
            clubId: session.clubId,
            region: session.region,
            date: session.date,
            createdBy: actorId,
            createdAt: now,
          },
        },
        upsert: true,
      },
    })),
    {
      deleteMany: {
        filter: { sessionId: session.id, learnerId: { $nin: records.map((r) => r.learnerId) } },
      },
    },
  ]);
}

/** Keeps attendance dates in step when a session's date changes. */
export async function moveAttendanceDate(sessionId, date) {
  await Attendance.updateMany({ sessionId }, { $set: { date } });
}

/** Learner ids marked present or late in a session. */
export async function presentLearnerIds(sessionId) {
  return Attendance.distinct('learnerId', { sessionId, status: { $in: ['present', 'late'] } });
}

export async function learnerNames(ids) {
  const docs = await Learner.find({ _id: { $in: ids } })
    .select('firstName lastName')
    .lean();
  return docs.map((l) => ({ learnerId: l._id, name: `${l.firstName} ${l.lastName}` }));
}
