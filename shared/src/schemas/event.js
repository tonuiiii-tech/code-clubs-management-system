import { z } from 'zod';
import {
  CONSENT_STATUSES,
  EVENT_PARTICIPANT_STATUSES,
  EVENT_STATUSES,
  EVENT_TYPES,
  REGION_VALUES,
} from '../enums.js';
import { idSchema, paginationSchema } from './common.js';

/** Events: hackathons, showcases, competitions and camps (questionnaire Q28–Q30). */
const eventFields = z.object({
  name: z.string().trim().min(3).max(120),
  type: z.enum(EVENT_TYPES),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  venue: z.string().trim().min(2).max(160),
  // null: a national event any club can be invited to.
  region: z.enum(REGION_VALUES).nullable(),
  description: z.string().trim().max(2000).optional(),
  capacity: z.number().int().min(1).max(5000).optional(),
  registrationCloses: z.iso.date().optional(),
  status: z.enum(EVENT_STATUSES).default('planned'),
});

const eventRules = (event, ctx) => {
  if (event.startDate && event.endDate && event.endDate < event.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'End date cannot be before start date',
    });
  }
  if (event.registrationCloses && event.endDate && event.registrationCloses > event.endDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['registrationCloses'],
      message: 'Registration must close before the event ends',
    });
  }
};

export const createEventSchema = eventFields
  .extend({ clubIds: z.array(idSchema).max(500).default([]) })
  .strict()
  .superRefine(eventRules);

export const updateEventSchema = eventFields
  .partial()
  .extend({ status: z.enum(EVENT_STATUSES).optional() })
  .strict()
  .superRefine(eventRules);

export const eventClubsSchema = z.object({ clubIds: z.array(idSchema).max(500) }).strict();

export const listEventsQuerySchema = paginationSchema.extend({
  status: z.enum(EVENT_STATUSES).optional(),
  from: z.iso.date().optional(),
  region: z.enum(REGION_VALUES).optional(),
});

export const registerParticipantsSchema = z
  .object({
    learnerIds: z
      .array(idSchema)
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'Each learner only once' }),
  })
  .strict();

export const participantStatusSchema = z
  .object({ status: z.enum(EVENT_PARTICIPANT_STATUSES) })
  .strict();

/** Consent for one learner to take part in one event (D4-6); the form is uploaded separately. */
export const eventConsentSchema = z
  .object({ status: z.enum(CONSENT_STATUSES), signedOn: z.iso.date().optional() })
  .strict();

const projectFields = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  link: z
    .url({ protocol: /^https?$/ })
    .max(300)
    .optional(),
  learnerIds: z.array(idSchema).min(1).max(10),
  // Results (Q29): an award name and/or a rank.
  award: z.string().trim().max(80).optional(),
  rank: z.number().int().min(1).max(1000).optional(),
});

export const createEventProjectSchema = projectFields.strict();
export const updateEventProjectSchema = projectFields.partial().strict();

export const eventPhotoQuerySchema = z.object({
  confirmConsent: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
