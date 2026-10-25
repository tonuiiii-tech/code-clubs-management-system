/**
 * Error messages the API can return, by a stable key.
 *
 * The server and the demo mock API throw these exact texts, so they cannot drift apart (R1-19).
 * The client looks the text up here to show it in the user's language
 * (client i18n: `apiErrors.<key>`); a text not listed is shown as the server sent it.
 */
export const ERROR_MESSAGES = Object.freeze({
  // Generic
  signIn: 'Please sign in',
  sessionExpired: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to do this',
  notFound: 'Not found',
  invalidFields: 'Some fields are not valid',
  invalidJson: 'Request body is not valid JSON',
  internal: 'Something went wrong',
  network: 'Cannot reach the server',
  // Auth
  invalidLogin: 'Email or password is incorrect',
  tooManyAttempts: 'Too many sign-in attempts. Try again in 15 minutes.',
  currentPasswordIncorrect: 'Current password is incorrect',
  // Users
  userNotFound: 'User not found',
  duplicateEmail: 'A user with this email already exists',
  ownRole: 'You cannot change your own role',
  ownStatus: 'You cannot change your own account status',
  // Schools
  schoolNotFound: 'School not found',
  duplicateSchool: 'A school with this name already exists in this sub-county',
  schoolOwnRegion: 'You can only add schools in your own region',
  schoolMoveOwnRegion: 'You can only move schools within your own region',
  schoolInactive: 'The school is inactive',
  // Clubs
  clubNotFound: 'Club not found',
  duplicateClubCode: 'A club with this code already exists',
  clubOwnRegion: 'You can only add clubs in your own region',
  onlineClubsNotSupported: 'Online clubs are not supported yet',
  onlyActiveChampions: 'Only active Club Champions can be assigned to a club',
  clubInactive: 'The club is not active',
  clubFull: 'This club is full',
  // Learners
  learnerNotFound: 'Learner not found',
  duplicateLearner: 'A learner with this name and age is already in this club',
  duplicateAdmissionNumber:
    'A learner with this admission number is already registered at this school',
  admissionNumberRequired: 'Admission number is required for school clubs',
  contactNotFound: 'No guardian contact has been recorded',
  consentFileNotFound: 'No consent form has been uploaded',
  // Files
  fileTypeNotAllowed: 'Upload a JPG, PNG or PDF file',
  photoTypeNotAllowed: 'Upload a JPG or PNG photo',
  fileTooLarge: 'The file is larger than 5 MB',
  // Sessions
  sessionNotFound: 'Session not found',
  duplicateSession: 'This club already has a session on this date',
  sessionLocked: 'This session report is older than 7 days. Ask your coordinator to change it.',
  futureSessionPlanned: 'A session in the future can only be planned',
  attendanceHeldOnly: 'Attendance can only be taken for a session that was held',
  attendanceNotInClub: 'Some learners are not active members of this club',
  tooManyPhotos: 'A session can have at most 3 photos',
  photoConsentMissing:
    'Some learners present have no photo consent. Confirm they are not in the photo.',
  photoNotFound: 'Photo not found',
  // Sync (Sprint 3)
  duplicateId: 'A record with this ID already exists',
  invalidRecordedAt: 'The time of this change is in the future. Check the device clock.',
  syncNotAvailable: 'Offline sync is for Club Champions and Coordinators',
  needsConnection: 'This needs an internet connection',
});

const KEY_BY_MESSAGE = new Map(Object.entries(ERROR_MESSAGES).map(([key, text]) => [text, key]));

/** The key for an API error text, or undefined when the text is not a known one. */
export const errorMessageKey = (message) => KEY_BY_MESSAGE.get(message);
