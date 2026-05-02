import type { FastifyPluginAsync } from "fastify";
import { CreateTenantSchema } from "@mediscala/shared";
import argon2 from "argon2";
import { masterDb, masterPool, getTenantClient } from "../../db/client.js";
import { tenants, plans, subscriptions } from "../../db/schema.master.js";
import { provisionTenantDatabase } from "../../db/migrations.js";
import { eq } from "drizzle-orm";

export const tenantRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require SUPER_ADMIN
  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.user || request.user.role !== "SUPER_ADMIN") {
      return reply
        .status(403)
        .send({ error: "Forbidden", message: "SUPER_ADMIN only" });
    }
  });

  // GET /tenants
  fastify.get("/", async (_request, reply) => {
    const rows = await masterDb.select().from(tenants);
    return reply.send({ data: rows });
  });

  // POST /tenants — creates tenant + provisions DB + creates admin user
  fastify.post("/", async (request, reply) => {
    const body = CreateTenantSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Bad Request", message: body.error.flatten() });
    }

    const { name, slug, adminName, adminEmail, adminPassword } = body.data;
    const dbName = `mediscala_${slug}`;

    // Check slug uniqueness
    const existing = await masterDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug));
    if (existing.length > 0) {
      return reply
        .status(409)
        .send({ error: "Conflict", message: "Slug already taken" });
    }

    // Create tenant record in master
    const [tenant] = await masterDb
      .insert(tenants)
      .values({ name, slug, dbName, status: "TRIAL", contactEmail: adminEmail })
      .returning();

    // Create STARTER subscription by default
    const [starterPlan] = await masterDb
      .select()
      .from(plans)
      .where(eq(plans.code, "STARTER"));

    if (starterPlan) {
      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + 30);
      await masterDb.insert(subscriptions).values({
        tenantId: tenant.id,
        planId: starterPlan.id,
        status: "ACTIVE",
        startsAt,
        endsAt,
      });
    }

    // Provision the tenant database
    await provisionTenantDatabase(slug);

    // Create HOSPITAL_ADMIN in tenant DB
    const passwordHash = await argon2.hash(adminPassword);
    const tenantClient = await getTenantClient(slug);
    let adminUserId: string;
    try {
      const { rows } = await tenantClient.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'HOSPITAL_ADMIN') RETURNING id`,
        [adminName, adminEmail, passwordHash],
      );
      adminUserId = rows[0].id;
    } finally {
      tenantClient.release();
    }

    // Register in master user_lookups
    const masterClient = await masterPool.connect();
    try {
      await masterClient.query(
        `INSERT INTO user_lookups (email, user_id, tenant_slug) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET user_id = $2, tenant_slug = $3`,
        [adminEmail, adminUserId, slug],
      );
    } finally {
      masterClient.release();
    }

    return reply.status(201).send({ data: tenant });
  });

  // GET /tenants/:id
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [tenant] = await masterDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, id));
    if (!tenant) return reply.status(404).send({ error: "Not Found" });
    return reply.send({ data: tenant });
  });

  // PATCH /tenants/:id — update name, status, notes, contactEmail
  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      status: string;
      notes: string;
      contactEmail: string;
    }>;

    const [updated] = await masterDb
      .update(tenants)
      .set({ ...body, updatedAt: new Date() } as any)
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not Found" });
    return reply.send({ data: updated });
  });
};
