import { rateLimit } from 'express-rate-limit';

/** Login attempts: 5 per 15 minutes per IP + email (R1-2). */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
  handler: (_req, res) =>
    res.status(429).json({
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many sign-in attempts. Try again in 15 minutes.',
      },
    }),
});
