import type { FastifyPluginAsync } from "fastify";
import { CreateAbsenceSchema } from "@mediscala/shared";
import { getTenantClient } from "../../db/client.js";
import type { CoverageJobData } from "../../services/coverage.service.js";
import type { Queue } from "bullmq";

declare module "fastify" {
  interface FastifyInstance {
    coverageQueue: Queue<CoverageJobData>;
  }
}

export const absenceRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /absences — register absence and trigger coverage engine
  fastify.post("/", async (request, reply) => {
    const body = CreateAbsenceSchema.safeParse(request.body);
    if (!body.success)
      return reply
        .status(400)
        .send({ error: "Bad Request", message: body.error.flatten() });

    const userId = request.user.sub;
    const client = await getTenantClient(request.tenantSlug);
    try {

      // Verify assignment belongs to this user (or user is manager)
      const { rows: assignRows } = await client.query(
        `SELECT id, user_id, shift_id FROM shift_assignments WHERE id = $1`,
        [body.data.shiftAssignmentId],
      );
      if (!assignRows[0])
        return reply.status(404).send({ error: "Assignment not found" });

      const isOwner = assignRows[0].user_id === userId;
      const isManager = ["MANAGER", "HOSPITAL_ADMIN"].includes(
        request.user.role,
      );
      if (!isOwner && !isManager)
        return reply.status(403).send({ error: "Forbidden" });

      // Insert absence
      const { rows: absenceRows } = await client.query(
        `INSERT INTO absences (shift_assignment_id, user_id, type, reason)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          body.data.shiftAssignmentId,
          assignRows[0].user_id,
          body.data.type,
          body.data.reason ?? null,
        ],
      );

      // Mark assignment as ABSENT
      await client.query(
        `UPDATE shift_assignments SET status = 'ABSENT' WHERE id = $1`,
        [body.data.shiftAssignmentId],
      );

      // Enqueue coverage job
      await fastify.coverageQueue.add("process", {
        absenceId: absenceRows[0].id,
        tenantSlug: request.tenantSlug,
      });

      return reply.status(201).send({ data: absenceRows[0] });
    } finally {
      client.release();
    }
  });

  // PATCH /absences/:id/approve
  fastify.patch(
    "/:id/approve",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `UPDATE absences SET approved_by = $1 WHERE id = $2 RETURNING *`,

          [request.user.sub, id],
        );
        if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
        return reply.send({ data: rows[0] });
      } finally {
        client.release();
      }
    },
  );

  // GET /absences
  fastify.get(
    "/",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `SELECT a.*, u.name as user_name, s.name as shift_name, s.start_datetime
         FROM absences a
         JOIN users u ON u.id = a.user_id
         JOIN shift_assignments sa ON sa.id = a.shift_assignment_id
         JOIN shifts s ON s.id = sa.shift_id
         ORDER BY a.reported_at DESC`,
        );
        return reply.send({ data: rows });
      } finally {
        client.release();
      }
    },
  );
};
