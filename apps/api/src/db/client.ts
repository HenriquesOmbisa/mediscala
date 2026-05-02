import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

// ─── Master database pool (tenants, plans, subscriptions, payments, super_admins) ─

export const masterPool = new Pool({
  connectionString: env.MASTER_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const masterDb = drizzle(masterPool);

// ─── Per-tenant database pools (one DB per company) ──────────────────────────────

const tenantPools = new Map<string, pg.Pool>();

function getTenantPool(slug: string): pg.Pool {
  const existing = tenantPools.get(slug);
  if (existing) return existing;

  const dbName = `mediscala_${slug}`;
  // Build connection string from master URL replacing the database name
  const base = new URL(env.MASTER_DATABASE_URL);
  base.pathname = `/${dbName}`;
  const pool = new Pool({
    connectionString: base.toString(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  tenantPools.set(slug, pool);
  return pool;
}

/**
 * Returns a Drizzle instance connected to the tenant's own database.
 * The caller is responsible for nothing extra — the pool is cached per slug.
 */
export function getTenantDb(slug: string) {
  const pool = getTenantPool(slug);
  return drizzle(pool);
}

/**
 * Returns a raw pg.PoolClient for the tenant DB (for raw SQL).
 * Caller must call client.release() when done.
 */
export async function getTenantClient(slug: string): Promise<pg.PoolClient> {
  return getTenantPool(slug).connect();
}

/** Gracefully close all pools (for clean shutdown / tests). */
export async function closeAllPools() {
  await masterPool.end();
  for (const pool of tenantPools.values()) {
    await pool.end();
  }
  tenantPools.clear();
}
