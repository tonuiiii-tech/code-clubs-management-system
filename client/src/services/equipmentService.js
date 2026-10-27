import { request } from './http.js';
import { onlineFirst } from '../offline/index.js';
import * as local from '../offline/localApi.js';

/**
 * Equipment (Sprint 5): read on the device when offline; a champion's report of damage or loss
 * waits in the outbox without a connection. Lending, returns and repairs need one (plan section 7).
 */
export const listEquipment = onlineFirst(
  (query) => request('/equipment', { query }),
  local.listEquipment,
);
export const getEquipment = onlineFirst((id) => request(`/equipment/${id}`), local.getEquipment);
export const createEquipment = (body) => request('/equipment', { method: 'POST', body });
export const updateEquipment = (id, body) => request(`/equipment/${id}`, { method: 'PATCH', body });
export const lendEquipment = (id, body) =>
  request(`/equipment/${id}/loans`, { method: 'POST', body });
export const returnEquipment = (id, body) =>
  request(`/equipment/${id}/return`, { method: 'POST', body });
export const addRepair = (id, body) =>
  request(`/equipment/${id}/repairs`, { method: 'POST', body });
export const reportEquipment = onlineFirst(
  (id, body) => request(`/equipment/${id}/report`, { method: 'POST', body }),
  local.reportEquipment,
);
