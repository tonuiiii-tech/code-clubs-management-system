import { z } from 'zod';
import {
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_REPORT_CONDITIONS,
  EQUIPMENT_TYPES,
  REGION_VALUES,
} from '../enums.js';
import { idSchema, paginationSchema } from './common.js';

/** Equipment: laptops, tablets and robotics kits (questionnaire Q25–Q26, plan section 4). */
const equipmentFields = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(EQUIPMENT_TYPES),
  serialNumber: z.string().trim().min(2).max(80).optional(),
  condition: z.enum(EQUIPMENT_CONDITIONS).default('working'),
  // The region whose store keeps the item when it is not lent out.
  region: z.enum(REGION_VALUES),
  // A kit is lent as one item; its parts are listed here (D5-1).
  contents: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const createEquipmentSchema = equipmentFields.strict();
export const updateEquipmentSchema = equipmentFields
  .partial()
  .extend({ condition: z.enum(EQUIPMENT_CONDITIONS).optional() })
  .strict();

export const listEquipmentQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(80).optional(),
  type: z.enum(EQUIPMENT_TYPES).optional(),
  condition: z.enum(EQUIPMENT_CONDITIONS).optional(),
  region: z.enum(REGION_VALUES).optional(),
  clubId: idSchema.optional(),
  location: z.enum(['store', 'club']).optional(),
  overdue: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

const noteSchema = z.string().trim().max(500).optional();

export const lendEquipmentSchema = z
  .object({
    clubId: idSchema,
    outDate: z.iso.date(),
    dueDate: z.iso.date().optional(),
    note: noteSchema,
  })
  .strict()
  .refine((loan) => !loan.dueDate || loan.dueDate >= loan.outDate, {
    path: ['dueDate'],
    message: 'The due date cannot be before the date it goes out',
  });

export const returnEquipmentSchema = z
  .object({
    returnedDate: z.iso.date(),
    condition: z.enum(EQUIPMENT_CONDITIONS),
    note: noteSchema,
  })
  .strict();

export const equipmentRepairSchema = z
  .object({
    date: z.iso.date(),
    problem: z.string().trim().min(2).max(500),
    action: z.string().trim().max(500).optional(),
    cost: z.number().min(0).max(10_000_000).optional(),
    conditionAfter: z.enum(EQUIPMENT_CONDITIONS),
  })
  .strict();

/** A champion reports an item their club holds as needing repair, damaged or lost. */
export const reportEquipmentSchema = z
  .object({
    condition: z.enum(EQUIPMENT_REPORT_CONDITIONS),
    note: z.string().trim().min(2).max(500),
  })
  .strict();
