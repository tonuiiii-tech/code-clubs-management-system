import { databasePending } from '../../db/index.js';

export async function insertAuditEntry(_entry) {
  throw databasePending();
}

export async function listAuditEntries(_filter, _query) {
  throw databasePending();
}
