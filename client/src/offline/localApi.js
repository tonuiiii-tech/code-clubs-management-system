import {
  CONSENT_TYPES,
  PHOTO_TYPES,
  SESSION_MAX_PHOTOS,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
} from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { can } from '@code-clubs/shared/permissions';
import {
  ageFromBirthYear,
  attendanceSchema,
  birthYearFromAge,
  consentSchema,
  createLearnerSchema,
  createSessionSchema,
  learnerContactSchema,
  sessionEditWindowOpen,
  updateLearnerSchema,
  updateSessionSchema,
} from '@code-clubs/shared/schemas';
import { ApiError } from '../services/http.js';
import { consentKey } from './db.js';
import { currentDb, currentUser, refreshCounts, requestSync } from './engine.js';
import { applyLocal } from './operations.js';

/**
 * The API, answered from the device for champions and coordinators once their data is synced
 * (D3-1, docs/sync-protocol.md §7). Reads return the same shapes as the server. Writes check the
 * same rules against the data on the device, are saved here at once and queued for the server,
 * which checks everything again when they arrive.
 */

const badRequest = (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details);
const notFound = (message) => new ApiError(404, 'NOT_FOUND', message);
const conflict = (message, code = 'CONFLICT', details) => new ApiError(409, code, message, details);
const forbidden = (message) => new ApiError(403, 'FORBIDDEN', message);

function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  throw badRequest(
    ERROR_MESSAGES.invalidFields,
    result.error.issues.map((i) => ({ field: ['body', ...i.path].join('.'), message: i.message })),
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const sameText = (a, b) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
const matches = (q, ...values) =>
  !q || values.some((v) => v?.toLowerCase().includes(q.toLowerCase()));

function paginate(rows, { page = 1, pageSize = 20 } = {}) {
  const p = Number(page);
  const size = Number(pageSize);
  return {
    data: rows.slice((p - 1) * size, p * size),
    page: p,
    pageSize: size,
    total: rows.length,
  };
}

/** A file's bytes; stored as bytes rather than a Blob, which some browsers cannot keep. */
async function readBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export const fileFromStore = (stored) =>
  stored ? new Blob([stored.bytes], { type: stored.type }) : null;

/** Saves a change on the device and queues it for the server, in one step. */
async function record(op, file) {
  const db = currentDb();
  const bytes = file ? await readBytes(file) : null;
  const entry = {
    opId: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    state: 'pending',
    ...op,
  };
  await db.transaction('rw', db.tables, async () => {
    await db.outbox.add(entry);
    if (file) await db.pendingFiles.put({ opId: entry.opId, bytes, type: file.type });
    await applyLocal(db, entry);
  });
  await refreshCounts();
  requestSync();
  return entry;
}

/** The values a change replaces, so the server can tell if someone else changed them (D3-5). */
const baseOf = (current, changes) =>
  Object.fromEntries(Object.keys(changes).map((key) => [key, current[key] ?? null]));

// ---------------------------------------------------------------------------
// Schools and clubs (read only on the device)

export async function listSchools(query = {}) {
  const rows = (await currentDb().schools.toArray())
    .filter(
      (s) =>
        (!query.region || s.region === query.region) &&
        (!query.county || s.county === query.county) &&
        (!query.type || s.type === query.type) &&
        (!query.status || s.status === query.status),
    )
    .filter((s) => matches(query.q, s.name, s.subCounty, s.ward))
    .sort((a, b) => a.name.localeCompare(b.name));
  return paginate(rows, query);
}

export async function getSchool(id) {
  const school = await currentDb().schools.get(id);
  if (!school) throw notFound(ERROR_MESSAGES.schoolNotFound);
  return { data: school };
}

export async function listClubs(query = {}) {
  const rows = (await currentDb().clubs.toArray())
    .filter(
      (c) =>
        (!query.region || c.region === query.region) &&
        (!query.schoolId || c.schoolId === query.schoolId) &&
        (!query.status || c.status === query.status) &&
        (!query.track || c.mainTrack === query.track),
    )
    .filter((c) => matches(query.q, c.name, c.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  return paginate(rows, query);
}

async function findClub(id) {
  const club = await currentDb().clubs.get(id);
  if (!club) throw notFound(ERROR_MESSAGES.clubNotFound);
  return club;
}

export async function getClub(id) {
  return { data: await findClub(id) };
}

// ---------------------------------------------------------------------------
// Learners

const PENDING = { status: 'pending', signedOn: null, hasFile: false };

async function consentsFor(learnerIds) {
  const rows = await currentDb().consents.where('learnerId').anyOf(learnerIds).toArray();
  const byLearner = {};
  for (const { learnerId, type, status, signedOn, hasFile, filePending } of rows) {
    byLearner[learnerId] ??= {};
    byLearner[learnerId][type] = {
      status,
      signedOn: signedOn ?? null,
      hasFile: Boolean(hasFile),
      ...(filePending && { filePending: true }),
    };
  }
  return (id) =>
    Object.fromEntries(CONSENT_TYPES.map((type) => [type, byLearner[id]?.[type] ?? PENDING]));
}

const presentLearner = (l, consents) => ({
  ...l,
  age: ageFromBirthYear(l.birthYear),
  consents: consents(l.id),
});

async function findLearner(id) {
  const learner = await currentDb().learners.get(id);
  if (!learner) throw notFound(ERROR_MESSAGES.learnerNotFound);
  return learner;
}

export async function listLearners(query = {}) {
  const learners = (await currentDb().learners.toArray())
    .filter(
      (l) =>
        (!query.clubId || l.clubId === query.clubId) &&
        (!query.status || l.status === query.status),
    )
    .filter((l) => matches(query.q, l.firstName, l.lastName, l.learnerNumber, l.admissionNumber))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const consents = await consentsFor(learners.map((l) => l.id));
  return paginate(
    learners.map((l) => presentLearner(l, consents)),
    query,
  );
}

export async function getLearner(id) {
  const learner = await findLearner(id);
  return { data: presentLearner(learner, await consentsFor([id])) };
}

const activeCount = async (clubId) =>
  (await currentDb().learners.where('clubId').equals(clubId).toArray()).filter(
    (l) => l.status === 'active',
  ).length;

async function assertAdmissionFree(schoolId, admissionNumber, exceptId) {
  if (!admissionNumber || !schoolId) return;
  const clash = (await currentDb().learners.toArray()).some(
    (l) =>
      l.id !== exceptId && l.schoolId === schoolId && sameText(l.admissionNumber, admissionNumber),
  );
  if (clash) throw conflict(ERROR_MESSAGES.duplicateAdmissionNumber);
}

const nameOf = (l) => `${l.firstName} ${l.lastName}`;

export async function createLearner(body) {
  const input = parse(createLearnerSchema, body);
  const club = await findClub(input.clubId);
  if (club.status !== 'active') throw badRequest(ERROR_MESSAGES.clubInactive);
  if (club.venueType === 'primary_school' && !input.admissionNumber) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.admissionNumber', message: ERROR_MESSAGES.admissionNumberRequired },
    ]);
  }
  if ((await activeCount(club.id)) >= club.capacity) throw conflict(ERROR_MESSAGES.clubFull);
  if (!input.confirmDuplicate) {
    const birthYear = birthYearFromAge(input.age);
    const duplicate = (await currentDb().learners.where('clubId').equals(club.id).toArray()).find(
      (l) =>
        l.birthYear === birthYear &&
        sameText(l.firstName, input.firstName) &&
        sameText(l.lastName, input.lastName),
    );
    if (duplicate) {
      throw conflict(ERROR_MESSAGES.duplicateLearner, 'POSSIBLE_DUPLICATE', [
        { learnerId: duplicate.id, learnerNumber: duplicate.learnerNumber },
      ]);
    }
  }
  await assertAdmissionFree(club.schoolId, input.admissionNumber);
  const data = { ...input, id: input.id ?? crypto.randomUUID() };
  await record({ type: 'learner.create', data, label: nameOf(data) });
  return getLearner(data.id);
}

export async function updateLearner(id, body) {
  const learner = await findLearner(id);
  const changes = parse(updateLearnerSchema, body);
  await assertAdmissionFree(learner.schoolId, changes.admissionNumber, id);
  const current = { ...learner, age: ageFromBirthYear(learner.birthYear) };
  await record({
    type: 'learner.update',
    recordId: id,
    data: changes,
    base: baseOf(current, changes),
    label: nameOf({ ...learner, ...changes }),
  });
  return getLearner(id);
}

export async function setLearnerStatus(id, status) {
  const learner = await findLearner(id);
  if (learner.status === status) return getLearner(id);
  if (status === 'active') {
    const club = await findClub(learner.clubId);
    if ((await activeCount(club.id)) >= club.capacity) throw conflict(ERROR_MESSAGES.clubFull);
  }
  await record({
    type: 'learner.status',
    recordId: id,
    data: { status },
    base: { status: learner.status },
    label: nameOf(learner),
  });
  return getLearner(id);
}

/** The contact stays in the outbox only until it is sent, then it is gone from the device. */
export async function saveLearnerContact(id, body) {
  const learner = await findLearner(id);
  const contact = parse(learnerContactSchema, body);
  await record({ type: 'learner.contact', recordId: id, data: contact, label: nameOf(learner) });
  return null;
}

export async function setConsent(id, type, body) {
  const learner = await findLearner(id);
  const input = parse(consentSchema, body);
  const current = (await currentDb().consents.get(consentKey(id, type))) ?? PENDING;
  await record({
    type: 'consent.set',
    recordId: id,
    params: { type },
    data: input,
    base: baseOf(current, input),
    label: nameOf(learner),
  });
  return { data: (await getLearner(id)).data.consents };
}

function checkFile(file, allowed, message) {
  if (!(file instanceof Blob) || !allowed.includes(file.type)) throw badRequest(message);
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new ApiError(413, 'TOO_LARGE', ERROR_MESSAGES.fileTooLarge);
  }
}

export async function uploadConsentFile(id, type, file) {
  const learner = await findLearner(id);
  checkFile(file, UPLOAD_TYPES, ERROR_MESSAGES.fileTypeNotAllowed);
  await record(
    { type: 'file.consent', recordId: id, params: { type }, data: {}, label: nameOf(learner) },
    file,
  );
  return { data: (await getLearner(id)).data.consents };
}

// ---------------------------------------------------------------------------
// Sessions and attendance

const isPresent = (status) => status === 'present' || status === 'late';

async function findSession(id) {
  const session = await currentDb().sessions.get(id);
  if (!session) throw notFound(ERROR_MESSAGES.sessionNotFound);
  return session;
}

function assertEditable(date) {
  if (!sessionEditWindowOpen(date) && !can(currentUser(), 'session:editLate')) {
    throw forbidden(ERROR_MESSAGES.sessionLocked);
  }
}

function assertDateFitsStatus({ date, status }) {
  if (date > today() && status !== 'planned') {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.status', message: ERROR_MESSAGES.futureSessionPlanned },
    ]);
  }
}

async function attendanceFor(sessionId) {
  const db = currentDb();
  const marks = await db.attendance.where('sessionId').equals(sessionId).toArray();
  const learners = await db.learners.bulkGet(marks.map((m) => m.learnerId));
  return marks
    .map(({ learnerId, status }, i) => ({
      learnerId,
      status,
      firstName: learners[i]?.firstName ?? '',
      lastName: learners[i]?.lastName ?? '',
      learnerNumber: learners[i]?.learnerNumber ?? '',
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

/** Photos taken on this device that have not uploaded yet. */
async function pendingPhotos(sessionId) {
  const db = currentDb();
  const ops = await db.outbox
    .filter((op) => op.type === 'file.photo' && op.recordId === sessionId)
    .toArray();
  const files = await db.pendingFiles.bulkGet(ops.map((op) => op.opId));
  return ops.map((op, i) => ({ id: op.opId, blob: fileFromStore(files[i]), state: op.state }));
}

export async function listSessions(query = {}) {
  const db = currentDb();
  const sessions = (await db.sessions.toArray())
    .filter(
      (s) =>
        (!query.clubId || s.clubId === query.clubId) &&
        (!query.status || s.status === query.status) &&
        (!query.from || s.date >= query.from) &&
        (!query.to || s.date <= query.to),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const marks = await db.attendance.toArray();
  const rows = sessions.map((s) => {
    const own = marks.filter((m) => m.sessionId === s.id);
    return {
      ...s,
      attendance: { present: own.filter((m) => isPresent(m.status)).length, total: own.length },
    };
  });
  return paginate(rows, query);
}

export async function getSession(id) {
  const session = await findSession(id);
  return {
    data: {
      ...session,
      attendance: await attendanceFor(id),
      pendingPhotos: await pendingPhotos(id),
    },
  };
}

const sessionLabel = async (session) => {
  const club = await currentDb().clubs.get(session.clubId);
  return `${club?.code ?? ''} · ${session.date}`;
};

export async function createSession(body) {
  const input = parse(createSessionSchema, body);
  const club = await findClub(input.clubId);
  if (club.status !== 'active') throw badRequest(ERROR_MESSAGES.clubInactive);
  assertDateFitsStatus(input);
  assertEditable(input.date);
  const taken = (await currentDb().sessions.where('clubId').equals(club.id).toArray()).some(
    (s) => s.date === input.date,
  );
  if (taken) throw conflict(ERROR_MESSAGES.duplicateSession);
  const data = { ...input, id: input.id ?? crypto.randomUUID() };
  await record({ type: 'session.create', data, label: await sessionLabel(data) });
  return getSession(data.id);
}

export async function updateSession(id, body) {
  const session = await findSession(id);
  const changes = parse(updateSessionSchema, body);
  assertEditable(session.date);
  if (changes.date) assertEditable(changes.date);
  const merged = { ...session, ...changes };
  assertDateFitsStatus(merged);
  if (merged.status === 'held' && !merged.topic) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.topic', message: 'Add the topic covered' },
    ]);
  }
  if (merged.endTime && merged.startTime && merged.endTime <= merged.startTime) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.endTime', message: 'End time must be after start time' },
    ]);
  }
  if (changes.date && changes.date !== session.date) {
    const taken = (
      await currentDb().sessions.where('clubId').equals(session.clubId).toArray()
    ).some((s) => s.id !== id && s.date === changes.date);
    if (taken) throw conflict(ERROR_MESSAGES.duplicateSession);
  }
  await record({
    type: 'session.update',
    recordId: id,
    data: changes,
    base: baseOf(session, changes),
    label: await sessionLabel(merged),
  });
  return getSession(id);
}

export async function saveAttendance(id, records) {
  const session = await findSession(id);
  const { records: marks } = parse(attendanceSchema, { records });
  assertEditable(session.date);
  if (session.status !== 'held') throw badRequest(ERROR_MESSAGES.attendanceHeldOnly);
  const learners = await currentDb().learners.bulkGet(marks.map((m) => m.learnerId));
  if (learners.some((l) => !l || l.clubId !== session.clubId)) {
    throw badRequest(ERROR_MESSAGES.attendanceNotInClub);
  }
  const current = Object.fromEntries((await attendanceFor(id)).map((a) => [a.learnerId, a.status]));
  await record({
    type: 'session.attendance',
    recordId: id,
    data: { records: marks },
    base: Object.fromEntries(marks.map((m) => [m.learnerId, current[m.learnerId] ?? null])),
    label: await sessionLabel(session),
  });
  return getSession(id);
}

/** Learners marked present who have no photo consent given (D2-7). */
async function presentWithoutPhotoConsent(sessionId) {
  const db = currentDb();
  const present = (await db.attendance.where('sessionId').equals(sessionId).toArray()).filter((m) =>
    isPresent(m.status),
  );
  const missing = [];
  for (const { learnerId } of present) {
    const consent = await db.consents.get(consentKey(learnerId, 'photo'));
    if (consent?.status === 'given') continue;
    const learner = await db.learners.get(learnerId);
    missing.push({ learnerId, name: learner ? nameOf(learner) : '' });
  }
  return missing;
}

export async function addSessionPhoto(id, file, confirmConsent = false) {
  const session = await findSession(id);
  assertEditable(session.date);
  if (session.photoIds.length + (await pendingPhotos(id)).length >= SESSION_MAX_PHOTOS) {
    throw conflict(ERROR_MESSAGES.tooManyPhotos);
  }
  const missing = await presentWithoutPhotoConsent(id);
  if (missing.length && !confirmConsent) {
    throw conflict(ERROR_MESSAGES.photoConsentMissing, 'PHOTO_CONSENT_MISSING', missing);
  }
  checkFile(file, PHOTO_TYPES, ERROR_MESSAGES.photoTypeNotAllowed);
  await record(
    {
      type: 'file.photo',
      recordId: id,
      data: { confirmConsent: missing.length > 0 },
      label: await sessionLabel(session),
    },
    file,
  );
  return getSession(id);
}

/** A photo still waiting on this device can be removed before it is sent. */
export async function removePendingPhoto(opId) {
  const db = currentDb();
  await db.transaction('rw', db.outbox, db.pendingFiles, async () => {
    await db.outbox.where('opId').equals(opId).delete();
    await db.pendingFiles.delete(opId);
  });
  await refreshCounts();
}

/** After an online-only change (deleting a photo), keep the device's copy in step. */
export async function forgetPhoto(sessionId, photoId) {
  const db = currentDb();
  const session = await db.sessions.get(sessionId);
  if (session) {
    await db.sessions.put({ ...session, photoIds: session.photoIds.filter((p) => p !== photoId) });
  }
}

// ---------------------------------------------------------------------------
// Dashboard: the last numbers seen online, shown with their date when offline.

export async function saveDashboard(summary) {
  const db = currentDb();
  if (db) await db.meta.put({ key: 'dashboard', value: { summary, at: new Date().toISOString() } });
}

export async function cachedDashboard() {
  return (await currentDb()?.meta.get('dashboard'))?.value ?? null;
}
