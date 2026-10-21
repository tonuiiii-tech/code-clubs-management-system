import { Router } from 'express';
import { loginSchema } from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { loginRateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, validate({ body: loginSchema }), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, controller.me);
