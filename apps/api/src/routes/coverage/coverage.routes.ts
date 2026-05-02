import type { FastifyPluginAsync } from "fastify";
import { getTenantClient } from "../../db/client.js";
import { notificationService } from "../../services/notification.service.js";

export const coverageRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /coverage — list open coverage requests (manager view)
  fastify.get(
    "/",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `SELECT cr.*, a.type as absence_type, a.user_id as absent_user_id,
                u.name as absent_user_name, s.name as shift_name,
                s.start_datetime, s.end_datetime,
                COUNT(cc.id) FILTER (WHERE cc.response = 'PENDING') as pending_candidates,
                COUNT(cc.id) FILTER (WHERE cc.response = 'ACCEPTED') as accepted_candidates
         FROM coverage_requests cr
         JOIN absences a ON a.id = cr.absence_id
         JOIN users u ON u.id = a.user_id
         JOIN shift_assignments sa ON sa.id = a.shift_assignment_id
         JOIN shifts s ON s.id = sa.shift_id
         LEFT JOIN coverage_candidates cc ON cc.coverage_request_id = cr.id
         GROUP BY cr.id, a.type, a.user_id, u.name, s.name, s.start_datetime, s.end_datetime
         ORDER BY cr.created_at DESC`,
        );
        return reply.send({ data: rows });
      } finally {
        client.release();
      }
    },
  );

  // POST /coverage/:id/respond — collaborator accepts or declines
  fastify.post("/:id/respond", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { response } = request.body as { response: "ACCEPTED" | "DECLINED" };
    const userId = request.user.sub;

    if (!["ACCEPTED", "DECLINED"].includes(response)) {
      return reply
        .status(400)
        .send({
          error: "Bad Request",
          message: "response must be ACCEPTED or DECLINED",
        });
    }

    const client = await getTenantClient(request.tenantSlug);
    try {
      await client.query("BEGIN");

      // Find candidate record
      const { rows: candidateRows } = await client.query(
        `SELECT cc.*, cr.status as request_status, cr.absence_id
         FROM coverage_candidates cc
         JOIN coverage_requests cr ON cr.id = cc.coverage_request_id
         WHERE cc.coverage_request_id = $1 AND cc.user_id = $2 AND cc.response = 'PENDING'
         LIMIT 1`,
        [id, userId],
      );

      if (!candidateRows[0]) {
        return reply
          .status(404)
          .send({
            error: "Not Found",
            message: "Coverage candidate not found or already responded",
          });
      }

      const candidate = candidateRows[0];
      if (candidate.request_status !== "OPEN") {
        return reply
          .status(409)
          .send({
            error: "Conflict",
            message: "Coverage request no longer open",
          });
      }

      // Update this candidate
      await client.query(
        `UPDATE coverage_candidates SET response = $1, responded_at = NOW() WHERE id = $2`,
        [response, candidate.id],
      );

      if (response === "ACCEPTED") {
        // Get shift info from absence
        const { rows: absRows } = await client.query(
          `SELECT sa.shift_id FROM absences a JOIN shift_assignments sa ON sa.id = a.shift_assignment_id WHERE a.id = $1`,
          [candidate.absence_id],
        );
        const shiftId = absRows[0]?.shift_id;

        // Create new assignment for the acceptor
        await client.query(
          `INSERT INTO shift_assignments (shift_id, user_id, status) VALUES ($1, $2, 'ASSIGNED')`,
          [shiftId, userId],
        );

        // Close the coverage request
        await client.query(
          `UPDATE coverage_requests SET status = 'FILLED' WHERE id = $1`,
          [id],
        );

        // Decline all other pending candidates + notify them
        const { rows: others } = await client.query(
          `UPDATE coverage_candidates SET response = 'DECLINED', responded_at = NOW()
           WHERE coverage_request_id = $1 AND user_id != $2 AND response = 'PENDING'
           RETURNING user_id`,
          [id, userId],
        );

        // Notify others that the request is filled
        for (const other of others) {
          await notificationService.sendToUser(fastify, request.tenantSlug, {
            userId: other.user_id,
            type: "COVERAGE_FILLED",
            title: "Turno preenchido",
            message: "O turno que solicitámos foi coberto por outro colega.",
            metadata: { coverageRequestId: id },
          });
        }
      }

      await client.query("COMMIT");
      return reply.send({ data: { message: `Response: ${response}` } });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // GET /coverage/my — collaborator sees their own coverage requests
  fastify.get("/my", async (request, reply) => {
    const userId = request.user.sub;
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT cc.*, cr.status as request_status, cr.expires_at,
                s.name as shift_name, s.start_datetime, s.end_datetime
         FROM coverage_candidates cc
         JOIN coverage_requests cr ON cr.id = cc.coverage_request_id
         JOIN absences a ON a.id = cr.absence_id
         JOIN shift_assignments sa ON sa.id = a.shift_assignment_id
         JOIN shifts s ON s.id = sa.shift_id
         WHERE cc.user_id = $1
         ORDER BY cc.notified_at DESC`,
        [userId],
      );
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });
};
