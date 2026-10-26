import Dexie from 'dexie';

/**
 * The local database on the device (Dexie on IndexedDB, D3-2). One database per user, so a
 * second person on a shared device never sees the first person's data (section 7 of the plan).
 *
 * Consents are keyed by learner and type, attendance by session and learner, so a record saved
 * on the device and the same record pulled from the server never become two.
 */
export const dbName = (userId) => `cc-offline-${userId}`;

export const DATA_TABLES = [
  'schools',
  'clubs',
  'learners',
  'consents',
  'sessions',
  'attendance',
  'events',
  'eventParticipants',
  'eventConsents',
  'announcements',
  'announcementReads',
  'equipmentItems',
  'resources',
  'learnerProjects',
  'assessments',
  'assessmentScores',
];

export function openUserDb(userId) {
  const db = new Dexie(dbName(userId));
  db.version(1).stores({
    schools: 'id',
    clubs: 'id',
    learners: 'id, clubId',
    consents: 'key, learnerId',
    sessions: 'id, clubId',
    attendance: 'key, sessionId, id',
    // Changes waiting for the server, in the order they were made.
    outbox: '++seq, opId, state',
    // Consent forms and photos waiting to upload; deleted once sent (D3-8).
    pendingFiles: 'opId',
    meta: 'key',
  });
  // Sprint 4: events and announcements, read-only on the device (D4-8).
  db.version(2).stores({
    events: 'id',
    eventParticipants: 'id, eventId',
    eventConsents: 'id, eventId',
    announcements: 'id',
    announcementReads: 'id',
  });
  // Sprint 5: the club's equipment, the resource list, projects and scores (plan section 7).
  // Saved resource files sit outside DATA_TABLES, so a full reload keeps them (D5-3).
  db.version(3).stores({
    equipmentItems: 'id, clubId',
    resources: 'id',
    learnerProjects: 'id, clubId',
    assessments: 'id, clubId',
    assessmentScores: 'key, assessmentId, learnerId',
    savedResources: 'id',
  });
  return db;
}

export const consentKey = (learnerId, type) => `${learnerId}:${type}`;
export const attendanceKey = (sessionId, learnerId) => `${sessionId}:${learnerId}`;
export const scoreKey = (assessmentId, learnerId) => `${assessmentId}:${learnerId}`;

export async function getMeta(db, key, fallback = null) {
  return (await db.meta.get(key))?.value ?? fallback;
}

export function setMeta(db, key, value) {
  return db.meta.put({ key, value });
}

export function deleteUserDb(userId) {
  return Dexie.delete(dbName(userId));
}
