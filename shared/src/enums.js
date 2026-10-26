/**
 * Stable values used by both client and server.
 * Labels shown to users live in the client i18n files, keyed by these values.
 */

export const ROLES = Object.freeze({
  SYSTEM_ADMIN: 'system_admin',
  PROGRAMME_MANAGER: 'programme_manager',
  COORDINATOR: 'coordinator',
  CHAMPION: 'champion',
});
export const ROLE_VALUES = Object.values(ROLES);

export const USER_STATUSES = ['active', 'inactive'];

export const REGIONS = Object.freeze({
  NAIROBI_CENTRAL: 'nairobi_central',
  WESTERN_NYANZA: 'western_nyanza',
  COAST: 'coast',
  RIFT_VALLEY: 'rift_valley',
});
export const REGION_VALUES = Object.values(REGIONS);

/** Prefix used in human-readable club codes, e.g. NAC-001. */
export const REGION_CODE_PREFIX = Object.freeze({
  nairobi_central: 'NAC',
  western_nyanza: 'WNY',
  coast: 'CST',
  rift_valley: 'RVL',
});

export const COUNTIES = [
  'Baringo',
  'Bomet',
  'Bungoma',
  'Busia',
  'Elgeyo-Marakwet',
  'Embu',
  'Garissa',
  'Homa Bay',
  'Isiolo',
  'Kajiado',
  'Kakamega',
  'Kericho',
  'Kiambu',
  'Kilifi',
  'Kirinyaga',
  'Kisii',
  'Kisumu',
  'Kitui',
  'Kwale',
  'Laikipia',
  'Lamu',
  'Machakos',
  'Makueni',
  'Mandera',
  'Marsabit',
  'Meru',
  'Migori',
  'Mombasa',
  "Murang'a",
  'Nairobi',
  'Nakuru',
  'Nandi',
  'Narok',
  'Nyamira',
  'Nyandarua',
  'Nyeri',
  'Samburu',
  'Siaya',
  'Taita-Taveta',
  'Tana River',
  'Tharaka-Nithi',
  'Trans Nzoia',
  'Turkana',
  'Uasin Gishu',
  'Vihiga',
  'Wajir',
  'West Pokot',
];

export const SCHOOL_TYPES = ['primary_school', 'community_centre', 'library', 'other'];
export const RECORD_STATUSES = ['active', 'inactive'];

export const VENUE_TYPES = ['primary_school', 'community_centre', 'library', 'online'];
export const CLUB_STATUSES = ['active', 'paused', 'closed'];
export const TRACKS = ['unplugged', 'scratch', 'robotics', 'game_design', 'ai_basics'];
export const MEETING_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
export const MEETING_FREQUENCIES = ['weekly', 'fortnightly', 'monthly'];
export const CLUB_MAX_CAPACITY = 30;

export const CHAMPION_TYPES = ['teacher', 'volunteer', 'staff'];
export const SAFEGUARDING_STATUSES = ['pending', 'cleared', 'expired'];
export const ASSIGNMENT_ROLES = ['lead', 'assistant'];

export const LANGUAGES = ['en', 'sw'];

// Sprint 2: learners, consent, sessions and attendance.
export const LEARNER_STATUSES = ['active', 'left'];
export const GENDERS = ['girl', 'boy', 'prefer_not_to_say'];
/** CBC grades 4 to 9; code clubs serve learners aged 9 to 14 (questionnaire Q14). */
export const GRADES = ['grade_4', 'grade_5', 'grade_6', 'grade_7', 'grade_8', 'grade_9'];
export const LEARNER_MIN_AGE = 9;
export const LEARNER_MAX_AGE = 14;
export const GUARDIAN_RELATIONSHIPS = ['mother', 'father', 'guardian', 'other'];
export const CONSENT_TYPES = ['participation', 'photo'];
export const CONSENT_STATUSES = ['pending', 'given', 'refused', 'withdrawn'];
export const SESSION_STATUSES = ['planned', 'held', 'cancelled'];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];
/** Champions can change a session report for this many days after the session (D2-5). */
export const SESSION_EDIT_DAYS = 7;
export const SESSION_MAX_PHOTOS = 3;
/** Uploads: signed consent forms and session photos (D2-3, D2-7). */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const PHOTO_TYPES = ['image/jpeg', 'image/png'];

// Sprint 3: working offline and syncing (docs/sync-protocol.md).
/** Changes a device can make offline and send with POST /sync/push. */
export const SYNC_OPERATION_TYPES = [
  'learner.create',
  'learner.update',
  'learner.status',
  'learner.contact',
  'consent.set',
  'session.create',
  'session.update',
  'session.attendance',
  // Sprint 4: marking an announcement as read.
  'announcement.read',
  // Sprint 5: reporting equipment, learner projects and assessments (D5-5).
  'equipment.report',
  'project.save',
  'assessment.save',
  'assessment.scores',
];
export const SYNC_PUSH_MAX_OPERATIONS = 50;
/** Devices hold sessions and attendance from this many days back (and future sessions). */
export const SYNC_SESSION_DAYS = 120;
/** Local data is deleted after this many days without a successful sync (D3-2). */
export const OFFLINE_MAX_DAYS = 14;

// Sprint 4: HQ dashboard, reports, events and announcements (docs/sprints/sprint-4.md).
/** Kenyan school terms (questionnaire Q9); HQ sets the dates each year. */
export const TERM_NUMBERS = [1, 2, 3];
export const EVENT_TYPES = ['hackathon', 'showcase', 'competition', 'camp'];
export const EVENT_STATUSES = ['planned', 'open', 'closed', 'held', 'cancelled'];
export const EVENT_PARTICIPANT_STATUSES = ['registered', 'attended', 'absent', 'withdrawn'];
export const EVENT_MAX_PHOTOS = 10;
/** Alert rules (section 4.2 of the plan, agreed with Enock on 2026-10-25). */
export const ALERT_TYPES = [
  'noRecentSession',
  'lowAttendance',
  'missingConsent',
  'nearCapacity',
  'eventConsentMissing',
  // Sprint 5 (plan section 4).
  'equipmentOverdue',
  'equipmentReported',
];
export const ALERT_RULES = Object.freeze({
  noSessionDays: 14,
  lowAttendancePercent: 60,
  lowAttendanceSessions: 4,
  nearCapacityLearners: 28,
  eventConsentDays: 7,
  equipmentReportedDays: 7,
});
/** Days a dismissed alert stays hidden for the person who dismissed it (R4-4). */
export const ALERT_DISMISS_DAYS = 7;
export const MESSAGE_CHANNELS = ['sms', 'whatsapp'];
export const ANNOUNCEMENT_MAX_LENGTH = 1000;
/** Reports show counts below this as "fewer than 5", so no child can be picked out (R4-1). */
export const REPORT_MIN_GROUP = 5;
export const AGE_BANDS = ['9-10', '11-12', '13-14'];

// Sprint 5: equipment, resources and learner progress (docs/sprints/sprint-5.md).
export const EQUIPMENT_TYPES = [
  'laptop',
  'tablet',
  'robotics_kit',
  'microbit',
  'raspberry_pi',
  'other',
];
export const EQUIPMENT_CONDITIONS = ['working', 'needs_repair', 'damaged', 'lost', 'retired'];
/** What a champion can report about an item their club holds (plan section 4). */
export const EQUIPMENT_REPORT_CONDITIONS = ['needs_repair', 'damaged', 'lost'];
/** Items in these conditions can be lent to a club (D5-1). */
export const LENDABLE_CONDITIONS = ['working', 'needs_repair'];

export const RESOURCE_TYPES = ['lesson_plan', 'slides', 'worksheet', 'video', 'other'];
export const RESOURCE_STATUSES = ['draft', 'published'];
export const RESOURCE_MAX_BYTES = 20 * 1024 * 1024;
/**
 * Files a resource can hold, by extension (D5-2). Office, OpenDocument and Scratch files are ZIP
 * files inside, so the server checks the first bytes match the family of the extension.
 */
export const RESOURCE_FILE_TYPES = Object.freeze({
  pdf: { type: 'application/pdf', family: 'pdf' },
  pptx: {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    family: 'zip',
  },
  docx: {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    family: 'zip',
  },
  odp: { type: 'application/vnd.oasis.opendocument.presentation', family: 'zip' },
  odt: { type: 'application/vnd.oasis.opendocument.text', family: 'zip' },
  sb3: { type: 'application/x.scratch.sb3', family: 'zip' },
  zip: { type: 'application/zip', family: 'zip' },
  png: { type: 'image/png', family: 'png' },
  jpg: { type: 'image/jpeg', family: 'jpeg' },
  jpeg: { type: 'image/jpeg', family: 'jpeg' },
});
/** Space saved resources may take on one device (D5-3, R5-1). */
export const OFFLINE_RESOURCES_MAX_BYTES = 300 * 1024 * 1024;

export const ASSESSMENT_MAX_SCORE = 1000;
