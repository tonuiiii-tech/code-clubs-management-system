import { scopeFilter } from '../scope.js';
import { summaryCounts } from './dashboard.repository.js';

export function getSummary(actor, scope) {
  return summaryCounts(scopeFilter(actor, scope));
}
