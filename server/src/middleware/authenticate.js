import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/httpError.js';
import { findUserById } from '../modules/users/users.repository.js';

/**
 * Verifies the access token and loads the current user (D1-12).
 * Inactive users and users whose tokens were revoked (tokenVersion changed)
 * are rejected on every request (R1-4).
 */
export async function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    return next(unauthorized('Your session has expired. Please sign in again.'));
  }

  const user = await findUserById(payload.sub);
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.tv) {
    return next(unauthorized());
  }
  req.user = user;
  next();
}
