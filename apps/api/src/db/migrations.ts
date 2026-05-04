import pg from "pg";
import { env } from "../config/env.js";
import { masterPool } from "./client.js";

const { Pool } = pg;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildTenantConnString(slug: string): string {
  const base = new URL(env.MASTER_DATABASE_URL);
  base.pathname = `/mediscala_${slug}`;
  return base.toString();
}

async function getAdminClient(): Promise<pg.PoolClient> {
  return masterPool.connect();
}

// ─── Master DB ─────────────────────────────────────────────────────────────────

/**
 * Creates all tables in the master database (idempotent).
 */
export async function runMasterMigrations() {
  const client = await getAdminClient();
  try {
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE payment_submission_status AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_users INTEGER NOT NULL DEFAULT 5,
        max_departments INTEGER NOT NULL DEFAULT 2,
        max_shifts_per_month INTEGER NOT NULL DEFAULT 50,
        features JSONB DEFAULT '{}',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'TRIAL',
        db_name TEXT NOT NULL UNIQUE,
        contact_email TEXT,
        contact_phone TEXT,
        nif TEXT,
        address TEXT,
        area_of_activity TEXT,
        logo_url TEXT,
        brand_display_mode TEXT NOT NULL DEFAULT 'LOGO_AND_NAME',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_phone TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nif TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS area_of_activity TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_display_mode TEXT NOT NULL DEFAULT 'LOGO_AND_NAME';

      CREATE TABLE IF NOT EXISTS super_admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        plan_id UUID NOT NULL REFERENCES plans(id),
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ,
        auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        subscription_id UUID REFERENCES subscriptions(id),
        amount NUMERIC(10,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'AOA',
        status TEXT NOT NULL DEFAULT 'PENDING',
        method TEXT,
        reference TEXT,
        notes TEXT,
        due_date TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE payments ADD COLUMN IF NOT EXISTS requested_plan_id UUID REFERENCES plans(id);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS submission_status payment_submission_status NOT NULL DEFAULT 'APPROVED';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_url TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS reviewed_by_super_admin_id UUID REFERENCES super_admins(id);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS review_reason TEXT;

      CREATE TABLE IF NOT EXISTS user_lookups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        user_id UUID NOT NULL,
        tenant_slug TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS user_lookups_tenant_idx ON user_lookups(tenant_slug);
      CREATE INDEX IF NOT EXISTS payments_tenant_submission_idx ON payments(tenant_id, submission_status);
    `);
    console.log("✅ Master DB migrations complete");
  } finally {
    client.release();
  }
}

/**
 * Seeds default plans if they don't exist yet.
 */
export async function seedMasterPlans() {
  const client = await getAdminClient();
  try {
    const defaultPlans = [
      { code: "FREE",       name: "Free",       price: "0",      maxUsers: 5,   maxDepts: 2,  maxShifts: 50  },
      { code: "STARTER",    name: "Starter",    price: "9900",   maxUsers: 20,  maxDepts: 5,  maxShifts: 200 },
      { code: "PRO",        name: "Pro",        price: "24900",  maxUsers: 100, maxDepts: 20, maxShifts: 1000 },
      { code: "ENTERPRISE", name: "Enterprise", price: "59900",  maxUsers: 9999,maxDepts: 999,maxShifts: 99999 },
    ];
    for (const p of defaultPlans) {
      await client.query(
        `INSERT INTO plans (name, code, price_monthly, max_users, max_departments, max_shifts_per_month)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO NOTHING`,
        [p.name, p.code, p.price, p.maxUsers, p.maxDepts, p.maxShifts],
      );
    }
    console.log("✅ Default plans seeded");
  } finally {
    client.release();
  }
}

// ─── Tenant DB ─────────────────────────────────────────────────────────────────

/**
 * Creates a new PostgreSQL database for a tenant and provisions all tables.
 * The DB name will be mediscala_{slug}.
 */
export async function provisionTenantDatabase(slug: string) {
  const dbName = `mediscala_${slug}`;

  // We need a connection to postgres (not the master db) to CREATE DATABASE
  const base = new URL(env.MASTER_DATABASE_URL);
  const adminConnStr = `${base.protocol}//${base.username}:${base.password}@${base.host}/postgres`;

  const adminPool = new Pool({ connectionString: adminConnStr, max: 1 });
  const adminClient = await adminPool.connect();
  try {
    // Check if DB already exists
    const { rows } = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (rows.length === 0) {
      // CREATE DATABASE cannot run inside a transaction
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database '${dbName}' created`);
    } else {
      console.log(`ℹ️  Database '${dbName}' already exists — skipping create`);
    }
  } finally {
    adminClient.release();
    await adminPool.end();
  }

  // Now connect to the new tenant DB and create tables
  const tenantConnStr = buildTenantConnString(slug);
  const tenantPool = new Pool({ connectionString: tenantConnStr, max: 1 });
  const tenantClient = await tenantPool.connect();
  try {
    await tenantClient.query("BEGIN");

    await tenantClient.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('HOSPITAL_ADMIN', 'MANAGER', 'COLLABORATOR');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE assignment_status AS ENUM ('ASSIGNED', 'ABSENT', 'SWAPPED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE absence_type AS ENUM ('SICK', 'PERSONAL', 'EMERGENCY', 'VACATION', 'OTHER');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE coverage_status AS ENUM ('OPEN', 'FILLED', 'EXPIRED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE coverage_response AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE notification_type AS ENUM (
          'COVERAGE_REQUEST', 'COVERAGE_FILLED', 'COVERAGE_EXPIRED',
          'SHIFT_ASSIGNED', 'SHIFT_CHANGED', 'ABSENCE_APPROVED', 'ABSENCE_REJECTED', 'GENERAL'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE day_of_week AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE availability_period AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE leave_block_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await tenantClient.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role user_role NOT NULL,
        specialty TEXT,
        contract_hours_week TEXT NOT NULL DEFAULT '40',
        department_id UUID REFERENCES departments(id),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        push_token TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        department_id UUID NOT NULL REFERENCES departments(id),
        start_datetime TIMESTAMPTZ NOT NULL,
        end_datetime TIMESTAMPTZ NOT NULL,
        required_specialty TEXT,
        required_count TEXT NOT NULL DEFAULT '1',
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS shifts_start_idx ON shifts(start_datetime);

      CREATE TABLE IF NOT EXISTS shift_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id UUID NOT NULL REFERENCES shifts(id),
        user_id UUID NOT NULL REFERENCES users(id),
        status assignment_status NOT NULL DEFAULT 'ASSIGNED',
        attendance_present BOOLEAN,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS absences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_assignment_id UUID NOT NULL REFERENCES shift_assignments(id),
        user_id UUID NOT NULL REFERENCES users(id),
        type absence_type NOT NULL,
        reason TEXT,
        reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_by UUID REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS coverage_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        absence_id UUID REFERENCES absences(id),
        status coverage_status NOT NULL DEFAULT 'OPEN',
        type TEXT NOT NULL DEFAULT 'COVERAGE',
        requested_by UUID REFERENCES users(id),
        source_assignment_id UUID REFERENCES shift_assignments(id),
        target_assignment_id UUID REFERENCES shift_assignments(id),
        swap_status TEXT,
        manager_decision_at TIMESTAMPTZ,
        manager_decision_by UUID REFERENCES users(id),
        manager_decision_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS coverage_requests_type_status_idx ON coverage_requests(type, status);
      CREATE INDEX IF NOT EXISTS coverage_requests_swap_status_idx ON coverage_requests(swap_status);

      CREATE TABLE IF NOT EXISTS coverage_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        coverage_request_id UUID NOT NULL REFERENCES coverage_requests(id),
        user_id UUID NOT NULL REFERENCES users(id),
        notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        response coverage_response NOT NULL DEFAULT 'PENDING',
        responded_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        day_of_week day_of_week NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        period availability_period
      );

      CREATE TABLE IF NOT EXISTS user_leave_blocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        starts_on DATE NOT NULL,
        ends_on DATE NOT NULL,
        type absence_type NOT NULL,
        status leave_block_status NOT NULL DEFAULT 'APPROVED',
        reason TEXT,
        approved_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        type notification_type NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id, read);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id UUID,
        old_value JSONB,
        new_value JSONB,
        ip TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await tenantClient.query("COMMIT");
    console.log(`✅ Tenant database '${dbName}' provisioned`);
  } catch (err) {
    await tenantClient.query("ROLLBACK");
    throw err;
  } finally {
    tenantClient.release();
    await tenantPool.end();
  }
}

/**
 * Gets the active plan limits for a tenant (via master DB lookup).
 */
export async function getTenantPlanLimits(tenantSlug: string): Promise<{
  maxUsers: number;
  maxDepartments: number;
  maxShiftsPerMonth: number;
} | null> {
  const client = await getAdminClient();
  try {
    const { rows } = await client.query<{
      max_users: number;
      max_departments: number;
      max_shifts_per_month: number;
    }>(
      `SELECT p.max_users, p.max_departments, p.max_shifts_per_month
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       JOIN tenants t ON t.id = s.tenant_id
       WHERE t.slug = $1 AND s.status = 'ACTIVE'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [tenantSlug],
    );
    if (!rows[0]) return null;
    return {
      maxUsers: rows[0].max_users,
      maxDepartments: rows[0].max_departments,
      maxShiftsPerMonth: rows[0].max_shifts_per_month,
    };
  } finally {
    client.release();
  }
}

/**
 * Creates the public schema tables (tenants) if they don't exist.
 * @deprecated Use runMasterMigrations() instead.
 */
export async function runPublicMigrations() {
  return runMasterMigrations();
}
