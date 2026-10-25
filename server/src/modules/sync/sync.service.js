import { createHash } from 'node:crypto';
import { z } from 'zod';
import { SYNC_SESSION_DAYS } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { scopeFor } from '@code-clubs/shared/permissions';
import {
  ageFromBirthYear,
  attendanceSchema,
  consentSchema,
  consentTypeSchema,
  createLearnerSchema,
  createSessionSchema,
  learnerContactSchema,
  learnerStatusSchema,
  updateLearnerSchema,
  updateSessionSchema,
} from '@code-clubs/shared/schemas';
import { badRequest, forbidden, HttpError } from '../../utils/httpError.js';
import { deviceTime } from '../../utils/deviceTime.js';
import { scopeFilter } from '../scope.js';
import * as learners from '../learners/learners.service.js';
import { learnerExists } from '../learners/learners.repository.js';
import * as sessions from '../sessions/sessions.service.js';
import { findSessionByClubDate } from '../sessions/sessions.repository.js';
import * as repo from './sync.repository.js';

/**
 * Sync for devices that work offline (docs/sync-protocol.md, D3-1 to D3-9).
 * Push runs each change through the same service functions as the online endpoints, so every
 * schema, permission, scope and audit rule still applies. Pull sends what changed in scope.
 */

/** Field values never written to the audit log are not kept in the conflict log either. */
const REDACTED = new Set(['accessibilityNeeds', 'guardianName', 'phone', 'altPhone']);

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const learnerValues = async (actor, scope, id) => {
  const learner = await learners.getLearner(actor, scope, id);
  return { record: learner, values: learner };
};

/**
 * Each operation type: the permission and schema of its online endpoint, how to read the
 * current values (for conflict detection, D3-5) and the service call that applies it.
 */
const OPERATIONS = {
  'learner.create': {
    permission: 'learner:write',
    schema: createLearnerSchema,
    alreadyApplied: (data) => data.id && learnerExists(data.id),
    run: ({ actor, scope, data, ctx }) => learners.createLearner(actor, scope, data, ctx),
  },
  'learner.update': {
    needsRecord: true,
    permission: 'learner:write',
    schema: updateLearnerSchema,
    entityType: 'learner',
    current: ({ actor, scope, recordId }) => learnerValues(actor, scope, recordId),
    run: ({ actor, scope, recordId, data, ctx }) =>
      learners.updateLearner(actor, scope, recordId, data, ctx),
  },
  'learner.status': {
    needsRecord: true,
    permission: 'learner:write',
    schema: learnerStatusSchema,
    entityType: 'learner',
    current: ({ actor, scope, recordId }) => learnerValues(actor, scope, recordId),
    run: ({ actor, scope, recordId, data, ctx }) =>
      learners.setLearnerStatus(actor, scope, recordId, data, ctx),
  },
  // Guardian contacts are written, never compared or logged (D2-1).
  'learner.contact': {
    needsRecord: true,
    permission: 'learnerContact:write',
    schema: learnerContactSchema,
    run: ({ actor, scope, recordId, data, ctx }) =>
      learners.putContact(actor, scope, recordId, data, ctx),
  },
  'consent.set': {
    needsRecord: true,
    permission: 'consent:write',
    schema: consentSchema,
    params: z.object({ type: consentTypeSchema }),
    entityType: 'consent',
    current: async ({ actor, scope, recordId, params }) => {
      const learner = await learners.getLearner(actor, scope, recordId);
      return { record: learner, values: learner.consents[params.type] };
    },
    run: ({ actor, scope, recordId, params, data, ctx }) =>
      learners.setConsent(actor, scope, recordId, params.type, data, ctx),
  },
  'session.create': {
    permission: 'session:write',
    schema: createSessionSchema,
    run: createOrJoinSession,
  },
  'session.update': {
    needsRecord: true,
    permission: 'session:write',
    schema: updateSessionSchema,
    entityType: 'session',
    current: async ({ actor, scope, recordId }) => {
      const session = await sessions.getSession(actor, scope, recordId);
      return { record: session, values: session };
    },
    run: ({ actor, scope, recordId, data, ctx }) =>
      sessions.updateSession(actor, scope, recordId, data, ctx),
  },
  // Attendance taken offline is merged per learner and never removes other marks (D2-4).
  'session.attendance': {
    needsRecord: true,
    permission: 'session:write',
    schema: attendanceSchema,
    entityType: 'attendance',
    fields: (data) => Object.fromEntries(data.records.map((r) => [r.learnerId, r.status])),
    current: async ({ actor, scope, recordId }) => {
      const session = await sessions.getSession(actor, scope, recordId);
      const marks = Object.fromEntries(session.attendance.map((a) => [a.learnerId, a.status]));
      const names = Object.fromEntries(
        session.attendance.map((a) => [a.learnerId, `${a.firstName} ${a.lastName}`]),
      );
      return { record: session, values: marks, labels: names };
    },
    run: ({ actor, scope, recordId, data, ctx }) =>
      sessions.saveAttendance(actor, scope, recordId, data, { ...ctx, merge: true }),
  },
};

/**
 * One session per club per day. If another device already reported this club's session for the
 * same date, the new one is joined to it: empty fields are filled in and later operations are
 * pointed at the existing session (D3-6).
 */
async function createOrJoinSession({ actor, scope, data, ctx }) {
  const existing = await findSessionByClubDate(data.clubId, data.date);
  if (existing?.id === data.id) return {};
  if (!existing) {
    await sessions.createSession(actor, scope, data, ctx);
    return {};
  }
  const current = await sessions.getSession(actor, scope, existing.id);
  const fill = {};
  for (const field of ['topic', 'notes', 'startTime', 'endTime', 'cancellationReason']) {
    if (data[field] && !current[field]) fill[field] = data[field];
  }
  if (current.status === 'planned' && data.status && data.status !== 'planned') {
    fill.status = data.status;
  }
  if (Object.keys(fill).length) {
    await sessions.updateSession(actor, scope, existing.id, fill, ctx);
  }
  return { recordId: existing.id, joined: true };
}

function parse(schema, value, part) {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  throw badRequest(
    ERROR_MESSAGES.invalidFields,
    result.error.issues.map((i) => ({ field: [part, ...i.path].join('.'), message: i.message })),
  );
}

/** Fields this operation changes whose value someone else changed since the device saw it. */
function findConflicts(handler, data, base, current) {
  if (!base || !current) return [];
  const changes = handler.fields ? handler.fields(data) : data;
  return Object.entries(changes)
    .filter(([field]) => field in base)
    .filter(([field, value]) => {
      const now = current.values?.[field];
      return !same(base[field], now) && !same(now, value);
    })
    .map(([field, value]) => ({ field, overwritten: current.values?.[field], applied: value }));
}

const errorResult = (opId, err) => ({
  opId,
  status: 'rejected',
  error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
});

async function runOperation(actor, op, { aliases, requestId }) {
  const handler = OPERATIONS[op.type];
  const scope = scopeFor(actor, handler.permission);
  if (!scope) throw forbidden();
  const recordId = op.recordId && (aliases.get(op.recordId) ?? op.recordId);
  if (handler.needsRecord && !recordId) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'recordId', message: 'Required for this operation' },
    ]);
  }
  const data = parse(handler.schema, op.data, 'data');
  const params = handler.params ? parse(handler.params, op.params, 'params') : {};
  const ctx = { requestId, recordedAt: deviceTime(op.recordedAt) };
  if (handler.alreadyApplied && (await handler.alreadyApplied(data))) {
    return { opId: op.opId, status: 'applied' };
  }
  const args = { actor, scope, recordId, params, data, ctx };
  const current = handler.current && op.base ? await handler.current(args) : null;
  const conflicts = findConflicts(handler, data, op.base, current);
  const outcome = (await handler.run(args)) ?? {};
  if (outcome.joined) aliases.set(data.id, outcome.recordId);
  if (conflicts.length) {
    const record = current.record;
    await repo.insertConflicts(
      conflicts.map(({ field, overwritten, applied }) => {
        const redacted = REDACTED.has(field);
        return {
          at: new Date(),
          entityType: handler.entityType,
          entityId: recordId,
          field: handler.entityType === 'consent' ? `${params.type}.${field}` : field,
          label: current.labels?.[field] ?? null,
          overwritten: redacted ? null : overwritten,
          applied: redacted ? null : applied,
          redacted,
          clubId: record.clubId,
          region: record.region,
          actorId: actor.id,
          actorName: actor.fullName,
          recordedAt: ctx.recordedAt ?? new Date(),
          opId: op.opId,
        };
      }),
    );
  }
  return {
    opId: op.opId,
    status: 'applied',
    ...(conflicts.length && { conflicts: conflicts.map((c) => c.field) }),
    ...(outcome.joined && { recordId: outcome.recordId, joined: true }),
  };
}

/**
 * Applies a device's changes in order (docs/sync-protocol.md §3). A change seen before returns
 * its stored result. After a refused change, later changes to the same record are skipped.
 */
export async function push(actor, { operations }, { requestId }) {
  const aliases = new Map();
  const refused = new Set();
  const results = [];
  for (const op of operations) {
    const target = op.recordId ? (aliases.get(op.recordId) ?? op.recordId) : op.data?.id;
    if (target && refused.has(target)) {
      results.push({ opId: op.opId, status: 'skipped' });
      continue;
    }
    const seen = await repo.claimOperation(op.opId, actor.id, op.type);
    if (seen) {
      const result =
        seen.userId !== actor.id
          ? errorResult(op.opId, forbidden())
          : (seen.result ?? { opId: op.opId, status: 'skipped' });
      if (result.status === 'rejected' && target) refused.add(target);
      if (result.joined) aliases.set(op.data?.id, result.recordId);
      results.push(result);
      continue;
    }
    let result;
    try {
      result = await runOperation(actor, op, { aliases, requestId });
    } catch (err) {
      if (!(err instanceof HttpError)) {
        await repo.releaseOperation(op.opId);
        throw err;
      }
      result = errorResult(op.opId, err);
      if (target) refused.add(target);
    }
    await repo.finishOperation(op.opId, result);
    results.push(result);
  }
  return { results };
}

// ---------------------------------------------------------------------------
// Pull

const PAGE = 500;
const OVERLAP_MS = 2 * 60 * 1000;
const KINDS = ['schools', 'clubs', 'learners', 'consents', 'sessions', 'attendance', 'deleted'];

function decodeCursor(text) {
  if (!text) return { at: {}, more: false };
  try {
    const value = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
    if (typeof value?.at !== 'object') throw new Error('bad cursor');
    return value;
  } catch {
    throw badRequest(ERROR_MESSAGES.invalidFields, [{ field: 'query.cursor', message: 'Invalid' }]);
  }
}

const encodeCursor = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const daysAgo = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Learners as the API shows them, with whether a contact is on file (never the contact). */
async function presentLearners(records) {
  const withContact = await repo.learnerIdsWithContact(records.map((l) => l.id));
  return records.map((l) => ({
    ...l,
    age: ageFromBirthYear(l.birthYear),
    hasContact: withContact.has(l.id),
  }));
}

/** Consent status without the file's id: the form itself never goes to a device (D3-8). */
const presentConsent = ({ fileId, createdBy: _c, updatedBy: _u, ...consent }) => ({
  ...consent,
  signedOn: consent.signedOn ?? null,
  hasFile: Boolean(fileId),
});

const presentAttendance = ({ createdBy: _c, updatedBy: _u, ...mark }) => mark;

/**
 * What changed in the user's scope after the cursor (docs/sync-protocol.md §4). The first page
 * of a pull starts 2 minutes early so saves that finished out of order are never missed (D3-4).
 */
export async function pull(actor, query) {
  const scope = scopeFor(actor, 'sync:use');
  if (!scope) {
    const err = forbidden(ERROR_MESSAGES.syncNotAvailable);
    err.code = 'SYNC_NOT_AVAILABLE';
    throw err;
  }
  const filter = scopeFilter(actor, scope);
  const clubIds = await repo.clubIdsInScope(filter);
  const scopeKey = createHash('sha256').update(clubIds.join(',')).digest('hex').slice(0, 32);
  const reset = Boolean(query.scopeKey) && query.scopeKey !== scopeKey;
  const cursor = reset ? { at: {}, more: false } : decodeCursor(query.cursor);
  const firstPage = !cursor.more;

  const after = (kind) => {
    const saved = cursor.at[kind];
    if (!saved) return null;
    const at = new Date(saved[0]);
    if (firstPage) return { at: new Date(at.getTime() - OVERLAP_MS), inclusive: true };
    return { at, id: saved[1] };
  };
  const fromDate = daysAgo(SYNC_SESSION_DAYS);
  const [schools, clubs, learnerRecords, consents, sessionRecords, attendance, deleted] =
    await Promise.all([
      repo.changedSchools(filter, after('schools'), PAGE),
      repo.changedClubs(filter, after('clubs'), PAGE),
      repo.changedLearners(filter, after('learners'), PAGE),
      repo.changedConsents(filter, after('consents'), PAGE),
      repo.changedSessions(filter, after('sessions'), PAGE, fromDate),
      repo.changedAttendance(filter, after('attendance'), PAGE, fromDate),
      repo.deletedRecords(filter, after('deleted'), PAGE),
    ]);
  const lists = [schools, clubs, learnerRecords, consents, sessionRecords, attendance, deleted];

  const next = { at: { ...cursor.at }, more: lists.some((list) => list.length === PAGE) };
  KINDS.forEach((kind, i) => {
    const last = lists[i].at(-1);
    if (last) next.at[kind] = [new Date(last.updatedAt).toISOString(), last.id];
  });

  return {
    scopeKey,
    reset,
    changes: {
      schools,
      clubs,
      learners: await presentLearners(learnerRecords),
      consents: consents.map(presentConsent),
      sessions: sessionRecords,
      attendance: attendance.map(presentAttendance),
    },
    deleted: {
      attendance: deleted.filter((t) => t.entityType === 'attendance').map((t) => t.recordId),
    },
    cursor: encodeCursor(next),
    more: next.more,
    serverTime: new Date().toISOString(),
  };
}

export function listConflicts(actor, scope, query) {
  return repo.listConflicts(scopeFilter(actor, scope), query);
}
