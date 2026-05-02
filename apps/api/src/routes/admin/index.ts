import type { FastifyPluginAsync } from "fastify";
import { adminAuthRoutes } from "./admin.auth.routes.js";
import { adminStatsRoutes } from "./admin.stats.routes.js";
import { adminTenantsRoutes } from "./admin.tenants.routes.js";
import { adminPlansRoutes } from "./admin.plans.routes.js";
import { adminSubscriptionsRoutes } from "./admin.subscriptions.routes.js";
import { adminPaymentsRoutes } from "./admin.payments.routes.js";

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(adminAuthRoutes, { prefix: "/auth" });
  fastify.register(adminStatsRoutes, { prefix: "/stats" });
  fastify.register(adminTenantsRoutes, { prefix: "/tenants" });
  fastify.register(adminPlansRoutes, { prefix: "/plans" });
  fastify.register(adminSubscriptionsRoutes, { prefix: "/subscriptions" });
  fastify.register(adminPaymentsRoutes, { prefix: "/payments" });
};
