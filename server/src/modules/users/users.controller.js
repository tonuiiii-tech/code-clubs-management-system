import { randomBytes } from 'node:crypto';
import * as service from './users.service.js';

export async function list(req, res) {
  res.json(await service.listUsers(req.user, req.scope, req.valid.query));
}

export async function create(req, res) {
  // Temporary password is shown once to the administrator; the user changes it at first sign-in.
  const temporaryPassword = randomBytes(9).toString('base64url');
  const user = await service.createUser(req.user, req.valid.body, {
    temporaryPassword,
    requestId: req.id,
  });
  res.status(201).json({ data: user, temporaryPassword });
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
