import type { FastifyPluginAsync } from "fastify";
import { masterDb } from "../../db/client.js";
import { subscriptions, plans, tenants } from "../../db/schema.master.js";
import { eq } from "drizzle-orm";

export const adminSubscriptionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.user || request.user.role !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden", message: "SUPER_ADMIN only" });
    }
  });

  // GET /admin/subscriptions?tenantId=...
  fastify.get("/", async (request, reply) => {
    const { tenantId } = request.query as { tenantId?: string };

    const query = masterDb
      .select({
        id: subscriptions.id,
        status: subscriptions.status,
        startsAt: subscriptions.startsAt,
        endsAt: subscriptions.endsAt,
        autoRenew: subscriptions.autoRenew,
        createdAt: subscriptions.createdAt,
        tenantId: subscriptions.tenantId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        planId: subscriptions.planId,
        planName: plans.name,
        planCode: plans.code,
        priceMonthly: plans.priceMonthly,
      })
      .from(subscriptions)
      .leftJoin(tenants, eq(subscriptions.tenantId, tenants.id))
      .leftJoin(plans, eq(subscriptions.planId, plans.id));

    if (tenantId) {
      const rows = await query.where(eq(subscriptions.tenantId, tenantId));
      return reply.send({ data: rows });
    }

    const rows = await query.orderBy(subscriptions.createdAt);
    return reply.send({ data: rows });
  });

  // POST /admin/subscriptions — create or renew subscription
  fastify.post("/", async (request, reply) => {
    const { tenantId, planId, startsAt, endsAt, autoRenew } = request.body as {
      tenantId: string;
      planId: string;
      startsAt: string;
      endsAt?: string;
      autoRenew?: boolean;
    };

    if (!tenantId || !planId || !startsAt) {
      return reply.status(400).send({ error: "Bad Request", message: "tenantId, planId, startsAt required" });
    }

    // Cancel any existing active subscription for this tenant
    await masterDb
      .update(subscriptions)
      .set({ status: "CANCELLED", updatedAt: new Date() } as any)
      .where(eq(subscriptions.tenantId, tenantId));

    const [sub] = await masterDb
      .insert(subscriptions)
      .values({
        tenantId,
        planId,
        status: "ACTIVE",
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : undefined,
        autoRenew: autoRenew ?? true,
      })
      .returning();

    // Activate tenant if it was trial/suspended
    await masterDb
      .update(tenants)
      .set({ status: "ACTIVE", updatedAt: new Date() } as any)
      .where(eq(tenants.id, tenantId));

    return reply.status(201).send({ data: sub });
  });

  // PATCH /admin/subscriptions/:id
  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, endsAt, autoRenew } = request.body as {
      status?: string;
      endsAt?: string;
      autoRenew?: boolean;
    };

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateFields.status = status;
    if (endsAt !== undefined) updateFields.endsAt = new Date(endsAt);
    if (autoRenew !== undefined) updateFields.autoRenew = autoRenew;

    const [updated] = await masterDb
      .update(subscriptions)
      .set(updateFields as any)
      .where(eq(subscriptions.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not Found" });
    return reply.send({ data: updated });
  });
};
