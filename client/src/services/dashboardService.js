import { request } from './http.js';

export const getDashboardSummary = () => request('/dashboard/summary');
