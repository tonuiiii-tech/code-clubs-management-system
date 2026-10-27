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
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_TYPES,
  EVENT_PARTICIPANT_STATUSES,
  EVENT_STATUSES,
  EVENT_TYPES,
  MESSAGE_CHANNELS,
  GENDERS,
  GRADES,
  GUARDIAN_RELATIONSHIPS,
  LEARNER_STATUSES,
  LANGUAGES,
  RESOURCE_STATUSES,
  RESOURCE_TYPES,
  MEETING_DAYS,
  MEETING_FREQUENCIES,
  RECORD_STATUSES,
  REGION_VALUES,
  ROLE_VALUES,
  SAFEGUARDING_STATUSES,
  SCHOOL_TYPES,
  SESSION_STATUSES,
  TERM_NUMBERS,
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

/** Sprint 4: school terms set by HQ (questionnaire Q9). */
const termSchema = new Schema(
  {
    _id: uuid,
    year: { type: Number, required: true },
    number: { type: Number, enum: TERM_NUMBERS, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    ...audited,
  },
  options,
);
termSchema.index({ year: 1, number: 1 }, { unique: true });
termSchema.index({ endDate: 1 });

/**
 * Events (plan section 6). `region` null means national. Invited clubs are kept on the event;
 * participants, consents and projects copy `clubId` and `region` for scope queries (D2-6).
 */
const eventSchema = new Schema(
  {
    _id: uuid,
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    venue: { type: String, required: true },
    region: { type: String, enum: [...REGION_VALUES, null], default: null },
    description: String,
    capacity: Number,
    registrationCloses: String,
    status: { type: String, enum: EVENT_STATUSES, default: 'planned' },
    clubIds: { type: [String], default: [] },
    photoIds: { type: [String], default: [] },
    ...audited,
  },
  options,
);
eventSchema.index({ startDate: -1 });
eventSchema.index({ region: 1, startDate: -1 });
eventSchema.index({ clubIds: 1 });

const eventParticipantSchema = new Schema(
  {
    _id: uuid,
    eventId: { type: String, required: true },
    learnerId: { type: String, required: true },
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    status: { type: String, enum: EVENT_PARTICIPANT_STATUSES, default: 'registered' },
    ...audited,
  },
  options,
);
eventParticipantSchema.index({ eventId: 1, learnerId: 1 }, { unique: true });
eventParticipantSchema.index({ clubId: 1, eventId: 1 });

/** Consent for one learner and one event, apart from club consent (D4-6). */
const eventConsentSchema = new Schema(
  {
    _id: uuid,
    eventId: { type: String, required: true },
    learnerId: { type: String, required: true },
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    status: { type: String, enum: CONSENT_STATUSES, required: true },
    signedOn: String,
    fileId: { type: String, default: null },
    ...audited,
  },
  options,
);
eventConsentSchema.index({ eventId: 1, learnerId: 1 }, { unique: true });

/** A project presented at an event, with its result (Q29). */
const eventProjectSchema = new Schema(
  {
    _id: uuid,
    eventId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: String,
    link: String,
    learnerIds: { type: [String], default: [] },
    clubId: String,
    region: { type: String, enum: REGION_VALUES },
    award: String,
    rank: Number,
    ...audited,
  },
  options,
);
eventProjectSchema.index({ eventId: 1 });

/**
 * Announcements to app users only (D4-7). The audience is turned into user ids when it is sent,
 * so later role or assignment changes do not change who received it.
 */
const announcementSchema = new Schema(
  {
    _id: uuid,
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    audience: {
      roles: { type: [String], default: [] },
      regions: { type: [String], default: [] },
      clubIds: { type: [String], default: [] },
    },
    channels: { type: [{ type: String, enum: MESSAGE_CHANNELS }], default: [] },
    recipientIds: { type: [String], default: [] },
    senderId: { type: String, required: true },
    senderName: String,
    ...audited,
  },
  options,
);
announcementSchema.index({ recipientIds: 1, createdAt: -1 });
announcementSchema.index({ senderId: 1, createdAt: -1 });

const announcementReadSchema = new Schema(
  {
    _id: uuid,
    announcementId: { type: String, required: true },
    userId: { type: String, required: true },
    readAt: { type: Date, required: true },
  },
  options,
);
announcementReadSchema.index({ announcementId: 1, userId: 1 }, { unique: true });
announcementReadSchema.index({ userId: 1, updatedAt: 1, _id: 1 });

/** Email, SMS and WhatsApp messages; the stub providers only record them here (D4-5). */
const outboundMessageSchema = new Schema(
  {
    _id: uuid,
    channel: { type: String, enum: ['email', ...MESSAGE_CHANNELS], required: true },
    provider: { type: String, required: true },
    status: { type: String, enum: ['recorded', 'sent', 'failed'], default: 'recorded' },
    to: { type: String, required: true },
    userId: String,
    subject: String,
    body: String,
    attachments: { type: [{ name: String, size: Number, _id: false }], default: [] },
    announcementId: String,
    termId: String,
  },
  options,
);
outboundMessageSchema.index({ createdAt: -1 });

/** One document per setting, e.g. the termly report recipients. */
const settingSchema = new Schema({ _id: String, value: Schema.Types.Mixed, ...audited }, options);

/** A termly report run; the unique id per term stops two servers sending it twice (R4-2). */
const reportRunSchema = new Schema(
  {
    _id: String,
    termId: { type: String, required: true },
    state: { type: String, enum: ['running', 'sent', 'failed'], default: 'running' },
    messages: Number,
    error: String,
  },
  options,
);

/** Sprint 5: an item is in its region's store (clubId null) or lent to one club (D5-1). */
const equipmentItemSchema = new Schema(
  {
    _id: uuid,
    assetTag: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: EQUIPMENT_TYPES, required: true },
    serialNumber: { type: String, default: null },
    condition: { type: String, enum: EQUIPMENT_CONDITIONS, default: 'working' },
    region: { type: String, enum: REGION_VALUES, required: true },
    clubId: { type: String, default: null },
    contents: { type: String, default: null },
    notes: { type: String, default: null },
    ...audited,
  },
  options,
);
equipmentItemSchema.index({ assetTag: 1 }, { unique: true });
// Two items cannot share a serial number; items without one are left out of the check.
equipmentItemSchema.index(
  { serialNumber: 1 },
  { unique: true, partialFilterExpression: { serialNumber: { $type: 'string' } } },
);
equipmentItemSchema.index({ region: 1, clubId: 1 });

/** One loan of an item to a club; open while returnedDate is null. */
const equipmentLoanSchema = new Schema(
  {
    _id: uuid,
    itemId: { type: String, required: true },
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    outDate: { type: String, required: true },
    dueDate: { type: String, default: null },
    returnedDate: { type: String, default: null },
    conditionOut: { type: String, enum: EQUIPMENT_CONDITIONS },
    conditionReturned: { type: String, enum: [...EQUIPMENT_CONDITIONS, null], default: null },
    note: { type: String, default: null },
    outBy: String,
    outByName: String,
    returnedBy: { type: String, default: null },
    returnedByName: { type: String, default: null },
    // True until the item comes back; the unique index below allows one open loan per item.
    open: { type: Boolean, default: true },
  },
  options,
);
equipmentLoanSchema.index({ itemId: 1, outDate: -1 });
// At most one open loan per item, even with two people lending at once.
equipmentLoanSchema.index(
  { itemId: 1 },
  { unique: true, partialFilterExpression: { open: true }, name: 'one_open_loan' },
);
equipmentLoanSchema.index({ clubId: 1, returnedDate: 1 });

const equipmentRepairSchema = new Schema(
  {
    _id: uuid,
    itemId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    date: { type: String, required: true },
    problem: { type: String, required: true },
    action: { type: String, default: null },
    cost: { type: Number, default: null },
    conditionAfter: { type: String, enum: EQUIPMENT_CONDITIONS, required: true },
    ...audited,
  },
  options,
);
equipmentRepairSchema.index({ itemId: 1, date: -1 });

/** A champion's report that an item is damaged, lost or needs repair. */
const equipmentReportSchema = new Schema(
  {
    _id: uuid,
    itemId: { type: String, required: true },
    clubId: { type: String, default: null },
    region: { type: String, enum: REGION_VALUES, required: true },
    condition: { type: String, enum: EQUIPMENT_CONDITIONS, required: true },
    note: String,
    date: { type: String, required: true },
    reportedBy: String,
    reportedByName: String,
  },
  options,
);
equipmentReportSchema.index({ itemId: 1, date: -1 });
equipmentReportSchema.index({ clubId: 1, date: -1 });

/** Lesson plans, slides, worksheets and video links (plan section 5). */
const resourceSchema = new Schema(
  {
    _id: uuid,
    title: { type: String, required: true, trim: true },
    description: String,
    type: { type: String, enum: RESOURCE_TYPES, required: true },
    tracks: { type: [String], default: [] },
    ageBands: { type: [String], default: [] },
    language: { type: String, enum: LANGUAGES, default: 'en' },
    link: { type: String, default: null },
    fileId: { type: String, default: null },
    fileName: { type: String, default: null },
    fileType: { type: String, default: null },
    size: { type: Number, default: null },
    status: { type: String, enum: RESOURCE_STATUSES, default: 'draft' },
    ...audited,
  },
  options,
);
resourceSchema.index({ status: 1, title: 1 });

/** A project one or more learners of one club made (Q23). */
const learnerProjectSchema = new Schema(
  {
    _id: uuid,
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    learnerIds: { type: [String], default: [] },
    sessionId: { type: String, default: null },
    title: { type: String, required: true, trim: true },
    track: { type: String, enum: TRACKS, required: true },
    link: { type: String, default: null },
    fileId: { type: String, default: null },
    fileType: { type: String, default: null },
    date: { type: String, required: true },
    note: { type: String, default: null },
    ...audited,
  },
  options,
);
learnerProjectSchema.index({ clubId: 1, date: -1 });
learnerProjectSchema.index({ learnerIds: 1 });

const assessmentSchema = new Schema(
  {
    _id: uuid,
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    title: { type: String, required: true, trim: true },
    track: { type: String, enum: TRACKS, required: true },
    date: { type: String, required: true },
    maxScore: { type: Number, required: true },
    ...audited,
  },
  options,
);
assessmentSchema.index({ clubId: 1, date: -1 });

/** One score per learner per assessment, merged learner by learner (D5-5). */
const assessmentScoreSchema = new Schema(
  {
    _id: uuid,
    assessmentId: { type: String, required: true },
    learnerId: { type: String, required: true },
    clubId: { type: String, required: true },
    region: { type: String, enum: REGION_VALUES, required: true },
    score: { type: Number, default: null },
    ...audited,
  },
  options,
);
assessmentScoreSchema.index({ assessmentId: 1, learnerId: 1 }, { unique: true });
assessmentScoreSchema.index({ learnerId: 1 });

/** An alert one person dismissed, hidden for them until `until` (R4-4). */
const alertDismissalSchema = new Schema(
  {
    _id: String,
    userId: { type: String, required: true },
    key: { type: String, required: true },
    until: { type: Date, required: true },
  },
  options,
);
alertDismissalSchema.index({ userId: 1, until: 1 });

// Devices pull changes in (updatedAt, _id) order (docs/sync-protocol.md, section 4).
for (const schema of [
  schoolSchema,
  clubSchema,
  learnerSchema,
  consentSchema,
  sessionSchema,
  attendanceSchema,
  eventSchema,
  eventParticipantSchema,
  eventConsentSchema,
  announcementSchema,
  equipmentItemSchema,
  resourceSchema,
  learnerProjectSchema,
  assessmentSchema,
  assessmentScoreSchema,
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
export const Term = define('Term', termSchema, 'terms');
export const Event = define('Event', eventSchema, 'events');
export const EventParticipant = define(
  'EventParticipant',
  eventParticipantSchema,
  'eventParticipants',
);
export const EventConsent = define('EventConsent', eventConsentSchema, 'eventConsents');
export const EventProject = define('EventProject', eventProjectSchema, 'eventProjects');
export const Announcement = define('Announcement', announcementSchema, 'announcements');
export const AnnouncementRead = define(
  'AnnouncementRead',
  announcementReadSchema,
  'announcementReads',
);
export const OutboundMessage = define('OutboundMessage', outboundMessageSchema, 'outboundMessages');
export const Setting = define('Setting', settingSchema, 'settings');
export const ReportRun = define('ReportRun', reportRunSchema, 'reportRuns');
export const EquipmentItem = define('EquipmentItem', equipmentItemSchema, 'equipmentItems');
export const EquipmentLoan = define('EquipmentLoan', equipmentLoanSchema, 'equipmentLoans');
export const EquipmentRepair = define('EquipmentRepair', equipmentRepairSchema, 'equipmentRepairs');
export const EquipmentReport = define('EquipmentReport', equipmentReportSchema, 'equipmentReports');
export const Resource = define('Resource', resourceSchema, 'resources');
export const LearnerProject = define('LearnerProject', learnerProjectSchema, 'learnerProjects');
export const Assessment = define('Assessment', assessmentSchema, 'assessments');
export const AssessmentScore = define('AssessmentScore', assessmentScoreSchema, 'assessmentScores');
export const AlertDismissal = define('AlertDismissal', alertDismissalSchema, 'alertDismissals');
