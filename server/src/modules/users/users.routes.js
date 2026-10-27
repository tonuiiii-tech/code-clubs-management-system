import { Router } from 'express';
import { z } from 'zod';
import {
  createUserSchema,
  updateOwnProfileSchema,
  idSchema,
  listUsersQuerySchema,
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
  validate({ query: listUsersQuerySchema }),
  controller.list,
);
usersRouter.patch(
  '/me',
  authorize('user:updateSelf'),
  validate({ body: updateOwnProfileSchema }),
  controller.updateMe,
);
usersRouter.get('/:id', authorize('user:read'), validate({ params: idParams }), controller.get);
usersRouter.post(
  '/',
  authorize('user:create'),
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
