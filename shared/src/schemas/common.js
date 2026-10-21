import { z } from 'zod';

export const idSchema = z.uuid();

/** Kenyan mobile or landline in E.164 form, e.g. +254712345678 or +254112345678. */
export const kenyanPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+254[17]\d{8}$/, 'Use the format +2547XXXXXXXX or +2541XXXXXXXX');

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
