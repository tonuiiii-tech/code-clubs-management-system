import { SCOPES } from '@code-clubs/shared/permissions';
import { ROLES } from '@code-clubs/shared/enums';

/**
 * Turns a user's scope into an engine-neutral filter that repositories apply (D1-4, D1-16).
 * Repositories turn it into a MongoDB query (server/src/db/scopeQueries.js).
 *
 * @returns {{ all: true } | { regions: string[] } | { championUserId: string } | { userId: string }}
 */
export function scopeFilter(user, scope) {
  if (scope === SCOPES.ALL) return { all: true };
  if (scope === SCOPES.SELF) return { userId: user.id };
  if (user.role === ROLES.COORDINATOR) return { regions: user.regions ?? [] };
  if (user.role === ROLES.CHAMPION) return { championUserId: user.id };
  return { none: true };
}
