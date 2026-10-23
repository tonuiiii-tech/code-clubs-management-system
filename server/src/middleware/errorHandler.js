import { HttpError } from '../utils/httpError.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

export function notFoundHandler(req, res) {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

/** One place that turns errors into the API's error format. Never leaks stack traces. */
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
  }
  if (err?.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: ERROR_MESSAGES.invalidJson } });
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${req.id}]`, err);
  }
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: ERROR_MESSAGES.internal } });
}
