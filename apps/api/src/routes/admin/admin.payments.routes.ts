import type { FastifyPluginAsync } from "fastify";
import { masterDb } from "../../db/client.js";
import { payments, tenants, subscriptions } from "../../db/schema.master.js";
import { and, eq, desc } from "drizzle-orm";

export const adminPaymentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.user || request.user.role !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden", message: "SUPER_ADMIN only" });
    }
  });

  // GET /admin/payments?tenantId=...&status=...
  fastify.get("/", async (request, reply) => {
    const { tenantId, status } = request.query as {
      tenantId?: string;
      status?: string;
    };

    const baseQuery = masterDb
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        method: payments.method,
        reference: payments.reference,
        notes: payments.notes,
        dueDate: payments.dueDate,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        tenantId: payments.tenantId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        subscriptionId: payments.subscriptionId,
      })
      .from(payments)
      .leftJoin(tenants, eq(payments.tenantId, tenants.id))
      .orderBy(desc(payments.createdAt));

    let rows;
    if (tenantId && status) {
      rows = await masterDb
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          method: payments.method,
          reference: payments.reference,
          notes: payments.notes,
          dueDate: payments.dueDate,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          tenantId: payments.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          subscriptionId: payments.subscriptionId,
        })
        .from(payments)
        .leftJoin(tenants, eq(payments.tenantId, tenants.id))
        .where(and(eq(payments.tenantId, tenantId), eq(payments.status, status as any)))
        .orderBy(desc(payments.createdAt));
    } else if (tenantId) {
      rows = await masterDb
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          method: payments.method,
          reference: payments.reference,
          notes: payments.notes,
          dueDate: payments.dueDate,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          tenantId: payments.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          subscriptionId: payments.subscriptionId,
        })
        .from(payments)
        .leftJoin(tenants, eq(payments.tenantId, tenants.id))
        .where(eq(payments.tenantId, tenantId))
        .orderBy(desc(payments.createdAt));
    } else {
      rows = await baseQuery;
    }

    return reply.send({ data: rows });
  });

  // POST /admin/payments — record a payment
  fastify.post("/", async (request, reply) => {
    const {
      tenantId,
      subscriptionId,
      amount,
      currency = "AOA",
      method,
      reference,
      notes,
      dueDate,
      markPaid = false,
    } = request.body as {
      tenantId: string;
      subscriptionId?: string;
      amount: string;
      currency?: string;
      method?: string;
      reference?: string;
      notes?: string;
      dueDate?: string;
      markPaid?: boolean;
    };

    if (!tenantId || !amount) {
      return reply.status(400).send({ error: "Bad Request", message: "tenantId and amount required" });
    }

    const [payment] = await masterDb
      .insert(payments)
      .values({
        tenantId,
        subscriptionId: subscriptionId ?? undefined,
        amount,
        currency,
        status: markPaid ? "PAID" : "PENDING",
        method: method ?? null,
        reference: reference ?? null,
        notes: notes ?? null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        paidAt: markPaid ? new Date() : undefined,
      })
      .returning();

    return reply.status(201).send({ data: payment });
  });

  // PATCH /admin/payments/:id — update payment (e.g. mark as PAID)
  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, method, reference, notes, paidAt } = request.body as {
      status?: string;
      method?: string;
      reference?: string;
      notes?: string;
      paidAt?: string;
    };

    const updateFields: Record<string, unknown> = {};
    if (status !== undefined) updateFields.status = status;
    if (method !== undefined) updateFields.method = method;
    if (reference !== undefined) updateFields.reference = reference;
    if (notes !== undefined) updateFields.notes = notes;
    if (status === "PAID" && !paidAt) updateFields.paidAt = new Date();
    if (paidAt !== undefined) updateFields.paidAt = new Date(paidAt);

    const [updated] = await masterDb
      .update(payments)
      .set(updateFields as any)
      .where(eq(payments.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not Found" });
    return reply.send({ data: updated });
  });
};
