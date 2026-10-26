import { request } from './http.js';
import { localFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/**
 * Learner projects and assessments (Sprint 5). Champions and coordinators record them on the
 * device and sync later, like attendance (D5-5); everyone else uses the server.
 */
export const listProjects = localFirst(local.listProjects, (query) =>
  request('/progress/projects', { query }),
);
export const getProject = localFirst(local.getProject, (id) => request(`/progress/projects/${id}`));
export const createProject = localFirst(local.createProject, (body) =>
  request('/progress/projects', { method: 'POST', body }),
);
export const updateProject = localFirst(local.updateProject, (id, body) =>
  request(`/progress/projects/${id}`, { method: 'PATCH', body }),
);
export const uploadProjectFile = localFirst(local.uploadProjectFile, (id, file, confirmConsent) =>
  request(`/progress/projects/${id}/file`, {
    method: 'PUT',
    file,
    query: { confirmConsent: String(Boolean(confirmConsent)) },
  }),
);
/** Project photos are opened online only (D3-8). */
export const getProjectFile = (id) => request(`/progress/projects/${id}/file`, { asBlob: true });

export const listAssessments = localFirst(local.listAssessments, (query) =>
  request('/progress/assessments', { query }),
);
export const getAssessment = localFirst(local.getAssessment, (id) =>
  request(`/progress/assessments/${id}`),
);
export const createAssessment = localFirst(local.createAssessment, (body) =>
  request('/progress/assessments', { method: 'POST', body }),
);
export const updateAssessment = localFirst(local.updateAssessment, (id, body) =>
  request(`/progress/assessments/${id}`, { method: 'PATCH', body }),
);
export const saveScores = localFirst(local.saveScores, (id, scores) =>
  request(`/progress/assessments/${id}/scores`, { method: 'PUT', body: { scores } }),
);

export const getLearnerProgress = localFirst(local.learnerProgress, (id) =>
  request(`/progress/learners/${id}`),
);
export const getClubProgress = localFirst(local.clubProgress, (id) =>
  request(`/progress/clubs/${id}`),
);
