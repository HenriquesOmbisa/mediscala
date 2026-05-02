#!/usr/bin/env tsx
/**
 * scripts/create-tenant.ts
 *
 * Provisions a new tenant:
 *   1. Creates tenant record in master DB
 *   2. Creates STARTER subscription
 *   3. Provisions mediscala_{slug} database with all tables
 *   4. Creates HOSPITAL_ADMIN user in tenant DB
 *   5. Registers user in master user_lookups
 *
 * Usage:
 *   tsx scripts/create-tenant.ts \
 *     --name "Hospital XYZ" \
 *     --slug hospital-xyz \
 *     --admin-email admin@hospitalxyz.com \
 *     --admin-password Secret@123 \
 *     --admin-name "Dr. Admin" \
 *     --plan STARTER
 */
import "dotenv/config";
import argon2 from "argon2";
import { masterPool, masterDb, getTenantClient } from "../src/db/client.js";
import { tenants, plans, subscriptions } from "../src/db/schema.master.js";
import { provisionTenantDatabase } from "../src/db/migrations.js";
import { eq } from "drizzle-orm";

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const args = process.argv.slice(2);

const tenantName = getArg(args, "--name");
const slug = getArg(args, "--slug");
const adminEmail = getArg(args, "--admin-email");
const adminPassword = getArg(args, "--admin-password");
const adminName = getArg(args, "--admin-name") ?? "Administrador";
const planCode = getArg(args, "--plan") ?? "STARTER";
const contactEmail = getArg(args, "--contact-email") ?? adminEmail;

if (!tenantName || !slug || !adminEmail || !adminPassword) {
  console.error(
    "❌ Missing required arguments: --name, --slug, --admin-email, --admin-password",
  );
  console.error(
    "\nUsage: tsx scripts/create-tenant.ts --name \"Hospital XYZ\" --slug hospital-xyz --admin-email admin@hospital.com --admin-password Secret@123",
  );
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error("❌ Slug must contain only lowercase letters, numbers and hyphens");
  process.exit(1);
}

async function main() {
  console.log(`🏥 Creating tenant "${tenantName}" (slug: ${slug})...\n`);

  // Check uniqueness
  const existing = await masterDb
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug));
  if (existing.length > 0) {
    console.error(`❌ Tenant with slug "${slug}" already exists`);
    process.exit(1);
  }

  const dbName = `mediscala_${slug}`;

  // Create tenant in master
  const [tenant] = await masterDb
    .insert(tenants)
    .values({
      name: tenantName,
      slug,
      dbName,
      status: "TRIAL",
      contactEmail: contactEmail ?? adminEmail,
    })
    .returning();
  console.log(`✅ Tenant created (id: ${tenant.id})`);

  // Create subscription
  const [plan] = await masterDb
    .select()
    .from(plans)
    .where(eq(plans.code, planCode.toUpperCase()));

  if (plan) {
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + 30);
    await masterDb.insert(subscriptions).values({
      tenantId: tenant.id,
      planId: plan.id,
      status: "ACTIVE",
      startsAt,
      endsAt,
    });
    console.log(`✅ ${planCode} subscription created (30 days)`);
  } else {
    console.warn(`⚠️  Plan "${planCode}" not found — subscription not created`);
  }

  // Provision tenant DB
  await provisionTenantDatabase(slug);
  console.log(`✅ Database "${dbName}" provisioned`);

  // Create admin user
  const passwordHash = await argon2.hash(adminPassword);
  const tenantClient = await getTenantClient(slug);
  let adminId: string;
  try {
    const { rows } = await tenantClient.query(
      `INSERT INTO users (name, email, password_hash, role, contract_hours_week, active)
       VALUES ($1, $2, $3, 'HOSPITAL_ADMIN', 40, TRUE) RETURNING id`,
      [adminName, adminEmail, passwordHash],
    );
    adminId = rows[0].id;
    console.log(`✅ HOSPITAL_ADMIN user created: ${adminEmail}`);
  } finally {
    tenantClient.release();
  }

  // Register in user_lookups
  const mc = await masterPool.connect();
  try {
    await mc.query(
      `INSERT INTO user_lookups (email, user_id, tenant_slug)
       VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET user_id = $2, tenant_slug = $3`,
      [adminEmail, adminId, slug],
    );
    console.log("✅ User registered in master user_lookups");
  } finally {
    mc.release();
  }

  await masterPool.end();

  console.log("\n🎉 Tenant provisioned successfully!");
  console.log(`\n   Slug:       ${slug}`);
  console.log(`   Database:   ${dbName}`);
  console.log(`   Admin:      ${adminEmail}`);
  console.log(`   Status:     TRIAL`);
}

main().catch((err) => {
  console.error("❌ create-tenant failed:", err);
  process.exit(1);
});
