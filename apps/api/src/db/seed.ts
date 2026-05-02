/**
 * Seed — tenant demo + dados para painel do gestor (turnos, equipa, pedido pendente).
 * Run: bun run seed (from apps/api)
 *
 * Credenciais:
 *   Admin:    admin@mediscala.demo / Admin@1234
 *   Gestor:   manager@mediscala.demo / Demo@1234
 *   Equipa:   colaborador1@… até colaborador4@… / Demo@1234
 *
 * Turnos com prefixo "Demo ·" são recriados em cada execução do seed (próximos 14 dias).
 */
import "dotenv/config";
import argon2 from "argon2";
import type { PoolClient } from "pg";
import { masterPool, masterDb, getTenantClient } from "./client.js";
import { tenants, plans, subscriptions, userLookups } from "./schema.master.js";
import { provisionTenantDatabase, runMasterMigrations, seedMasterPlans } from "./migrations.js";
import { eq } from "drizzle-orm";

const DEMO_SLUG = "demo";
const DEMO_PASSWORD = "Demo@1234";
const ADMIN_PASSWORD = "Admin@1234";

async function wipeDemoShifts(client: PoolClient) {
  await client.query(`
    DELETE FROM coverage_candidates cc
    USING coverage_requests cr, absences ab, shift_assignments sa, shifts s
    WHERE cc.coverage_request_id = cr.id AND cr.absence_id = ab.id
      AND ab.shift_assignment_id = sa.id AND sa.shift_id = s.id AND s.name LIKE 'Demo ·%'
  `);
  await client.query(`
    DELETE FROM coverage_requests cr
    USING absences ab, shift_assignments sa, shifts s
    WHERE cr.absence_id = ab.id AND ab.shift_assignment_id = sa.id
      AND sa.shift_id = s.id AND s.name LIKE 'Demo ·%'
  `);
  await client.query(`
    DELETE FROM absences ab
    USING shift_assignments sa, shifts s
    WHERE ab.shift_assignment_id = sa.id AND sa.shift_id = s.id AND s.name LIKE 'Demo ·%'
  `);
  await client.query(`
    DELETE FROM shift_assignments sa
    USING shifts s
    WHERE sa.shift_id = s.id AND s.name LIKE 'Demo ·%'
  `);
  await client.query(`DELETE FROM shifts WHERE name LIKE 'Demo ·%'`);
}

async function ensureDemoCollaboratorAvailability(client: PoolClient) {
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
  for (const dow of days) {
    await client.query(
      `INSERT INTO availability (user_id, day_of_week, start_time, end_time, period)
       SELECT u.id, $1::day_of_week, '06:00', '22:00', NULL
       FROM users u
       WHERE u.email LIKE 'colaborador%@mediscala.demo'
         AND NOT EXISTS (
           SELECT 1 FROM availability av
           WHERE av.user_id = u.id AND av.day_of_week = $1::day_of_week
         )`,
      [dow],
    );
  }
}

async function registerUserLookup(email: string, userId: string, tenantSlug: string) {
  const mc = await masterPool.connect();
  try {
    await mc.query(
      `INSERT INTO user_lookups (email, user_id, tenant_slug)
       VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET user_id = $2, tenant_slug = $3`,
      [email, userId, tenantSlug],
    );
  } finally {
    mc.release();
  }
}

async function seedManagerDemoData(slug: string) {
  const client = await getTenantClient(slug);
  try {
    const deptNames = ["Urgências", "Medicina interna"];
    for (const name of deptNames) {
      await client.query(
        `INSERT INTO departments (name) SELECT $1::text WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = $1)`,
        [name],
      );
    }

    const { rows: deptRows } = await client.query<{ id: string }>(
      `SELECT id FROM departments WHERE name = 'Urgências' LIMIT 1`,
    );
    const deptUrgId = deptRows[0]?.id;
    const { rows: deptMiRows } = await client.query<{ id: string }>(
      `SELECT id FROM departments WHERE name = 'Medicina interna' LIMIT 1`,
    );
    const deptMiId = deptMiRows[0]?.id;

    if (!deptUrgId || !deptMiId) {
      console.warn("⚠️  Departamentos demo em falta — abortando dados gestor.");
      return;
    }

    const demoUsers: Array<{
      email: string;
      name: string;
      role: string;
      specialty: string | null;
      department_id: string | null;
    }> = [
      {
        email: "manager@mediscala.demo",
        name: "Maria Gestora",
        role: "MANAGER",
        specialty: null,
        department_id: deptUrgId,
      },
      {
        email: "colaborador1@mediscala.demo",
        name: "João Silva",
        role: "COLLABORATOR",
        specialty: "Enfermeiro",
        department_id: deptUrgId,
      },
      {
        email: "colaborador2@mediscala.demo",
        name: "Ana Costa",
        role: "COLLABORATOR",
        specialty: "Enfermeiro",
        department_id: deptUrgId,
      },
      {
        email: "colaborador3@mediscala.demo",
        name: "Pedro Martins",
        role: "COLLABORATOR",
        specialty: "Técnico",
        department_id: deptMiId,
      },
      {
        email: "colaborador4@mediscala.demo",
        name: "Inês Ramos",
        role: "COLLABORATOR",
        specialty: "Auxiliar",
        department_id: deptMiId,
      },
    ];

    const pwdHash = await argon2.hash(DEMO_PASSWORD);
    for (const u of demoUsers) {
      const { rows: exists } = await client.query(`SELECT id FROM users WHERE email = $1`, [
        u.email,
      ]);
      if (exists.length > 0) {
        await registerUserLookup(u.email, exists[0].id, slug);
        continue;
      }
      const { rows: ins } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, specialty, contract_hours_week, department_id, active)
         VALUES ($1, $2, $3, $4::user_role, $5, $6, $7, TRUE) RETURNING id`,
        [u.name, u.email, pwdHash, u.role, u.specialty, 40, u.department_id],
      );
      await registerUserLookup(u.email, ins[0].id, slug);
      console.log(`   ✅ Utilizador demo: ${u.email}`);
    }

    await ensureDemoCollaboratorAvailability(client);

    const { rows: adminRows } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'admin@mediscala.demo' LIMIT 1`,
    );
    const createdBy = adminRows[0]?.id;
    if (!createdBy) {
      console.warn("⚠️  Admin demo não encontrado — não é possível criar turnos.");
      return;
    }

    await wipeDemoShifts(client);

    const { rows: urgCollabs } = await client.query<{ id: string }>(
      `SELECT u.id FROM users u WHERE u.email LIKE 'colaborador%@mediscala.demo' AND u.department_id = $1 ORDER BY u.email`,
      [deptUrgId],
    );
    const { rows: miCollabs } = await client.query<{ id: string }>(
      `SELECT u.id FROM users u WHERE u.email LIKE 'colaborador%@mediscala.demo' AND u.department_id = $1 ORDER BY u.email`,
      [deptMiId],
    );

    if (urgCollabs.length === 0 && miCollabs.length === 0) {
      console.warn("⚠️  Nenhum colaborador demo encontrado para atribuir turnos.");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 0; d < 14; d++) {
      const day = new Date(today);
      day.setDate(day.getDate() + d);
      const y = day.getFullYear();
      const m = day.getMonth();
      const date = day.getDate();
      const label = `${String(date).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}`;
      const start = new Date(y, m, date, 8, 0, 0);
      const end = new Date(y, m, date, 16, 0, 0);

      const ins = await client.query<{ id: string }>(
        `INSERT INTO shifts (name, department_id, start_datetime, end_datetime, required_specialty, required_count, created_by)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz, NULL, 1, $5)
         RETURNING id`,
        [`Demo · Manhã Urgências (${label})`, deptUrgId, start.toISOString(), end.toISOString(), createdBy],
      );
      const shiftId = ins.rows[0]?.id;
      if (!shiftId || urgCollabs.length === 0) continue;
      const assignee = urgCollabs[d % urgCollabs.length];
      await client.query(
        `INSERT INTO shift_assignments (shift_id, user_id) VALUES ($1, $2)`,
        [shiftId, assignee.id],
      );
    }

    for (let d = 0; d < 14; d++) {
      const day = new Date(today);
      day.setDate(day.getDate() + d);
      const y = day.getFullYear();
      const m = day.getMonth();
      const date = day.getDate();
      const label = `${String(date).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}`;
      const start = new Date(y, m, date, 16, 0, 0);
      const end = new Date(y, m, date + 1, 0, 0, 0);

      const ins = await client.query<{ id: string }>(
        `INSERT INTO shifts (name, department_id, start_datetime, end_datetime, required_specialty, required_count, created_by)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz, NULL, 1, $5)
         RETURNING id`,
        [`Demo · Tarde Medicina Interna (${label})`, deptMiId, start.toISOString(), end.toISOString(), createdBy],
      );
      const shiftId = ins.rows[0]?.id;
      if (!shiftId || miCollabs.length === 0) continue;
      const assignee = miCollabs[d % miCollabs.length];
      await client.query(
        `INSERT INTO shift_assignments (shift_id, user_id) VALUES ($1, $2)`,
        [shiftId, assignee.id],
      );
    }

    await client.query(
      `INSERT INTO user_leave_blocks (user_id, starts_on, ends_on, type, status, reason)
       SELECT u.id, (CURRENT_DATE + INTERVAL '5 days')::date, (CURRENT_DATE + INTERVAL '7 days')::date,
              'VACATION'::absence_type, 'PENDING'::leave_block_status, 'Pedido de demo para fila do gestor'
       FROM users u WHERE u.email = 'colaborador4@mediscala.demo'
       AND NOT EXISTS (
         SELECT 1 FROM user_leave_blocks lb WHERE lb.user_id = u.id AND lb.status = 'PENDING'
       )`,
    );

    console.log(
      "✅ Dados demo do gestor: disponibilidade dos colaboradores, turnos por departamento (14 dias), pedido pendente.",
    );
  } finally {
    client.release();
  }
}

async function seed() {
  console.log("🌱 Starting seed...");

  // Ensure master DB is set up with plans
  await runMasterMigrations();
  await seedMasterPlans();

  const existing = await masterDb
    .select()
    .from(tenants)
    .where(eq(tenants.slug, DEMO_SLUG));

  if (existing.length === 0) {
    const dbName = `mediscala_${DEMO_SLUG}`;

    const [tenant] = await masterDb.insert(tenants).values({
      name: "MediScala Demo",
      slug: DEMO_SLUG,
      dbName,
      status: "ACTIVE",
      contactEmail: "admin@mediscala.demo",
    }).returning();
    console.log("✅ Tenant criado no master");

    // Create FREE subscription
    const [freePlan] = await masterDb.select().from(plans).where(eq(plans.code, "FREE"));
    if (freePlan) {
      await masterDb.insert(subscriptions).values({
        tenantId: tenant.id,
        planId: freePlan.id,
        status: "ACTIVE",
        startsAt: new Date(),
      });
    }

    await provisionTenantDatabase(DEMO_SLUG);
    console.log("✅ Base de dados do tenant provisionada");

    const passwordHash = await argon2.hash(ADMIN_PASSWORD);
    const tenantClient = await getTenantClient(DEMO_SLUG);
    let adminId: string;
    try {
      const { rows } = await tenantClient.query(
        `INSERT INTO users (name, email, password_hash, role, contract_hours_week, active)
         VALUES ($1, $2, $3, $4::user_role, $5, $6) RETURNING id`,
        ["Administrador Demo", "admin@mediscala.demo", passwordHash, "HOSPITAL_ADMIN", 40, true],
      );
      adminId = rows[0].id;
      console.log("✅ Admin user created");
    } finally {
      tenantClient.release();
    }

    await registerUserLookup("admin@mediscala.demo", adminId, DEMO_SLUG);
  } else {
    console.log("ℹ️  Tenant 'demo' já existe — a atualizar apenas dados demo do gestor.");
  }

  await seedManagerDemoData(DEMO_SLUG);

  console.log("\n🎉 Seed complete!");
  console.log("\n📋 Credenciais:");
  console.log(`   Admin (hospital):   admin@mediscala.demo / ${ADMIN_PASSWORD}`);
  console.log(`   Gestor:             manager@mediscala.demo / ${DEMO_PASSWORD}`);
  console.log(`   Colaboradores:      colaborador1..4@mediscala.demo / ${DEMO_PASSWORD}`);
  console.log("\n   Turnos nomeados «Demo · …» são repostos em cada seed.");

  await masterPool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
