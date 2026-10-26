import { Router } from 'express';
import { z } from 'zod';
import { UPLOAD_TYPES } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import {
  assessmentScoresSchema,
  createAssessmentSchema,
  createProjectSchema,
  idSchema,
  listAssessmentsQuerySchema,
  listProjectsQuerySchema,
  projectFileQuerySchema,
  updateAssessmentSchema,
  updateProjectSchema,
} from '@code-clubs/shared/schemas';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './progress.controller.js';

/** Learner projects, assessments and the progress pages (plan section 6). */
export const progressRouter = Router();
const idParams = z.object({ id: idSchema });
const read = authorize('progress:read');
const record = authorize('progress:record');

progressRouter.use(authenticate);

progressRouter.get(
  '/projects',
  read,
  validate({ query: listProjectsQuerySchema }),
  controller.listProjects,
);
progressRouter.post(
  '/projects',
  record,
  validate({ body: createProjectSchema }),
  controller.createProject,
);
progressRouter.get('/projects/:id', read, validate({ params: idParams }), controller.getProject);
progressRouter.patch(
  '/projects/:id',
  record,
  validate({ params: idParams, body: updateProjectSchema }),
  controller.updateProject,
);
progressRouter.delete(
  '/projects/:id',
  record,
  validate({ params: idParams }),
  controller.deleteProject,
);
progressRouter.put(
  '/projects/:id/file',
  record,
  validate({ params: idParams, query: projectFileQuerySchema }),
  upload(UPLOAD_TYPES, ERROR_MESSAGES.fileTypeNotAllowed),
  controller.putProjectFile,
);
progressRouter.get(
  '/projects/:id/file',
  read,
  validate({ params: idParams }),
  controller.getProjectFile,
);

progressRouter.get(
  '/assessments',
  read,
  validate({ query: listAssessmentsQuerySchema }),
  controller.listAssessments,
);
progressRouter.post(
  '/assessments',
  record,
  validate({ body: createAssessmentSchema }),
  controller.createAssessment,
);
progressRouter.get(
  '/assessments/:id',
  read,
  validate({ params: idParams }),
  controller.getAssessment,
);
progressRouter.patch(
  '/assessments/:id',
  record,
  validate({ params: idParams, body: updateAssessmentSchema }),
  controller.updateAssessment,
);
progressRouter.put(
  '/assessments/:id/scores',
  record,
  validate({ params: idParams, body: assessmentScoresSchema }),
  controller.saveScores,
);

progressRouter.get(
  '/learners/:id',
  read,
  validate({ params: idParams }),
  controller.learnerProgress,
);
progressRouter.get('/clubs/:id', read, validate({ params: idParams }), controller.clubProgress);
