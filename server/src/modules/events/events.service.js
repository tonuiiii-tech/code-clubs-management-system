import { randomUUID } from 'node:crypto';
import { EVENT_MAX_PHOTOS } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { scopeFor } from '@code-clubs/shared/permissions';
import { BUCKETS, deleteFile, readFile, saveFile } from '../../db/files.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { fileExtension } from '../../utils/fileType.js';
import { recordAudit } from '../audit/audit.service.js';
import { scopeFilter } from '../scope.js';
import * as repo from './events.repository.js';

/**
 * Events (plan section 6): HQ and coordinators run them and invite clubs; champions register
 * their own learners. Event consent is apart from club consent (D4-6), and photos get the same
 * consent check as session photos (D2-7, R4-5).
 */

const today = () => new Date().toISOString().slice(0, 10);
const stampNew = (actor) => {
  const now = new Date();
  return { createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id };
};
const stampChange = (actor) => ({ updatedAt: new Date(), updatedBy: actor.id });
const filterFor = (actor, permission) => scopeFilter(actor, scopeFor(actor, permission));
const fullName = (l) => `${l.firstName} ${l.lastName}`;

async function findEvent(actor, id) {
  const event = await repo.findEvent(filterFor(actor, 'event:read'), id);
  if (!event) throw notFound(ERROR_MESSAGES.eventNotFound);
  return event;
}

/** An event the user may change; one they can only read answers 403, others 404. */
async function findManagedEvent(actor, scope, id) {
  const event = await repo.findManagedEvent(scopeFilter(actor, scope), id);
  if (event) return event;
  await findEvent(actor, id);
  throw forbidden(ERROR_MESSAGES.eventOwnRegion);
}

/** Coordinators keep events in their regions; invited clubs must exist and fit the region. */
async function checkRegionAndClubs(actor, scope, { region, clubIds }) {
  const filter = scopeFilter(actor, scope);
  if (filter.regions && !filter.regions.includes(region)) {
    throw forbidden(ERROR_MESSAGES.eventOwnRegion);
  }
  const clubs = await repo.clubsByIds(clubIds);
  if (clubs.length !== new Set(clubIds).size) throw badRequest(ERROR_MESSAGES.clubNotFound);
  if (region && clubs.some((c) => c.region !== region)) {
    throw badRequest(ERROR_MESSAGES.eventClubNotInRegion);
  }
  if (filter.regions && clubs.some((c) => !filter.regions.includes(c.region))) {
    throw forbidden(ERROR_MESSAGES.eventOwnRegion);
  }
  return clubs;
}

/** Registration is open until it closes (or the event starts), unless closed by hand. */
export const registrationOpen = (event, day = today()) =>
  ['planned', 'open'].includes(event.status) &&
  day <= (event.registrationCloses ?? event.startDate);

export const listEvents = (actor, scope, query) =>
  repo.listEvents(scopeFilter(actor, scope), query);

/** The event with its invited clubs and, for the user's own learners, the numbers to act on. */
export async function getEvent(actor, _scope, id) {
  const event = await findEvent(actor, id);
  const manageFilter = filterFor(actor, 'eventParticipant:manage');
  const [clubs, mine, registered] = await Promise.all([
    repo.clubsByIds(event.clubIds),
    repo.participants(id, manageFilter),
    repo.countRegistered(id),
  ]);
  const active = mine.filter((p) => p.status !== 'withdrawn');
  const given = (
    await repo.consents(
      id,
      active.map((p) => p.learnerId),
    )
  ).filter((c) => c.status === 'given');
  return {
    ...event,
    clubs: clubs.map(({ id: clubId, code, name, region }) => ({ id: clubId, code, name, region })),
    registered,
    registrationOpen: registrationOpen(event),
    myParticipants: active.length,
    consentMissing: active.length - given.length,
  };
}

export async function createEvent(actor, scope, input, { requestId }) {
  const { clubIds, ...fields } = input;
  await checkRegionAndClubs(actor, scope, { region: input.region, clubIds });
  const event = {
    id: randomUUID(),
    ...fields,
    clubIds: [...new Set(clubIds)],
    photoIds: [],
    ...stampNew(actor),
  };
  await repo.insertEvent(event);
  await recordAudit({
    actor,
    action: 'event.create',
    entityType: 'event',
    entityId: event.id,
    after: { ...fields, clubs: event.clubIds.length },
    region: event.region,
    requestId,
  });
  return getEvent(actor, scope, event.id);
}

export async function updateEvent(actor, scope, id, changes, { requestId }) {
  const before = await findManagedEvent(actor, scope, id);
  const merged = { ...before, ...changes };
  if (merged.endDate < merged.startDate) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field: 'body.endDate', message: 'End date cannot be before start date' },
    ]);
  }
  if ('region' in changes) await checkRegionAndClubs(actor, scope, merged);
  await repo.updateEventById(id, { ...changes, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'event.update',
    entityType: 'event',
    entityId: id,
    before,
    after: changes,
    region: merged.region,
    requestId,
  });
  return getEvent(actor, scope, id);
}

export async function setEventClubs(actor, scope, id, { clubIds }, { requestId }) {
  const event = await findManagedEvent(actor, scope, id);
  await checkRegionAndClubs(actor, scope, { region: event.region, clubIds });
  const unique = [...new Set(clubIds)];
  await repo.updateEventById(id, { clubIds: unique, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'event.clubs',
    entityType: 'event',
    entityId: id,
    before: { clubs: event.clubIds.length },
    after: { clubs: unique.length },
    region: event.region,
    requestId,
  });
  return getEvent(actor, scope, id);
}

/** Participants from the user's own clubs (or regions), with names and event consent. */
export async function listParticipants(actor, scope, id) {
  await findEvent(actor, id);
  const rows = await repo.participants(id, scopeFilter(actor, scope));
  const learnerIds = rows.map((p) => p.learnerId);
  const [learners, consents, clubs] = await Promise.all([
    repo.learnerNames(learnerIds),
    repo.consents(id, learnerIds),
    repo.clubsByIds([...new Set(rows.map((p) => p.clubId))]),
  ]);
  const learnerById = new Map(learners.map((l) => [l.id, l]));
  const consentBy = new Map(consents.map((c) => [c.learnerId, c]));
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  return rows
    .map((p) => ({
      learnerId: p.learnerId,
      name: learnerById.has(p.learnerId) ? fullName(learnerById.get(p.learnerId)) : '',
      learnerNumber: learnerById.get(p.learnerId)?.learnerNumber ?? null,
      clubId: p.clubId,
      clubCode: clubById.get(p.clubId)?.code ?? null,
      status: p.status,
      consent: consentBy.get(p.learnerId)?.status ?? 'pending',
      consentSignedOn: consentBy.get(p.learnerId)?.signedOn ?? null,
      hasConsentFile: Boolean(consentBy.get(p.learnerId)?.fileId),
    }))
    .sort(
      (a, b) => (a.clubCode ?? '').localeCompare(b.clubCode ?? '') || a.name.localeCompare(b.name),
    );
}

/**
 * Registers learners, all or none: each must be in the user's scope, active, from an invited
 * club and not registered yet, while registration is open and there is room.
 */
export async function registerParticipants(actor, scope, id, { learnerIds }, { requestId }) {
  const event = await findEvent(actor, id);
  if (!registrationOpen(event)) throw conflict(ERROR_MESSAGES.eventClosed);
  const learners = await repo.learnersInScope(scopeFilter(actor, scope), learnerIds);
  if (learners.length !== learnerIds.length) throw notFound(ERROR_MESSAGES.learnerNotFound);
  const fail = (message, list) => {
    const err = conflict(message);
    err.details = list.map((l) => ({ learnerId: l.id, name: fullName(l) }));
    return err;
  };
  const inactive = learners.filter((l) => l.status !== 'active');
  if (inactive.length) throw fail(ERROR_MESSAGES.learnerInactive, inactive);
  const notInvited = learners.filter((l) => !event.clubIds.includes(l.clubId));
  if (notInvited.length) throw fail(ERROR_MESSAGES.eventClubNotInvited, notInvited);
  const existing = new Map((await repo.participants(id)).map((p) => [p.learnerId, p]));
  const already = learners.filter(
    (l) => existing.has(l.id) && existing.get(l.id).status !== 'withdrawn',
  );
  if (already.length) throw fail(ERROR_MESSAGES.alreadyRegistered, already);
  if (event.capacity && (await repo.countRegistered(id)) + learners.length > event.capacity) {
    throw conflict(ERROR_MESSAGES.eventFull);
  }
  const stamp = stampNew(actor);
  await repo.upsertParticipants(
    learners.map((l) => ({
      id: existing.get(l.id)?.id ?? randomUUID(),
      eventId: id,
      learnerId: l.id,
      clubId: l.clubId,
      region: l.region,
      status: 'registered',
      ...stamp,
    })),
  );
  await recordAudit({
    actor,
    action: 'event.register',
    entityType: 'event',
    entityId: id,
    after: { learners: learners.length },
    region: event.region,
    requestId,
  });
  return listParticipants(actor, scope, id);
}

async function findParticipant(actor, scope, eventId, learnerId) {
  await findEvent(actor, eventId);
  const [learner] = await repo.learnersInScope(scopeFilter(actor, scope), [learnerId]);
  const participant = learner && (await repo.findParticipant(eventId, learnerId));
  if (!participant) throw notFound(ERROR_MESSAGES.participantNotFound);
  return { participant, learner };
}

export async function setParticipantStatus(actor, scope, id, learnerId, { status }, { requestId }) {
  const { participant } = await findParticipant(actor, scope, id, learnerId);
  await repo.updateParticipant(id, learnerId, { status, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'event.participantStatus',
    entityType: 'event',
    entityId: id,
    before: { status: participant.status },
    after: { status },
    region: participant.region,
    requestId,
  });
  return listParticipants(actor, scope, id);
}

export async function setEventConsent(actor, scope, id, learnerId, input, { requestId }) {
  const { participant } = await findParticipant(actor, scope, id, learnerId);
  const before = (await repo.findConsent(id, learnerId)) ?? {};
  await repo.upsertConsent(
    { id: randomUUID(), ...participant, ...stampNew(actor) },
    { status: input.status, signedOn: input.signedOn ?? null, ...stampChange(actor) },
  );
  await recordAudit({
    actor,
    action: 'event.consent',
    entityType: 'event',
    entityId: id,
    before: { learnerId, consent: before.status, signedOn: before.signedOn },
    after: { learnerId, consent: input.status, signedOn: input.signedOn ?? null },
    region: participant.region,
    requestId,
  });
  return listParticipants(actor, scope, id);
}

/** The signed event consent form; a new upload replaces the old one. */
export async function uploadEventConsentFile(actor, scope, id, learnerId, file, { requestId }) {
  const { participant } = await findParticipant(actor, scope, id, learnerId);
  const fileId = await saveFile(BUCKETS.eventConsentFiles, file.buffer, {
    contentType: file.type,
    metadata: { eventId: id, learnerId, uploadedBy: actor.id },
  });
  const before = await repo.findConsent(id, learnerId);
  await repo.upsertConsent(
    { id: randomUUID(), ...participant, ...stampNew(actor) },
    // A form without a recorded answer counts as given, as signed forms only say yes.
    { fileId, ...(!before && { status: 'given', signedOn: today() }), ...stampChange(actor) },
  );
  if (before?.fileId) await deleteFile(BUCKETS.eventConsentFiles, before.fileId);
  await recordAudit({
    actor,
    action: 'event.consentFile',
    entityType: 'event',
    entityId: id,
    before: { learnerId, consentFile: before?.fileId ? 'previous file' : null },
    after: { learnerId, consentFile: file.type },
    region: participant.region,
    requestId,
  });
  return listParticipants(actor, scope, id);
}

/** For HQ and the region's coordinator; every download is audited (R2-2). */
export async function downloadEventConsentFile(actor, scope, id, learnerId, { requestId }) {
  const { participant, learner } = await findParticipant(actor, scope, id, learnerId);
  const consent = await repo.findConsent(id, learnerId);
  const file = consent?.fileId && (await readFile(BUCKETS.eventConsentFiles, consent.fileId));
  if (!file) throw notFound(ERROR_MESSAGES.consentFileNotFound);
  await recordAudit({
    actor,
    action: 'event.consentFileRead',
    entityType: 'event',
    entityId: id,
    after: { learnerId },
    region: participant.region,
    requestId,
  });
  return {
    file,
    filename: `event-consent-${learner.learnerNumber}.${fileExtension(file.contentType)}`,
  };
}

/** Projects with member names only for the learners the user may see. */
export async function listProjects(actor, _scope, id) {
  await findEvent(actor, id);
  const rows = await repo.projects(id);
  const visible = await repo.learnersInScope(
    filterFor(actor, 'learner:read'),
    rows.flatMap((p) => p.learnerIds),
  );
  const nameOf = new Map(visible.map((l) => [l.id, fullName(l)]));
  const clubs = new Map(
    (await repo.clubsByIds([...new Set(rows.map((p) => p.clubId).filter(Boolean))])).map((c) => [
      c.id,
      c,
    ]),
  );
  return rows.map(({ learnerIds, ...p }) => ({
    ...p,
    clubCode: clubs.get(p.clubId)?.code ?? null,
    clubName: clubs.get(p.clubId)?.name ?? null,
    learnerCount: learnerIds.length,
    learners: learnerIds.filter((l) => nameOf.has(l)).map((l) => ({ id: l, name: nameOf.get(l) })),
  }));
}

/** Members must be registered and in the user's scope; awards and ranks are for organisers. */
async function checkProject(actor, scope, event, input) {
  if (('award' in input || 'rank' in input) && !scopeFor(actor, 'event:manage')) {
    throw forbidden();
  }
  if (!input.learnerIds) return {};
  const learners = await repo.learnersInScope(scopeFilter(actor, scope), input.learnerIds);
  const registered = new Set(
    (await repo.participants(event.id))
      .filter((p) => p.status !== 'withdrawn')
      .map((p) => p.learnerId),
  );
  if (learners.length !== input.learnerIds.length || learners.some((l) => !registered.has(l.id))) {
    throw badRequest(ERROR_MESSAGES.eventProjectLearners);
  }
  return { clubId: learners[0].clubId, region: learners[0].region };
}

export async function createProject(actor, scope, id, input, { requestId }) {
  const event = await findEvent(actor, id);
  const club = await checkProject(actor, scope, event, input);
  const project = { id: randomUUID(), eventId: id, ...input, ...club, ...stampNew(actor) };
  await repo.insertProject(project);
  await recordAudit({
    actor,
    action: 'event.projectCreate',
    entityType: 'event',
    entityId: id,
    after: { projectId: project.id, title: input.title, award: input.award, rank: input.rank },
    region: event.region,
    requestId,
  });
  return listProjects(actor, scope, id);
}

export async function updateProject(actor, scope, id, projectId, changes, { requestId }) {
  const event = await findEvent(actor, id);
  const before = await repo.findProject(id, projectId);
  if (!before) throw notFound(ERROR_MESSAGES.eventProjectNotFound);
  // Champions change only projects of their own learners; organisers any.
  if (!scopeFor(actor, 'event:manage')) {
    const own = await repo.learnersInScope(scopeFilter(actor, scope), before.learnerIds);
    if (own.length !== before.learnerIds.length) throw forbidden();
  }
  const club = await checkProject(actor, scope, event, changes);
  await repo.updateProjectById(projectId, { ...changes, ...club, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'event.projectUpdate',
    entityType: 'event',
    entityId: id,
    before: { title: before.title, award: before.award, rank: before.rank },
    after: { title: changes.title, award: changes.award, rank: changes.rank },
    region: event.region,
    requestId,
  });
  return listProjects(actor, scope, id);
}

/**
 * Adds a photo. Participants in the user's scope without photo consent or event consent are
 * listed first (409) until the user confirms they are not in the photo (D2-7, R4-5).
 */
export async function addPhoto(actor, scope, id, file, { confirmConsent }, { requestId }) {
  const event = await findEvent(actor, id);
  if (event.photoIds.length >= EVENT_MAX_PHOTOS) throw conflict(ERROR_MESSAGES.tooManyEventPhotos);
  const rows = (await repo.participants(id, scopeFilter(actor, scope))).filter((p) =>
    ['registered', 'attended'].includes(p.status),
  );
  const attended = rows.some((p) => p.status === 'attended')
    ? rows.filter((p) => p.status === 'attended')
    : rows;
  const ids = attended.map((p) => p.learnerId);
  const eventConsent = new Set(
    (await repo.consents(id, ids)).filter((c) => c.status === 'given').map((c) => c.learnerId),
  );
  const noPhoto = new Set(await repo.withoutPhotoConsent(ids));
  const missing = ids.filter((l) => noPhoto.has(l) || !eventConsent.has(l));
  if (missing.length && !confirmConsent) {
    const err = conflict(ERROR_MESSAGES.photoConsentMissing);
    err.code = 'PHOTO_CONSENT_MISSING';
    err.details = (await repo.learnerNames(missing)).map((l) => ({
      learnerId: l.id,
      name: fullName(l),
    }));
    throw err;
  }
  const photoId = await saveFile(BUCKETS.eventPhotos, file.buffer, {
    contentType: file.type,
    metadata: { eventId: id, uploadedBy: actor.id },
  });
  await repo.updateEventById(id, {
    photoIds: [...event.photoIds, photoId],
    ...stampChange(actor),
  });
  await recordAudit({
    actor,
    action: 'event.photoAdd',
    entityType: 'event',
    entityId: id,
    after: { photoId, confirmedWithoutConsent: missing.length > 0 },
    region: event.region,
    requestId,
  });
  return getEvent(actor, scope, id);
}

export async function getPhoto(actor, _scope, id, photoId) {
  const event = await findEvent(actor, id);
  const file = event.photoIds.includes(photoId) && (await readFile(BUCKETS.eventPhotos, photoId));
  if (!file) throw notFound(ERROR_MESSAGES.photoNotFound);
  return {
    file,
    filename: `event-${event.startDate}-${photoId.slice(0, 8)}.${fileExtension(file.contentType)}`,
  };
}

export async function deletePhoto(actor, scope, id, photoId, { requestId }) {
  const event = await findManagedEvent(actor, scope, id);
  if (!event.photoIds.includes(photoId)) throw notFound(ERROR_MESSAGES.photoNotFound);
  await repo.updateEventById(id, {
    photoIds: event.photoIds.filter((p) => p !== photoId),
    ...stampChange(actor),
  });
  await deleteFile(BUCKETS.eventPhotos, photoId);
  await recordAudit({
    actor,
    action: 'event.photoDelete',
    entityType: 'event',
    entityId: id,
    before: { photoId },
    after: { photoId: null },
    region: event.region,
    requestId,
  });
}
