import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './audit.controller.js';

export const auditRouter = Router();

auditRouter.get('/', authenticate, authorize('audit:read'), controller.list);
