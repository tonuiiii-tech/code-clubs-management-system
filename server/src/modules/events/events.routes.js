import { Router } from 'express';
import { z } from 'zod';
import { PHOTO_TYPES, UPLOAD_TYPES } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import {
  createEventProjectSchema,
  createEventSchema,
  eventClubsSchema,
  eventConsentSchema,
  eventPhotoQuerySchema,
  idSchema,
  listEventsQuerySchema,
  participantStatusSchema,
  registerParticipantsSchema,
  updateEventProjectSchema,
  updateEventSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './events.controller.js';

export const eventsRouter = Router();
const idParams = z.object({ id: idSchema });
const learnerParams = z.object({ id: idSchema, learnerId: idSchema });
const projectParams = z.object({ id: idSchema, projectId: idSchema });
const photoParams = z.object({ id: idSchema, photoId: idSchema });

eventsRouter.use(authenticate);
eventsRouter.get(
  '/',
  authorize('event:read'),
  validate({ query: listEventsQuerySchema }),
  controller.list,
);
eventsRouter.post(
  '/',
  authorize('event:manage'),
  validate({ body: createEventSchema }),
  controller.create,
);
eventsRouter.get('/:id', authorize('event:read'), validate({ params: idParams }), controller.get);
eventsRouter.patch(
  '/:id',
  authorize('event:manage'),
  validate({ params: idParams, body: updateEventSchema }),
  controller.update,
);
eventsRouter.put(
  '/:id/clubs',
  authorize('event:manage'),
  validate({ params: idParams, body: eventClubsSchema }),
  controller.setClubs,
);

// Champions register and manage their own learners; coordinators those in their regions.
eventsRouter.get(
  '/:id/participants',
  authorize('eventParticipant:manage'),
  validate({ params: idParams }),
  controller.participants,
);
eventsRouter.post(
  '/:id/participants',
  authorize('eventParticipant:manage'),
  validate({ params: idParams, body: registerParticipantsSchema }),
  controller.register,
);
eventsRouter.patch(
  '/:id/participants/:learnerId',
  authorize('eventParticipant:manage'),
  validate({ params: learnerParams, body: participantStatusSchema }),
  controller.participantStatus,
);
eventsRouter.put(
  '/:id/consents/:learnerId',
  authorize('eventParticipant:manage'),
  validate({ params: learnerParams, body: eventConsentSchema }),
  controller.setConsent,
);
eventsRouter.put(
  '/:id/consents/:learnerId/file',
  authorize('eventParticipant:manage'),
  validate({ params: learnerParams }),
  upload(UPLOAD_TYPES, ERROR_MESSAGES.fileTypeNotAllowed),
  controller.uploadConsentFile,
);
eventsRouter.get(
  '/:id/consents/:learnerId/file',
  authorize('consentFile:read'),
  validate({ params: learnerParams }),
  controller.downloadConsentFile,
);

eventsRouter.get(
  '/:id/projects',
  authorize('event:read'),
  validate({ params: idParams }),
  controller.projects,
);
eventsRouter.post(
  '/:id/projects',
  authorize('eventParticipant:manage'),
  validate({ params: idParams, body: createEventProjectSchema }),
  controller.createProject,
);
eventsRouter.patch(
  '/:id/projects/:projectId',
  authorize('eventParticipant:manage'),
  validate({ params: projectParams, body: updateEventProjectSchema }),
  controller.updateProject,
);

eventsRouter.post(
  '/:id/photos',
  authorize('eventParticipant:manage'),
  validate({ params: idParams, query: eventPhotoQuerySchema }),
  upload(PHOTO_TYPES, ERROR_MESSAGES.photoTypeNotAllowed),
  controller.addPhoto,
);
eventsRouter.get(
  '/:id/photos/:photoId',
  authorize('event:read'),
  validate({ params: photoParams }),
  controller.getPhoto,
);
eventsRouter.delete(
  '/:id/photos/:photoId',
  authorize('event:manage'),
  validate({ params: photoParams }),
  controller.deletePhoto,
);
