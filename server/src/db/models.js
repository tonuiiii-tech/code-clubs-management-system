import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import {
  ASSIGNMENT_ROLES,
  CHAMPION_TYPES,
  CLUB_MAX_CAPACITY,
  ATTENDANCE_STATUSES,
  CLUB_STATUSES,
  CONSENT_STATUSES,
  CONSENT_TYPES,
  COUNTIES,
  GENDERS,
  GRADES,
  GUARDIAN_RELATIONSHIPS,
  LEARNER_STATUSES,
  LANGUAGES,
  MEETING_DAYS,
  MEETING_FREQUENCIES,
  RECORD_STATUSES,
  REGION_VALUES,
  ROLE_VALUES,
  SAFEGUARDING_STATUSES,
  SCHOOL_TYPES,
  SESSION_STATUSES,
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

/**
 * Sprint 2. Learners, sessions and attendance copy `clubId` and `region` from their club,
 * so scope queries need no join (D2-6).
 */
const learnerSchema = new Schema(
  {
    _id: uuid,
    learnerNumber: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    // Age is asked for; the year of birth keeps it right each year (D2-2).
    birthYear: { type: Number, required: true },
    gender: { type: String, enum: GENDERS, required: true },
    grade: { type: String, enum: GRADES, required: true },
    admissionNumber: String,
    accessibilityNeeds: String,
    clubId: { type: String, required: true },
    schoolId: String,
    region: { type: String, enum: REGION_VALUES, required: true },
    status: { type: String, enum: LEARNER_STATUSES, default: 'active' },
    joinedAt: { type: String, required: true },
    leftAt: { type: String, default: null },
    ...audited,
  },
  options,
);
learnerSchema.index({ learnerNumber: 1 }, { unique: true });
learnerSchema.index({ clubId: 1, status: 1 });
learnerSchema.index({ region: 1, status: 1 });
// Admission numbers are unique within a school (D2-9).
learnerSchema.index(
  { schoolId: 1, admissionNumber: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: {
      schoolId: { $type: 'string' },
      admissionNumber: { $type: 'string' },
    },
  },
);

/** Guardian contacts, kept apart from learners and readable by HQ only (D2-1). */
const learnerContactSchema = new Schema(
  {
    _id: uuid,
    learnerId: { type: String, required: true },
    guardianName: { type: String, required: true, trim: true },
    relationship: { type: String, enum: GUARDIAN_RELATIONSHIPS, required: true },
    phone: { type: String, required: true },
    altPhone: String,
    ...audited,
  },
  options,
);
learnerContactSchema.index({ learnerId: 1 }, { unique: true });

const consentSchema = new Schema(
  {
    _id: uuid,
    learnerId: { type: String, required: true },
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    type: { type: String, enum: CONSENT_TYPES, required: true },
    status: { type: String, enum: CONSENT_STATUSES, required: true },
    signedOn: String,
    // The signed form, in the consentFiles GridFS bucket (D2-3).
    fileId: { type: String, default: null },
    ...audited,
  },
  options,
);
consentSchema.index({ learnerId: 1, type: 1 }, { unique: true });
consentSchema.index({ clubId: 1, type: 1, status: 1 });

const sessionSchema = new Schema(
  {
    _id: uuid,
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: SESSION_STATUSES, required: true },
    topic: String,
    notes: String,
    startTime: String,
    endTime: String,
    cancellationReason: String,
    // Up to 3 photos, in the sessionPhotos GridFS bucket (D2-7).
    photoIds: { type: [String], default: [] },
    reportedBy: String,
    reportedAt: Date,
    ...audited,
  },
  options,
);
// One session per club per day.
sessionSchema.index({ clubId: 1, date: 1 }, { unique: true });
sessionSchema.index({ region: 1, date: -1 });

/** One record per learner per session (D2-4). */
const attendanceSchema = new Schema(
  {
    _id: uuid,
    sessionId: { type: String, required: true },
    learnerId: { type: String, required: true },
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    ...audited,
  },
  options,
);
attendanceSchema.index({ sessionId: 1, learnerId: 1 }, { unique: true });
attendanceSchema.index({ learnerId: 1, date: -1 });
attendanceSchema.index({ region: 1, date: -1 });

/**
 * Sprint 3: sync (docs/sync-protocol.md). Each change sent by a device is stored with its result,
 * so sending it again changes nothing (D3-3). Kept 30 days.
 */
const syncOperationSchema = new Schema(
  {
    _id: String,
    userId: { type: String, required: true },
    type: String,
    state: { type: String, enum: ['running', 'done'], default: 'running' },
    result: Schema.Types.Mixed,
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);
syncOperationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

/** A value overwritten when two people changed the same field (D3-5). */
const syncConflictSchema = new Schema(
  {
    _id: uuid,
    at: { type: Date, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    field: { type: String, required: true },
    // A readable name for the field when it is an id, e.g. the learner of an attendance mark.
    label: String,
    // Values of fields never written to the audit log are not kept either.
    overwritten: Schema.Types.Mixed,
    applied: Schema.Types.Mixed,
    redacted: { type: Boolean, default: false },
    clubId: String,
    region: { type: String, enum: REGION_VALUES },
    actorId: String,
    actorName: String,
    recordedAt: Date,
    opId: String,
  },
  { versionKey: false },
);
syncConflictSchema.index({ region: 1, at: -1 });
syncConflictSchema.index({ clubId: 1, at: -1 });

/** Records deleted on the server, so devices can delete them too. Kept 30 days. */
const tombstoneSchema = new Schema(
  {
    _id: uuid,
    entityType: { type: String, required: true },
    recordId: { type: String, required: true },
    clubId: String,
    region: { type: String, enum: REGION_VALUES },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);
tombstoneSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
tombstoneSchema.index({ entityType: 1, updatedAt: 1, _id: 1 });

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

// Devices pull changes in (updatedAt, _id) order (docs/sync-protocol.md, section 4).
for (const schema of [
  schoolSchema,
  clubSchema,
  learnerSchema,
  consentSchema,
  sessionSchema,
  attendanceSchema,
]) {
  schema.index({ updatedAt: 1, _id: 1 });
}

const define = (name, schema, collection) => models[name] ?? model(name, schema, collection);

export const User = define('User', userSchema, 'users');
export const RefreshToken = define('RefreshToken', refreshTokenSchema, 'refreshTokens');
export const School = define('School', schoolSchema, 'schools');
export const Club = define('Club', clubSchema, 'clubs');
export const ClubChampion = define('ClubChampion', clubChampionSchema, 'clubChampions');
export const Counter = define('Counter', counterSchema, 'counters');
export const AuditEntry = define('AuditEntry', auditEntrySchema, 'auditEntries');
export const Learner = define('Learner', learnerSchema, 'learners');
export const LearnerContact = define('LearnerContact', learnerContactSchema, 'learnerContacts');
export const Consent = define('Consent', consentSchema, 'consents');
export const Session = define('Session', sessionSchema, 'sessions');
export const Attendance = define('Attendance', attendanceSchema, 'attendance');
export const SyncOperation = define('SyncOperation', syncOperationSchema, 'syncOperations');
export const SyncConflict = define('SyncConflict', syncConflictSchema, 'syncConflicts');
export const Tombstone = define('Tombstone', tombstoneSchema, 'tombstones');
