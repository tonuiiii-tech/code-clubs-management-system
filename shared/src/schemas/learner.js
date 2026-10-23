import { z } from 'zod';
import {
  CONSENT_STATUSES,
  CONSENT_TYPES,
  GENDERS,
  GRADES,
  GUARDIAN_RELATIONSHIPS,
  LEARNER_MAX_AGE,
  LEARNER_MIN_AGE,
  LEARNER_STATUSES,
} from '../enums.js';
import { idSchema, kenyanPhoneSchema, paginationSchema } from './common.js';

/**
 * Learners are children, so only these fields are collected (D2-2, D2-9). Age is asked for and
 * stored as a year of birth; there is no full date of birth, address or photo of the child.
 */
const name = z.string().trim().min(1).max(60);

/** Guardian contact: stored apart from the learner and readable only by HQ roles (D2-1). */
export const learnerContactSchema = z
  .object({
    guardianName: z.string().trim().min(2).max(120),
    relationship: z.enum(GUARDIAN_RELATIONSHIPS),
    phone: kenyanPhoneSchema,
    altPhone: kenyanPhoneSchema.optional(),
  })
  .strict();

const learnerFields = z.object({
  firstName: name,
  lastName: name,
  age: z.number().int().min(LEARNER_MIN_AGE).max(LEARNER_MAX_AGE),
  gender: z.enum(GENDERS),
  grade: z.enum(GRADES),
  admissionNumber: z.string().trim().min(1).max(30).optional(),
  accessibilityNeeds: z.string().trim().max(200).optional(),
});

export const createLearnerSchema = learnerFields
  .extend({
    clubId: idSchema,
    contact: learnerContactSchema.optional(),
    // Set after the user has seen the "possible duplicate" warning and still wants to save (US-07).
    confirmDuplicate: z.boolean().optional(),
  })
  .strict();

/** A learner stays in the club they joined (D2-8), so clubId cannot change. */
export const updateLearnerSchema = learnerFields.partial().strict();

export const learnerStatusSchema = z.object({ status: z.enum(LEARNER_STATUSES) }).strict();

export const listLearnersQuerySchema = paginationSchema.extend({
  clubId: idSchema.optional(),
  status: z.enum(LEARNER_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
});

export const consentTypeSchema = z.enum(CONSENT_TYPES);

/** Consent status for one type; the signed form is uploaded separately (D2-3). */
export const consentSchema = z
  .object({
    status: z.enum(CONSENT_STATUSES),
    signedOn: z.iso.date().optional(),
  })
  .strict();

/** Year of birth from an age today, and the age back from it. */
export const birthYearFromAge = (age, today = new Date()) => today.getFullYear() - age;
export const ageFromBirthYear = (birthYear, today = new Date()) => today.getFullYear() - birthYear;
