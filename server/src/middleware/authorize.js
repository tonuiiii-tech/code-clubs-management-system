import { scopeFor } from '@code-clubs/shared/permissions';
import { forbidden, unauthorized } from '../utils/httpError.js';

/**
 * Checks the role permission (step 1 of D1-4) and records the scope on the request.
 * Services then apply req.scope to every query and write (step 2: resource scope).
 *
 * @param {string} permission e.g. 'club:write'
 */
export function authorize(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    const scope = scopeFor(req.user, permission);
    if (!scope) return next(forbidden());
    req.scope = scope;
    next();
  };
}
