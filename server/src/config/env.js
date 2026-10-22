import { z } from 'zod';

/**
 * Environment variables, validated once at startup so a bad config fails fast
 * with a clear message instead of failing later at runtime.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  SEED_DEFAULT_PASSWORD: z.string().optional(),
});

const testDefaults = {
  JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-123',
  JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough-456',
};

export function loadEnv(source = process.env) {
  const input = source.NODE_ENV === 'test' ? { ...testDefaults, ...source } : source;
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  if (!result.data.MONGODB_URI && result.data.NODE_ENV !== 'test') {
    throw new Error(
      'Invalid environment configuration:\n  - MONGODB_URI: set it in server/.env (see README)',
    );
  }
  return Object.freeze(result.data);
}

export const env = loadEnv();
