import { z } from 'zod';
import {
  ASSIGNMENT_ROLES,
  CLUB_MAX_CAPACITY,
  CLUB_STATUSES,
  MEETING_DAYS,
  MEETING_FREQUENCIES,
  REGION_VALUES,
  TRACKS,
  VENUE_TYPES,
} from '../enums.js';
import { idSchema, paginationSchema, timeSchema } from './common.js';

const clubFields = z.object({
  name: z.string().trim().min(2).max(120),
  schoolId: idSchema.optional(),
  venueType: z.enum(VENUE_TYPES),
  meetingDay: z.enum(MEETING_DAYS),
  startTime: timeSchema,
  endTime: timeSchema,
  frequency: z.enum(MEETING_FREQUENCIES).default('weekly'),
  mainTrack: z.enum(TRACKS),
  capacity: z.number().int().min(1).max(CLUB_MAX_CAPACITY).default(CLUB_MAX_CAPACITY),
});

const timeRule = (club, ctx) => {
  if (club.startTime && club.endTime && club.endTime <= club.startTime) {
    ctx.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: 'End time must be after start time',
    });
  }
};

export const createClubSchema = clubFields.strict().superRefine((club, ctx) => {
  if (club.venueType !== 'online' && !club.schoolId) {
    ctx.addIssue({
      code: 'custom',
      path: ['schoolId'],
      message: 'A school is required unless the club meets online',
    });
  }
  timeRule(club, ctx);
});

export const updateClubSchema = clubFields
  .partial()
  .extend({ status: z.enum(CLUB_STATUSES).optional() })
  .strict()
  .superRefine(timeRule);

export const assignChampionSchema = z
  .object({
    role: z.enum(ASSIGNMENT_ROLES).default('assistant'),
    startDate: z.iso.date().optional(),
  })
  .strict();

export const listClubsQuerySchema = paginationSchema.extend({
  region: z.enum(REGION_VALUES).optional(),
  schoolId: idSchema.optional(),
  status: z.enum(CLUB_STATUSES).optional(),
  track: z.enum(TRACKS).optional(),
  q: z.string().trim().max(80).optional(),
});
