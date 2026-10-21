/** An error with an HTTP status and a stable code the client can rely on. */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) =>
  new HttpError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Please sign in') =>
  new HttpError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to do this') =>
  new HttpError(403, 'FORBIDDEN', message);
/** Also used for records outside the user's scope, so their existence is not revealed (D1-4). */
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message) => new HttpError(409, 'CONFLICT', message);
export const notImplemented = (message) => new HttpError(501, 'NOT_IMPLEMENTED', message);
