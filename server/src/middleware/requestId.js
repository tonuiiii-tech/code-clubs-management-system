import { randomUUID } from 'node:crypto';

/** Gives every request an id, returned in a header and used in logs and audit entries. */
export function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
