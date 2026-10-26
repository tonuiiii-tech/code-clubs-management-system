import { z } from 'zod';
import { REGION_VALUES } from '../enums.js';
import { emailSchema, idSchema, paginationSchema } from './common.js';

/** HQ dashboard and termly report filters (docs/sprints/sprint-4.md, sections 4 and 5). */
export const hqDashboardQuerySchema = z.object({
  termId: idSchema.optional(),
  region: z.enum(REGION_VALUES).optional(),
});

export const alertsQuerySchema = z.object({
  region: z.enum(REGION_VALUES).optional(),
  clubId: idSchema.optional(),
});

export const termReportQuerySchema = z.object({
  termId: idSchema,
  region: z.enum(REGION_VALUES).optional(),
  clubId: idSchema.optional(),
});

/** Who receives the termly report by email. */
export const reportRecipientsSchema = z
  .object({
    recipients: z
      .array(z.object({ name: z.string().trim().min(2).max(120), email: emailSchema }).strict())
      .max(50),
  })
  .strict();

export const listOutboxQuerySchema = paginationSchema;
