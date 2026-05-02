import type { FastifyPluginAsync } from "fastify";
import {
  CreateUserSchema,
  PaginationSchema,
  UpdateProfileSchema,
  UpdateUserSchema,
  SetAvailabilitySchema,
  CreateLeaveBlockSchema,
  UpdateLeaveBlockSchema,
} from "@mediscala/shared";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { env } from "../../config/env.js";
import { getTenantClient, masterPool } from "../../db/client.js";
import { availabilityPeriodFromSlot } from "../../lib/shift-period.js";

const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

async function removeAvatarFile(avatarUrl: string | null) {
  if (!avatarUrl?.startsWith("/uploads/")) return;
  const name = path.basename(avatarUrl);
  const full = path.join(UPLOAD_ROOT, name);
  try {
    await unlink(full);
  } catch {
    /* ignore */
  }
}

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Me (must be registered before /:id) ───────────────────────────────────

  fastify.get("/me", async (request, reply) => {
    const userId = request.user.sub;
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT u.id, u.name, u.email, u.role, u.specialty, u.contract_hours_week,
                u.department_id, u.active, u.avatar_url, u.created_at, u.updated_at,
                d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.id = $1`,
        [userId],
      );
      if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
      return reply.send({ data: rows[0] });
    } finally {
      client.release();
    }
  });

  fastify.patch("/me", async (request, reply) => {
    const parsed = UpdateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Bad Request", message: parsed.error.flatten() });
    }
    const updates = parsed.data;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.specialty !== undefined) {
      setClauses.push(`specialty = $${idx++}`);
      values.push(updates.specialty);
    }
    if (setClauses.length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }
    setClauses.push(`updated_at = NOW()`);
    values.push(request.user.sub);
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${idx}
         RETURNING id, name, email, role, specialty, contract_hours_week, department_id, active, avatar_url, updated_at`,
        values,
      );
      if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
      return reply.send({ data: rows[0] });
    } finally {
      client.release();
    }
  });

  fastify.post("/me/avatar", async (request, reply) => {
    const data = await request.file({
      limits: { fileSize: 2 * 1024 * 1024 },
    });
    if (!data) {
      return reply.status(400).send({ error: "Bad Request", message: "No file" });
    }
    const mime = data.mimetype;
    const ext = MIME_EXT[mime];
    if (!ext) {
      return reply
        .status(400)
        .send({ error: "Bad Request", message: "Use JPEG, PNG or WebP" });
    }

    const userId = request.user.sub;
    const client = await getTenantClient(request.tenantSlug);
    let previousAvatar: string | null = null;
    try {
      const { rows: cur } = await client.query<{ avatar_url: string | null }>(
        `SELECT avatar_url FROM users WHERE id = $1`,
        [userId],
      );
      previousAvatar = cur[0]?.avatar_url ?? null;

      const filename = `${randomUUID()}${ext}`;
      const publicPath = `/uploads/${filename}`;
      const dest = path.join(UPLOAD_ROOT, filename);

      await pipeline(data.file, createWriteStream(dest));

      const { rows } = await client.query(
        `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, name, email, role, specialty, contract_hours_week, department_id, active, avatar_url`,
        [publicPath, userId],
      );
      if (!rows[0]) {
        await unlink(dest).catch(() => {});
        return reply.status(404).send({ error: "Not Found" });
      }
      await removeAvatarFile(previousAvatar);
      return reply.send({ data: rows[0] });
    } finally {
      client.release();
    }
  });

  // GET /users/pending-leave-requests — gestão de pedidos de indisponibilidade
  fastify.get(
    "/pending-leave-requests",
    {
      preHandler: fastify.requireRole(["HOSPITAL_ADMIN", "MANAGER"]),
    },
    async (request, reply) => {
      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `SELECT lb.id, lb.user_id, lb.starts_on, lb.ends_on, lb.type,
                  lb.status, lb.reason, lb.created_at,
                  u.name AS user_name, u.email AS user_email
           FROM user_leave_blocks lb
           JOIN users u ON u.id = lb.user_id
           WHERE lb.status = 'PENDING'
           ORDER BY lb.created_at DESC`,
        );
        return reply.send({ data: rows });
      } finally {
        client.release();
      }
    },
  );

  // ─── List ─────────────────────────────────────────────────────────────────

  fastify.get("/", async (request, reply) => {
    const q = PaginationSchema.parse(request.query);
    const offset = (q.page - 1) * q.pageSize;
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT u.id, u.name, u.email, u.role, u.specialty, u.contract_hours_week,
                u.department_id, u.active, u.avatar_url, u.created_at,
                d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
        [q.pageSize, offset],
      );
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) FROM users`,
      );
      const total = Number(countRows[0].count);
      return reply.send({
        data: rows,
        total,
        page: q.page,
        pageSize: q.pageSize,
        totalPages: Math.ceil(total / q.pageSize),
      });
    } finally {
      client.release();
    }
  });

  // GET /users/:id/shifts — must be before /:id
  fastify.get("/:id/shifts", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { from, to } = request.query as { from?: string; to?: string };
    const client = await getTenantClient(request.tenantSlug);
    try {
      let sql = `
        SELECT s.*, d.name AS department_name,
          sa.id AS assignment_id, sa.status AS assignment_status
        FROM shift_assignments sa
        JOIN shifts s ON s.id = sa.shift_id
        LEFT JOIN departments d ON d.id = s.department_id
        WHERE sa.user_id = $1`;
      const params: unknown[] = [id];
      let idx = 2;
      if (from && to) {
        sql += ` AND s.start_datetime < $${idx++} AND s.end_datetime > $${idx++}`;
        params.push(to, from);
      } else if (from) {
        sql += ` AND s.end_datetime > $${idx++}`;
        params.push(from);
      } else if (to) {
        sql += ` AND s.start_datetime < $${idx++}`;
        params.push(to);
      }
      sql += ` ORDER BY s.start_datetime`;
      const { rows } = await client.query(sql, params);
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });

  // GET /users/:id/leave-blocks
  fastify.get("/:id/leave-blocks", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (
      request.user.sub !== id &&
      !["HOSPITAL_ADMIN", "MANAGER"].includes(request.user.role)
    ) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT id, user_id, starts_on, ends_on, type, status, reason,
                approved_by, created_at
         FROM user_leave_blocks WHERE user_id = $1 ORDER BY starts_on DESC`,
        [id],
      );
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });

  // POST /users/:id/leave-blocks — gestores para qualquer utilizador; colaborador só para si (APPROVED ou PENDING)
  fastify.post("/:id/leave-blocks", async (request, reply) => {
    const { id } = request.params as { id: string };
    const role = request.user.role;
    const isMgr = ["HOSPITAL_ADMIN", "MANAGER"].includes(role);
    const isCollaboratorSelf =
      role === "COLLABORATOR" && request.user.sub === id;
    if (!isMgr && !isCollaboratorSelf) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const parsed = CreateLeaveBlockSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Bad Request", message: parsed.error.flatten() });
    }
    const { startsOn, endsOn, type, status: rawStatus, reason } = parsed.data;
    const status = rawStatus ?? "APPROVED";

    if (isCollaboratorSelf && status !== "APPROVED" && status !== "PENDING") {
      return reply.status(400).send({
        error: "Bad Request",
        message:
          "Colaboradores só podem criar indisponibilidade imediata (APPROVED) ou pedido pendente (PENDING).",
      });
    }

    if (startsOn > endsOn) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "endsOn must be >= startsOn",
      });
    }
    const client = await getTenantClient(request.tenantSlug);
    try {
      const approvedBy = status === "APPROVED" ? request.user.sub : null;
      const { rows } = await client.query(
        `INSERT INTO user_leave_blocks
            (user_id, starts_on, ends_on, type, status, reason, approved_by)
           VALUES ($1, $2::date, $3::date, $4, $5, $6, $7)
           RETURNING *`,
        [id, startsOn, endsOn, type, status, reason ?? null, approvedBy],
      );
      return reply.status(201).send({ data: rows[0] });
    } finally {
      client.release();
    }
  });

  fastify.patch(
    "/:id/leave-blocks/:blockId",
    {
      preHandler: fastify.requireRole(["HOSPITAL_ADMIN", "MANAGER"]),
    },
    async (request, reply) => {
      const { id, blockId } = request.params as {
        id: string;
        blockId: string;
      };
      const parsed = UpdateLeaveBlockSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Bad Request", message: parsed.error.flatten() });
      }
      const client = await getTenantClient(request.tenantSlug);
      try {
        const u = parsed.data;
        const sets: string[] = [];
        const vals: unknown[] = [];
        let i = 1;
        if (u.startsOn !== undefined) {
          sets.push(`starts_on = $${i++}::date`);
          vals.push(u.startsOn);
        }
        if (u.endsOn !== undefined) {
          sets.push(`ends_on = $${i++}::date`);
          vals.push(u.endsOn);
        }
        if (u.type !== undefined) {
          sets.push(`type = $${i++}`);
          vals.push(u.type);
        }
        if (u.status !== undefined) {
          sets.push(`status = $${i++}`);
          vals.push(u.status);
          if (u.status === "APPROVED") {
            sets.push(`approved_by = $${i++}`);
            vals.push(request.user.sub);
          }
        }
        if (u.reason !== undefined) {
          sets.push(`reason = $${i++}`);
          vals.push(u.reason);
        }
        if (!sets.length) {
          return reply.status(400).send({ error: "Nothing to update" });
        }
        vals.push(blockId, id);
        const { rows } = await client.query(
          `UPDATE user_leave_blocks SET ${sets.join(", ")}
           WHERE id = $${i++} AND user_id = $${i++}
           RETURNING *`,
          vals,
        );
        if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
        return reply.send({ data: rows[0] });
      } finally {
        client.release();
      }
    },
  );

  fastify.delete("/:id/leave-blocks/:blockId", async (request, reply) => {
    const { id, blockId } = request.params as {
      id: string;
      blockId: string;
    };
    const role = request.user.role;
    const isMgr = ["HOSPITAL_ADMIN", "MANAGER"].includes(role);
    const isCollaboratorSelf =
      role === "COLLABORATOR" && request.user.sub === id;
    if (!isMgr && !isCollaboratorSelf) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rowCount } = await client.query(
        `DELETE FROM user_leave_blocks WHERE id = $1 AND user_id = $2`,
        [blockId, id],
      );
      if (!rowCount)
        return reply.status(404).send({ error: "Not Found" });
      return reply.send({ data: { message: "Deleted" } });
    } finally {
      client.release();
    }
  });

  // GET /users/:id
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT u.id, u.name, u.email, u.role, u.specialty, u.contract_hours_week,
                u.department_id, u.active, u.avatar_url, u.created_at,
                d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.id = $1`,
        [id],
      );
      if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
      return reply.send({ data: rows[0] });
    } finally {
      client.release();
    }
  });

  // POST /users
  fastify.post(
    "/",
    {
      preHandler: fastify.requireRole(["HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const body = CreateUserSchema.safeParse(request.body);
      if (!body.success) {
        return reply
          .status(400)
          .send({ error: "Bad Request", message: body.error.flatten() });
      }
      const {
        name,
        email,
        password,
        role,
        specialty,
        contractHoursWeek,
        departmentId,
      } = body.data;
      const passwordHash = await argon2.hash(password);
      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `INSERT INTO users (name, email, password_hash, role, specialty, contract_hours_week, department_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, role, specialty, contract_hours_week, department_id, active, avatar_url, created_at`,
          [
            name,
            email,
            passwordHash,
            role,
            specialty ?? null,
            contractHoursWeek,
            departmentId ?? null,
          ],
        );
        // Register in master user_lookups for fast cross-tenant auth
        const masterClient = await masterPool.connect();
        try {
          await masterClient.query(
            `INSERT INTO user_lookups (email, user_id, tenant_slug) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET user_id = $2, tenant_slug = $3`,
            [email, rows[0].id, request.tenantSlug],
          );
        } finally {
          masterClient.release();
        }
        return reply.status(201).send({ data: rows[0] });
      } finally {
        client.release();
      }
    },
  );

  // PATCH /users/:id
  fastify.patch(
    "/:id",
    {
      preHandler: fastify.requireRole(["HOSPITAL_ADMIN", "MANAGER"]),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateUserSchema.safeParse(request.body);
      if (!body.success) {
        return reply
          .status(400)
          .send({ error: "Bad Request", message: body.error.flatten() });
      }

      const updates = body.data;
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.email !== undefined) {
        setClauses.push(`email = $${idx++}`);
        values.push(updates.email);
      }
      if (updates.role !== undefined) {
        setClauses.push(`role = $${idx++}`);
        values.push(updates.role);
      }
      if (updates.specialty !== undefined) {
        setClauses.push(`specialty = $${idx++}`);
        values.push(updates.specialty);
      }
      if (updates.contractHoursWeek !== undefined) {
        setClauses.push(`contract_hours_week = $${idx++}`);
        values.push(updates.contractHoursWeek);
      }
      if (updates.departmentId !== undefined) {
        setClauses.push(`department_id = $${idx++}`);
        values.push(updates.departmentId);
      }

      if (setClauses.length === 0)
        return reply.status(400).send({ error: "No fields to update" });

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING id, name, email, role, specialty, contract_hours_week, department_id, active, avatar_url`,
          values,
        );
        if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
        return reply.send({ data: rows[0] });
      } finally {
        client.release();
      }
    },
  );

  // DELETE /users/:id (soft delete)
  fastify.delete(
    "/:id",
    {
      preHandler: fastify.requireRole(["HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = await getTenantClient(request.tenantSlug);
      try {
        await client.query(
          `UPDATE users SET active = FALSE, updated_at = NOW() WHERE id = $1`,
          [id],
        );
        return reply.send({ data: { message: "User deactivated" } });
      } finally {
        client.release();
      }
    },
  );

  // PUT /users/:id/push-token
  fastify.put("/:id/push-token", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { pushToken } = request.body as { pushToken: string };
    if (request.user.sub !== id) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const client = await getTenantClient(request.tenantSlug);
    try {
      await client.query(`UPDATE users SET push_token = $1 WHERE id = $2`, [
        pushToken,
        id,
      ]);
      return reply.send({ data: { message: "Push token updated" } });
    } finally {
      client.release();
    }
  });

  // GET/PUT /users/:id/availability
  fastify.get("/:id/availability", async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT id, day_of_week, start_time, end_time, period::text AS period
         FROM availability WHERE user_id = $1 ORDER BY day_of_week`,
        [id],
      );
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });

  fastify.put("/:id/availability", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (
      request.user.sub !== id &&
      !["HOSPITAL_ADMIN", "MANAGER"].includes(request.user.role)
    ) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const parsed = SetAvailabilitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Bad Request", message: parsed.error.flatten() });
    }
    const { slots } = parsed.data;
    const client = await getTenantClient(request.tenantSlug);
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM availability WHERE user_id = $1`, [id]);
      for (const slot of slots) {
        const period = availabilityPeriodFromSlot(
          slot.startTime,
          slot.period ?? undefined,
        );
        await client.query(
          `INSERT INTO availability (user_id, day_of_week, start_time, end_time, period)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, slot.dayOfWeek, slot.startTime, slot.endTime, period],
        );
      }
      await client.query("COMMIT");
      return reply.send({ data: { message: "Availability updated" } });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });
};
