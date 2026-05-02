#!/usr/bin/env tsx
/**
 * scripts/init-master.ts
 *
 * Initializes the master database:
 *   1. Creates mediscala_master DB (if not exists)
 *   2. Runs migrations (tables, enums)
 *   3. Seeds default plans
 *   4. Optionally creates an initial SUPER_ADMIN
 *
 * Usage:
 *   tsx scripts/init-master.ts
 *   tsx scripts/init-master.ts --email admin@example.com --password Secret123
 */
import "dotenv/config";
import pg from "pg";
import { runMasterMigrations, seedMasterPlans } from "../src/db/migrations.js";
import { masterPool, masterDb } from "../src/db/client.js";
import { superAdmins } from "../src/db/schema.master.js";
import { eq } from "drizzle-orm";
import argon2 from "argon2";

const args = process.argv.slice(2);
const emailIdx = args.indexOf("--email");
const passwordIdx = args.indexOf("--password");
const nameIdx = args.indexOf("--name");

const email = emailIdx !== -1 ? args[emailIdx + 1] : undefined;
const password = passwordIdx !== -1 ? args[passwordIdx + 1] : undefined;
const name = nameIdx !== -1 ? args[nameIdx + 1] : "Super Admin";

async function createMasterDbIfNotExists() {
  // Connect to default postgres DB to create the master DB
  const { MASTER_DATABASE_URL } = process.env;
  if (!MASTER_DATABASE_URL) {
    throw new Error("MASTER_DATABASE_URL is not set in .env");
  }

  const url = new URL(MASTER_DATABASE_URL);
  const postgresUrl = new URL(MASTER_DATABASE_URL);
  postgresUrl.pathname = "/postgres";

  const adminPool = new pg.Pool({ connectionString: postgresUrl.toString() });
  try {
    const dbName = url.pathname.slice(1); // "mediscala_master"
    const { rows } = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );
    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created`);
    } else {
      console.log(`ℹ️  Database "${dbName}" already exists`);
    }
  } finally {
    await adminPool.end();
  }
}

async function main() {
  console.log("🔧 Initializing master database...\n");

  await createMasterDbIfNotExists();

  await runMasterMigrations();
  console.log("✅ Master migrations applied");

  await seedMasterPlans();
  console.log("✅ Default plans seeded");

  if (email && password) {
    const existing = await masterDb
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.email, email.toLowerCase().trim()));

    if (existing.length > 0) {
      console.log(`ℹ️  Super admin with email "${email}" already exists`);
    } else {
      const passwordHash = await argon2.hash(password);
      await masterDb.insert(superAdmins).values({
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
      });
      console.log(`✅ Super admin created: ${email}`);
    }
  } else {
    console.log("ℹ️  No --email/--password provided — skipping super admin creation");
    console.log("   Run with: tsx scripts/init-master.ts --email admin@example.com --password Secret123");
  }

  await masterPool.end();
  console.log("\n🎉 Master database initialized successfully!");
}

main().catch((err) => {
  console.error("❌ init-master failed:", err);
  process.exit(1);
});
