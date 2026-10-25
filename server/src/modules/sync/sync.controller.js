import * as service from './sync.service.js';

export async function push(req, res) {
  res.json({ data: await service.push(req.user, req.valid.body, { requestId: req.id }) });
}

export async function pull(req, res) {
  res.json({ data: await service.pull(req.user, req.valid.query) });
}

export async function listConflicts(req, res) {
  res.json(await service.listConflicts(req.user, req.scope, req.valid.query));
}
