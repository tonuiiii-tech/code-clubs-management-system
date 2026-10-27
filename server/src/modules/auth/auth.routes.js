import { Router } from 'express';
import { acceptInviteSchema, changePasswordSchema, loginSchema } from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { inviteRateLimit, loginRateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, validate({ body: loginSchema }), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post(
  '/accept-invite',
  inviteRateLimit,
  validate({ body: acceptInviteSchema }),
  controller.acceptInvite,
);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, controller.me);
authRouter.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);
