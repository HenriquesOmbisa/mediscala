import type { FastifyPluginAsync } from "fastify";
import argon2 from "argon2";
import { masterDb } from "../../db/client.js";
import { superAdmins } from "../../db/schema.master.js";
import { eq } from "drizzle-orm";
import { signAccessToken, signRefreshToken } from "../../plugins/auth.js";

export const adminAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /admin/auth/login — authenticate super admin
  fastify.post("/login", async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return reply
        .status(400)
        .send({ error: "Bad Request", message: "email and password required" });
    }

    const [admin] = await masterDb
      .select()
      .from(superAdmins)
      .where(eq(superAdmins.email, email.toLowerCase().trim()));

    if (!admin || !admin.active) {
      return reply
        .status(401)
        .send({ error: "Unauthorized", message: "Invalid credentials" });
    }

    const valid = await argon2.verify(admin.passwordHash, password);
    if (!valid) {
      return reply
        .status(401)
        .send({ error: "Unauthorized", message: "Invalid credentials" });
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: "SUPER_ADMIN" as const,
      tenantSlug: "",
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(admin.id);

    reply.setCookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      data: {
        accessToken,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: "SUPER_ADMIN",
        },
      },
    });
  });

  // POST /admin/auth/logout
  fastify.post("/logout", async (_request, reply) => {
    reply.clearCookie("refresh_token", { path: "/" });
    return reply.send({ data: { message: "Logged out" } });
  });
};
