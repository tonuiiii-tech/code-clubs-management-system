import * as service from './equipment.service.js';

const meta = (req) => ({ requestId: req.id });
const id = (req) => req.valid.params.id;

export async function list(req, res) {
  res.json(await service.listEquipment(req.user, req.scope, req.valid.query));
}

export async function get(req, res) {
  res.json({ data: await service.getEquipment(req.user, req.scope, id(req)) });
}

export async function create(req, res) {
  const item = await service.createEquipment(req.user, req.scope, req.valid.body, meta(req));
  res.status(201).json({ data: item });
}

export async function update(req, res) {
  res.json({
    data: await service.updateEquipment(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}

export async function lend(req, res) {
  res.status(201).json({
    data: await service.lendEquipment(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}

export async function giveBack(req, res) {
  res.json({
    data: await service.returnEquipment(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}

export async function repair(req, res) {
  res.status(201).json({
    data: await service.addRepair(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}

export async function report(req, res) {
  res.status(201).json({
    data: await service.reportEquipment(req.user, req.scope, id(req), req.valid.body, meta(req)),
  });
}
