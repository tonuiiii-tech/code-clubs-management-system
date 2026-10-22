import { RefreshToken } from '../../db/models.js';
import { toDocument, toRecord } from '../../db/records.js';

/** Refresh tokens are stored hashed (D1-12). Expired ones are removed by a TTL index. */

export async function insertRefreshToken(record) {
  await RefreshToken.create(toDocument(record));
}

export async function findRefreshTokenByHash(tokenHash) {
  return toRecord(await RefreshToken.findOne({ tokenHash }).lean());
}

export async function revokeRefreshToken(id) {
  await RefreshToken.updateOne({ _id: id }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllRefreshTokensForUser(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

/** Used when an old token is reused: the whole session family is revoked. */
export async function revokeRefreshTokenFamily(familyId) {
  await RefreshToken.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
