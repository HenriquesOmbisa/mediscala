import { z } from "zod";

const envSchema = z.object({
  /** Master database: super_admins, plans, tenants, subscriptions, payments, user_lookups */
  MASTER_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  /** Directory for avatar files (relative to cwd or absolute). */
  UPLOAD_DIR: z.string().default("uploads"),
  /** IANA TZ for shift suggestion / availability (align with hospital locale). */
  APP_TIMEZONE: z.string().default("Africa/Luanda"),
  /** Dev only — bypass JWT tenant lookup and force a specific tenant slug. */
  FORCE_TENANT_SLUG: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
