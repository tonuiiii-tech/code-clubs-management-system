import { Router } from 'express';
import { z } from 'zod';
import {
  createResourceSchema,
  idSchema,
  listResourcesQuerySchema,
  resourceFileQuerySchema,
  updateResourceSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { uploadResource } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './resources.controller.js';

export const resourcesRouter = Router();
const idParams = z.object({ id: idSchema });

resourcesRouter.use(authenticate);
resourcesRouter.get(
  '/',
  authorize('resource:read'),
  validate({ query: listResourcesQuerySchema }),
  controller.list,
);
resourcesRouter.post(
  '/',
  authorize('resource:manage'),
  validate({ body: createResourceSchema }),
  controller.create,
);
resourcesRouter.get(
  '/:id',
  authorize('resource:read'),
  validate({ params: idParams }),
  controller.get,
);
resourcesRouter.patch(
  '/:id',
  authorize('resource:manage'),
  validate({ params: idParams, body: updateResourceSchema }),
  controller.update,
);
resourcesRouter.delete(
  '/:id',
  authorize('resource:manage'),
  validate({ params: idParams }),
  controller.remove,
);
resourcesRouter.put(
  '/:id/file',
  authorize('resource:manage'),
  validate({ params: idParams, query: resourceFileQuerySchema }),
  uploadResource(),
  controller.putFile,
);
resourcesRouter.delete(
  '/:id/file',
  authorize('resource:manage'),
  validate({ params: idParams }),
  controller.deleteFile,
);
resourcesRouter.get(
  '/:id/file',
  authorize('resource:read'),
  validate({ params: idParams }),
  controller.getFile,
);
