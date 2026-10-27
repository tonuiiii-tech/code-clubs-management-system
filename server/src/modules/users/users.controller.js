import { randomBytes } from 'node:crypto';
import * as service from './users.service.js';

export async function list(req, res) {
  res.json(await service.listUsers(req.user, req.scope, req.valid.query));
}

export async function get(req, res) {
  res.json({ data: await service.getUser(req.user, req.scope, req.valid.params.id) });
}

export async function updateMe(req, res) {
  res.json({
    data: await service.updateOwnProfile(req.user, req.valid.body, { requestId: req.id }),
  });
}

export async function create(req, res) {
  const { invite, ...input } = req.valid.body;
  // Temporary password is shown once to the administrator; the user changes it at first sign-in.
  // With an invitation (D5-15) it is never shown: the person sets their own password instead.
  const temporaryPassword = randomBytes(invite ? 32 : 9).toString('base64url');
  const user = await service.createUser(req.user, input, {
    temporaryPassword,
    requestId: req.id,
  });
  if (!invite) {
    res.status(201).json({ data: user, temporaryPassword });
    return;
  }
  const sent = await service.sendInvite(req.user, user, { requestId: req.id });
  res.status(201).json({ data: { ...user, invitePending: true }, invited: true, ...sent });
}

export async function resendInvite(req, res) {
  res.json(await service.resendInvite(req.user, req.valid.params.id, { requestId: req.id }));
}

export async function update(req, res) {
  res.json({
    data: await service.updateUser(req.user, req.params.id, req.valid.body, { requestId: req.id }),
  });
}

export async function setStatus(req, res) {
  const user = await service.setUserStatus(req.user, req.params.id, req.valid.body.status, {
    requestId: req.id,
  });
  res.json({ data: user });
}
