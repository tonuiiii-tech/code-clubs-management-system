import { Router } from 'express';
import { reportRecipientsSchema, termReportQuerySchema } from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './reports.controller.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.get(
  '/termly',
  authorize('report:read'),
  validate({ query: termReportQuerySchema }),
  controller.termly,
);
reportsRouter.get(
  '/termly.pdf',
  authorize('report:read'),
  validate({ query: termReportQuerySchema }),
  controller.termlyPdf,
);
reportsRouter.get('/recipients', authorize('report:schedule'), controller.recipients);
reportsRouter.put(
  '/recipients',
  authorize('report:schedule'),
  validate({ body: reportRecipientsSchema }),
  controller.setRecipients,
);
