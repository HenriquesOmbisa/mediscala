import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { masterDb, masterPool, getTenantClient } from "../../db/client.js";
import { tenants, plans, subscriptions } from "../../db/schema.master.js";
import { provisionTenantDatabase } from "../../db/migrations.js";
import { eq } from "drizzle-orm";

export const adminTenantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.user || request.user.role !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden", message: "SUPER_ADMIN only" });
    }
  });

  // GET /admin/tenants
  fastify.get("/", async (_request, reply) => {
    const rows = await masterDb
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        dbName: tenants.dbName,
        contactEmail: tenants.contactEmail,
        notes: tenants.notes,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .orderBy(tenants.createdAt);
    return reply.send({ data: rows });
  });

  // GET /admin/tenants/:id
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [tenant] = await masterDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, id));
    if (!tenant) return reply.status(404).send({ error: "Not Found" });

    // Get active subscription + plan
    const [sub] = await masterDb
      .select({ subscription: subscriptions, plan: plans })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.tenantId, id))
      .orderBy(subscriptions.createdAt)
      .limit(1);

    return reply.send({ data: { ...tenant, subscription: sub ?? null } });
  });

  // POST /admin/tenants — provision new tenant
  fastify.post("/", async (request, reply) => {
    const {
      name,
      slug,
      adminName,
      adminEmail,
      adminPassword,
      planCode = "STARTER",
      notes,
      contactEmail,
    } = request.body as {
      name: string;
      slug: string;
      adminName: string;
      adminEmail: string;
      adminPassword: string;
      planCode?: string;
      notes?: string;
      contactEmail?: string;
    };

    if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
      return reply.status(400).send({ error: "Bad Request", message: "Missing required fields" });
    }

    const dbName = `mediscala_${slug}`;

    const existing = await masterDb.select().from(tenants).where(eq(tenants.slug, slug));
    if (existing.length > 0) {
      return reply.status(409).send({ error: "Conflict", message: "Slug already taken" });
    }

    // Create tenant
    const [tenant] = await masterDb
      .insert(tenants)
      .values({
        name,
        slug,
        dbName,
        status: "TRIAL",
        contactEmail: contactEmail ?? adminEmail,
        notes: notes ?? null,
      })
      .returning();

    // Create subscription
    const [plan] = await masterDb.select().from(plans).where(eq(plans.code, planCode));
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
    }

    // Provision DB
    await provisionTenantDatabase(slug);

    // Create admin user in tenant DB
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

    // Register in user_lookups
    const masterClient = await masterPool.connect();
    try {
      await masterClient.query(
        `INSERT INTO user_lookups (email, user_id, tenant_slug)
         VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET user_id = $2, tenant_slug = $3`,
        [adminEmail, adminUserId, slug],
      );
    } finally {
      masterClient.release();
    }

    return reply.status(201).send({ data: tenant });
  });

  // PATCH /admin/tenants/:id
  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, status, notes, contactEmail } = request.body as {
      name?: string;
      status?: string;
      notes?: string;
      contactEmail?: string;
    };

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;
    if (contactEmail !== undefined) updateFields.contactEmail = contactEmail;

    const [updated] = await masterDb
      .update(tenants)
      .set(updateFields as any)
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not Found" });
    return reply.send({ data: updated });
  });

  // DELETE /admin/tenants/:id — only suspend (no hard delete)
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [updated] = await masterDb
      .update(tenants)
      .set({ status: "SUSPENDED", updatedAt: new Date() } as any)
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not Found" });
    return reply.send({ data: { message: "Tenant suspended", tenant: updated } });
  });
};
