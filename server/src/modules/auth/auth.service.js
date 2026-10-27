import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { badRequest, unauthorized } from '../../utils/httpError.js';
import { recordAudit } from '../audit/audit.service.js';
import {
  findUserByEmail,
  findUserById,
  findUserByInviteTokenHash,
  updateUserById,
} from '../users/users.repository.js';
import { BCRYPT_COST, hashInviteToken, toPublicUser } from '../users/users.service.js';
import * as repo from './auth.repository.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const INVALID_LOGIN = ERROR_MESSAGES.invalidLogin;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

async function issueRefreshToken(user, familyId = randomUUID()) {
  const token = randomBytes(48).toString('base64url');
  await repo.insertRefreshToken({
    id: randomUUID(),
    userId: user.id,
    familyId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    revokedAt: null,
  });
  return token;
}

/** Same message for unknown email, wrong password and inactive account, so accounts cannot be probed. */
export async function login({ email, password }, { requestId }) {
  const user = await findUserByEmail(email);
  if (!user || user.status !== 'active') throw unauthorized(INVALID_LOGIN);
  if (user.lockedUntil && user.lockedUntil > new Date()) throw unauthorized(INVALID_LOGIN);

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failedLogins = (user.failedLogins ?? 0) + 1;
    await updateUserById(user.id, {
      failedLogins,
      ...(failedLogins >= MAX_FAILED_LOGINS && {
        lockedUntil: new Date(Date.now() + LOCKOUT_MS),
        failedLogins: 0,
      }),
    });
    await recordAudit({
      actor: user,
      action: 'auth.loginFailed',
      entityType: 'user',
      entityId: user.id,
      requestId,
    });
    throw unauthorized(INVALID_LOGIN);
  }

  await updateUserById(user.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() });
  await recordAudit({
    actor: user,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    requestId,
  });
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user),
  };
}

/** Rotates the refresh token. Reusing an old token revokes the whole family (stolen-token signal). */
export async function refresh(refreshToken) {
  if (!refreshToken) throw unauthorized();
  const record = await repo.findRefreshTokenByHash(hashToken(refreshToken));
  if (!record) throw unauthorized();
  if (record.revokedAt) {
    await repo.revokeRefreshTokenFamily(record.familyId);
    throw unauthorized();
  }
  if (record.expiresAt < new Date()) throw unauthorized();

  const user = await findUserById(record.userId);
  if (!user || user.status !== 'active') throw unauthorized();

  await repo.revokeRefreshToken(record.id);
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user, record.familyId),
  };
}

/** Changing the password signs out every other session (tokenVersion bump + refresh tokens revoked). */
export async function changePassword(user, { currentPassword, newPassword }, { requestId }) {
  const full = await findUserById(user.id);
  if (!(await bcrypt.compare(currentPassword, full.passwordHash))) {
    throw badRequest(ERROR_MESSAGES.currentPasswordIncorrect, [
      { field: 'body.currentPassword', message: ERROR_MESSAGES.currentPasswordIncorrect },
    ]);
  }
  await updateUserById(user.id, {
    passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST),
    tokenVersion: full.tokenVersion + 1,
  });
  await repo.revokeAllRefreshTokensForUser(user.id);
  await recordAudit({
    actor: user,
    action: 'auth.changePassword',
    entityType: 'user',
    entityId: user.id,
    requestId,
  });
}

/** Sets the first password from an invitation link; the link then stops working (D5-15). */
export async function acceptInvite({ token, password }, { requestId }) {
  const user = await findUserByInviteTokenHash(hashInviteToken(token));
  if (
    !user?.invitePending ||
    user.status !== 'active' ||
    !user.inviteExpiresAt ||
    user.inviteExpiresAt < new Date()
  ) {
    throw badRequest(ERROR_MESSAGES.inviteInvalid);
  }
  await updateUserById(user.id, {
    passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    tokenVersion: user.tokenVersion + 1,
    invitePending: false,
    inviteTokenHash: null,
    inviteExpiresAt: null,
  });
  await recordAudit({
    actor: user,
    action: 'auth.acceptInvite',
    entityType: 'user',
    entityId: user.id,
    requestId,
  });
  return { email: user.email };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  const record = await repo.findRefreshTokenByHash(hashToken(refreshToken));
  if (record) await repo.revokeRefreshTokenFamily(record.familyId);
}
