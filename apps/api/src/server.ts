import "dotenv/config";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "./config/env.js";
import { authMiddleware } from "./plugins/auth.js";
import { rbacPlugin } from "./plugins/rbac.js";
import { redisPlugin } from "./plugins/redis.js";
import { wsPlugin } from "./plugins/websocket.js";
import {
  runMasterMigrations,
  seedMasterPlans,
} from "./db/migrations.js";
import { authRoutes } from "./routes/auth/auth.routes.js";
import { tenantRoutes } from "./routes/tenants/tenants.routes.js";
import { userRoutes } from "./routes/users/users.routes.js";
import { departmentRoutes } from "./routes/departments/departments.routes.js";
import { shiftRoutes } from "./routes/shifts/shifts.routes.js";
import { absenceRoutes } from "./routes/absences/absences.routes.js";
import { coverageRoutes } from "./routes/coverage/coverage.routes.js";
import { notificationRoutes } from "./routes/notifications/notifications.routes.js";
import { billingRoutes } from "./routes/billing/billing.routes.js";
import { adminRoutes } from "./routes/admin/index.js";
import {
  createCoverageQueue,
  startCoverageWorker,
} from "./services/coverage.service.js";

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "warn" : "info",
  },
});

async function bootstrap() {
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  await mkdir(uploadRoot, { recursive: true });

  await fastify.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024 },
  });
  await fastify.register(fastifyStatic, {
    root: uploadRoot,
    prefix: "/uploads/",
    decorateReply: false,
  });

  // Security plugins
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(cors, {
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  });
  await fastify.register(rateLimit, {
    max: env.NODE_ENV === "production" ? 200 : 10_000,
    timeWindow: "1 minute",
  });
  await fastify.register(cookie, {
    secret: env.JWT_ACCESS_SECRET,
  });

  // Infrastructure plugins
  await fastify.register(redisPlugin);
  await fastify.register(wsPlugin);

  // Auth + RBAC middleware
  await fastify.register(authMiddleware);
  await fastify.register(rbacPlugin);

  // Coverage queue
  const coverageQueue = createCoverageQueue(fastify.redis);
  fastify.decorate("coverageQueue", coverageQueue);
  startCoverageWorker(fastify.redis, fastify);

  // Health check
  fastify.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  // API routes
  fastify.register(authRoutes, { prefix: "/api/v1/auth" });
  fastify.register(tenantRoutes, { prefix: "/api/v1/tenants" });
  fastify.register(userRoutes, { prefix: "/api/v1/users" });
  fastify.register(departmentRoutes, { prefix: "/api/v1/departments" });
  fastify.register(shiftRoutes, { prefix: "/api/v1/shifts" });
  fastify.register(absenceRoutes, { prefix: "/api/v1/absences" });
  fastify.register(coverageRoutes, { prefix: "/api/v1/coverage" });
  fastify.register(notificationRoutes, { prefix: "/api/v1/notifications" });
  fastify.register(billingRoutes, { prefix: "/api/v1/billing" });
  fastify.register(adminRoutes, { prefix: "/api/v1/admin" });

  // Run master DB migrations and seed default plans
  await runMasterMigrations();
  await seedMasterPlans();
  await fastify.listen({ port: env.PORT, host: env.HOST });
  fastify.log.info(
    `🚀 MediScala API running at http://${env.HOST}:${env.PORT}`,
  );
}

bootstrap().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
