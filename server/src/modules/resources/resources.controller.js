import { sendFile } from '../../middleware/upload.js';
import * as service from './resources.service.js';

const meta = (req) => ({ requestId: req.id });
const id = (req) => req.valid.params.id;

export async function list(req, res) {
  res.json(await service.listResources(req.user, req.scope, req.valid.query));
}

export async function get(req, res) {
  res.json({ data: await service.getResource(req.user, req.scope, id(req)) });
}

export async function create(req, res) {
  const resource = await service.createResource(req.user, req.scope, req.valid.body, meta(req));
  res.status(201).json({ data: resource });
}

export async function update(req, res) {
  res.json({
    data: await service.updateResource(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}

export async function remove(req, res) {
  await service.deleteResource(req.user, req.scope, id(req), meta(req));
  res.status(204).end();
}

export async function putFile(req, res) {
  res.json({
    data: await service.putResourceFile(
      req.user,
      req.scope,
      id(req),
      req.file,
      req.valid.query,
      meta(req),
    ),
  });
}

export async function deleteFile(req, res) {
  res.json({ data: await service.deleteResourceFile(req.user, req.scope, id(req), meta(req)) });
}

export async function getFile(req, res) {
  const { file, filename } = await service.getResourceFile(req.user, req.scope, id(req));
  sendFile(res, file, filename);
}
