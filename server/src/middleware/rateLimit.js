import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

/** Failed login attempts: 5 per 15 minutes per IP + email (R1-2). */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Only failed attempts count, so signing in and out on a shared tablet never locks anyone out.
  skipSuccessfulRequests: true,
  // ipKeyGenerator groups IPv6 addresses by network, so rotating addresses cannot bypass the limit.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email ?? '').toLowerCase()}`,
  handler: (_req, res) =>
    res.status(429).json({
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: ERROR_MESSAGES.tooManyAttempts,
      },
    }),
});
