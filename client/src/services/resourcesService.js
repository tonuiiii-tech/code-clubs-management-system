import { request } from './http.js';
import { isLocalReady, onlineFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/**
 * The resource library (Sprint 5). The list is on the device for champions and coordinators;
 * files they save open without a connection (D5-3).
 */

/** Marks the resources saved on this device. */
async function withSaved(result) {
  if (!isLocalReady()) return result;
  const saved = new Set((await local.savedResources()).map((r) => r.id));
  const mark = (r) => ({ ...r, saved: saved.has(r.id) });
  return {
    ...result,
    data: Array.isArray(result.data) ? result.data.map(mark) : mark(result.data),
  };
}

export const listResources = onlineFirst(
  async (query) => withSaved(await request('/resources', { query })),
  local.listResources,
);
export const getResource = onlineFirst(
  async (id) => withSaved(await request(`/resources/${id}`)),
  local.getResource,
);
export const createResource = (body) => request('/resources', { method: 'POST', body });
export const updateResource = (id, body) => request(`/resources/${id}`, { method: 'PATCH', body });
export const deleteResource = (id) => request(`/resources/${id}`, { method: 'DELETE' });
/** The server checks the file really is what its name says (PDF, slides, Scratch, ZIP, image). */
export const uploadResourceFile = (id, file) =>
  request(`/resources/${id}/file`, { method: 'PUT', file, query: { filename: file.name } });
export const deleteResourceFile = (id) => request(`/resources/${id}/file`, { method: 'DELETE' });

/** The saved copy when there is one, otherwise the server's. */
export async function openResourceFile(id) {
  return (await local.savedResourceFile(id)) ?? request(`/resources/${id}/file`, { asBlob: true });
}

/** Only people who keep data on their device can save files on it (D3-1). */
export const canSaveOffline = () => isLocalReady();

export async function saveResourceOnDevice(resource) {
  const blob = await request(`/resources/${resource.id}/file`, { asBlob: true });
  await local.keepResourceFile(resource, blob);
}
export const removeSavedResource = (id) => local.forgetResourceFile(id);
export const listSavedResources = () => local.savedResources();
export const savedResourcesSize = () => local.savedResourcesSize();
