import type { FastifyPluginAsync } from "fastify";
import { LoginSchema, RefreshTokenSchema } from "@mediscala/shared";
import argon2 from "argon2";
import { masterPool, getTenantClient } from "../../db/client.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../plugins/auth.js";
import { serializeAuthUser } from "../../lib/auth-user.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/login
  fastify.post("/login", async (request, reply) => {
    const body = LoginSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "Bad Request", message: body.error.flatten() });
    }

    const { email, password } = body.data;

    // 1. Lookup tenant via user_lookups index in master DB
    const masterClient = await masterPool.connect();
    try {
      const { rows: lookupRows } = await masterClient.query<{
        tenant_slug: string;
        user_id: string;
      }>(
        `SELECT tenant_slug, user_id FROM user_lookups WHERE email = $1 LIMIT 1`,
        [email],
      );

      if (!lookupRows[0]) {
        return reply
          .status(401)
          .send({ error: "Unauthorized", message: "Invalid credentials" });
      }

      const { tenant_slug: tenantSlug } = lookupRows[0];

      // 2. Verify tenant is active
      const { rows: tenantRows } = await masterClient.query<{ status: string }>(
        `SELECT status FROM tenants WHERE slug = $1 LIMIT 1`,
        [tenantSlug],
      );
      if (!tenantRows[0] || tenantRows[0].status === "SUSPENDED") {
        return reply
          .status(403)
          .send({ error: "Forbidden", message: "Tenant is suspended" });
      }

      // 3. Fetch user from tenant DB
      const tenantClient = await getTenantClient(tenantSlug);
      try {
        const { rows } = await tenantClient.query(
          `SELECT id, name, email, password_hash, role, specialty, avatar_url, department_id
           FROM users WHERE email = $1 AND active = TRUE LIMIT 1`,
          [email],
        );

        const foundUser = rows[0];
        if (!foundUser) {
          return reply
            .status(401)
            .send({ error: "Unauthorized", message: "Invalid credentials" });
        }

        const passwordValid = await argon2.verify(
          foundUser.password_hash,
          password,
        );
        if (!passwordValid) {
          return reply
            .status(401)
            .send({ error: "Unauthorized", message: "Invalid credentials" });
        }

        const accessToken = signAccessToken({
          sub: foundUser.id,
          email: foundUser.email,
          role: foundUser.role,
          tenantSlug,
        });
        const refreshToken = signRefreshToken(foundUser.id);

        reply.setCookie("refresh_token", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/api/v1/auth/refresh",
          maxAge: 60 * 60 * 24 * 7,
        });

        return reply.send({
          data: {
            accessToken,
            user: serializeAuthUser(foundUser, tenantSlug),
          },
        });
      } finally {
        tenantClient.release();
      }
    } finally {
      masterClient.release();
    }
  });

  // POST /auth/refresh
  fastify.post("/refresh", async (request, reply) => {
    const cookieToken = (request.cookies as any)?.refresh_token;
    if (!cookieToken) {
      return reply
        .status(401)
        .send({ error: "Unauthorized", message: "No refresh token" });
    }

    let sub: string;
    try {
      const payload = verifyRefreshToken(cookieToken);
      sub = payload.sub;
    } catch {
      return reply
        .status(401)
        .send({ error: "Unauthorized", message: "Invalid refresh token" });
    }

    // Lookup tenant for this user id via master DB
    const masterClient = await masterPool.connect();
    try {
      const { rows: lookupRows } = await masterClient.query<{
        tenant_slug: string;
      }>(
        `SELECT tenant_slug FROM user_lookups WHERE user_id = $1 LIMIT 1`,
        [sub],
      );

      if (!lookupRows[0]) {
        return reply
          .status(401)
          .send({ error: "Unauthorized", message: "User not found" });
      }

      const { tenant_slug: tenantSlug } = lookupRows[0];

      const tenantClient = await getTenantClient(tenantSlug);
      try {
        const { rows } = await tenantClient.query(
          `SELECT id, name, email, role, specialty, avatar_url, department_id
           FROM users WHERE id = $1 AND active = TRUE LIMIT 1`,
          [sub],
        );

        if (!rows[0]) {
          return reply
            .status(401)
            .send({ error: "Unauthorized", message: "User not found" });
        }

        const foundUser = rows[0];
        const accessToken = signAccessToken({
          sub: foundUser.id,
          email: foundUser.email,
          role: foundUser.role,
          tenantSlug,
        });

        return reply.send({
          data: {
            accessToken,
            user: serializeAuthUser(foundUser, tenantSlug),
          },
        });
      } finally {
        tenantClient.release();
      }
    } finally {
      masterClient.release();
    }
  });

  // POST /auth/logout
  fastify.post("/logout", async (request, reply) => {
    reply.clearCookie("refresh_token", {
      path: "/api/v1/auth/refresh",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return reply.send({ data: { message: "Logged out successfully" } });
  });
};
  // POST /auth/login
