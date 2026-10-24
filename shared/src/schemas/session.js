import { z } from 'zod';
import {
  ATTENDANCE_STATUSES,
  CLUB_MAX_CAPACITY,
  SESSION_EDIT_DAYS,
  SESSION_STATUSES,
} from '../enums.js';
import { idSchema, paginationSchema, timeSchema } from './common.js';

/** A session report: what the questionnaire asked for (Q20) plus the date. */
const sessionFields = z.object({
  date: z.iso.date(),
  status: z.enum(SESSION_STATUSES).default('held'),
  topic: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  cancellationReason: z.string().trim().max(300).optional(),
});

const sessionRules = (session, ctx) => {
  if (session.status === 'held' && !session.topic) {
    ctx.addIssue({ code: 'custom', path: ['topic'], message: 'Add the topic covered' });
  }
  if (session.startTime && session.endTime && session.endTime <= session.startTime) {
    ctx.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: 'End time must be after start time',
    });
  }
};

export const createSessionSchema = sessionFields
  .extend({ clubId: idSchema })
  .strict()
  .superRefine(sessionRules);

export const updateSessionSchema = sessionFields
  .partial()
  .extend({ status: z.enum(SESSION_STATUSES).optional() })
  .strict()
  .superRefine((session, ctx) => {
    if (session.startTime && session.endTime && session.endTime <= session.startTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'End time must be after start time',
      });
    }
  });

/** The whole attendance list for a session, saved at once (D2-4). */
export const attendanceSchema = z
  .object({
    records: z
      .array(z.object({ learnerId: idSchema, status: z.enum(ATTENDANCE_STATUSES) }).strict())
      .max(CLUB_MAX_CAPACITY * 2)
      .refine((records) => new Set(records.map((r) => r.learnerId)).size === records.length, {
        message: 'Each learner can appear only once',
      }),
  })
  .strict();

/** Query for adding a session photo; the body is the image itself. */
export const sessionPhotoQuerySchema = z.object({
  // The champion confirms that present learners without photo consent are not in the photo (D2-7).
  confirmConsent: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const listSessionsQuerySchema = paginationSchema.extend({
  clubId: idSchema.optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

/**
 * True while a champion may still change a session's report: up to 7 days after its date (D2-5).
 * Coordinators and HQ have `session:editLate` and are not limited. Dates are YYYY-MM-DD.
 */
export function sessionEditWindowOpen(date, now = new Date()) {
  const earliest = new Date(now.getTime() - SESSION_EDIT_DAYS * 24 * 60 * 60 * 1000);
  return date >= earliest.toISOString().slice(0, 10);
}
