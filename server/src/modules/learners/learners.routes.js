import { Router } from 'express';
import { z } from 'zod';
import { UPLOAD_TYPES } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import {
  consentSchema,
  consentTypeSchema,
  createLearnerSchema,
  idSchema,
  learnerContactSchema,
  learnerStatusSchema,
  listLearnersQuerySchema,
  updateLearnerSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import * as controller from './learners.controller.js';

export const learnersRouter = Router();
const idParams = z.object({ id: idSchema });
const consentParams = z.object({ id: idSchema, type: consentTypeSchema });

learnersRouter.use(authenticate);
learnersRouter.get(
  '/',
  authorize('learner:read'),
  validate({ query: listLearnersQuerySchema }),
  controller.list,
);
learnersRouter.post(
  '/',
  authorize('learner:write'),
  validate({ body: createLearnerSchema }),
  controller.create,
);
learnersRouter.get(
  '/:id',
  authorize('learner:read'),
  validate({ params: idParams }),
  controller.get,
);
learnersRouter.patch(
  '/:id',
  authorize('learner:write'),
  validate({ params: idParams, body: updateLearnerSchema }),
  controller.update,
);
learnersRouter.patch(
  '/:id/status',
  authorize('learner:write'),
  validate({ params: idParams, body: learnerStatusSchema }),
  controller.setStatus,
);
learnersRouter.get(
  '/:id/contact',
  authorize('learnerContact:read'),
  validate({ params: idParams }),
  controller.getContact,
);
learnersRouter.put(
  '/:id/contact',
  authorize('learnerContact:write'),
  validate({ params: idParams, body: learnerContactSchema }),
  controller.putContact,
);
learnersRouter.put(
  '/:id/consents/:type',
  authorize('consent:write'),
  validate({ params: consentParams, body: consentSchema }),
  controller.setConsent,
);
// The body is the file itself (JPG, PNG or PDF, max 5 MB), checked by its content (D2-3).
learnersRouter.put(
  '/:id/consents/:type/file',
  authorize('consent:write'),
  validate({ params: consentParams }),
  upload(UPLOAD_TYPES, ERROR_MESSAGES.fileTypeNotAllowed),
  controller.uploadConsentFile,
);
learnersRouter.get(
  '/:id/consents/:type/file',
  authorize('consentFile:read'),
  validate({ params: consentParams }),
  controller.downloadConsentFile,
);
