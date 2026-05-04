#!/usr/bin/env tsx
import "dotenv/config";
import pg from "pg";
import { env } from "../src/config/env.js";

const { Pool } = pg;

const args = process.argv.slice(2);
const slug = args.find((arg) => !arg.startsWith("--"));
const yes = args.includes("--yes");

if (!slug) {
  console.error("❌ Missing tenant slug");
  console.error("Usage: tsx scripts/reset-tenant.ts <slug> --yes");
  process.exit(1);
}

if (!yes) {
  console.error("❌ Refusing to run without --yes");
  console.error("Usage: tsx scripts/reset-tenant.ts <slug> --yes");
  process.exit(1);
}

function buildPostgresAdminUrl(masterUrl: string): string {
  const url = new URL(masterUrl);
  url.pathname = "/postgres";
  return url.toString();
}

async function dropTenantDatabase(dbName: string) {
  const adminPool = new Pool({
    connectionString: buildPostgresAdminUrl(env.MASTER_DATABASE_URL),
    max: 1,
  });

  try {
    await adminPool.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1
         AND pid <> pg_backend_pid()`,
      [dbName],
    );

    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    console.log(`🗑️  Dropped database ${dbName}`);
  } finally {
    await adminPool.end();
  }
}

async function main() {
  const masterPool = new Pool({ connectionString: env.MASTER_DATABASE_URL, max: 2 });

  try {
    const { rows } = await masterPool.query<{
      id: string;
      db_name: string;
    }>(
      `SELECT id, db_name
       FROM tenants
       WHERE slug = $1
       LIMIT 1`,
      [slug],
    );

    if (!rows[0]) {
      console.error(`❌ Tenant not found for slug: ${slug}`);
      process.exit(1);
    }

    const tenantId = rows[0].id;
    const dbName = rows[0].db_name;

    await dropTenantDatabase(dbName);

    await masterPool.query("BEGIN");
    await masterPool.query("DELETE FROM user_lookups WHERE tenant_slug = $1", [slug]);
    await masterPool.query("DELETE FROM payments WHERE tenant_id = $1", [tenantId]);
    await masterPool.query("DELETE FROM subscriptions WHERE tenant_id = $1", [tenantId]);
    await masterPool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    await masterPool.query("COMMIT");

    console.log(`✅ Tenant reset complete for slug ${slug}`);
  } catch (err) {
    await masterPool.query("ROLLBACK");
    console.error("❌ Tenant reset failed:", err);
    process.exit(1);
  } finally {
    await masterPool.end();
  }
}

main();
