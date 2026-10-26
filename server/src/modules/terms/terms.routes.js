import { Router } from 'express';
import { z } from 'zod';
import { createTermSchema, idSchema, updateTermSchema } from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './terms.controller.js';

export const termsRouter = Router();
const idParams = z.object({ id: idSchema });

termsRouter.use(authenticate);
// Term dates are not personal data; every signed-in user may read them.
termsRouter.get('/', controller.list);
termsRouter.post(
  '/',
  authorize('term:manage'),
  validate({ body: createTermSchema }),
  controller.create,
);
termsRouter.patch(
  '/:id',
  authorize('term:manage'),
  validate({ params: idParams, body: updateTermSchema }),
  controller.update,
);
