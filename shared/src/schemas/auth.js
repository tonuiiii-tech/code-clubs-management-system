import { z } from 'zod';
import { emailSchema } from './common.js';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});

export const PASSWORD_MIN_LENGTH = 10;

/** Accepting an invitation sets the first password (D5-15). */
export const acceptInviteSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  })
  .strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});
