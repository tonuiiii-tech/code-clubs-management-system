import * as service from './clubs.service.js';

export async function list(req, res) {
  res.json(await service.listClubs(req.user, req.scope, req.valid.query));
}

export async function get(req, res) {
  res.json({ data: await service.getClub(req.user, req.scope, req.valid.params.id) });
}

export async function create(req, res) {
  const club = await service.createClub(req.user, req.scope, req.valid.body, { requestId: req.id });
  res.status(201).json({ data: club });
}

export async function update(req, res) {
  const club = await service.updateClub(req.user, req.scope, req.valid.params.id, req.valid.body, {
    requestId: req.id,
  });
  res.json({ data: club });
}

export async function listChampions(req, res) {
  res.json({ data: await service.listChampions(req.user, req.scope, req.valid.params.id) });
}

export async function assignChampion(req, res) {
  const { id, userId } = req.valid.params;
  const assignment = await service.assignChampion(req.user, req.scope, id, userId, req.valid.body, {
    requestId: req.id,
  });
  res.json({ data: assignment });
}

export async function unassignChampion(req, res) {
  const { id, userId } = req.valid.params;
  await service.unassignChampion(req.user, req.scope, id, userId, { requestId: req.id });
  res.status(204).end();
}
