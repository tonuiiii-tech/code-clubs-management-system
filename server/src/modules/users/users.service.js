import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { conflict, notFound } from '../../utils/httpError.js';
import { scopeFilter } from '../scope.js';
import { recordAudit } from '../audit/audit.service.js';
import * as repo from './users.repository.js';

export const BCRYPT_COST = 12;

/** Fields that are never sent to the client. */
export function toPublicUser(user) {
  if (!user) return user;
  const { passwordHash: _p, tokenVersion: _t, failedLogins: _f, lockedUntil: _l, ...safe } = user;
  return safe;
}

export async function listUsers(actor, scope, query) {
  const result = await repo.listUsers(scopeFilter(actor, scope), query);
  return { ...result, data: result.data.map(toPublicUser) };
}

export async function createUser(actor, input, { temporaryPassword, requestId }) {
  if (await repo.findUserByEmail(input.email))
    throw conflict('A user with this email already exists');
  const now = new Date();
  const user = {
    id: randomUUID(),
    ...input,
    status: 'active',
    passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_COST),
    tokenVersion: 0,
    failedLogins: 0,
    permissionGrants: [],
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  };
  await repo.insertUser(user);
  await recordAudit({
    actor,
    action: 'user.create',
    entityType: 'user',
    entityId: user.id,
    after: input,
    requestId,
  });
  return toPublicUser(user);
}

export async function updateUser(actor, id, changes, { requestId }) {
  const before = await repo.findUserById(id);
  if (!before) throw notFound();
  const updated = await repo.updateUserById(id, {
    ...changes,
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'user.update',
    entityType: 'user',
    entityId: id,
    before,
    after: changes,
    requestId,
  });
  return toPublicUser(updated);
}

/** Deactivation also bumps tokenVersion so existing sessions stop working at once (R1-4). */
export async function setUserStatus(actor, id, status, { requestId }) {
  const before = await repo.findUserById(id);
  if (!before) throw notFound();
  const changes = {
    status,
    ...(status === 'inactive' && { tokenVersion: before.tokenVersion + 1 }),
  };
  const updated = await repo.updateUserById(id, {
    ...changes,
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: `user.${status === 'active' ? 'activate' : 'deactivate'}`,
    entityType: 'user',
    entityId: id,
    before,
    after: { status },
    requestId,
  });
  return toPublicUser(updated);
}
