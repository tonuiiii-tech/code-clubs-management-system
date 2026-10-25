import { Router } from 'express';
import {
  listSyncConflictsQuerySchema,
  syncPullQuerySchema,
  syncPushSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './sync.controller.js';

/**
 * Offline sync (docs/sync-protocol.md). Each pushed change is checked against the permission of
 * its own online endpoint, so `sync:use` only says who may keep data on a device (D3-1).
 */
export const syncRouter = Router();

syncRouter.use(authenticate);
syncRouter.post(
  '/push',
  authorize('sync:use'),
  validate({ body: syncPushSchema }),
  controller.push,
);
syncRouter.get('/pull', validate({ query: syncPullQuerySchema }), controller.pull);
syncRouter.get(
  '/conflicts',
  authorize('syncConflict:read'),
  validate({ query: listSyncConflictsQuerySchema }),
  controller.listConflicts,
);
