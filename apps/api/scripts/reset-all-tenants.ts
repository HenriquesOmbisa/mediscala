#!/usr/bin/env tsx
import "dotenv/config";
import pg from "pg";
import { env } from "../src/config/env.js";

const { Pool } = pg;

const args = process.argv.slice(2);
const yes = args.includes("--yes");

if (!yes) {
  console.error("❌ Refusing to run without --yes");
  console.error("Usage: tsx scripts/reset-all-tenants.ts --yes");
  process.exit(1);
}

function buildPostgresAdminUrl(masterUrl: string): string {
  const url = new URL(masterUrl);
  url.pathname = "/postgres";
  return url.toString();
}

async function dropTenantDatabase(adminPool: pg.Pool, dbName: string) {
  await adminPool.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1
       AND pid <> pg_backend_pid()`,
    [dbName],
  );

  await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  console.log(`🗑️  Dropped database ${dbName}`);
}

async function main() {
  const masterPool = new Pool({ connectionString: env.MASTER_DATABASE_URL, max: 2 });
  const adminPool = new Pool({
    connectionString: buildPostgresAdminUrl(env.MASTER_DATABASE_URL),
    max: 1,
  });

  try {
    const { rows: tenantRows } = await masterPool.query<{
      id: string;
      slug: string;
      db_name: string;
    }>(
      `SELECT id, slug, db_name
       FROM tenants
       ORDER BY created_at ASC`,
    );

    if (tenantRows.length === 0) {
      console.log("ℹ️ No tenants found. Nothing to reset.");
      return;
    }

    console.log(`🚨 Resetting ${tenantRows.length} tenant(s)...`);

    for (const tenant of tenantRows) {
      await dropTenantDatabase(adminPool, tenant.db_name);
    }

    await masterPool.query("BEGIN");
    await masterPool.query("DELETE FROM user_lookups");
    await masterPool.query("DELETE FROM payments");
    await masterPool.query("DELETE FROM subscriptions");
    await masterPool.query("DELETE FROM tenants");
    await masterPool.query("COMMIT");

    console.log("✅ All tenants reset completed.");
  } catch (err) {
    await masterPool.query("ROLLBACK");
    console.error("❌ Reset all tenants failed:", err);
    process.exit(1);
  } finally {
    await adminPool.end();
    await masterPool.end();
  }
}

main();
