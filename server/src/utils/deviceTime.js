import { OFFLINE_MAX_DAYS } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { badRequest } from './httpError.js';

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a change sent by a syncing device counts as made (docs/sync-protocol.md, section 6).
 * Returns the device time if it is at most 14 days old, otherwise undefined (meaning "now").
 * A time more than 5 minutes in the future is refused, so a wrong clock cannot reopen a
 * locked session report (R3-3).
 */
export function deviceTime(recordedAt, now = new Date()) {
  if (!recordedAt) return undefined;
  const at = new Date(recordedAt);
  if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    const err = badRequest(ERROR_MESSAGES.invalidRecordedAt);
    err.code = 'INVALID_RECORDED_AT';
    throw err;
  }
  if (at.getTime() < now.getTime() - OFFLINE_MAX_DAYS * DAY_MS) return undefined;
  return at > now ? now : at;
}
