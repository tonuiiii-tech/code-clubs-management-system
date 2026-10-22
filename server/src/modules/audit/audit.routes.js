import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { paginationSchema } from '@code-clubs/shared/schemas';
import { validate } from '../../middleware/validate.js';
import * as controller from './audit.controller.js';

export const auditRouter = Router();

auditRouter.get(
  '/',
  authenticate,
  authorize('audit:read'),
  validate({ query: paginationSchema }),
  controller.list,
);
