import { z } from 'zod';
import { SYNC_OPERATION_TYPES, SYNC_PUSH_MAX_OPERATIONS } from '../enums.js';
import { idSchema, paginationSchema } from './common.js';

/**
 * One change made on a device (docs/sync-protocol.md, section 3). `data` is the body the
 * matching online endpoint takes and is checked with that endpoint's schema when it runs.
 */
export const syncOperationSchema = z
  .object({
    opId: idSchema,
    type: z.enum(SYNC_OPERATION_TYPES),
    recordId: idSchema.optional(),
    params: z.record(z.string(), z.string()).optional(),
    recordedAt: z.iso.datetime(),
    data: z.record(z.string(), z.unknown()),
    // Values the device saw before the change, for conflict detection only (D3-5).
    base: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const syncPushSchema = z
  .object({ operations: z.array(syncOperationSchema).min(1).max(SYNC_PUSH_MAX_OPERATIONS) })
  .strict();

export const syncPullQuerySchema = z.object({
  cursor: z.string().max(2000).optional(),
  scopeKey: z.string().max(64).optional(),
});

export const listSyncConflictsQuerySchema = paginationSchema;
