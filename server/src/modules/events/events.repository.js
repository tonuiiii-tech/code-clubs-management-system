import {
  Club,
  Consent,
  Event,
  EventConsent,
  EventParticipant,
  EventProject,
  Learner,
} from '../../db/models.js';
import { paginate, toDocument, toRecord } from '../../db/records.js';
import { clubRecordScopeQuery, eventScopeQuery } from '../../db/scopeQueries.js';

/** Events and what hangs off them (plan section 6). Plain records only (D1-16). */

/** Coordinators manage only their own regions' events, never national ones. */
function manageScopeQuery(filter) {
  if (filter.all) return {};
  if (filter.regions) return { region: { $in: filter.regions } };
  return { _id: null };
}

export async function listEvents(filter, { status, from, region, page, pageSize }) {
  const query = {
    $and: [
      await eventScopeQuery(filter),
      status ? { status } : {},
      from ? { endDate: { $gte: from } } : {},
      region ? { region } : {},
    ],
  };
  return paginate(Event, query, { page, pageSize }, { startDate: from ? 1 : -1, _id: 1 });
}

export async function findEvent(filter, id) {
  return toRecord(
    await Event.findOne({ $and: [{ _id: id }, await eventScopeQuery(filter)] }).lean(),
  );
}

export async function findManagedEvent(filter, id) {
  return toRecord(await Event.findOne({ $and: [{ _id: id }, manageScopeQuery(filter)] }).lean());
}

export const insertEvent = (event) => Event.create(toDocument(event));

export async function updateEventById(id, changes) {
  return toRecord(await Event.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean());
}

export async function clubsByIds(ids) {
  const docs = await Club.find({ _id: { $in: ids } })
    .select('code name region status')
    .lean();
  return docs.map(toRecord);
}

/** Learners the user may manage for an event (their clubs, or their regions). */
export async function learnersInScope(filter, ids) {
  const docs = await Learner.find({
    $and: [{ _id: { $in: ids } }, await clubRecordScopeQuery(filter)],
  })
    .select('firstName lastName learnerNumber clubId region status')
    .lean();
  return docs.map(toRecord);
}

export async function participants(eventId, filter) {
  const docs = await EventParticipant.find({
    $and: [{ eventId }, filter ? await clubRecordScopeQuery(filter) : {}],
  }).lean();
  return docs.map(toRecord);
}

export async function findParticipant(eventId, learnerId) {
  return toRecord(await EventParticipant.findOne({ eventId, learnerId }).lean());
}

export const countRegistered = (eventId) =>
  EventParticipant.countDocuments({ eventId, status: { $ne: 'withdrawn' } });

export async function upsertParticipants(rows) {
  if (!rows.length) return;
  await EventParticipant.bulkWrite(
    rows.map((row) => {
      const { id, createdAt, createdBy, ...changes } = row;
      return {
        updateOne: {
          filter: { eventId: row.eventId, learnerId: row.learnerId },
          update: { $set: changes, $setOnInsert: { _id: id, createdAt, createdBy } },
          upsert: true,
        },
      };
    }),
  );
}

export async function updateParticipant(eventId, learnerId, changes) {
  return toRecord(
    await EventParticipant.findOneAndUpdate(
      { eventId, learnerId },
      { $set: changes },
      { new: true },
    ).lean(),
  );
}

export async function consents(eventId, learnerIds) {
  const docs = await EventConsent.find({ eventId, learnerId: { $in: learnerIds } }).lean();
  return docs.map(toRecord);
}

export async function findConsent(eventId, learnerId) {
  return toRecord(await EventConsent.findOne({ eventId, learnerId }).lean());
}

export async function upsertConsent(record, changes) {
  const { id, eventId, learnerId, clubId, region, createdAt, createdBy } = record;
  return toRecord(
    await EventConsent.findOneAndUpdate(
      { eventId, learnerId },
      {
        $set: changes,
        $setOnInsert: { _id: id, clubId, region, createdAt, createdBy },
      },
      { upsert: true, new: true },
    ).lean(),
  );
}

/** Learners among these without club photo consent (D2-7). */
export async function withoutPhotoConsent(learnerIds) {
  const given = new Set(
    await Consent.distinct('learnerId', {
      learnerId: { $in: learnerIds },
      type: 'photo',
      status: 'given',
    }),
  );
  return learnerIds.filter((id) => !given.has(id));
}

export async function learnerNames(ids) {
  const docs = await Learner.find({ _id: { $in: ids } })
    .select('firstName lastName learnerNumber clubId')
    .lean();
  return docs.map(toRecord);
}

export async function projects(eventId) {
  const docs = await EventProject.find({ eventId }).sort({ rank: 1, createdAt: 1 }).lean();
  return docs.map(toRecord);
}

export async function findProject(eventId, id) {
  return toRecord(await EventProject.findOne({ _id: id, eventId }).lean());
}

export const insertProject = (project) => EventProject.create(toDocument(project));

export async function updateProjectById(id, changes) {
  return toRecord(
    await EventProject.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean(),
  );
}
