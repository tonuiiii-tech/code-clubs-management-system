import { randomUUID } from 'node:crypto';
import { SESSION_EDIT_DAYS, SESSION_MAX_PHOTOS } from '@code-clubs/shared/enums';
import { scopeFor } from '@code-clubs/shared/permissions';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { BUCKETS, deleteFile, readFile, saveFile } from '../../db/files.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { fileExtension } from '../../utils/fileType.js';
import { scopeFilter } from '../scope.js';
import { recordAudit } from '../audit/audit.service.js';
import { getClub } from '../clubs/clubs.service.js';
import { withoutPhotoConsent } from '../learners/learners.repository.js';
import * as repo from './sessions.repository.js';

const isoDate = (date) => date.toISOString().slice(0, 10);
const today = () => isoDate(new Date());
const daysAgo = (n) => isoDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));

/**
 * Champions can change a session report for 7 days after the session; coordinators (in their
 * regions) and HQ at any time (D2-5).
 */
function assertEditable(actor, date) {
  if (date >= daysAgo(SESSION_EDIT_DAYS)) return;
  if (scopeFor(actor, 'session:editLate')) return;
  throw forbidden(ERROR_MESSAGES.sessionLocked);
}

/** Only a planned session can be in the future. */
function assertDateFitsStatus({ date, status }) {
  if (date > today() && status !== 'planned') {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.status', message: ERROR_MESSAGES.futureSessionPlanned },
    ]);
  }
}

export function listSessions(actor, scope, query) {
  return repo.listSessions(scopeFilter(actor, scope), query);
}

/** Out-of-scope sessions look exactly like missing ones (404). */
async function findSession(actor, scope, id) {
  const session = await repo.findSessionInScope(id, scopeFilter(actor, scope));
  if (!session) throw notFound(ERROR_MESSAGES.sessionNotFound);
  return session;
}

/** A session with its attendance list. */
export async function getSession(actor, scope, id) {
  const session = await findSession(actor, scope, id);
  return { ...session, attendance: await repo.attendanceForSession(id) };
}

const reported = (actor, status) =>
  status === 'held' ? { reportedBy: actor.id, reportedAt: new Date() } : {};

export async function createSession(actor, scope, input, { requestId }) {
  const club = await getClub(actor, scope, input.clubId);
  if (club.status !== 'active') throw badRequest(ERROR_MESSAGES.clubInactive);
  assertDateFitsStatus(input);
  assertEditable(actor, input.date);
  const now = new Date();
  const session = {
    id: randomUUID(),
    // The club's usual times unless others are given.
    startTime: club.startTime,
    endTime: club.endTime,
    ...input,
    region: club.region,
    photoIds: [],
    ...reported(actor, input.status),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  };
  await repo.insertSession(session);
  await recordAudit({
    actor,
    action: 'session.create',
    entityType: 'session',
    entityId: session.id,
    after: input,
    region: club.region,
    requestId,
  });
  return { ...session, attendance: [] };
}

export async function updateSession(actor, scope, id, changes, { requestId }) {
  const before = await findSession(actor, scope, id);
  assertEditable(actor, before.date);
  const merged = { ...before, ...changes };
  if (changes.date) assertEditable(actor, changes.date);
  assertDateFitsStatus(merged);
  if (merged.status === 'held' && !merged.topic) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.topic', message: 'Add the topic covered' },
    ]);
  }
  if (merged.endTime <= merged.startTime) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.endTime', message: 'End time must be after start time' },
    ]);
  }
  await repo.updateSessionById(id, {
    ...changes,
    ...(changes.status && changes.status !== before.status && reported(actor, changes.status)),
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  if (changes.date && changes.date !== before.date) await repo.moveAttendanceDate(id, changes.date);
  await recordAudit({
    actor,
    action: 'session.update',
    entityType: 'session',
    entityId: id,
    before,
    after: changes,
    region: before.region,
    requestId,
  });
  return getSession(actor, scope, id);
}

/** Saves the whole attendance list in one step (US-11). */
export async function saveAttendance(actor, scope, id, { records }, { requestId }) {
  const session = await findSession(actor, scope, id);
  assertEditable(actor, session.date);
  if (session.status !== 'held') throw badRequest(ERROR_MESSAGES.attendanceHeldOnly);
  const ids = records.map((r) => r.learnerId);
  const inClub = await repo.learnerIdsInClub(session.clubId, ids);
  if (inClub.length !== ids.length) throw badRequest(ERROR_MESSAGES.attendanceNotInClub);
  await repo.replaceAttendance(session, records, actor.id);
  const count = (status) => records.filter((r) => r.status === status).length;
  await recordAudit({
    actor,
    action: 'session.attendance',
    entityType: 'session',
    entityId: id,
    after: {
      present: count('present'),
      late: count('late'),
      absent: count('absent'),
      excused: count('excused'),
    },
    region: session.region,
    requestId,
  });
  return getSession(actor, scope, id);
}

/**
 * Adds a photo (D2-7). If any learner marked present has no photo consent, the champion must
 * first confirm they are not in the photo; the API answers 409 with their names until then.
 */
export async function addPhoto(actor, scope, id, file, { confirmConsent }, { requestId }) {
  const session = await findSession(actor, scope, id);
  assertEditable(actor, session.date);
  if (session.photoIds.length >= SESSION_MAX_PHOTOS) throw conflict(ERROR_MESSAGES.tooManyPhotos);
  const missing = await withoutPhotoConsent(await repo.presentLearnerIds(id));
  if (missing.length && !confirmConsent) {
    const err = conflict(ERROR_MESSAGES.photoConsentMissing);
    err.code = 'PHOTO_CONSENT_MISSING';
    err.details = await repo.learnerNames(missing);
    throw err;
  }
  const photoId = await saveFile(BUCKETS.sessionPhotos, file.buffer, {
    contentType: file.type,
    metadata: { sessionId: id, uploadedBy: actor.id },
  });
  await repo.updateSessionById(id, {
    photoIds: [...session.photoIds, photoId],
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'session.photoAdd',
    entityType: 'session',
    entityId: id,
    after: { photoId, confirmedWithoutConsent: missing.length > 0 },
    region: session.region,
    requestId,
  });
  return getSession(actor, scope, id);
}

export async function getPhoto(actor, scope, id, photoId) {
  const session = await findSession(actor, scope, id);
  const file =
    session.photoIds.includes(photoId) && (await readFile(BUCKETS.sessionPhotos, photoId));
  if (!file) throw notFound(ERROR_MESSAGES.photoNotFound);
  return {
    file,
    filename: `session-${session.date}-${photoId.slice(0, 8)}.${fileExtension(file.contentType)}`,
  };
}

export async function deletePhoto(actor, scope, id, photoId, { requestId }) {
  const session = await findSession(actor, scope, id);
  assertEditable(actor, session.date);
  if (!session.photoIds.includes(photoId)) throw notFound(ERROR_MESSAGES.photoNotFound);
  await repo.updateSessionById(id, {
    photoIds: session.photoIds.filter((p) => p !== photoId),
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await deleteFile(BUCKETS.sessionPhotos, photoId);
  await recordAudit({
    actor,
    action: 'session.photoDelete',
    entityType: 'session',
    entityId: id,
    before: { photoId },
    after: { photoId: null },
    region: session.region,
    requestId,
  });
}
