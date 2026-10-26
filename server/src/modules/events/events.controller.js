import { sendFile } from '../../middleware/upload.js';
import * as service from './events.service.js';

const meta = (req) => ({ requestId: req.id });
const p = (req) => req.valid.params;

export async function list(req, res) {
  res.json(await service.listEvents(req.user, req.scope, req.valid.query));
}

export async function get(req, res) {
  res.json({ data: await service.getEvent(req.user, req.scope, p(req).id) });
}

export async function create(req, res) {
  const event = await service.createEvent(req.user, req.scope, req.valid.body, meta(req));
  res.status(201).json({ data: event });
}

export async function update(req, res) {
  res.json({
    data: await service.updateEvent(req.user, req.scope, p(req).id, req.valid.body, meta(req)),
  });
}

export async function setClubs(req, res) {
  res.json({
    data: await service.setEventClubs(req.user, req.scope, p(req).id, req.valid.body, meta(req)),
  });
}

export async function participants(req, res) {
  res.json({ data: await service.listParticipants(req.user, req.scope, p(req).id) });
}

export async function register(req, res) {
  const data = await service.registerParticipants(
    req.user,
    req.scope,
    p(req).id,
    req.valid.body,
    meta(req),
  );
  res.status(201).json({ data });
}

export async function participantStatus(req, res) {
  const { id, learnerId } = p(req);
  res.json({
    data: await service.setParticipantStatus(
      req.user,
      req.scope,
      id,
      learnerId,
      req.valid.body,
      meta(req),
    ),
  });
}

export async function setConsent(req, res) {
  const { id, learnerId } = p(req);
  res.json({
    data: await service.setEventConsent(
      req.user,
      req.scope,
      id,
      learnerId,
      req.valid.body,
      meta(req),
    ),
  });
}

export async function uploadConsentFile(req, res) {
  const { id, learnerId } = p(req);
  res.json({
    data: await service.uploadEventConsentFile(
      req.user,
      req.scope,
      id,
      learnerId,
      req.file,
      meta(req),
    ),
  });
}

export async function downloadConsentFile(req, res) {
  const { id, learnerId } = p(req);
  const { file, filename } = await service.downloadEventConsentFile(
    req.user,
    req.scope,
    id,
    learnerId,
    meta(req),
  );
  sendFile(res, file, filename);
}

export async function projects(req, res) {
  res.json({ data: await service.listProjects(req.user, req.scope, p(req).id) });
}

export async function createProject(req, res) {
  const data = await service.createProject(
    req.user,
    req.scope,
    p(req).id,
    req.valid.body,
    meta(req),
  );
  res.status(201).json({ data });
}

export async function updateProject(req, res) {
  const { id, projectId } = p(req);
  res.json({
    data: await service.updateProject(
      req.user,
      req.scope,
      id,
      projectId,
      req.valid.body,
      meta(req),
    ),
  });
}

export async function addPhoto(req, res) {
  const event = await service.addPhoto(
    req.user,
    req.scope,
    p(req).id,
    req.file,
    req.valid.query,
    meta(req),
  );
  res.status(201).json({ data: event });
}

export async function getPhoto(req, res) {
  const { id, photoId } = p(req);
  const { file, filename } = await service.getPhoto(req.user, req.scope, id, photoId);
  sendFile(res, file, filename);
}

export async function deletePhoto(req, res) {
  const { id, photoId } = p(req);
  await service.deletePhoto(req.user, req.scope, id, photoId, meta(req));
  res.status(204).end();
}
