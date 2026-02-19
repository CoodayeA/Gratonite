import { z } from 'zod';
import 'dotenv/config';

/**
 * Environment variable validation schema.
 * Fails fast on startup if required variables are missing or malformed.
 */
const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url().default('postgres://gratonite:gratonite@localhost:5433/gratonite'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('gratonite'),
  MINIO_SECRET_KEY: z.string().default('gratonite123'),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // JWT
  JWT_SECRET: z.string().min(32).default('dev-secret-change-me-in-production-please-now'),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),

  // Encryption
  ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .default('http://localhost:4000/api/v1/auth/google/callback'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // CDN
  CDN_BASE_URL: z.string().default('http://localhost:9000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
