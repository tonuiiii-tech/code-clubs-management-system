import { getSummary } from './dashboard.service.js';

export async function summary(req, res) {
  res.json({ data: await getSummary(req.user, req.scope) });
}
