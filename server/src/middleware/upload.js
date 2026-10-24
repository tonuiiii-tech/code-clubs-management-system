import express from 'express';
import { UPLOAD_MAX_BYTES } from '@code-clubs/shared/enums';
import { HttpError, badRequest } from '../utils/httpError.js';
import { detectFileType } from '../utils/fileType.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

/**
 * Reads an uploaded file sent as the raw request body (no multipart parser needed) and checks
 * its real type. Sets req.file = { buffer, type }.
 *
 * @param {string[]} allowedTypes e.g. ['image/jpeg', 'image/png']
 * @param {string} typeMessage the error when the type is not allowed
 */
export function upload(allowedTypes, typeMessage) {
  const raw = express.raw({ type: () => true, limit: UPLOAD_MAX_BYTES });
  return [
    (req, res, next) =>
      raw(req, res, (err) =>
        err?.type === 'entity.too.large'
          ? next(new HttpError(413, 'TOO_LARGE', ERROR_MESSAGES.fileTooLarge))
          : next(err),
      ),
    (req, _res, next) => {
      const type = detectFileType(req.body);
      if (!type || !allowedTypes.includes(type)) return next(badRequest(typeMessage));
      req.file = { buffer: req.body, type };
      next();
    },
  ];
}

/** Sends a stored file as a download that browsers and the service worker do not keep. */
export function sendFile(res, file, filename) {
  res.set({
    'Content-Type': file.contentType,
    'Content-Length': String(file.length),
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(file.buffer);
}
