import { insertAuditEntry, listAuditEntries } from './audit.repository.js';
import { scopeFilter } from '../scope.js';

/** Field names whose values are never written to the audit log. */
const REDACTED = new Set([
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'contactPhone',
  'phone',
  // Guardian contacts and learner details that are not needed to follow a change (D2-1).
  'guardianName',
  'altPhone',
  'accessibilityNeeds',
]);

/**
 * Records who changed what (append-only). Stores changed field names and
 * non-sensitive values only; never passwords, tokens or whole request bodies.
 */
export async function recordAudit({
  actor,
  action,
  entityType,
  entityId,
  before = {},
  after = {},
  region,
  requestId,
}) {
  const changedFields = Object.keys(after)
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) =>
      REDACTED.has(field)
        ? { field, redacted: true }
        : { field, from: before[field] ?? null, to: after[field] ?? null },
    );
  return insertAuditEntry({
    at: new Date(),
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    action,
    entityType,
    entityId,
    // Lets coordinators see the history of their own region's schools and clubs.
    region: region ?? null,
    changedFields,
    requestId,
  });
}

export function listAudit(user, scope, query) {
  return listAuditEntries(scopeFilter(user, scope), query);
}
