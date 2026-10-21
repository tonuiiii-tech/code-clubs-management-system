import { Router } from 'express';
import { z } from 'zod';
import {
  createSchoolSchema,
  idSchema,
  listSchoolsQuerySchema,
  updateSchoolSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './schools.controller.js';

export const schoolsRouter = Router();
const idParams = z.object({ id: idSchema });

schoolsRouter.use(authenticate);
schoolsRouter.get(
  '/',
  authorize('school:read'),
  validate({ query: listSchoolsQuerySchema }),
  controller.list,
);
schoolsRouter.post(
  '/',
  authorize('school:write'),
  validate({ body: createSchoolSchema }),
  controller.create,
);
schoolsRouter.get('/:id', authorize('school:read'), validate({ params: idParams }), controller.get);
schoolsRouter.patch(
  '/:id',
  authorize('school:write'),
  validate({ params: idParams, body: updateSchoolSchema }),
  controller.update,
);
