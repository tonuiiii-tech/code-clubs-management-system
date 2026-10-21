import { Router } from 'express';
import { z } from 'zod';
import {
  createUserSchema,
  idSchema,
  paginationSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './users.controller.js';

export const usersRouter = Router();
const idParams = z.object({ id: idSchema });

usersRouter.use(authenticate);
usersRouter.get(
  '/',
  authorize('user:read'),
  validate({ query: paginationSchema }),
  controller.list,
);
usersRouter.post(
  '/',
  authorize('user:manage'),
  validate({ body: createUserSchema }),
  controller.create,
);
usersRouter.patch(
  '/:id',
  authorize('user:manage'),
  validate({ params: idParams, body: updateUserSchema }),
  controller.update,
);
usersRouter.patch(
  '/:id/status',
  authorize('user:manage'),
  validate({ params: idParams, body: updateUserStatusSchema }),
  controller.setStatus,
);
