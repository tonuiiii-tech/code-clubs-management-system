import { Router } from 'express';
import { z } from 'zod';
import {
  createEquipmentSchema,
  equipmentRepairSchema,
  idSchema,
  lendEquipmentSchema,
  listEquipmentQuerySchema,
  reportEquipmentSchema,
  returnEquipmentSchema,
  updateEquipmentSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './equipment.controller.js';

export const equipmentRouter = Router();
const idParams = z.object({ id: idSchema });

equipmentRouter.use(authenticate);
equipmentRouter.get(
  '/',
  authorize('equipment:read'),
  validate({ query: listEquipmentQuerySchema }),
  controller.list,
);
equipmentRouter.post(
  '/',
  authorize('equipment:manage'),
  validate({ body: createEquipmentSchema }),
  controller.create,
);
equipmentRouter.get(
  '/:id',
  authorize('equipment:read'),
  validate({ params: idParams }),
  controller.get,
);
equipmentRouter.patch(
  '/:id',
  authorize('equipment:manage'),
  validate({ params: idParams, body: updateEquipmentSchema }),
  controller.update,
);
equipmentRouter.post(
  '/:id/loans',
  authorize('equipment:manage'),
  validate({ params: idParams, body: lendEquipmentSchema }),
  controller.lend,
);
equipmentRouter.post(
  '/:id/return',
  authorize('equipment:manage'),
  validate({ params: idParams, body: returnEquipmentSchema }),
  controller.giveBack,
);
equipmentRouter.post(
  '/:id/repairs',
  authorize('equipment:manage'),
  validate({ params: idParams, body: equipmentRepairSchema }),
  controller.repair,
);
// Champions report the items their clubs hold (US-27).
equipmentRouter.post(
  '/:id/report',
  authorize('equipment:report'),
  validate({ params: idParams, body: reportEquipmentSchema }),
  controller.report,
);
