import { birthYearFromAge } from '@code-clubs/shared/schemas';
import { attendanceKey, consentKey } from './db.js';

/**
 * What each change does to the local database. Used when the change is made and again after
 * every pull, so the screens show "server data plus my unsent changes" (docs/sync-protocol.md §4).
 * Every step can run twice without harm.
 */

/** Changes that go to POST /sync/push; the rest are file uploads. */
export const FILE_OPERATIONS = new Set(['file.consent', 'file.photo']);

/** The record a change is about: changes after a refused one wait behind it. */
export const targetOf = (op) => op.recordId ?? op.data?.id;

const day = (iso) => iso.slice(0, 10);

async function patch(table, key, changes) {
  const record = await table.get(key);
  if (record) await table.put({ ...record, ...changes });
}

async function upsertConsent(db, learnerId, type, changes) {
  const key = consentKey(learnerId, type);
  const learner = await db.learners.get(learnerId);
  const existing = (await db.consents.get(key)) ?? {
    key,
    learnerId,
    type,
    clubId: learner?.clubId,
    region: learner?.region,
    status: 'pending',
    signedOn: null,
    hasFile: false,
  };
  await db.consents.put({ ...existing, ...changes });
}

const APPLY = {
  async 'learner.create'(db, { data, recordedAt }) {
    if (await db.learners.get(data.id)) return;
    const club = await db.clubs.get(data.clubId);
    const { contact, confirmDuplicate: _c, age, ...details } = data;
    await db.learners.put({
      ...details,
      // The server gives the number when the learner is synced.
      learnerNumber: null,
      birthYear: birthYearFromAge(age),
      schoolId: club?.schoolId ?? null,
      region: club?.region,
      status: 'active',
      joinedAt: day(recordedAt),
      leftAt: null,
      hasContact: Boolean(contact),
    });
  },
  async 'learner.update'(db, { recordId, data }) {
    const { age, ...changes } = data;
    if (age !== undefined) changes.birthYear = birthYearFromAge(age);
    await patch(db.learners, recordId, changes);
  },
  async 'learner.status'(db, { recordId, data, recordedAt }) {
    await patch(db.learners, recordId, {
      status: data.status,
      leftAt: data.status === 'left' ? day(recordedAt) : null,
    });
  },
  async 'learner.contact'(db, { recordId }) {
    await patch(db.learners, recordId, { hasContact: true });
  },
  async 'consent.set'(db, { recordId, params, data }) {
    await upsertConsent(db, recordId, params.type, {
      status: data.status,
      signedOn: data.signedOn ?? null,
    });
  },
  async 'file.consent'(db, { recordId, params }) {
    await upsertConsent(db, recordId, params.type, { hasFile: true, filePending: true });
  },
  async 'session.create'(db, { data, recordedAt }) {
    if (await db.sessions.get(data.id)) return;
    const club = await db.clubs.get(data.clubId);
    await db.sessions.put({
      startTime: club?.startTime,
      endTime: club?.endTime,
      status: 'held',
      ...data,
      region: club?.region,
      photoIds: [],
      ...(data.status !== 'planned' && data.status !== 'cancelled' && { reportedAt: recordedAt }),
    });
  },
  async 'session.update'(db, { recordId, data }) {
    await patch(db.sessions, recordId, data);
  },
  async 'session.attendance'(db, { recordId, data }) {
    const session = await db.sessions.get(recordId);
    if (!session) return;
    await db.attendance.bulkPut(
      await Promise.all(
        data.records.map(async ({ learnerId, status }) => {
          const key = attendanceKey(recordId, learnerId);
          const existing = await db.attendance.get(key);
          return {
            ...existing,
            key,
            sessionId: recordId,
            learnerId,
            clubId: session.clubId,
            region: session.region,
            date: session.date,
            status,
          };
        }),
      ),
    );
  },
  // Photos waiting to upload are shown from pendingFiles.
  async 'file.photo'() {},
  async 'announcement.read'(db, { recordId, recordedAt }) {
    if (await db.announcementReads.get(recordId)) return;
    await db.announcementReads.put({ id: recordId, announcementId: recordId, readAt: recordedAt });
  },
};

export async function applyLocal(db, op) {
  await APPLY[op.type]?.(db, op);
}

/**
 * Points everything at the server's session when the device's session was joined to one
 * another device reported for the same club and date (D3-6).
 */
export async function renameSession(db, fromId, toId) {
  await db.transaction('rw', db.sessions, db.attendance, db.outbox, async () => {
    const mine = await db.sessions.get(fromId);
    await db.sessions.delete(fromId);
    if (mine && !(await db.sessions.get(toId))) await db.sessions.put({ ...mine, id: toId });
    const marks = await db.attendance.where('sessionId').equals(fromId).toArray();
    await db.attendance.bulkDelete(marks.map((m) => m.key));
    await db.attendance.bulkPut(
      marks.map((m) => ({ ...m, key: attendanceKey(toId, m.learnerId), sessionId: toId })),
    );
    await db.outbox
      .filter((op) => op.recordId === fromId)
      .modify((op) => {
        op.recordId = toId;
      });
  });
}
