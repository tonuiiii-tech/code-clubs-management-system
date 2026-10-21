import { request } from './http.js';

export const listUsers = (query) => request('/users', { query });
export const getUser = (id) => request(`/users/${id}`);
export const createUser = (body) => request('/users', { method: 'POST', body });
export const updateUser = (id, body) => request(`/users/${id}`, { method: 'PATCH', body });
export const setUserStatus = (id, status) =>
  request(`/users/${id}/status`, { method: 'PATCH', body: { status } });
export const updateMyProfile = (body) => request('/users/me', { method: 'PATCH', body });
