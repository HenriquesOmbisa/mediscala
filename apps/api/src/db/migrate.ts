import "dotenv/config";
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

function buildTenantConnString(slug: string): string {
  const base = new URL(env.MASTER_DATABASE_URL);
  base.pathname = `/mediscala_${slug}`;
  return base.toString();
}

async function migrateTenant(slug: string) {
  const pool = new Pool({ connectionString: buildTenantConnString(slug), max: 1 });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "ALTER TABLE coverage_requests ALTER COLUMN absence_id DROP NOT NULL;",
    );
    await client.query(
      "ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'COVERAGE';",
    );
    await client.query(
      "ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES users(id);",
    );
    await client.query(
      "ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS source_assignment_id UUID REFERENCES shift_assignments(id);",
    );
    await client.query(
      "ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS target_assignment_id UUID REFERENCES shift_assignments(id);",
    );
    await client.query(
      "ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS swap_status TEXT;",
    );
    await client.query(
      "ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS manager_decision_at TIMESTAMPTZ;",
    );
    await client.query(
      "ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS manager_decision_by UUID REFERENCES users(id);",
    );
    await client.query(
      "ALTER TABLE coverage_requests ADD COLUMN IF NOT EXISTS manager_decision_reason TEXT;",
    );

    await client.query(
      "CREATE INDEX IF NOT EXISTS coverage_requests_type_status_idx ON coverage_requests(type, status);",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS coverage_requests_swap_status_idx ON coverage_requests(swap_status);",
    );

    await client.query("COMMIT");
    console.log(`✅ Migrated tenant: ${slug}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`❌ Failed migrating tenant: ${slug}`, err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function run() {
  const masterPool = new Pool({ connectionString: env.MASTER_DATABASE_URL, max: 1 });
  const masterClient = await masterPool.connect();

  try {
    const onlySlug = process.argv[2]?.trim();

    let slugs: string[] = [];
    if (onlySlug) {
      slugs = [onlySlug];
    } else {
      const { rows } = await masterClient.query<{ slug: string }>(
        "SELECT slug FROM tenants ORDER BY created_at ASC",
      );
      slugs = rows.map((r) => r.slug);
    }

    if (slugs.length === 0) {
      console.log("ℹ️ No tenants found to migrate.");
      return;
    }

    console.log(`🚀 Running tenant migrations for ${slugs.length} tenant(s)...`);
    for (const slug of slugs) {
      await migrateTenant(slug);
    }
    console.log("✅ Tenant migrations completed.");
  } finally {
    masterClient.release();
    await masterPool.end();
  }
}

run().catch((err) => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
