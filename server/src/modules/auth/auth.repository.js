import { databasePending } from '../../db/index.js';

/** Refresh tokens are stored hashed (D1-12). Engine pending (D1-8). */

export async function insertRefreshToken(_record) {
  throw databasePending();
}

export async function findRefreshTokenByHash(_tokenHash) {
  throw databasePending();
}

export async function revokeRefreshToken(_id) {
  throw databasePending();
}

export async function revokeAllRefreshTokensForUser(_userId) {
  throw databasePending();
}

/** Used when an old token is reused: the whole session family is revoked. */
export async function revokeRefreshTokenFamily(_familyId) {
  throw databasePending();
}
