import * as service from './terms.service.js';

export async function list(_req, res) {
  res.json({ data: await service.listTerms() });
}

export async function create(req, res) {
  res
    .status(201)
    .json({ data: await service.createTerm(req.user, req.valid.body, { requestId: req.id }) });
}

export async function update(req, res) {
  const term = await service.updateTerm(req.user, req.valid.params.id, req.valid.body, {
    requestId: req.id,
  });
  res.json({ data: term });
}
