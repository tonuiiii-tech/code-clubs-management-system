import { z } from 'zod';
import { COUNTIES, RECORD_STATUSES, REGION_VALUES, SCHOOL_TYPES } from '../enums.js';
import { kenyanPhoneSchema, paginationSchema } from './common.js';

export const gpsSchema = z.object({
  lat: z.number().min(-4.9).max(5.1),
  lng: z.number().min(33.9).max(42),
});

export const createSchoolSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    type: z.enum(SCHOOL_TYPES),
    region: z.enum(REGION_VALUES),
    county: z.enum(COUNTIES),
    subCounty: z.string().trim().min(2).max(80),
    ward: z.string().trim().max(80).optional(),
    gps: gpsSchema.optional(),
    contactName: z.string().trim().max(120).optional(),
    contactPhone: kenyanPhoneSchema.optional(),
  })
  .strict();

export const updateSchoolSchema = createSchoolSchema
  .partial()
  .extend({ status: z.enum(RECORD_STATUSES).optional() })
  .strict();

export const listSchoolsQuerySchema = paginationSchema.extend({
  region: z.enum(REGION_VALUES).optional(),
  county: z.enum(COUNTIES).optional(),
  type: z.enum(SCHOOL_TYPES).optional(),
  status: z.enum(RECORD_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  // Schools with no open club, the only ones a new club can be added to (D5-11).
  withoutClub: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
