import { Router } from 'express';
import { z } from 'zod';
import {
  assignChampionSchema,
  createClubSchema,
  idSchema,
  listClubsQuerySchema,
  updateClubSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './clubs.controller.js';

export const clubsRouter = Router();
const idParams = z.object({ id: idSchema });
const assignmentParams = z.object({ id: idSchema, userId: idSchema });

clubsRouter.use(authenticate);
clubsRouter.get(
  '/',
  authorize('club:read'),
  validate({ query: listClubsQuerySchema }),
  controller.list,
);
clubsRouter.post(
  '/',
  authorize('club:write'),
  validate({ body: createClubSchema }),
  controller.create,
);
clubsRouter.get('/:id', authorize('club:read'), validate({ params: idParams }), controller.get);
clubsRouter.patch(
  '/:id',
  authorize('club:write'),
  validate({ params: idParams, body: updateClubSchema }),
  controller.update,
);
clubsRouter.get(
  '/:id/champions',
  authorize('club:read'),
  validate({ params: idParams }),
  controller.listChampions,
);
clubsRouter.put(
  '/:id/champions/:userId',
  authorize('club:assignChampion'),
  validate({ params: assignmentParams, body: assignChampionSchema }),
  controller.assignChampion,
);
clubsRouter.delete(
  '/:id/champions/:userId',
  authorize('club:assignChampion'),
  validate({ params: assignmentParams }),
  controller.unassignChampion,
);
