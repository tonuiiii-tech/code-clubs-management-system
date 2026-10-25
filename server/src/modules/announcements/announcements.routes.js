import { Router } from 'express';
import { z } from 'zod';
import {
  createAnnouncementSchema,
  idSchema,
  listAnnouncementsQuerySchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './announcements.controller.js';

export const announcementsRouter = Router();
const idParams = z.object({ id: idSchema });

announcementsRouter.use(authenticate);
announcementsRouter.get(
  '/',
  authorize('announcement:read'),
  validate({ query: listAnnouncementsQuerySchema }),
  controller.list,
);
announcementsRouter.post(
  '/',
  authorize('announcement:send'),
  validate({ body: createAnnouncementSchema }),
  controller.send,
);
// The number of recipients and SMS or WhatsApp messages, before sending (R4-3).
announcementsRouter.post(
  '/preview',
  authorize('announcement:send'),
  validate({ body: createAnnouncementSchema.pick({ audience: true, channels: true }) }),
  controller.preview,
);
announcementsRouter.get(
  '/:id',
  authorize('announcement:read'),
  validate({ params: idParams }),
  controller.get,
);
announcementsRouter.post(
  '/:id/read',
  authorize('announcement:read'),
  validate({ params: idParams }),
  controller.read,
);
