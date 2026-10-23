import * as service from './learners.service.js';
import { sendFile } from '../../middleware/upload.js';

const meta = (req) => ({ requestId: req.id });

export async function list(req, res) {
  res.json(await service.listLearners(req.user, req.scope, req.valid.query));
}

export async function get(req, res) {
  res.json({ data: await service.getLearner(req.user, req.scope, req.valid.params.id) });
}

export async function create(req, res) {
  const learner = await service.createLearner(req.user, req.scope, req.valid.body, meta(req));
  res.status(201).json({ data: learner });
}

export async function update(req, res) {
  const { id } = req.valid.params;
  res.json({
    data: await service.updateLearner(req.user, req.scope, id, req.valid.body, meta(req)),
  });
}

export async function setStatus(req, res) {
  const { id } = req.valid.params;
  const learner = await service.setLearnerStatus(
    req.user,
    req.scope,
    id,
    req.valid.body,
    meta(req),
  );
  res.json({ data: learner });
}

export async function getContact(req, res) {
  const { id } = req.valid.params;
  res.json({ data: await service.getContact(req.user, req.scope, id, meta(req)) });
}

export async function putContact(req, res) {
  await service.putContact(req.user, req.scope, req.valid.params.id, req.valid.body, meta(req));
  res.status(204).end();
}

export async function setConsent(req, res) {
  const { id, type } = req.valid.params;
  const consents = await service.setConsent(
    req.user,
    req.scope,
    id,
    type,
    req.valid.body,
    meta(req),
  );
  res.json({ data: consents });
}

export async function uploadConsentFile(req, res) {
  const { id, type } = req.valid.params;
  const consents = await service.uploadConsentFile(
    req.user,
    req.scope,
    id,
    type,
    req.file,
    meta(req),
  );
  res.json({ data: consents });
}

export async function downloadConsentFile(req, res) {
  const { id, type } = req.valid.params;
  const { file, filename } = await service.downloadConsentFile(
    req.user,
    req.scope,
    id,
    type,
    meta(req),
  );
  sendFile(res, file, filename);
}
