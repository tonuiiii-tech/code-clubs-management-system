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
