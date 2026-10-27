import { randomUUID } from 'node:crypto';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { scopeFor } from '@code-clubs/shared/permissions';
import { notInFuture, termForDate } from '@code-clubs/shared/schemas';
import { BUCKETS, deleteFile, findFileByOpId, readFile, saveFile } from '../../db/files.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { fileExtension } from '../../utils/fileType.js';
import { recordAudit } from '../audit/audit.service.js';
import { scopeFilter } from '../scope.js';
import { listTerms } from '../terms/terms.service.js';
import * as repo from './progress.repository.js';

/**
 * Learner progress (plan section 6, US-29, US-30): projects learners made and assessment scores,
 * recorded by champions for their own clubs, also offline (D5-5). They are learner data, so they
 * follow the learner record's scope and reach reports only as counts and averages (D5-6).
 */

const stampNew = (actor) => {
  const now = new Date();
  return { createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id };
};
const stampChange = (actor) => ({ updatedAt: new Date(), updatedBy: actor.id });
const filterFor = (actor, permission) => scopeFilter(actor, scopeFor(actor, permission));
const fullName = (l) => `${l.firstName} ${l.lastName}`;
const percent = (score, max) => (score === null ? null : Math.round((score / max) * 100));
const average = (values) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

function checkDate(date, field = 'body.date') {
  if (!notInFuture(date)) {
    throw badRequest(ERROR_MESSAGES.invalidFields, [
      { field, message: 'The date cannot be in the future' },
    ]);
  }
}

async function findClub(actor, scope, clubId) {
  const club = await repo.findClubInScope(scopeFilter(actor, scope), clubId);
  if (!club) throw notFound(ERROR_MESSAGES.clubNotFound);
  return club;
}

/** Members must be learners of the club; new members must be active ones. */
async function checkMembers(clubId, learnerIds, keep = []) {
  const learners = await repo.learnersByIds(learnerIds);
  const ok =
    learners.length === learnerIds.length &&
    learners.every((l) => l.clubId === clubId && (l.status === 'active' || keep.includes(l.id)));
  if (!ok) throw badRequest(ERROR_MESSAGES.projectLearnersOneClub);
  return learners;
}

async function checkSession(clubId, sessionId) {
  if (sessionId && !(await repo.sessionOfClub(sessionId, clubId))) {
    throw badRequest(ERROR_MESSAGES.sessionNotFound);
  }
}

/** A project with its members' names, as the API shows it. */
async function presentProjects(projects) {
  const ids = [...new Set(projects.flatMap((p) => p.learnerIds))];
  const learners = new Map((await repo.learnersByIds(ids)).map((l) => [l.id, l]));
  return projects.map(({ fileId, createdBy: _c, updatedBy: _u, ...p }) => ({
    ...p,
    hasFile: Boolean(fileId),
    learners: p.learnerIds.map((id) => ({
      id,
      name: learners.has(id) ? fullName(learners.get(id)) : '',
    })),
  }));
}

async function findProject(actor, id, permission = 'progress:read') {
  const project = await repo.findProject(filterFor(actor, permission), id);
  if (!project) throw notFound(ERROR_MESSAGES.projectNotFound);
  return project;
}

export async function listProjects(actor, scope, { page, pageSize, ...query }) {
  const result = await repo.listProjects(scopeFilter(actor, scope), query, { page, pageSize });
  return { ...result, data: await presentProjects(result.data) };
}

export async function getProject(actor, _scope, id) {
  const [project] = await presentProjects([await findProject(actor, id)]);
  return project;
}

export async function createProject(actor, scope, input, { requestId }) {
  const club = await findClub(actor, scope, input.clubId);
  checkDate(input.date);
  await checkMembers(club.id, input.learnerIds);
  await checkSession(club.id, input.sessionId);
  const project = {
    id: input.id ?? randomUUID(),
    sessionId: null,
    link: null,
    note: null,
    ...input,
    clubId: club.id,
    region: club.region,
    fileId: null,
    fileType: null,
    ...stampNew(actor),
  };
  await repo.insertProject(project, ERROR_MESSAGES.duplicateId);
  await recordAudit({
    actor,
    action: 'project.create',
    entityType: 'project',
    entityId: project.id,
    after: { title: project.title, track: project.track, learners: project.learnerIds.length },
    region: club.region,
    requestId,
  });
  return getProject(actor, scope, project.id);
}

export async function updateProject(actor, scope, id, changes, { requestId }) {
  const before = await findProject(actor, id, 'progress:record');
  if (changes.date) checkDate(changes.date);
  if (changes.learnerIds) await checkMembers(before.clubId, changes.learnerIds, before.learnerIds);
  if (changes.sessionId) await checkSession(before.clubId, changes.sessionId);
  await repo.updateProject(id, { ...changes, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'project.update',
    entityType: 'project',
    entityId: id,
    before: { title: before.title, track: before.track, date: before.date },
    after: { title: changes.title, track: changes.track, date: changes.date },
    region: before.region,
    requestId,
  });
  return getProject(actor, scope, id);
}

/** Created on a device: a new project, or changes to one it made earlier (D5-5). */
export async function saveProject(actor, scope, { id, clubId: _club, ...changes }, ctx) {
  if (await repo.projectExists(id)) return updateProject(actor, scope, id, changes, ctx);
  return createProject(actor, scope, { id, clubId: _club, ...changes }, ctx);
}

export async function deleteProject(actor, _scope, id, { requestId }) {
  const project = await findProject(actor, id, 'progress:record');
  await repo.deleteProject(id);
  if (project.fileId) await deleteFile(BUCKETS.projectFiles, project.fileId);
  await recordAudit({
    actor,
    action: 'project.delete',
    entityType: 'project',
    entityId: id,
    before: { title: project.title },
    after: { title: null },
    region: project.region,
    requestId,
  });
}

/**
 * Adds or replaces the project's file or photo. A photo of members without photo consent needs
 * the user to confirm they are not in it (D2-7). A device sending it again adds it once.
 */
export async function putProjectFile(actor, scope, id, file, { confirmConsent, opId }, ctx) {
  const project = await findProject(actor, id, 'progress:record');
  if (opId && (await findFileByOpId(BUCKETS.projectFiles, opId))) {
    return getProject(actor, scope, id);
  }
  const isPhoto = file.type.startsWith('image/');
  const missing = isPhoto ? await repo.withoutPhotoConsent(project.learnerIds) : [];
  if (missing.length && !confirmConsent) {
    const err = conflict(ERROR_MESSAGES.photoConsentMissing);
    err.code = 'PHOTO_CONSENT_MISSING';
    err.details = (await repo.learnersByIds(missing)).map((l) => ({
      learnerId: l.id,
      name: fullName(l),
    }));
    throw err;
  }
  const fileId = await saveFile(BUCKETS.projectFiles, file.buffer, {
    contentType: file.type,
    metadata: { projectId: id, uploadedBy: actor.id, ...(opId && { opId }) },
  });
  await repo.updateProject(id, { fileId, fileType: file.type, ...stampChange(actor) });
  if (project.fileId) await deleteFile(BUCKETS.projectFiles, project.fileId);
  await recordAudit({
    actor,
    action: 'project.file',
    entityType: 'project',
    entityId: id,
    after: { fileType: file.type, confirmedWithoutConsent: missing.length > 0 },
    region: project.region,
    requestId: ctx.requestId,
  });
  return getProject(actor, scope, id);
}

export async function getProjectFile(actor, _scope, id) {
  const project = await findProject(actor, id);
  const file = project.fileId && (await readFile(BUCKETS.projectFiles, project.fileId));
  if (!file) throw notFound(ERROR_MESSAGES.photoNotFound);
  return { file, filename: `project-${project.date}.${fileExtension(file.contentType)}` };
}

// ---------------------------------------------------------------------------
// Assessments

async function findAssessment(actor, id, permission = 'progress:read') {
  const assessment = await repo.findAssessment(filterFor(actor, permission), id);
  if (!assessment) throw notFound(ERROR_MESSAGES.assessmentNotFound);
  return assessment;
}

const presentAssessment = ({ createdBy: _c, updatedBy: _u, ...a }, scores) => {
  const given = scores.filter((s) => s.assessmentId === a.id && s.score !== null);
  return {
    ...a,
    scored: given.length,
    averageScore: average(given.map((s) => percent(s.score, a.maxScore))),
  };
};

export async function listAssessments(actor, scope, { page, pageSize, ...query }) {
  const result = await repo.listAssessments(scopeFilter(actor, scope), query, { page, pageSize });
  const scores = await repo.scoresOf(result.data.map((a) => a.id));
  return { ...result, data: result.data.map((a) => presentAssessment(a, scores)) };
}

/** An assessment with a row for each active learner of the club (and anyone already scored). */
export async function getAssessment(actor, _scope, id) {
  const assessment = await findAssessment(actor, id);
  const scores = await repo.scoresOf([id]);
  const scoreBy = new Map(scores.map((s) => [s.learnerId, s.score]));
  const active = await repo.activeLearners(assessment.clubId);
  const others = await repo.learnersByIds(
    scores.map((s) => s.learnerId).filter((l) => !active.some((a) => a.id === l)),
  );
  return {
    ...presentAssessment(assessment, scores),
    scores: [...active, ...others].map((l) => ({
      learnerId: l.id,
      name: fullName(l),
      learnerNumber: l.learnerNumber ?? null,
      status: l.status,
      score: scoreBy.get(l.id) ?? null,
    })),
  };
}

export async function createAssessment(actor, scope, input, { requestId }) {
  const club = await findClub(actor, scope, input.clubId);
  checkDate(input.date);
  const assessment = {
    id: input.id ?? randomUUID(),
    ...input,
    clubId: club.id,
    region: club.region,
    ...stampNew(actor),
  };
  await repo.insertAssessment(assessment, ERROR_MESSAGES.duplicateId);
  await recordAudit({
    actor,
    action: 'assessment.create',
    entityType: 'assessment',
    entityId: assessment.id,
    after: { title: assessment.title, track: assessment.track, maxScore: assessment.maxScore },
    region: club.region,
    requestId,
  });
  return getAssessment(actor, scope, assessment.id);
}

export async function updateAssessment(actor, scope, id, changes, { requestId }) {
  const before = await findAssessment(actor, id, 'progress:record');
  if (changes.date) checkDate(changes.date);
  if (changes.maxScore !== undefined) {
    const top = await repo.maxScoreGiven(id);
    if (top !== null && top > changes.maxScore) throw badRequest(ERROR_MESSAGES.scoreAboveMaximum);
  }
  await repo.updateAssessment(id, { ...changes, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'assessment.update',
    entityType: 'assessment',
    entityId: id,
    before,
    after: changes,
    region: before.region,
    requestId,
  });
  return getAssessment(actor, scope, id);
}

export async function saveAssessment(actor, scope, { id, clubId, ...changes }, ctx) {
  if (await repo.assessmentExists(id)) return updateAssessment(actor, scope, id, changes, ctx);
  return createAssessment(actor, scope, { id, clubId, ...changes }, ctx);
}

/** Saves scores learner by learner, like attendance (D5-5). */
export async function saveScores(actor, scope, id, { scores }, { requestId }) {
  const assessment = await findAssessment(actor, id, 'progress:record');
  if (scores.some((s) => s.score !== null && s.score > assessment.maxScore)) {
    throw badRequest(ERROR_MESSAGES.scoreAboveMaximum);
  }
  const learners = await repo.learnersByIds(scores.map((s) => s.learnerId));
  const existing = new Set((await repo.scoresOf([id])).map((s) => s.learnerId));
  const ok =
    learners.length === scores.length &&
    learners.every(
      (l) => l.clubId === assessment.clubId && (l.status === 'active' || existing.has(l.id)),
    );
  if (!ok) throw badRequest(ERROR_MESSAGES.scoresNotInClub);
  if (scores.length) await repo.mergeScores(assessment, scores, actor.id);
  await recordAudit({
    actor,
    action: 'assessment.scores',
    entityType: 'assessment',
    entityId: id,
    after: { scores: scores.length },
    region: assessment.region,
    requestId,
  });
  return getAssessment(actor, scope, id);
}

// ---------------------------------------------------------------------------
// Progress pages

/** One learner's progress: attendance this term and overall, projects and scores. */
export async function learnerProgress(actor, scope, learnerId) {
  const learner = await repo.findLearnerInScope(scopeFilter(actor, scope), learnerId);
  if (!learner) throw notFound(ERROR_MESSAGES.learnerNotFound);
  const term = termForDate(await listTerms(), new Date().toISOString().slice(0, 10));
  const [allTime, thisTerm, projects, eventProjects, scores] = await Promise.all([
    repo.attendanceOfLearner(learnerId),
    term ? repo.attendanceOfLearner(learnerId, term.startDate) : null,
    repo.projectsOfLearner(learnerId),
    repo.eventProjectsOfLearner(learnerId),
    repo.scoresOfLearner(learnerId),
  ]);
  const given = scores.filter((s) => s.score !== null);
  const assessments = new Map(
    (await repo.assessmentsByIds(given.map((s) => s.assessmentId))).map((a) => [a.id, a]),
  );
  const results = given
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
    .sort((a, b) => b.date.localeCompare(a.date));
  const rate = ({ present, total }) => (total ? Math.round((present / total) * 100) : null);
  return {
    learner: {
      id: learner.id,
      name: fullName(learner),
      learnerNumber: learner.learnerNumber ?? null,
      clubId: learner.clubId,
      status: learner.status,
    },
    term: term ? { id: term.id, number: term.number, year: term.year } : null,
    attendance: {
      term: thisTerm && { ...thisTerm, rate: rate(thisTerm) },
      allTime: { ...allTime, rate: rate(allTime) },
    },
    projects: await presentProjects(projects),
    eventProjects,
    results,
    averageScore: average(results.map((r) => r.percent)),
  };
}

/** A club's projects per track and its assessments with their averages. */
export async function clubProgress(actor, scope, clubId) {
  const club = await findClub(actor, scope, clubId);
  const [projects, assessments, learners] = await Promise.all([
    repo.projectsOfClub(clubId),
    repo.assessmentsOfClub(clubId),
    repo.activeLearners(clubId),
  ]);
  const scores = await repo.scoresOf(assessments.map((a) => a.id));
  const byTrack = {};
  for (const p of projects) byTrack[p.track] = (byTrack[p.track] ?? 0) + 1;
  const withProject = new Set(projects.flatMap((p) => p.learnerIds));
  return {
    club: { id: club.id, code: club.code, name: club.name },
    activeLearners: learners.length,
    learnersWithProject: learners.filter((l) => withProject.has(l.id)).length,
    projectsByTrack: byTrack,
    projects: await presentProjects(projects.slice(0, 20)),
    assessments: assessments.map((a) => presentAssessment(a, scores)),
  };
}
