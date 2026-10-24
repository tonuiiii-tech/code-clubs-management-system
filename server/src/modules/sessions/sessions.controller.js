import * as service from './sessions.service.js';
import { sendFile } from '../../middleware/upload.js';

const meta = (req) => ({ requestId: req.id });

export async function list(req, res) {
  res.json(await service.listSessions(req.user, req.scope, req.valid.query));
}

export async function get(req, res) {
  res.json({ data: await service.getSession(req.user, req.scope, req.valid.params.id) });
}

export async function create(req, res) {
  const session = await service.createSession(req.user, req.scope, req.valid.body, meta(req));
  res.status(201).json({ data: session });
}

export async function update(req, res) {
  const { id } = req.valid.params;
  res.json({
    data: await service.updateSession(req.user, req.scope, id, req.valid.body, meta(req)),
  });
}

export async function saveAttendance(req, res) {
  const { id } = req.valid.params;
  const session = await service.saveAttendance(req.user, req.scope, id, req.valid.body, meta(req));
  res.json({ data: session });
}

export async function addPhoto(req, res) {
  const { id } = req.valid.params;
  const session = await service.addPhoto(
    req.user,
    req.scope,
    id,
    req.file,
    req.valid.query,
    meta(req),
  );
  res.status(201).json({ data: session });
}

export async function getPhoto(req, res) {
  const { id, photoId } = req.valid.params;
  const { file, filename } = await service.getPhoto(req.user, req.scope, id, photoId);
  sendFile(res, file, filename);
}

export async function deletePhoto(req, res) {
  const { id, photoId } = req.valid.params;
  await service.deletePhoto(req.user, req.scope, id, photoId, meta(req));
  res.status(204).end();
}
