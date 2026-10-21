import { notImplemented } from '../utils/httpError.js';

/**
 * Database connection.
 *
 * The engine is still pending (decision D1-8: PostgreSQL or MongoDB).
 * Only repositories (modules/<name>/<name>.repository.js) talk to the database,
 * so choosing the engine changes this file and the repositories, nothing else.
 */
export async function connectDatabase(_databaseUrl) {
  // Intentionally empty until D1-8 is decided.
}

export async function disconnectDatabase() {}

/** Thrown by repository stubs until the database is chosen. */
export const databasePending = () =>
  notImplemented('Database not configured yet (decision D1-8: PostgreSQL or MongoDB)');
