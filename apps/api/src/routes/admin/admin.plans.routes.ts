import type { FastifyPluginAsync } from "fastify";
import { masterDb } from "../../db/client.js";
import { plans } from "../../db/schema.master.js";
import { eq } from "drizzle-orm";

export const adminPlansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.user || request.user.role !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden", message: "SUPER_ADMIN only" });
    }
  });

  // GET /admin/plans
  fastify.get("/", async (_request, reply) => {
    const rows = await masterDb.select().from(plans).orderBy(plans.priceMonthly);
    return reply.send({ data: rows });
  });

  // GET /admin/plans/:id
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [plan] = await masterDb.select().from(plans).where(eq(plans.id, id));
    if (!plan) return reply.status(404).send({ error: "Not Found" });
    return reply.send({ data: plan });
  });

  // POST /admin/plans
  fastify.post("/", async (request, reply) => {
    const {
      name,
      code,
      priceMonthly,
      maxUsers,
      maxDepartments,
      maxShiftsPerMonth,
      features,
    } = request.body as {
      name: string;
      code: string;
      priceMonthly: string;
      maxUsers: number;
      maxDepartments: number;
      maxShiftsPerMonth: number;
      features?: Record<string, unknown>;
    };

    if (!name || !code || priceMonthly === undefined) {
      return reply.status(400).send({ error: "Bad Request", message: "name, code, priceMonthly required" });
    }

    const [plan] = await masterDb
      .insert(plans)
      .values({
        name,
        code: code.toUpperCase(),
        priceMonthly,
        maxUsers: maxUsers ?? 5,
        maxDepartments: maxDepartments ?? 2,
        maxShiftsPerMonth: maxShiftsPerMonth ?? 50,
        features: features ?? {},
      })
      .returning();

    return reply.status(201).send({ data: plan });
  });

  // PATCH /admin/plans/:id
  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      priceMonthly: string;
      maxUsers: number;
      maxDepartments: number;
      maxShiftsPerMonth: number;
      features: Record<string, unknown>;
      active: boolean;
    }>;

    const [updated] = await masterDb
      .update(plans)
      .set(body as any)
      .where(eq(plans.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not Found" });
    return reply.send({ data: updated });
  });
};
