import type { FastifyPluginAsync } from "fastify";
import { CreateDepartmentSchema } from "@mediscala/shared";
import { getTenantClient } from "../../db/client.js";

export const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request, reply) => {
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT d.*,
           COUNT(u.id)::INTEGER AS collaborator_count
         FROM departments d
         LEFT JOIN users u ON u.department_id = d.id AND u.active = TRUE
         GROUP BY d.id
         ORDER BY d.name`,
      );
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });

  fastify.post(
    "/",
    {
      preHandler: fastify.requireRole(["HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const body = CreateDepartmentSchema.safeParse(request.body);
      if (!body.success)
        return reply
          .status(400)
          .send({ error: "Bad Request", message: body.error.flatten() });

      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `INSERT INTO departments (name) VALUES ($1) RETURNING *`,
          [body.data.name],
        );
        return reply.status(201).send({ data: rows[0] });
      } finally {
        client.release();
      }
    },
  );

  fastify.get("/:id/shifts", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { from, to } = request.query as { from?: string; to?: string };
    const client = await getTenantClient(request.tenantSlug);
    try {
      let sql = `
        SELECT s.*, d.name as department_name,
          json_agg(json_build_object(
            'id', sa.id,
            'user_id', sa.user_id,
            'status', sa.status,
            'attendance_present', sa.attendance_present
          ))
            FILTER (WHERE sa.id IS NOT NULL) as assignments
        FROM shifts s
        LEFT JOIN departments d ON d.id = s.department_id
        LEFT JOIN shift_assignments sa ON sa.shift_id = s.id
        WHERE s.department_id = $1`;
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
      sql += " GROUP BY s.id, d.name ORDER BY s.start_datetime";
      const { rows } = await client.query(sql, params);
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });

  fastify.patch(
    "/:id",
    {
      preHandler: fastify.requireRole(["HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name } = request.body as { name: string };
      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `UPDATE departments SET name = $1 WHERE id = $2 RETURNING *`,
          [name, id],
        );
        if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
        return reply.send({ data: rows[0] });
      } finally {
        client.release();
      }
    },
  );

  fastify.delete(
    "/:id",
    {
      preHandler: fastify.requireRole(["HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = await getTenantClient(request.tenantSlug);
      try {
        await client.query(`DELETE FROM departments WHERE id = $1`, [id]);
        return reply.send({ data: { message: "Department deleted" } });
      } finally {
        client.release();
      }
    },
  );
};
