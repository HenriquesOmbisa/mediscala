import type { FastifyPluginAsync } from "fastify";
import { masterDb, masterPool } from "../../db/client.js";
import { payments, tenants, subscriptions, plans } from "../../db/schema.master.js";
import { and, eq, desc } from "drizzle-orm";

export const adminPaymentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.user || request.user.role !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden", message: "SUPER_ADMIN only" });
    }
  });

  // GET /admin/payments?tenantId=...&status=...
  fastify.get("/", async (request, reply) => {
    const { tenantId, status, submissionStatus } = request.query as {
      tenantId?: string;
      status?: string;
      submissionStatus?: string;
    };

    const baseQuery = masterDb
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        submissionStatus: payments.submissionStatus,
        method: payments.method,
        reference: payments.reference,
        notes: payments.notes,
        proofUrl: payments.proofUrl,
        reviewReason: payments.reviewReason,
        reviewedAt: payments.reviewedAt,
        dueDate: payments.dueDate,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        tenantId: payments.tenantId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        subscriptionId: payments.subscriptionId,
        requestedPlanId: payments.requestedPlanId,
        requestedPlanName: plans.name,
        requestedPlanCode: plans.code,
      })
      .from(payments)
      .leftJoin(tenants, eq(payments.tenantId, tenants.id))
      .leftJoin(plans, eq(payments.requestedPlanId, plans.id))
      .orderBy(desc(payments.createdAt));

    let rows;
    if (tenantId && status) {
      rows = await masterDb
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          submissionStatus: payments.submissionStatus,
          method: payments.method,
          reference: payments.reference,
          notes: payments.notes,
          proofUrl: payments.proofUrl,
          reviewReason: payments.reviewReason,
          reviewedAt: payments.reviewedAt,
          dueDate: payments.dueDate,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          tenantId: payments.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          subscriptionId: payments.subscriptionId,
          requestedPlanId: payments.requestedPlanId,
          requestedPlanName: plans.name,
          requestedPlanCode: plans.code,
        })
        .from(payments)
        .leftJoin(tenants, eq(payments.tenantId, tenants.id))
        .leftJoin(plans, eq(payments.requestedPlanId, plans.id))
        .where(and(eq(payments.tenantId, tenantId), eq(payments.status, status as any)))
        .orderBy(desc(payments.createdAt));
    } else if (tenantId && submissionStatus) {
      rows = await masterDb
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          submissionStatus: payments.submissionStatus,
          method: payments.method,
          reference: payments.reference,
          notes: payments.notes,
          proofUrl: payments.proofUrl,
          reviewReason: payments.reviewReason,
          reviewedAt: payments.reviewedAt,
          dueDate: payments.dueDate,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          tenantId: payments.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          subscriptionId: payments.subscriptionId,
          requestedPlanId: payments.requestedPlanId,
          requestedPlanName: plans.name,
          requestedPlanCode: plans.code,
        })
        .from(payments)
        .leftJoin(tenants, eq(payments.tenantId, tenants.id))
        .leftJoin(plans, eq(payments.requestedPlanId, plans.id))
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.submissionStatus, submissionStatus as any),
          ),
        )
        .orderBy(desc(payments.createdAt));
    } else if (submissionStatus) {
      rows = await masterDb
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          submissionStatus: payments.submissionStatus,
          method: payments.method,
          reference: payments.reference,
          notes: payments.notes,
          proofUrl: payments.proofUrl,
          reviewReason: payments.reviewReason,
          reviewedAt: payments.reviewedAt,
          dueDate: payments.dueDate,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          tenantId: payments.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          subscriptionId: payments.subscriptionId,
          requestedPlanId: payments.requestedPlanId,
          requestedPlanName: plans.name,
          requestedPlanCode: plans.code,
        })
        .from(payments)
        .leftJoin(tenants, eq(payments.tenantId, tenants.id))
        .leftJoin(plans, eq(payments.requestedPlanId, plans.id))
        .where(eq(payments.submissionStatus, submissionStatus as any))
        .orderBy(desc(payments.createdAt));
    } else if (tenantId) {
      rows = await masterDb
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          submissionStatus: payments.submissionStatus,
          method: payments.method,
          reference: payments.reference,
          notes: payments.notes,
          proofUrl: payments.proofUrl,
          reviewReason: payments.reviewReason,
          reviewedAt: payments.reviewedAt,
          dueDate: payments.dueDate,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          tenantId: payments.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          subscriptionId: payments.subscriptionId,
          requestedPlanId: payments.requestedPlanId,
          requestedPlanName: plans.name,
          requestedPlanCode: plans.code,
        })
        .from(payments)
        .leftJoin(tenants, eq(payments.tenantId, tenants.id))
        .leftJoin(plans, eq(payments.requestedPlanId, plans.id))
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
      submissionStatus,
      requestedPlanId,
      proofUrl,
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
      submissionStatus?: string;
      requestedPlanId?: string;
      proofUrl?: string;
    };

    if (!tenantId || !amount) {
      return reply.status(400).send({ error: "Bad Request", message: "tenantId and amount required" });
    }

    const [payment] = await masterDb
      .insert(payments)
      .values({
        tenantId,
        subscriptionId: subscriptionId ?? undefined,
        requestedPlanId: requestedPlanId ?? undefined,
        amount,
        currency,
        status: markPaid ? "PAID" : "PENDING",
        submissionStatus: submissionStatus === "SUBMITTED" ? "SUBMITTED" : "APPROVED",
        method: method ?? null,
        reference: reference ?? null,
        notes: notes ?? null,
        proofUrl: proofUrl ?? null,
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

  // POST /admin/payments/:id/approve — approve tenant submission and release plan automatically
  fastify.post("/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { planId, reviewReason, paidAt } = request.body as {
      planId?: string;
      reviewReason?: string;
      paidAt?: string;
    };

    const client = await masterPool.connect();
    try {
      await client.query("BEGIN");

      const { rows: paymentRows } = await client.query<{
        id: string;
        tenant_id: string;
        requested_plan_id: string | null;
      }>(
        `SELECT id, tenant_id, requested_plan_id FROM payments WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const payment = paymentRows[0];
      if (!payment) {
        await client.query("ROLLBACK");
        return reply.status(404).send({ error: "Not Found", message: "Payment not found" });
      }

      const finalPlanId = planId ?? payment.requested_plan_id;
      if (!finalPlanId) {
        await client.query("ROLLBACK");
        return reply.status(400).send({
          error: "Bad Request",
          message: "planId is required when payment has no requested plan",
        });
      }

      const { rows: planRows } = await client.query<{ id: string }>(
        `SELECT id FROM plans WHERE id = $1 AND active = TRUE LIMIT 1`,
        [finalPlanId],
      );
      if (!planRows[0]) {
        await client.query("ROLLBACK");
        return reply.status(400).send({ error: "Bad Request", message: "Invalid plan" });
      }

      await client.query(
        `UPDATE subscriptions
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE tenant_id = $1 AND status = 'ACTIVE'`,
        [payment.tenant_id],
      );

      const { rows: subRows } = await client.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, starts_at, ends_at, auto_renew, created_at, updated_at)
         VALUES ($1, $2, 'ACTIVE', NOW(), NOW() + INTERVAL '30 days', TRUE, NOW(), NOW())
         RETURNING *`,
        [payment.tenant_id, finalPlanId],
      );

      await client.query(
        `UPDATE tenants
         SET status = 'ACTIVE', updated_at = NOW()
         WHERE id = $1`,
        [payment.tenant_id],
      );

      const { rows: updatedPaymentRows } = await client.query(
        `UPDATE payments
         SET submission_status = 'APPROVED',
             reviewed_by_super_admin_id = $2,
             reviewed_at = NOW(),
             review_reason = $3,
             status = 'PAID',
             paid_at = COALESCE($4::timestamptz, NOW())
         WHERE id = $1
         RETURNING *`,
        [id, request.user.sub, reviewReason ?? null, paidAt ?? null],
      );

      await client.query("COMMIT");

      return reply.send({
        data: {
          payment: updatedPaymentRows[0],
          subscription: subRows[0],
          message: "Payment approved and plan released",
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /admin/payments/:id/reject — reject tenant submission
  fastify.post("/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reviewReason } = request.body as { reviewReason?: string };

    if (!reviewReason || !reviewReason.trim()) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "reviewReason is required",
      });
    }

    const [updated] = await masterDb
      .update(payments)
      .set({
        submissionStatus: "REJECTED",
        reviewedBySuperAdminId: request.user.sub,
        reviewedAt: new Date(),
        reviewReason,
      } as any)
      .where(eq(payments.id, id))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: "Not Found", message: "Payment not found" });
    }

    return reply.send({ data: updated });
  });
};
