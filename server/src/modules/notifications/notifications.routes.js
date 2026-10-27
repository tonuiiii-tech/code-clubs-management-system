import { Router } from 'express';
import { listOutboxQuerySchema } from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { listOutbox } from './notifications.repository.js';

/** HQ can see every email, SMS and WhatsApp message the stubs recorded (US-24). */
export const notificationsRouter = Router();

notificationsRouter.get(
  '/outbox',
  authenticate,
  authorize('report:schedule'),
  validate({ query: listOutboxQuerySchema }),
  async (req, res) => {
    res.json(await listOutbox(req.valid.query));
  },
);
