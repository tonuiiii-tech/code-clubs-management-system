import { sendFile } from '../../middleware/upload.js';
import * as service from './progress.service.js';

const meta = (req) => ({ requestId: req.id });
const id = (req) => req.valid.params.id;

export async function listProjects(req, res) {
  res.json(await service.listProjects(req.user, req.scope, req.valid.query));
}

export async function getProject(req, res) {
  res.json({ data: await service.getProject(req.user, req.scope, id(req)) });
}

export async function createProject(req, res) {
  const project = await service.createProject(req.user, req.scope, req.valid.body, meta(req));
  res.status(201).json({ data: project });
}

export async function updateProject(req, res) {
  res.json({
    data: await service.updateProject(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}

export async function deleteProject(req, res) {
  await service.deleteProject(req.user, req.scope, id(req), meta(req));
  res.status(204).end();
}

export async function putProjectFile(req, res) {
  res.json({
    data: await service.putProjectFile(
      req.user,
      req.scope,
      id(req),
      req.file,
      req.valid.query,
      meta(req),
    ),
  });
}

export async function getProjectFile(req, res) {
  const { file, filename } = await service.getProjectFile(req.user, req.scope, id(req));
  sendFile(res, file, filename);
}

export async function listAssessments(req, res) {
  res.json(await service.listAssessments(req.user, req.scope, req.valid.query));
}

export async function getAssessment(req, res) {
  res.json({ data: await service.getAssessment(req.user, req.scope, id(req)) });
}

export async function createAssessment(req, res) {
  const assessment = await service.createAssessment(req.user, req.scope, req.valid.body, meta(req));
  res.status(201).json({ data: assessment });
}

export async function updateAssessment(req, res) {
  res.json({
    data: await service.updateAssessment(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}

export async function saveScores(req, res) {
  res.json({
    data: await service.saveScores(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}

export async function learnerProgress(req, res) {
  res.json({ data: await service.learnerProgress(req.user, req.scope, id(req)) });
}

export async function clubProgress(req, res) {
  res.json({ data: await service.clubProgress(req.user, req.scope, id(req)) });
}
