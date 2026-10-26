import { z } from 'zod';
import { ASSESSMENT_MAX_SCORE, CLUB_MAX_CAPACITY, TRACKS } from '../enums.js';
import { idSchema, paginationSchema } from './common.js';

/**
 * Learner progress (questionnaire Q23, plan section 6): projects learners made and assessment
 * scores. Both can be recorded offline, so the device may give the id (D5-5).
 */
const projectFields = z.object({
  title: z.string().trim().min(2).max(120),
  track: z.enum(TRACKS),
  learnerIds: z
    .array(idSchema)
    .min(1)
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Each learner only once' }),
  sessionId: idSchema.optional(),
  link: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .optional(),
  date: z.iso.date(),
  note: z.string().trim().max(1000).optional(),
});

export const createProjectSchema = projectFields
  .extend({ id: idSchema.optional(), clubId: idSchema })
  .strict();
export const updateProjectSchema = projectFields
  .partial()
  .extend({ link: projectFields.shape.link.nullable() })
  .partial()
  .strict();

export const listProjectsQuerySchema = paginationSchema.extend({
  clubId: idSchema.optional(),
  learnerId: idSchema.optional(),
  track: z.enum(TRACKS).optional(),
});

/** Query for a project's file or photo; the body is the file itself. */
export const projectFileQuerySchema = z.object({
  // The champion confirms that members without photo consent are not in the photo (D2-7).
  confirmConsent: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  opId: idSchema.optional(),
});

const assessmentFields = z.object({
  title: z.string().trim().min(2).max(120),
  track: z.enum(TRACKS),
  date: z.iso.date(),
  maxScore: z.number().int().min(1).max(ASSESSMENT_MAX_SCORE),
});

export const createAssessmentSchema = assessmentFields
  .extend({ id: idSchema.optional(), clubId: idSchema })
  .strict();
export const updateAssessmentSchema = assessmentFields.partial().strict();

export const listAssessmentsQuerySchema = paginationSchema.extend({
  clubId: idSchema.optional(),
  track: z.enum(TRACKS).optional(),
});

/** Scores are merged learner by learner, like attendance (D5-5); null clears a score. */
export const assessmentScoresSchema = z
  .object({
    scores: z
      .array(
        z
          .object({
            learnerId: idSchema,
            score: z.number().min(0).max(ASSESSMENT_MAX_SCORE).multipleOf(0.5).nullable(),
          })
          .strict(),
      )
      .max(CLUB_MAX_CAPACITY * 2)
      .refine((rows) => new Set(rows.map((r) => r.learnerId)).size === rows.length, {
        message: 'Each learner can appear only once',
      }),
  })
  .strict();

/** A project's date or an assessment's date cannot be in the future. */
export const notInFuture = (date, now = new Date()) => date <= now.toISOString().slice(0, 10);
