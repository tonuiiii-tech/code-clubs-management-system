import { listAudit } from './audit.service.js';

export async function list(req, res) {
  res.json(await listAudit(req.user, req.scope, req.valid.query));
}
