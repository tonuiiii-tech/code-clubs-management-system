import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import {
  ASSIGNMENT_ROLES,
  CHAMPION_TYPES,
  CLUB_MAX_CAPACITY,
  CLUB_STATUSES,
  COUNTIES,
  LANGUAGES,
  MEETING_DAYS,
  MEETING_FREQUENCIES,
  RECORD_STATUSES,
  REGION_VALUES,
  ROLE_VALUES,
  SAFEGUARDING_STATUSES,
  SCHOOL_TYPES,
  TRACKS,
  USER_STATUSES,
  VENUE_TYPES,
} from '@code-clubs/shared/enums';

/**
 * Mongoose models (D1-8). Request data is validated with the shared Zod schemas before it
 * gets here; these schemas are a second line of defence and declare the indexes.
 * Every `_id` is a UUID string a device can generate (D1-21).
 */
const { Schema, model, models } = mongoose;
const uuid = { type: String, default: () => randomUUID() };
const audited = { createdBy: String, updatedBy: String };
const options = { timestamps: true, versionKey: false };

const userSchema = new Schema(
  {
    _id: uuid,
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLE_VALUES, required: true },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    regions: { type: [{ type: String, enum: REGION_VALUES }], default: [] },
    championProfile: {
      type: new Schema(
        {
          type: { type: String, enum: CHAMPION_TYPES },
          skills: [String],
          safeguarding: {
            status: { type: String, enum: SAFEGUARDING_STATUSES },
            date: String,
          },
        },
        { _id: false },
      ),
      default: undefined,
    },
    permissionGrants: { type: [String], default: [] },
    preferredLanguage: { type: String, enum: LANGUAGES, default: 'en' },
    tokenVersion: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    ...audited,
  },
  options,
);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ regions: 1 });

const refreshTokenSchema = new Schema(
  {
    _id: uuid,
    userId: { type: String, required: true },
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  options,
);
refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ familyId: 1 });
refreshTokenSchema.index({ userId: 1 });
// MongoDB removes expired refresh tokens by itself.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const schoolSchema = new Schema(
  {
    _id: uuid,
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: SCHOOL_TYPES, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    county: { type: String, enum: COUNTIES, required: true },
    subCounty: { type: String, required: true, trim: true },
    ward: String,
    gps: { type: new Schema({ lat: Number, lng: Number }, { _id: false }), default: undefined },
    contactName: String,
    contactPhone: String,
    status: { type: String, enum: RECORD_STATUSES, default: 'active' },
    ...audited,
  },
  options,
);
// Duplicate check (R1-11): case-insensitive name within a county and sub-county.
schoolSchema.index(
  { name: 1, county: 1, subCounty: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
schoolSchema.index({ region: 1, status: 1 });
schoolSchema.index({ county: 1 });

const clubSchema = new Schema(
  {
    _id: uuid,
    code: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    schoolId: String,
    venueType: { type: String, enum: VENUE_TYPES, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    meetingDay: { type: String, enum: MEETING_DAYS, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    frequency: { type: String, enum: MEETING_FREQUENCIES, default: 'weekly' },
    mainTrack: { type: String, enum: TRACKS, required: true },
    capacity: { type: Number, min: 1, max: CLUB_MAX_CAPACITY, default: CLUB_MAX_CAPACITY },
    status: { type: String, enum: CLUB_STATUSES, default: 'active' },
    ...audited,
  },
  options,
);
clubSchema.index({ code: 1 }, { unique: true });
clubSchema.index({ region: 1, status: 1 });
clubSchema.index({ schoolId: 1 });

const clubChampionSchema = new Schema(
  {
    _id: uuid,
    clubId: { type: String, required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: ASSIGNMENT_ROLES, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
  },
  options,
);
// One current assignment per champion and club; ended ones stay as history (D1-15).
clubChampionSchema.index(
  { clubId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { endDate: null } },
);
clubChampionSchema.index({ userId: 1, endDate: 1 });

/** Atomic sequences, e.g. the next club number for a region prefix. */
const counterSchema = new Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { versionKey: false },
);

const auditEntrySchema = new Schema(
  {
    _id: uuid,
    at: { type: Date, required: true },
    actorId: String,
    actorRole: String,
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: String,
    region: String,
    changedFields: { type: [Schema.Types.Mixed], default: [] },
    requestId: String,
  },
  { versionKey: false },
);
auditEntrySchema.index({ entityType: 1, entityId: 1, at: -1 });
auditEntrySchema.index({ actorId: 1, at: -1 });
auditEntrySchema.index({ region: 1, at: -1 });

const define = (name, schema, collection) => models[name] ?? model(name, schema, collection);

export const User = define('User', userSchema, 'users');
export const RefreshToken = define('RefreshToken', refreshTokenSchema, 'refreshTokens');
export const School = define('School', schoolSchema, 'schools');
export const Club = define('Club', clubSchema, 'clubs');
export const ClubChampion = define('ClubChampion', clubChampionSchema, 'clubChampions');
export const Counter = define('Counter', counterSchema, 'counters');
export const AuditEntry = define('AuditEntry', auditEntrySchema, 'auditEntries');
