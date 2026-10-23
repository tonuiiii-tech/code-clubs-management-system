import { Router } from 'express';
import { z } from 'zod';
import { PHOTO_TYPES } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import {
  attendanceSchema,
  createSessionSchema,
  idSchema,
  listSessionsQuerySchema,
  sessionPhotoQuerySchema,
  updateSessionSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import * as controller from './sessions.controller.js';

export const sessionsRouter = Router();
const idParams = z.object({ id: idSchema });
const photoParams = z.object({ id: idSchema, photoId: idSchema });

sessionsRouter.use(authenticate);
sessionsRouter.get(
  '/',
  authorize('session:read'),
  validate({ query: listSessionsQuerySchema }),
  controller.list,
);
sessionsRouter.post(
  '/',
  authorize('session:write'),
  validate({ body: createSessionSchema }),
  controller.create,
);
sessionsRouter.get(
  '/:id',
  authorize('session:read'),
  validate({ params: idParams }),
  controller.get,
);
sessionsRouter.patch(
  '/:id',
  authorize('session:write'),
  validate({ params: idParams, body: updateSessionSchema }),
  controller.update,
);
sessionsRouter.put(
  '/:id/attendance',
  authorize('session:write'),
  validate({ params: idParams, body: attendanceSchema }),
  controller.saveAttendance,
);
// The body is the photo itself (JPG or PNG), checked by its content (D2-7).
sessionsRouter.post(
  '/:id/photos',
  authorize('session:write'),
  validate({ params: idParams, query: sessionPhotoQuerySchema }),
  upload(PHOTO_TYPES, ERROR_MESSAGES.photoTypeNotAllowed),
  controller.addPhoto,
);
sessionsRouter.get(
  '/:id/photos/:photoId',
  authorize('session:read'),
  validate({ params: photoParams }),
  controller.getPhoto,
);
sessionsRouter.delete(
  '/:id/photos/:photoId',
  authorize('session:write'),
  validate({ params: photoParams }),
  controller.deletePhoto,
);
