import { z } from 'zod';
import {
  CHAMPION_TYPES,
  LANGUAGES,
  REGION_VALUES,
  ROLE_VALUES,
  SAFEGUARDING_STATUSES,
  USER_STATUSES,
} from '../enums.js';
import { emailSchema, kenyanPhoneSchema } from './common.js';

export const safeguardingSchema = z.object({
  status: z.enum(SAFEGUARDING_STATUSES),
  date: z.iso.date().optional(),
});

export const championProfileSchema = z.object({
  type: z.enum(CHAMPION_TYPES),
  skills: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  safeguarding: safeguardingSchema.default({ status: 'pending' }),
});

/** Fields an administrator may set when creating a user. */
export const createUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: emailSchema,
    phone: kenyanPhoneSchema.optional(),
    role: z.enum(ROLE_VALUES),
    regions: z.array(z.enum(REGION_VALUES)).default([]),
    championProfile: championProfileSchema.optional(),
    preferredLanguage: z.enum(LANGUAGES).default('en'),
  })
  .strict();

/** Administrator update. Role changes are separate so they can be audited and restricted. */
export const updateUserSchema = createUserSchema.omit({ role: true }).partial().strict();

export const updateUserStatusSchema = z.object({ status: z.enum(USER_STATUSES) }).strict();

/** What a user may change about themselves. Never role, status or assignments. */
export const updateOwnProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: kenyanPhoneSchema,
    preferredLanguage: z.enum(LANGUAGES),
  })
  .partial()
  .strict();
