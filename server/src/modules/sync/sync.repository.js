import { randomUUID } from 'node:crypto';
import {
  Announcement,
  AnnouncementRead,
  Attendance,
  Club,
  Consent,
  Event,
  EventConsent,
  EventParticipant,
  Learner,
  LearnerContact,
  School,
  Session,
  SyncConflict,
  SyncOperation,
  Tombstone,
} from '../../db/models.js';
import { paginate, toRecord } from '../../db/records.js';
import {
  clubRecordScopeQuery,
  clubScopeQuery,
  eventScopeQuery,
  schoolScopeQuery,
} from '../../db/scopeQueries.js';

/** Only this file talks to the database for sync (D1-16). */

// ---------------------------------------------------------------------------
// Push: one stored result per operation (D3-3).

/**
 * Claims an operation id for this user. Returns null when it is new (the caller runs it), or the
 * stored record when it has been seen before.
 */
export async function claimOperation(opId, userId, type) {
  try {
    await SyncOperation.create({ _id: opId, userId, type });
    return null;
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return SyncOperation.findById(opId).lean();
  }
}

export async function finishOperation(opId, result) {
  await SyncOperation.updateOne({ _id: opId }, { $set: { state: 'done', result } });
}

/** Lets a failed run be tried again with the same id. */
export async function releaseOperation(opId) {
  await SyncOperation.deleteOne({ _id: opId, state: 'running' });
}

export async function insertConflicts(conflicts) {
  if (conflicts.length) {
    await SyncConflict.insertMany(conflicts.map((c) => ({ _id: randomUUID(), ...c })));
  }
}

export async function listConflicts(scopeFilter, query) {
  return paginate(SyncConflict, await clubRecordScopeQuery(scopeFilter), query, { at: -1 });
}

// ---------------------------------------------------------------------------
// Pull: records changed after a cursor, in (updatedAt, _id) order (docs/sync-protocol.md §4).

/** Ids of the clubs in scope, sorted; their hash tells a device its scope changed. */
export async function clubIdsInScope(scopeFilter) {
  const ids = await Club.distinct('_id', await clubScopeQuery(scopeFilter));
  return ids.sort();
}

/** `after` is { at: Date, id: string, inclusive?: boolean } or null for "from the start". */
function changedAfter(after) {
  if (!after) return {};
  if (after.inclusive) return { updatedAt: { $gte: after.at } };
  return {
    $or: [{ updatedAt: { $gt: after.at } }, { updatedAt: after.at, _id: { $gt: after.id } }],
  };
}

async function changes(model, scopeQuery, after, limit, extra = {}) {
  const docs = await model
    .find({ $and: [scopeQuery, changedAfter(after), extra] })
    .sort({ updatedAt: 1, _id: 1 })
    .limit(limit)
    .lean();
  return docs.map(toRecord);
}

export async function changedSchools(scopeFilter, after, limit) {
  return changes(School, await schoolScopeQuery(scopeFilter), after, limit);
}

export async function changedClubs(scopeFilter, after, limit) {
  return changes(Club, await clubScopeQuery(scopeFilter), after, limit);
}

export async function changedLearners(scopeFilter, after, limit) {
  return changes(Learner, await clubRecordScopeQuery(scopeFilter), after, limit);
}

export async function changedConsents(scopeFilter, after, limit) {
  return changes(Consent, await clubRecordScopeQuery(scopeFilter), after, limit);
}

export async function changedSessions(scopeFilter, after, limit, fromDate) {
  return changes(Session, await clubRecordScopeQuery(scopeFilter), after, limit, {
    date: { $gte: fromDate },
  });
}

export async function changedAttendance(scopeFilter, after, limit, fromDate) {
  return changes(Attendance, await clubRecordScopeQuery(scopeFilter), after, limit, {
    date: { $gte: fromDate },
  });
}

// Sprint 4: events and announcements are read-only on a device (D4-8).
export async function changedEvents(scopeFilter, after, limit, fromDate) {
  return changes(Event, await eventScopeQuery(scopeFilter), after, limit, {
    endDate: { $gte: fromDate },
  });
}

export async function changedEventParticipants(scopeFilter, after, limit) {
  return changes(EventParticipant, await clubRecordScopeQuery(scopeFilter), after, limit);
}

export async function changedEventConsents(scopeFilter, after, limit) {
  return changes(EventConsent, await clubRecordScopeQuery(scopeFilter), after, limit);
}

export async function changedAnnouncements(userId, after, limit) {
  return changes(Announcement, { recipientIds: userId }, after, limit);
}

export async function changedAnnouncementReads(userId, after, limit) {
  return changes(AnnouncementRead, { userId }, after, limit);
}

export async function deletedRecords(scopeFilter, after, limit) {
  return changes(Tombstone, await clubRecordScopeQuery(scopeFilter), after, limit);
}

/** Which of these learners have a guardian contact on file (never the contact itself). */
export async function learnerIdsWithContact(learnerIds) {
  return new Set(await LearnerContact.distinct('learnerId', { learnerId: { $in: learnerIds } }));
}
