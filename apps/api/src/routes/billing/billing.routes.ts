import type { FastifyPluginAsync } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { and, desc, eq } from "drizzle-orm";
import { UpdateInstitutionSchema } from "@mediscala/shared";
import { env } from "../../config/env.js";
import { masterDb } from "../../db/client.js";
import {
  payments,
  plans,
  subscriptions,
  tenants,
} from "../../db/schema.master.js";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

const LOGO_MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

function getFieldValue(fields: Record<string, unknown>, name: string): string | undefined {
  const item = fields[name] as { value?: unknown } | Array<{ value?: unknown }> | undefined;
  if (!item) return undefined;
  if (Array.isArray(item)) {
    const first = item[0]?.value;
    return typeof first === "string" ? first : undefined;
  }
  return typeof item.value === "string" ? item.value : undefined;
}

async function removeInstitutionLogoFile(logoUrl: string | null) {
  if (!logoUrl?.startsWith("/uploads/institutions/")) return;
  const name = path.basename(logoUrl);
  const full = path.join(path.resolve(process.cwd(), env.UPLOAD_DIR), "institutions", name);
  try {
    await unlink(full);
  } catch {
    /* ignore */
  }
}

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    if (request.user.role === "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden", message: "Tenant users only" });
    }
  });

  // GET /billing/current-plan
  fastify.get("/current-plan", async (request, reply) => {
    const [tenant] = await masterDb
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        contactEmail: tenants.contactEmail,
        contactPhone: tenants.contactPhone,
        nif: tenants.nif,
        address: tenants.address,
        areaOfActivity: tenants.areaOfActivity,
        logoUrl: tenants.logoUrl,
        brandDisplayMode: tenants.brandDisplayMode,
        notes: tenants.notes,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .where(eq(tenants.slug, request.tenantSlug));

    if (!tenant) {
      return reply.status(404).send({ error: "Not Found", message: "Tenant not found" });
    }

    const [activeSub] = await masterDb
      .select({
        id: subscriptions.id,
        status: subscriptions.status,
        startsAt: subscriptions.startsAt,
        endsAt: subscriptions.endsAt,
        autoRenew: subscriptions.autoRenew,
        planId: plans.id,
        planCode: plans.code,
        planName: plans.name,
        priceMonthly: plans.priceMonthly,
        maxUsers: plans.maxUsers,
        maxDepartments: plans.maxDepartments,
        maxShiftsPerMonth: plans.maxShiftsPerMonth,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(and(eq(subscriptions.tenantId, tenant.id), eq(subscriptions.status, "ACTIVE")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return reply.send({
      data: {
        tenant,
        subscription: activeSub ?? null,
      },
    });
  });

  // PATCH /billing/institution
  fastify.patch("/institution", async (request, reply) => {
    if (request.user.role !== "HOSPITAL_ADMIN") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Apenas administradores podem atualizar dados da instituição",
      });
    }

    const parsed = UpdateInstitutionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: parsed.error.flatten(),
      });
    }

    const normalized = {
      ...parsed.data,
      name: parsed.data.name?.trim(),
      contactEmail: parsed.data.contactEmail?.trim().toLowerCase(),
      contactPhone: parsed.data.contactPhone?.trim(),
      nif: parsed.data.nif?.trim(),
      address: parsed.data.address?.trim(),
      areaOfActivity: parsed.data.areaOfActivity?.trim(),
      brandDisplayMode: parsed.data.brandDisplayMode,
      notes: parsed.data.notes?.trim(),
    };

    const [updated] = await masterDb
      .update(tenants)
      .set({
        ...normalized,
        updatedAt: new Date(),
      })
      .where(eq(tenants.slug, request.tenantSlug))
      .returning({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        contactEmail: tenants.contactEmail,
        contactPhone: tenants.contactPhone,
        nif: tenants.nif,
        address: tenants.address,
        areaOfActivity: tenants.areaOfActivity,
        logoUrl: tenants.logoUrl,
        brandDisplayMode: tenants.brandDisplayMode,
        notes: tenants.notes,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      });

    if (!updated) {
      return reply.status(404).send({ error: "Not Found", message: "Tenant not found" });
    }

    return reply.send({ data: updated });
  });

  // POST /billing/institution/logo
  fastify.post("/institution/logo", async (request, reply) => {
    if (request.user.role !== "HOSPITAL_ADMIN") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Apenas administradores podem atualizar a logo da instituição",
      });
    }

    const file = await request.file({ limits: { fileSize: 4 * 1024 * 1024 } });
    if (!file) {
      return reply.status(400).send({ error: "Bad Request", message: "Logo é obrigatória" });
    }

    const ext = LOGO_MIME_EXT[file.mimetype];
    if (!ext) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Logo deve ser PNG, JPEG, WebP ou SVG",
      });
    }

    const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
    const logosDir = path.join(uploadRoot, "institutions");
    await mkdir(logosDir, { recursive: true });

    const [currentTenant] = await masterDb
      .select({
        logoUrl: tenants.logoUrl,
      })
      .from(tenants)
      .where(eq(tenants.slug, request.tenantSlug))
      .limit(1);

    if (!currentTenant) {
      return reply.status(404).send({ error: "Not Found", message: "Tenant not found" });
    }

    const previousLogo = currentTenant.logoUrl ?? null;

    const filename = `${request.tenantSlug}-${randomUUID()}${ext}`;
    const savePath = path.join(logosDir, filename);
    const publicUrl = `/uploads/institutions/${filename}`;

    await pipeline(file.file, createWriteStream(savePath));

    const [updated] = await masterDb
      .update(tenants)
      .set({ logoUrl: publicUrl, updatedAt: new Date() })
      .where(eq(tenants.slug, request.tenantSlug))
      .returning({
        logoUrl: tenants.logoUrl,
        updatedAt: tenants.updatedAt,
      });

    if (!updated) {
      await unlink(savePath).catch(() => {});
      return reply.status(404).send({ error: "Not Found", message: "Tenant not found" });
    }

    await removeInstitutionLogoFile(previousLogo);

    return reply.status(201).send({ data: updated });
  });

  // GET /billing/plans
  fastify.get("/plans", async (_request, reply) => {
    const rows = await masterDb
      .select({
        id: plans.id,
        code: plans.code,
        name: plans.name,
        priceMonthly: plans.priceMonthly,
        maxUsers: plans.maxUsers,
        maxDepartments: plans.maxDepartments,
        maxShiftsPerMonth: plans.maxShiftsPerMonth,
        features: plans.features,
      })
      .from(plans)
      .where(eq(plans.active, true));

    return reply.send({ data: rows });
  });

  // GET /billing/payments
  fastify.get("/payments", async (request, reply) => {
    const [tenant] = await masterDb
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, request.tenantSlug));

    if (!tenant) {
      return reply.status(404).send({ error: "Not Found", message: "Tenant not found" });
    }

    const rows = await masterDb
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        submissionStatus: payments.submissionStatus,
        method: payments.method,
        reference: payments.reference,
        proofUrl: payments.proofUrl,
        reviewReason: payments.reviewReason,
        dueDate: payments.dueDate,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        requestedPlanId: payments.requestedPlanId,
        requestedPlanCode: plans.code,
        requestedPlanName: plans.name,
      })
      .from(payments)
      .leftJoin(plans, eq(payments.requestedPlanId, plans.id))
      .where(eq(payments.tenantId, tenant.id))
      .orderBy(desc(payments.createdAt));

    return reply.send({ data: rows });
  });

  // POST /billing/payments/submit
  fastify.post("/payments/submit", async (request, reply) => {
    const file = await request.file({ limits: { fileSize: 8 * 1024 * 1024 } });
    if (!file) {
      return reply.status(400).send({ error: "Bad Request", message: "Comprovativo é obrigatório" });
    }

    const ext = MIME_EXT[file.mimetype];
    if (!ext) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Comprovativo deve ser JPEG, PNG, WebP ou PDF",
      });
    }

    const requestedPlanId = getFieldValue(file.fields, "requestedPlanId");
    const amount = getFieldValue(file.fields, "amount");
    const method = getFieldValue(file.fields, "method");
    const reference = getFieldValue(file.fields, "reference");
    const notes = getFieldValue(file.fields, "notes");

    if (!requestedPlanId || !amount || !method) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "requestedPlanId, amount e method são obrigatórios",
      });
    }

    const [tenant] = await masterDb
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, request.tenantSlug));

    if (!tenant) {
      return reply.status(404).send({ error: "Not Found", message: "Tenant not found" });
    }

    const [targetPlan] = await masterDb
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.id, requestedPlanId), eq(plans.active, true)));

    if (!targetPlan) {
      return reply.status(400).send({ error: "Bad Request", message: "Plano solicitado inválido" });
    }

    const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
    const billingDir = path.join(uploadRoot, "payments");
    await mkdir(billingDir, { recursive: true });

    const filename = `${randomUUID()}${ext}`;
    const savePath = path.join(billingDir, filename);
    const publicUrl = `/uploads/payments/${filename}`;
    await pipeline(file.file, createWriteStream(savePath));

    const [created] = await masterDb
      .insert(payments)
      .values({
        tenantId: tenant.id,
        requestedPlanId,
        amount,
        currency: "AOA",
        status: "PENDING",
        submissionStatus: "SUBMITTED",
        method,
        reference: reference ?? null,
        notes: notes ?? null,
        proofUrl: publicUrl,
        submittedByUserId: request.user.sub,
      })
      .returning();

    return reply.status(201).send({ data: created });
  });
};
