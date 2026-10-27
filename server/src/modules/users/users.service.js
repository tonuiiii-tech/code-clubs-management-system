import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { conflict, forbidden, notFound } from '../../utils/httpError.js';
import { scopeFilter } from '../scope.js';
import { env } from '../../config/env.js';
import { recordAudit } from '../audit/audit.service.js';
import { emailProvider, stubEmailProvider } from '../notifications/providers.js';
import * as repo from './users.repository.js';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { canManageRole } from '@code-clubs/shared/permissions';

export const BCRYPT_COST = 12;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Only a hash of an invitation token is stored, like refresh tokens. */
export const hashInviteToken = (token) => createHash('sha256').update(token).digest('hex');

/** Only the roles in MANAGEABLE_ROLES: a coordinator creates champions only (D5-12, D5-13). */
function assertCanManage(actor, roles, permission = 'user:manage') {
  if (!roles.every((role) => canManageRole(actor, role, permission))) {
    throw forbidden(ERROR_MESSAGES.roleNotManageable);
  }
}

/** Fields that are never sent to the client. */
export function toPublicUser(user) {
  if (!user) return user;
  const {
    passwordHash: _p,
    tokenVersion: _t,
    failedLogins: _f,
    lockedUntil: _l,
    inviteTokenHash: _i,
    ...safe
  } = user;
  return safe;
}

export async function listUsers(actor, scope, query) {
  const result = await repo.listUsers(scopeFilter(actor, scope), query);
  return { ...result, data: result.data.map(toPublicUser) };
}

export async function getUser(actor, scope, id) {
  const user = await repo.findUserInScope(id, scopeFilter(actor, scope));
  if (!user) throw notFound(ERROR_MESSAGES.userNotFound);
  return toPublicUser(user);
}

/** Users may change only their own name, phone and language (never role, status or assignments). */
export async function updateOwnProfile(actor, changes, { requestId }) {
  const updated = await repo.updateUserById(actor.id, {
    ...changes,
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'user.updateSelf',
    entityType: 'user',
    entityId: actor.id,
    before: actor,
    after: changes,
    requestId,
  });
  return toPublicUser(updated);
}

export async function createUser(actor, input, { temporaryPassword, requestId }) {
  assertCanManage(actor, [input.role], 'user:create');
  if (await repo.findUserByEmail(input.email)) throw conflict(ERROR_MESSAGES.duplicateEmail);
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
  if (id === actor.id && changes.role !== undefined) throw forbidden(ERROR_MESSAGES.ownRole);
  const before = await repo.findUserById(id);
  if (!before) throw notFound();
  assertCanManage(actor, [before.role, changes.role ?? before.role]);
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
  if (id === actor.id) throw forbidden(ERROR_MESSAGES.ownStatus);
  const before = await repo.findUserById(id);
  if (!before) throw notFound();
  assertCanManage(actor, [before.role]);
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

const INVITE_EMAIL = {
  en: (name, link) => ({
    subject: 'Your STEAMLabs Code Clubs account',
    body: `Hello ${name},\n\nYou have been added to STEAMLabs Code Clubs. Open this link to choose your password and sign in:\n\n${link}\n\nThe link works once and expires in 7 days.`,
  }),
  sw: (name, link) => ({
    subject: 'Akaunti yako ya STEAMLabs Code Clubs',
    body: `Habari ${name},\n\nUmeongezwa kwenye STEAMLabs Code Clubs. Fungua kiungo hiki uchague nenosiri lako na uingie:\n\n${link}\n\nKiungo kinafanya kazi mara moja na kinaisha baada ya siku 7.`,
  }),
};

/**
 * Emails a one-time link to set a password (D5-15). A new invitation replaces the old link.
 * The email stub delivers nothing, so until a provider is chosen (D4-5) the link is returned to
 * the person who sent the invitation, to pass on themselves, as with a temporary password.
 */
export async function sendInvite(actor, user, { requestId }) {
  const token = randomBytes(32).toString('base64url');
  const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await repo.updateUserById(user.id, {
    invitePending: true,
    inviteTokenHash: hashInviteToken(token),
    inviteExpiresAt,
    updatedAt: new Date(),
    updatedBy: actor.id,
  });
  const appUrl = env.APP_URL ?? env.CORS_ORIGIN.split(',')[0].trim();
  const link = `${appUrl.replace(/\/$/, '')}/invite/${token}`;
  const email = (INVITE_EMAIL[user.preferredLanguage] ?? INVITE_EMAIL.en)(user.fullName, link);
  const provider = emailProvider();
  await provider.send({ to: user.email, ...email });
  await recordAudit({
    actor,
    action: 'user.invite',
    entityType: 'user',
    entityId: user.id,
    requestId,
  });
  return { inviteExpiresAt, ...(provider === stubEmailProvider && { inviteLink: link }) };
}

/** Sends a new invitation to someone who has not set a password yet. */
export async function resendInvite(actor, id, { requestId }) {
  const user = await repo.findUserById(id);
  if (!user) throw notFound();
  // A coordinator resends only the invitations they sent; managers resend any they may manage.
  const mayResend = canManageRole(actor, user.role) || user.createdBy === actor.id;
  if (!mayResend || !canManageRole(actor, user.role, 'user:create')) {
    throw forbidden(ERROR_MESSAGES.roleNotManageable);
  }
  if (!user.invitePending) throw conflict(ERROR_MESSAGES.notInvited);
  return sendInvite(actor, user, { requestId });
}
