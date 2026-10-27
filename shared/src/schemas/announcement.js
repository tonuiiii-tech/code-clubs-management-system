import { z } from 'zod';
import { ANNOUNCEMENT_MAX_LENGTH, MESSAGE_CHANNELS, REGION_VALUES, ROLE_VALUES } from '../enums.js';
import { idSchema, paginationSchema } from './common.js';

/**
 * An announcement to app users (D4-7): never to guardians. An empty audience list means
 * "no limit" for that part, so { roles: ['champion'] } reaches every champion in scope.
 */
export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(1).max(ANNOUNCEMENT_MAX_LENGTH),
    audience: z
      .object({
        roles: z.array(z.enum(ROLE_VALUES)).max(4).default([]),
        regions: z.array(z.enum(REGION_VALUES)).max(4).default([]),
        clubIds: z.array(idSchema).max(500).default([]),
      })
      .strict(),
    // Copies by SMS or WhatsApp go through a stub until a provider is chosen (D4-5).
    channels: z.array(z.enum(MESSAGE_CHANNELS)).max(2).default([]),
  })
  .strict();

export const listAnnouncementsQuerySchema = paginationSchema.extend({
  box: z.enum(['inbox', 'sent']).default('inbox'),
});

export const announcementIdSchema = idSchema;
