import { z } from 'zod';
import {
  AGE_BANDS,
  LANGUAGES,
  RESOURCE_FILE_TYPES,
  RESOURCE_STATUSES,
  RESOURCE_TYPES,
  TRACKS,
} from '../enums.js';
import { paginationSchema } from './common.js';

/** Lesson plans, slides, worksheets and video links (questionnaire Q22, Q27, plan section 5). */
const linkSchema = z.url({ protocol: /^https?$/ }).max(500);

const resourceFields = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(RESOURCE_TYPES),
  tracks: z
    .array(z.enum(TRACKS))
    .min(1)
    .max(TRACKS.length)
    .refine((list) => new Set(list).size === list.length, { message: 'Each track only once' }),
  ageBands: z.array(z.enum(AGE_BANDS)).max(AGE_BANDS.length).default([]),
  language: z.enum(LANGUAGES).default('en'),
  // Links to the Raspberry Pi Foundation's projects stay links, not copies (D5-4).
  link: linkSchema.optional(),
  status: z.enum(RESOURCE_STATUSES).default('draft'),
});

export const createResourceSchema = resourceFields.strict();
export const updateResourceSchema = resourceFields
  .partial()
  .extend({
    link: linkSchema.nullable().optional(),
    ageBands: z.array(z.enum(AGE_BANDS)).max(AGE_BANDS.length).optional(),
    language: z.enum(LANGUAGES).optional(),
    status: z.enum(RESOURCE_STATUSES).optional(),
  })
  .strict();

export const listResourcesQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(80).optional(),
  type: z.enum(RESOURCE_TYPES).optional(),
  track: z.enum(TRACKS).optional(),
  ageBand: z.enum(AGE_BANDS).optional(),
  language: z.enum(LANGUAGES).optional(),
  status: z.enum(RESOURCE_STATUSES).optional(),
});

/** The file's extension, e.g. "pptx", or null when it is not one a resource can hold. */
export function resourceExtension(filename) {
  const ext = /\.([a-z0-9]+)$/i.exec(filename ?? '')?.[1]?.toLowerCase();
  return ext && RESOURCE_FILE_TYPES[ext] ? ext : null;
}

/** Query for uploading a resource file; the body is the file itself. */
export const resourceFileQuerySchema = z.object({
  filename: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .refine((name) => Boolean(resourceExtension(name)), { message: 'File type not allowed' }),
});
