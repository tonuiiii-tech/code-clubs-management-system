import { getSummary } from './dashboard.service.js';
import { getAlerts, getHqDashboard } from '../insights/insights.service.js';

export async function summary(req, res) {
  res.json({ data: await getSummary(req.user, req.scope) });
}

export async function hq(req, res) {
  res.json({ data: await getHqDashboard(req.user, req.scope, req.valid.query) });
}

export async function alerts(req, res) {
  res.json({ data: await getAlerts(req.user, req.scope, req.valid.query) });
}
