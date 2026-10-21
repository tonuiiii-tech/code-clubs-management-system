import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './dashboard.controller.js';

export const dashboardRouter = Router();

// Counts follow the same scope as club:read, so each role sees totals for its own clubs.
dashboardRouter.get('/summary', authenticate, authorize('club:read'), controller.summary);
