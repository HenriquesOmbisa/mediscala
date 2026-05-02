import type { FastifyPluginAsync } from "fastify";
import { masterDb } from "../../db/client.js";
import { tenants, subscriptions, payments, plans } from "../../db/schema.master.js";
import { eq, count, sql } from "drizzle-orm";

// Middleware: all admin routes (except /auth) require SUPER_ADMIN
const requireSuperAdmin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    if (!request.user || request.user.role !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Forbidden", message: "SUPER_ADMIN only" });
    }
  });
};

export const adminStatsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(requireSuperAdmin);

  // GET /admin/stats — dashboard overview
  fastify.get("/", async (_request, reply) => {
    const [totalTenantsResult] = await masterDb
      .select({ count: count() })
      .from(tenants);

    const activeTenantsResult = await masterDb
      .select({ count: count() })
      .from(tenants)
      .where(eq(tenants.status, "ACTIVE"));

    const trialTenantsResult = await masterDb
      .select({ count: count() })
      .from(tenants)
      .where(eq(tenants.status, "TRIAL"));

    const suspendedTenantsResult = await masterDb
      .select({ count: count() })
      .from(tenants)
      .where(eq(tenants.status, "SUSPENDED"));

    const pendingPaymentsResult = await masterDb
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.status, "PENDING"));

    const overduePaymentsResult = await masterDb
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.status, "OVERDUE"));

    const recentTenants = await masterDb
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(sql`${tenants.createdAt} DESC`)
      .limit(5);

    return reply.send({
      data: {
        tenants: {
          total: Number(totalTenantsResult.count),
          active: Number(activeTenantsResult[0]?.count ?? 0),
          trial: Number(trialTenantsResult[0]?.count ?? 0),
          suspended: Number(suspendedTenantsResult[0]?.count ?? 0),
        },
        payments: {
          pending: Number(pendingPaymentsResult[0]?.count ?? 0),
          overdue: Number(overduePaymentsResult[0]?.count ?? 0),
        },
        recentTenants,
      },
    });
  });
};
