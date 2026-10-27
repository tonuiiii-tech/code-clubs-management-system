import {
  CONSENT_TYPES,
  OFFLINE_RESOURCES_MAX_BYTES,
  PHOTO_TYPES,
  SESSION_MAX_PHOTOS,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
} from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { can } from '@code-clubs/shared/permissions';
import {
  ageFromBirthYear,
  assessmentScoresSchema,
  attendanceSchema,
  birthYearFromAge,
  consentSchema,
  createAssessmentSchema,
  createLearnerSchema,
  createProjectSchema,
  createSessionSchema,
  learnerContactSchema,
  notInFuture,
  reportEquipmentSchema,
  sessionEditWindowOpen,
  termForDate,
  updateAssessmentSchema,
  updateLearnerSchema,
  updateProjectSchema,
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

/** Any other numbers seen online (the HQ dashboard, alerts), kept with their date. */
export async function saveValue(key, value) {
  const db = currentDb();
  if (db)
    await db.meta.put({ key: `cache:${key}`, value: { value, at: new Date().toISOString() } });
}

export async function cachedValue(key) {
  return (await currentDb()?.meta.get(`cache:${key}`))?.value ?? null;
}

// ---------------------------------------------------------------------------
// Events and announcements (Sprint 4): read on the device when offline; changing an event needs a
// connection, marking an announcement read does not (D4-8).

export async function listEvents(query = {}) {
  const rows = (await currentDb().events.toArray())
    .filter(
      (e) =>
        (!query.status || e.status === query.status) &&
        (!query.from || e.endDate >= query.from) &&
        (!query.region || e.region === query.region),
    )
    .sort((a, b) =>
      query.from ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate),
    );
  return paginate(rows, query);
}

export async function getEvent(id) {
  const db = currentDb();
  const event = await db.events.get(id);
  if (!event) throw notFound(ERROR_MESSAGES.eventNotFound);
  const clubs = (await db.clubs.bulkGet(event.clubIds)).filter(Boolean);
  const mine = (await db.eventParticipants.where('eventId').equals(id).toArray()).filter(
    (p) => p.status !== 'withdrawn',
  );
  const consents = await db.eventConsents.where('eventId').equals(id).toArray();
  const given = new Set(consents.filter((c) => c.status === 'given').map((c) => c.learnerId));
  return {
    data: {
      ...event,
      clubs: clubs.map(({ id: clubId, code, name, region }) => ({
        id: clubId,
        code,
        name,
        region,
      })),
      registered: null,
      registrationOpen: false,
      myParticipants: mine.length,
      consentMissing: mine.filter((p) => !given.has(p.learnerId)).length,
      offline: true,
    },
  };
}

export async function listEventParticipants(id) {
  const db = currentDb();
  const rows = await db.eventParticipants.where('eventId').equals(id).toArray();
  const consents = await db.eventConsents.where('eventId').equals(id).toArray();
  const learners = await db.learners.bulkGet(rows.map((p) => p.learnerId));
  const clubs = await db.clubs.bulkGet(rows.map((p) => p.clubId));
  return {
    data: rows
      .map((p, i) => {
        const consent = consents.find((c) => c.learnerId === p.learnerId);
        return {
          learnerId: p.learnerId,
          name: learners[i] ? nameOf(learners[i]) : '',
          learnerNumber: learners[i]?.learnerNumber ?? null,
          clubId: p.clubId,
          clubCode: clubs[i]?.code ?? null,
          status: p.status,
          consent: consent?.status ?? 'pending',
          consentSignedOn: consent?.signedOn ?? null,
          hasConsentFile: Boolean(consent?.hasFile),
        };
      })
      .sort(
        (a, b) =>
          (a.clubCode ?? '').localeCompare(b.clubCode ?? '') || a.name.localeCompare(b.name),
      ),
  };
}

async function readIds() {
  return new Set((await currentDb().announcementReads.toArray()).map((r) => r.announcementId));
}

export async function listAnnouncements(query = {}) {
  if (query.box === 'sent') throw new ApiError(0, 'NETWORK_ERROR', ERROR_MESSAGES.needsConnection);
  const read = await readIds();
  const rows = (await currentDb().announcements.toArray())
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((a) => ({ ...a, read: read.has(a.id) }));
  return { ...paginate(rows, query), unread: rows.filter((a) => !a.read).length };
}

export async function getAnnouncement(id) {
  const announcement = await currentDb().announcements.get(id);
  if (!announcement) throw notFound(ERROR_MESSAGES.announcementNotFound);
  return { data: { ...announcement, read: (await readIds()).has(id) } };
}

export async function markAnnouncementRead(id) {
  const announcement = await currentDb().announcements.get(id);
  if (!announcement) throw notFound(ERROR_MESSAGES.announcementNotFound);
  if (!(await readIds()).has(id)) {
    await record({ type: 'announcement.read', recordId: id, data: {}, label: announcement.title });
  }
  return { data: { announcementId: id, read: true } };
}

// ---------------------------------------------------------------------------
// Sprint 5 (plan section 7): the club's equipment and the resource list are read on the device;
// a champion reports damage, records projects and scores there, and opens saved resources.

const clubSummary = (club) =>
  club ? { id: club.id, code: club.code, name: club.name, region: club.region } : null;

async function presentItems(items) {
  const clubs = await currentDb().clubs.bulkGet(items.map((i) => i.clubId ?? ''));
  return items.map((item, i) => ({
    ...item,
    club: clubSummary(clubs[i]),
    dueDate: null,
    overdue: false,
  }));
}

export async function listEquipment(query = {}) {
  const rows = (await currentDb().equipmentItems.toArray())
    .filter(
      (i) =>
        (!query.type || i.type === query.type) &&
        (!query.condition || i.condition === query.condition) &&
        (!query.clubId || i.clubId === query.clubId) &&
        (query.location !== 'store' || !i.clubId) &&
        (query.location !== 'club' || i.clubId),
    )
    .filter((i) => matches(query.q, i.name, i.assetTag, i.serialNumber))
    .sort((a, b) => a.assetTag.localeCompare(b.assetTag));
  return paginate(await presentItems(rows), query);
}

/** Loans, repairs and reports stay on the server; the device shows the item itself. */
export async function getEquipment(id) {
  const item = await currentDb().equipmentItems.get(id);
  if (!item) throw notFound(ERROR_MESSAGES.equipmentNotFound);
  const [row] = await presentItems([item]);
  return { data: { ...row, loans: [], repairs: [], reports: [], canManage: false, offline: true } };
}

export async function reportEquipment(id, body) {
  const item = await currentDb().equipmentItems.get(id);
  if (!item) throw notFound(ERROR_MESSAGES.equipmentNotFound);
  const data = parse(reportEquipmentSchema, body);
  await record({ type: 'equipment.report', recordId: id, data, label: item.name });
  return getEquipment(id);
}

export async function listResources(query = {}) {
  const saved = new Set(await currentDb().savedResources.toCollection().primaryKeys());
  const rows = (await currentDb().resources.toArray())
    .filter(
      (r) =>
        (!query.type || r.type === query.type) &&
        (!query.track || r.tracks.includes(query.track)) &&
        (!query.ageBand || r.ageBands.includes(query.ageBand)) &&
        (!query.language || r.language === query.language),
    )
    .filter((r) => matches(query.q, r.title, r.description))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((r) => ({ ...r, saved: saved.has(r.id) }));
  return paginate(rows, query);
}

export async function getResource(id) {
  const resource = await currentDb().resources.get(id);
  if (!resource) throw notFound(ERROR_MESSAGES.resourceNotFound);
  return { data: { ...resource, saved: Boolean(await currentDb().savedResources.get(id)) } };
}

/** A saved file, or null when the resource is not saved on this device. */
export async function savedResourceFile(id) {
  const saved = await currentDb()?.savedResources.get(id);
  return saved ? new Blob([saved.bytes], { type: saved.type }) : null;
}

export async function savedResources() {
  const rows = await currentDb().savedResources.toArray();
  return rows.map(({ bytes: _b, ...r }) => r);
}

/** Bytes used by saved resources, and the limit (D5-3, R5-1). */
export async function savedResourcesSize() {
  const used = (await savedResources()).reduce((sum, r) => sum + (r.size ?? 0), 0);
  return { used, limit: OFFLINE_RESOURCES_MAX_BYTES };
}

/** Keeps a downloaded file on the device, within the 300 MB limit. */
export async function keepResourceFile(resource, blob) {
  const db = currentDb();
  const others = (await savedResources()).filter((r) => r.id !== resource.id);
  const used = others.reduce((sum, r) => sum + (r.size ?? 0), 0);
  if (used + blob.size > OFFLINE_RESOURCES_MAX_BYTES) {
    throw conflict(ERROR_MESSAGES.offlineStorageFull, 'STORAGE_FULL');
  }
  await db.savedResources.put({
    id: resource.id,
    title: resource.title,
    fileName: resource.fileName,
    type: blob.type || resource.fileType,
    size: blob.size,
    bytes: await readBytes(blob),
    resourceUpdatedAt: resource.updatedAt,
    savedAt: new Date().toISOString(),
  });
}

export async function forgetResourceFile(id) {
  await currentDb().savedResources.delete(id);
}

// Projects

async function presentProjects(projects) {
  const db = currentDb();
  const ids = [...new Set(projects.flatMap((p) => p.learnerIds))];
  const learners = new Map((await db.learners.bulkGet(ids)).filter(Boolean).map((l) => [l.id, l]));
  return projects.map((p) => ({
    ...p,
    learners: p.learnerIds.map((id) => ({
      id,
      name: learners.has(id) ? nameOf(learners.get(id)) : '',
    })),
  }));
}

async function findProject(id) {
  const project = await currentDb().learnerProjects.get(id);
  if (!project) throw notFound(ERROR_MESSAGES.projectNotFound);
  return project;
}

function checkNotFuture(date) {
  if (!notInFuture(date)) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.date', message: 'The date cannot be in the future' },
    ]);
  }
}

async function checkMembers(clubId, learnerIds, keep = []) {
  const learners = await currentDb().learners.bulkGet(learnerIds);
  const ok = learners.every(
    (l) => l && l.clubId === clubId && (l.status === 'active' || keep.includes(l.id)),
  );
  if (!ok) throw badRequest(ERROR_MESSAGES.projectLearnersOneClub);
}

const byDateDesc = (a, b) => b.date.localeCompare(a.date);

export async function listProjects(query = {}) {
  const rows = (await currentDb().learnerProjects.toArray())
    .filter(
      (p) =>
        (!query.clubId || p.clubId === query.clubId) &&
        (!query.learnerId || p.learnerIds.includes(query.learnerId)) &&
        (!query.track || p.track === query.track),
    )
    .sort(byDateDesc);
  return paginate(await presentProjects(rows), query);
}

export async function getProject(id) {
  const [project] = await presentProjects([await findProject(id)]);
  return { data: project };
}

export async function createProject(body) {
  const input = parse(createProjectSchema, body);
  await findClub(input.clubId);
  checkNotFuture(input.date);
  await checkMembers(input.clubId, input.learnerIds);
  const data = { ...input, id: input.id ?? crypto.randomUUID() };
  await record({ type: 'project.save', data, label: data.title });
  return getProject(data.id);
}

/** A change saves the whole project again, so the server can create it if it never got it. */
export async function updateProject(id, body) {
  const project = await findProject(id);
  const changes = parse(updateProjectSchema, body);
  if (changes.date) checkNotFuture(changes.date);
  if (changes.learnerIds)
    await checkMembers(project.clubId, changes.learnerIds, project.learnerIds);
  const {
    id: _id,
    clubId,
    title,
    track,
    learnerIds,
    sessionId,
    link,
    date,
    note,
  } = {
    ...project,
    ...changes,
  };
  const data = Object.fromEntries(
    Object.entries({ id, clubId, title, track, learnerIds, sessionId, link, date, note }).filter(
      ([, v]) => v !== null && v !== undefined,
    ),
  );
  await record({ type: 'project.save', data, label: title });
  return getProject(id);
}

export async function uploadProjectFile(id, file, confirmConsent = false) {
  const project = await findProject(id);
  checkFile(file, UPLOAD_TYPES, ERROR_MESSAGES.fileTypeNotAllowed);
  const missing = [];
  if (PHOTO_TYPES.includes(file.type)) {
    for (const learnerId of project.learnerIds) {
      const consent = await currentDb().consents.get(consentKey(learnerId, 'photo'));
      if (consent?.status === 'given') continue;
      const learner = await currentDb().learners.get(learnerId);
      missing.push({ learnerId, name: learner ? nameOf(learner) : '' });
    }
  }
  if (missing.length && !confirmConsent) {
    throw conflict(ERROR_MESSAGES.photoConsentMissing, 'PHOTO_CONSENT_MISSING', missing);
  }
  await record(
    {
      type: 'file.project',
      recordId: id,
      data: { confirmConsent: missing.length > 0 },
      label: project.title,
    },
    file,
  );
  return getProject(id);
}

// Assessments

const percent = (score, max) => (score === null ? null : Math.round((score / max) * 100));
const average = (values) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

async function findAssessment(id) {
  const assessment = await currentDb().assessments.get(id);
  if (!assessment) throw notFound(ERROR_MESSAGES.assessmentNotFound);
  return assessment;
}

const scoresOf = (id) => currentDb().assessmentScores.where('assessmentId').equals(id).toArray();

async function presentAssessment(a) {
  const given = (await scoresOf(a.id)).filter((s) => s.score !== null);
  return {
    ...a,
    scored: given.length,
    averageScore: average(given.map((s) => percent(s.score, a.maxScore))),
  };
}

export async function listAssessments(query = {}) {
  const rows = (await currentDb().assessments.toArray())
    .filter(
      (a) =>
        (!query.clubId || a.clubId === query.clubId) && (!query.track || a.track === query.track),
    )
    .sort(byDateDesc);
  return paginate(await Promise.all(rows.map(presentAssessment)), query);
}

const byName = (a, b) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

export async function getAssessment(id) {
  const db = currentDb();
  const assessment = await findAssessment(id);
  const scores = await scoresOf(id);
  const scoreBy = new Map(scores.map((s) => [s.learnerId, s.score]));
  const clubLearners = await db.learners.where('clubId').equals(assessment.clubId).toArray();
  // Active learners first, then anyone who left after being scored, as on the server.
  const rows = clubLearners
    .filter((l) => l.status === 'active' || scoreBy.has(l.id))
    .sort((a, b) => (b.status === 'active') - (a.status === 'active') || byName(a, b));
  return {
    data: {
      ...(await presentAssessment(assessment)),
      scores: rows.map((l) => ({
        learnerId: l.id,
        name: nameOf(l),
        learnerNumber: l.learnerNumber ?? null,
        status: l.status,
        score: scoreBy.get(l.id) ?? null,
      })),
    },
  };
}

export async function createAssessment(body) {
  const input = parse(createAssessmentSchema, body);
  await findClub(input.clubId);
  checkNotFuture(input.date);
  const data = { ...input, id: input.id ?? crypto.randomUUID() };
  await record({ type: 'assessment.save', data, label: data.title });
  return getAssessment(data.id);
}

export async function updateAssessment(id, body) {
  const assessment = await findAssessment(id);
  const changes = parse(updateAssessmentSchema, body);
  if (changes.date) checkNotFuture(changes.date);
  if (changes.maxScore !== undefined) {
    const top = Math.max(-1, ...(await scoresOf(id)).map((s) => s.score ?? -1));
    if (top > changes.maxScore) throw badRequest(ERROR_MESSAGES.scoreAboveMaximum);
  }
  const { clubId, title, track, date, maxScore } = { ...assessment, ...changes };
  await record({
    type: 'assessment.save',
    data: { id, clubId, title, track, date, maxScore },
    label: title,
  });
  return getAssessment(id);
}

/** Only changed scores are sent, merged learner by learner on the server (D5-5). */
export async function saveScores(id, scores) {
  const assessment = await findAssessment(id);
  const { scores: rows } = parse(assessmentScoresSchema, { scores });
  if (rows.some((s) => s.score !== null && s.score > assessment.maxScore)) {
    throw badRequest(ERROR_MESSAGES.scoreAboveMaximum);
  }
  const existing = new Map((await scoresOf(id)).map((s) => [s.learnerId, s.score]));
  const learners = await currentDb().learners.bulkGet(rows.map((r) => r.learnerId));
  const ok = learners.every(
    (l) => l && l.clubId === assessment.clubId && (l.status === 'active' || existing.has(l.id)),
  );
  if (!ok) throw badRequest(ERROR_MESSAGES.scoresNotInClub);
  const changed = rows.filter((r) => (existing.get(r.learnerId) ?? null) !== r.score);
  if (changed.length) {
    await record({
      type: 'assessment.scores',
      recordId: id,
      data: { scores: changed },
      label: assessment.title,
    });
  }
  return getAssessment(id);
}

// Progress pages

function attendanceRate(marks) {
  const present = marks.filter((m) => isPresent(m.status)).length;
  return {
    present,
    total: marks.length,
    rate: marks.length ? Math.round((present / marks.length) * 100) : null,
  };
}

/**
 * A learner's progress from the device. Attendance covers the sessions kept on the device, and
 * event projects need a connection, so the page says it is the device's copy.
 */
export async function learnerProgress(id) {
  const db = currentDb();
  const learner = await findLearner(id);
  const terms = (await getMetaValue('terms')) ?? [];
  const term = termForDate(terms, today());
  const marks = (await db.attendance.toArray()).filter((a) => a.learnerId === id);
  const scores = (await db.assessmentScores.where('learnerId').equals(id).toArray()).filter(
    (s) => s.score !== null,
  );
  const assessments = new Map(
    (await db.assessments.bulkGet(scores.map((s) => s.assessmentId)))
      .filter(Boolean)
      .map((a) => [a.id, a]),
  );
  const results = scores
    .filter((s) => assessments.has(s.assessmentId))
    .map((s) => {
      const a = assessments.get(s.assessmentId);
      return {
        assessmentId: a.id,
        title: a.title,
        track: a.track,
        date: a.date,
        score: s.score,
        maxScore: a.maxScore,
        percent: percent(s.score, a.maxScore),
      };
    })
    .sort(byDateDesc);
  const projects = (await db.learnerProjects.toArray())
    .filter((p) => p.learnerIds.includes(id))
    .sort(byDateDesc);
  return {
    data: {
      learner: {
        id,
        name: nameOf(learner),
        learnerNumber: learner.learnerNumber ?? null,
        clubId: learner.clubId,
        status: learner.status,
      },
      term: term ? { id: term.id, number: term.number, year: term.year } : null,
      attendance: {
        term: term ? attendanceRate(marks.filter((m) => m.date >= term.startDate)) : null,
        allTime: attendanceRate(marks),
      },
      projects: await presentProjects(projects),
      eventProjects: [],
      results,
      averageScore: average(results.map((r) => r.percent)),
      offline: true,
    },
  };
}

export async function clubProgress(id) {
  const db = currentDb();
  const club = await findClub(id);
  const projects = (await db.learnerProjects.where('clubId').equals(id).toArray()).sort(byDateDesc);
  const learners = (await db.learners.where('clubId').equals(id).toArray()).filter(
    (l) => l.status === 'active',
  );
  const byTrack = {};
  for (const p of projects) byTrack[p.track] = (byTrack[p.track] ?? 0) + 1;
  const withProject = new Set(projects.flatMap((p) => p.learnerIds));
  const assessments = (await db.assessments.where('clubId').equals(id).toArray()).sort(byDateDesc);
  return {
    data: {
      club: { id: club.id, code: club.code, name: club.name },
      activeLearners: learners.length,
      learnersWithProject: learners.filter((l) => withProject.has(l.id)).length,
      projectsByTrack: byTrack,
      projects: await presentProjects(projects.slice(0, 20)),
      assessments: await Promise.all(assessments.map(presentAssessment)),
    },
  };
}

/** Terms seen online, for the learner progress page offline. */
async function getMetaValue(key) {
  return (await cachedValue(key))?.value ?? null;
}
