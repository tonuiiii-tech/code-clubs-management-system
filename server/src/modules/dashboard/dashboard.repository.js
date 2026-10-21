import { databasePending } from '../../db/index.js';

/**
 * Counts inside a scope filter:
 * { activeClubs, schools, champions, clubsByRegion: { region: n }, clubsByTrack: { track: n } }
 */
export async function summaryCounts(_scopeFilter) {
  throw databasePending();
}
