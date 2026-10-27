import { randomUUID } from 'node:crypto';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { can } from '@code-clubs/shared/permissions';
import { BUCKETS, deleteFile, readFile, saveFile } from '../../db/files.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { recordAudit } from '../audit/audit.service.js';
import * as repo from './resources.repository.js';

/**
 * The resource library (plan section 5): HQ adds and publishes lesson plans, slides, worksheets
 * and video links; everyone signed in finds published ones and champions save files on their
 * device (D5-2, D5-3). Raspberry Pi Foundation material stays a link (D5-4).
 */

const stampNew = (actor) => {
  const now = new Date();
  return { createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id };
};
const stampChange = (actor) => ({ updatedAt: new Date(), updatedBy: actor.id });
const managing = (actor) => can(actor, 'resource:manage');

/** The API shape: whether there is a file, never where it is stored. */
export const presentResource = ({ createdBy: _c, updatedBy: _u, fileId, ...resource }) => ({
  ...resource,
  hasFile: Boolean(fileId),
});

async function findResource(actor, id) {
  const resource = await repo.findResource(id, { publishedOnly: !managing(actor) });
  if (!resource) throw notFound(ERROR_MESSAGES.resourceNotFound);
  return resource;
}

/** Published resources need something to open; videos are links only (D5-2). */
function checkContent(resource) {
  if (resource.type === 'video' && resource.fileId) throw badRequest(ERROR_MESSAGES.videoLinkOnly);
  if (resource.status === 'published' && !resource.link && !resource.fileId) {
    throw badRequest(ERROR_MESSAGES.resourceNeedsLinkOrFile);
  }
}

export async function listResources(actor, _scope, { page, pageSize, ...query }) {
  const filters = managing(actor) ? query : { ...query, status: 'published' };
  const result = await repo.listResources(filters, { page, pageSize });
  return { ...result, data: result.data.map(presentResource) };
}

export async function getResource(actor, _scope, id) {
  return presentResource(await findResource(actor, id));
}

export async function createResource(actor, _scope, input, { requestId }) {
  const resource = {
    id: randomUUID(),
    description: null,
    link: null,
    fileId: null,
    fileName: null,
    fileType: null,
    size: null,
    ...input,
    ...stampNew(actor),
  };
  checkContent(resource);
  await repo.insertResource(resource);
  await recordAudit({
    actor,
    action: 'resource.create',
    entityType: 'resource',
    entityId: resource.id,
    after: { title: resource.title, type: resource.type, status: resource.status },
    requestId,
  });
  return presentResource(resource);
}

export async function updateResource(actor, _scope, id, changes, { requestId }) {
  const before = await findResource(actor, id);
  checkContent({ ...before, ...changes });
  const updated = await repo.updateResource(id, { ...changes, ...stampChange(actor) });
  await recordAudit({
    actor,
    action: 'resource.update',
    entityType: 'resource',
    entityId: id,
    before,
    after: changes,
    requestId,
  });
  return presentResource(updated);
}

export async function deleteResource(actor, _scope, id, { requestId }) {
  const resource = await findResource(actor, id);
  await repo.deleteResource(id);
  if (resource.fileId) await deleteFile(BUCKETS.resourceFiles, resource.fileId);
  await recordAudit({
    actor,
    action: 'resource.delete',
    entityType: 'resource',
    entityId: id,
    before: { title: resource.title, status: resource.status },
    after: { title: null, status: null },
    requestId,
  });
}

/** Adds or replaces the resource's file; devices that saved the old one fetch the new one. */
export async function putResourceFile(actor, _scope, id, file, query, { requestId }) {
  const resource = await findResource(actor, id);
  // Only plain characters, so the name is safe in a download header.
  const filename = query.filename.replace(/[^\w.\- ]+/g, '_');
  if (resource.type === 'video') throw badRequest(ERROR_MESSAGES.videoLinkOnly);
  const fileId = await saveFile(BUCKETS.resourceFiles, file.buffer, {
    contentType: file.type,
    metadata: { resourceId: id, uploadedBy: actor.id },
  });
  const updated = await repo.updateResource(id, {
    fileId,
    fileName: filename,
    fileType: file.type,
    size: file.buffer.length,
    ...stampChange(actor),
  });
  if (resource.fileId) await deleteFile(BUCKETS.resourceFiles, resource.fileId);
  await recordAudit({
    actor,
    action: 'resource.file',
    entityType: 'resource',
    entityId: id,
    before: { fileName: resource.fileName },
    after: { fileName: filename },
    requestId,
  });
  return presentResource(updated);
}

export async function deleteResourceFile(actor, _scope, id, { requestId }) {
  const resource = await findResource(actor, id);
  if (!resource.fileId) throw notFound(ERROR_MESSAGES.resourceFileNotFound);
  checkContent({ ...resource, fileId: null });
  const updated = await repo.updateResource(id, {
    fileId: null,
    fileName: null,
    fileType: null,
    size: null,
    ...stampChange(actor),
  });
  await deleteFile(BUCKETS.resourceFiles, resource.fileId);
  await recordAudit({
    actor,
    action: 'resource.file',
    entityType: 'resource',
    entityId: id,
    before: { fileName: resource.fileName },
    after: { fileName: null },
    requestId,
  });
  return presentResource(updated);
}

export async function getResourceFile(actor, _scope, id) {
  const resource = await findResource(actor, id);
  const file = resource.fileId && (await readFile(BUCKETS.resourceFiles, resource.fileId));
  if (!file) throw notFound(ERROR_MESSAGES.resourceFileNotFound);
  return { file, filename: resource.fileName };
}
