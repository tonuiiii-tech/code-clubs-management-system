import { randomUUID } from 'node:crypto';
import {
  Assessment,
  AssessmentScore,
  Attendance,
  Club,
  Consent,
  Event,
  EventProject,
  Learner,
  LearnerProject,
  Session,
} from '../../db/models.js';
import { insertUnique, paginate, toRecord } from '../../db/records.js';
import { clubRecordScopeQuery, clubScopeQuery } from '../../db/scopeQueries.js';

/** Learner projects, assessments and scores (plan section 6). Plain records only (D1-16). */

export async function findClubInScope(filter, id) {
  return toRecord(
    await Club.findOne({ $and: [{ _id: id }, await clubScopeQuery(filter)] })
      .select('code name region status mainTrack')
      .lean(),
  );
}

export async function findLearnerInScope(filter, id) {
  return toRecord(
    await Learner.findOne({ $and: [{ _id: id }, await clubRecordScopeQuery(filter)] })
      .select('firstName lastName learnerNumber clubId region status')
      .lean(),
  );
}

export async function learnersByIds(ids) {
  const docs = await Learner.find({ _id: { $in: ids } })
    .select('firstName lastName learnerNumber clubId region status')
    .lean();
  return docs.map(toRecord);
}

export async function activeLearners(clubId) {
  const docs = await Learner.find({ clubId, status: 'active' })
    .select('firstName lastName learnerNumber clubId region status')
    .sort({ firstName: 1, lastName: 1 })
    .lean();
  return docs.map(toRecord);
}

export async function sessionOfClub(id, clubId) {
  return toRecord(await Session.findOne({ _id: id, clubId }).select('date clubId').lean());
}

/** Learners among these without photo consent (D2-7). */
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

// Projects

export async function listProjects(filter, { clubId, learnerId, track }, page) {
  const query = {
    $and: [
      await clubRecordScopeQuery(filter),
      clubId ? { clubId } : {},
      learnerId ? { learnerIds: learnerId } : {},
      track ? { track } : {},
    ],
  };
  return paginate(LearnerProject, query, page, { date: -1, _id: 1 });
}

export async function findProject(filter, id) {
  return toRecord(
    await LearnerProject.findOne({ $and: [{ _id: id }, await clubRecordScopeQuery(filter)] }).lean(),
  );
}

export const projectExists = async (id) => Boolean(await LearnerProject.exists({ _id: id }));

export const insertProject = (project, message) => insertUnique(LearnerProject, project, message);

export async function updateProject(id, changes) {
  return toRecord(
    await LearnerProject.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' }).lean(),
  );
}

export const deleteProject = (id) => LearnerProject.deleteOne({ _id: id });

export async function projectsOfLearner(learnerId) {
  const docs = await LearnerProject.find({ learnerIds: learnerId }).sort({ date: -1 }).lean();
  return docs.map(toRecord);
}

export async function projectsOfClub(clubId) {
  const docs = await LearnerProject.find({ clubId }).sort({ date: -1 }).lean();
  return docs.map(toRecord);
}

/** Projects the learner presented at events (Sprint 4), with the event's name and date. */
export async function eventProjectsOfLearner(learnerId) {
  const projects = await EventProject.find({ learnerIds: learnerId }).lean();
  const events = await Event.find({ _id: { $in: projects.map((p) => p.eventId) } })
    .select('name startDate')
    .lean();
  const eventBy = new Map(events.map((e) => [e._id, e]));
  return projects.map((p) => ({
    id: p._id,
    eventId: p.eventId,
    eventName: eventBy.get(p.eventId)?.name ?? '',
    date: eventBy.get(p.eventId)?.startDate ?? null,
    title: p.title,
    link: p.link ?? null,
    award: p.award ?? null,
    rank: p.rank ?? null,
  }));
}

// Assessments

export async function listAssessments(filter, { clubId, track }, page) {
  const query = {
    $and: [await clubRecordScopeQuery(filter), clubId ? { clubId } : {}, track ? { track } : {}],
  };
  return paginate(Assessment, query, page, { date: -1, _id: 1 });
}

export async function findAssessment(filter, id) {
  return toRecord(
    await Assessment.findOne({ $and: [{ _id: id }, await clubRecordScopeQuery(filter)] }).lean(),
  );
}

export const assessmentExists = async (id) => Boolean(await Assessment.exists({ _id: id }));

export const insertAssessment = (assessment, message) =>
  insertUnique(Assessment, assessment, message);

export async function updateAssessment(id, changes) {
  return toRecord(
    await Assessment.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' }).lean(),
  );
}

export async function assessmentsOfClub(clubId) {
  const docs = await Assessment.find({ clubId }).sort({ date: -1 }).lean();
  return docs.map(toRecord);
}

export async function assessmentsByIds(ids) {
  const docs = await Assessment.find({ _id: { $in: ids } }).lean();
  return docs.map(toRecord);
}

export async function scoresOf(assessmentIds) {
  const docs = await AssessmentScore.find({ assessmentId: { $in: assessmentIds } }).lean();
  return docs.map(toRecord);
}

export async function scoresOfLearner(learnerId) {
  const docs = await AssessmentScore.find({ learnerId }).lean();
  return docs.map(toRecord);
}

export async function maxScoreGiven(assessmentId) {
  const [top] = await AssessmentScore.find({ assessmentId, score: { $ne: null } })
    .sort({ score: -1 })
    .limit(1)
    .lean();
  return top?.score ?? null;
}

/** Saves scores learner by learner; other learners' scores stay as they are (D5-5). */
export async function mergeScores(assessment, scores, actorId) {
  const now = new Date();
  await AssessmentScore.bulkWrite(
    scores.map(({ learnerId, score }) => ({
      updateOne: {
        filter: { assessmentId: assessment.id, learnerId },
        update: {
          $set: { score, updatedAt: now, updatedBy: actorId },
          $setOnInsert: {
            _id: randomUUID(),
            clubId: assessment.clubId,
            region: assessment.region,
            createdAt: now,
            createdBy: actorId,
          },
        },
        upsert: true,
      },
    })),
    { timestamps: false },
  );
}

/** Present and total attendance marks for a learner, optionally from a date on. */
export async function attendanceOfLearner(learnerId, from) {
  const marks = await Attendance.find({ learnerId, ...(from && { date: { $gte: from } }) })
    .select('status')
    .lean();
  const present = marks.filter((m) => m.status === 'present' || m.status === 'late').length;
  return { present, total: marks.length };
}

