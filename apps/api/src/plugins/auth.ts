import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: string;
  tenantSlug: string; // empty for SUPER_ADMIN
  iat?: number;
  exp?: number;
}

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
    tenantSlug: string;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null as unknown as JwtPayload);
  fastify.decorateRequest("tenantSlug", null as unknown as string);

  fastify.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const publicPrefixes = [
      "/health",
      "/api/v1/auth/login",
      "/api/v1/auth/mobile-login",
      "/api/v1/auth/refresh",
      "/api/v1/admin/auth/login",
      "/documentation",
      "/ws",
      "/uploads/",
    ];
    if (publicPrefixes.some((r) => path.startsWith(r))) return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply
        .status(401)
        .send({ error: "Unauthorized", message: "Missing token" });
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
      request.user = payload;

      // Dev override: force a specific tenant slug regardless of JWT
      if (env.FORCE_TENANT_SLUG && payload.role !== "SUPER_ADMIN") {
        request.tenantSlug = env.FORCE_TENANT_SLUG;
      } else {
        request.tenantSlug = payload.tenantSlug;
      }
    } catch {
      return reply
        .status(401)
        .send({ error: "Unauthorized", message: "Invalid or expired token" });
    }
  });
};

export const authMiddleware = fp(authPlugin, { name: "auth-middleware" });

// ─── Token Helpers ─────────────────────────────────────────────────────────────

export function signAccessToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(sub: string): string {
  return jwt.sign({ sub }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
}
