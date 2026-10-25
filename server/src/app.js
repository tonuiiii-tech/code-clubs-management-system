import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { schoolsRouter } from './modules/schools/schools.routes.js';
import { clubsRouter } from './modules/clubs/clubs.routes.js';
import { learnersRouter } from './modules/learners/learners.routes.js';
import { sessionsRouter } from './modules/sessions/sessions.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { alertsRouter, dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';
import { termsRouter } from './modules/terms/terms.routes.js';

/** Builds the Express app without listening, so tests can use it with Supertest. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
  // A device can send up to 50 changes at once (docs/sync-protocol.md).
  app.use('/api/v1/sync/push', express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/schools', schoolsRouter);
  api.use('/clubs', clubsRouter);
  api.use('/learners', learnersRouter);
  api.use('/sessions', sessionsRouter);
  api.use('/audit', auditRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/sync', syncRouter);
  api.use('/terms', termsRouter);
  api.use('/alerts', alertsRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
