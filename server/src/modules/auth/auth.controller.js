import { env } from '../../config/env.js';
import { toPublicUser } from '../users/users.service.js';
import * as service from './auth.service.js';
import { REFRESH_TOKEN_TTL_MS } from './auth.service.js';

export const REFRESH_COOKIE = 'cc_refresh';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

export async function login(req, res) {
  const { user, accessToken, refreshToken } = await service.login(req.valid.body, {
    requestId: req.id,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.json({ data: { user, accessToken } });
}

export async function refresh(req, res) {
  const { user, accessToken, refreshToken } = await service.refresh(req.cookies?.[REFRESH_COOKIE]);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.json({ data: { user, accessToken } });
}

export async function logout(req, res) {
  await service.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
}

export async function changePassword(req, res) {
  await service.changePassword(req.user, req.valid.body, { requestId: req.id });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
}

export async function acceptInvite(req, res) {
  res.json({ data: await service.acceptInvite(req.valid.body, { requestId: req.id }) });
}

export function me(req, res) {
  res.json({ data: toPublicUser(req.user) });
}
