import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  alertsQuerySchema,
  dismissAlertSchema,
  hqDashboardQuerySchema,
} from '@code-clubs/shared/schemas';
import * as controller from './dashboard.controller.js';

export const dashboardRouter = Router();

// Counts follow the same scope as club:read, so each role sees totals for its own clubs.
dashboardRouter.get('/summary', authenticate, authorize('club:read'), controller.summary);

// Sprint 4: trends for HQ and coordinators (plan section 4.1).
dashboardRouter.get(
  '/hq',
  authenticate,
  authorize('dashboard:hq'),
  validate({ query: hqDashboardQuerySchema }),
  controller.hq,
);

// Alerts for the clubs each role can read, computed when asked (D4-2).
export const alertsRouter = Router();
alertsRouter.get(
  '/',
  authenticate,
  authorize('club:read'),
  validate({ query: alertsQuerySchema }),
  controller.alerts,
);
// Hides one alert for the person who dismissed it, for 7 days (R4-4).
alertsRouter.post(
  '/dismissals',
  authenticate,
  authorize('club:read'),
  validate({ body: dismissAlertSchema }),
  controller.dismiss,
);
