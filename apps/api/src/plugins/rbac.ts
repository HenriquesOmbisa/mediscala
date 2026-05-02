import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { UserRole } from "@mediscala/shared";

const rbacPluginImpl: FastifyPluginAsync = async (fastify) => {
  /**
   * Decorator that asserts the authenticated user has one of the required roles.
   * Usage: fastify.requireRole(['MANAGER', 'HOSPITAL_ADMIN'])
   */
  fastify.decorate("requireRole", (roles: UserRole[]) => {
    return async (request: any, reply: any) => {
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      if (!roles.includes(request.user.role as UserRole)) {
        return reply.status(403).send({
          error: "Forbidden",
          message: `Requires one of: ${roles.join(", ")}`,
        });
      }
    };
  });
};

declare module "fastify" {
  interface FastifyInstance {
    requireRole: (
      roles: UserRole[],
    ) => (request: any, reply: any) => Promise<void>;
  }
}

export const rbacPlugin = fp(rbacPluginImpl, { name: "rbac" });
