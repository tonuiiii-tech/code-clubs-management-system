import * as service from './schools.service.js';

export async function list(req, res) {
  res.json(await service.listSchools(req.user, req.scope, req.valid.query));
}

export async function get(req, res) {
  res.json({ data: await service.getSchool(req.user, req.scope, req.valid.params.id) });
}

export async function create(req, res) {
  const school = await service.createSchool(req.user, req.scope, req.valid.body, {
    requestId: req.id,
  });
  res.status(201).json({ data: school });
}

export async function update(req, res) {
  const school = await service.updateSchool(
    req.user,
    req.scope,
    req.valid.params.id,
    req.valid.body,
    { requestId: req.id },
  );
  res.json({ data: school });
}
