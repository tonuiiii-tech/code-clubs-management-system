import { randomUUID } from 'node:crypto';
import { AuditEntry } from '../../db/models.js';
import { paginate, toDocument } from '../../db/records.js';
import { auditScopeQuery } from '../../db/scopeQueries.js';

/** Append-only (D1-6): there is deliberately no update or delete here. */
export async function insertAuditEntry(entry) {
  await AuditEntry.create(toDocument({ id: randomUUID(), ...entry }));
}

export async function listAuditEntries(scopeFilter, query) {
  return paginate(AuditEntry, auditScopeQuery(scopeFilter), query, { at: -1 });
}
