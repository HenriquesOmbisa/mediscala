import type { FastifyPluginAsync } from "fastify";
import type { Queue } from "bullmq";
import {
  CreateShiftSchema,
  AssignShiftSchema,
  MarkShiftAttendanceSchema,
  type WsMessage,
} from "@mediscala/shared";
import { getTenantClient } from "../../db/client.js";
import type { CoverageJobData } from "../../services/coverage.service.js";
import { env } from "../../config/env.js";
import { shiftInstantInTimezone } from "../../lib/shift-zoned.js";
import { localDateString } from "../../lib/shift-period.js";

declare module "fastify" {
  interface FastifyInstance {
    coverageQueue: Queue<CoverageJobData>;
  }
}

export const shiftRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /shifts
  fastify.get("/", async (request, reply) => {
    const { from, to, departmentId } = request.query as {
      from?: string;
      to?: string;
      departmentId?: string;
    };
    const client = await getTenantClient(request.tenantSlug);
    try {
      let sql = `
        SELECT s.*, d.name as department_name,
          json_agg(json_build_object(
            'id', sa.id,
            'user_id', sa.user_id,
            'status', sa.status,
            'attendance_present', sa.attendance_present
          )) FILTER (WHERE sa.id IS NOT NULL) as assignments
        FROM shifts s
        LEFT JOIN departments d ON d.id = s.department_id
        LEFT JOIN shift_assignments sa ON sa.shift_id = s.id
        WHERE 1=1
      `;
      const params: unknown[] = [];
      let idx = 1;
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
      if (departmentId) {
        sql += ` AND s.department_id = $${idx++}`;
        params.push(departmentId);
      }
      sql += " GROUP BY s.id, d.name ORDER BY s.start_datetime";
      const { rows } = await client.query(sql, params);
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });

  // GET /shifts/suggest — ranked candidate suggestions for a new shift
  fastify.get(
    "/suggest",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const {
        departmentId,
        startDatetime,
        endDatetime,
        requiredSpecialty,
        requiredCount: requiredCountRaw,
        limit: limitRaw,
      } = request.query as {
        departmentId?: string;
        startDatetime?: string;
        endDatetime?: string;
        requiredSpecialty?: string;
        requiredCount?: string;
        limit?: string;
      };

      const requiredCountHint = Math.max(
        1,
        Math.min(99, Number(requiredCountRaw) || 1),
      );
      const requestedLimit = limitRaw ? Number(limitRaw) : NaN;
      const resultLimit = Math.min(
        50,
        Math.max(
          8,
          Number.isFinite(requestedLimit)
            ? requestedLimit
            : Math.max(16, requiredCountHint * 2),
        ),
      );

      if (!departmentId) {
        return reply
          .status(400)
          .send({ error: "Bad Request", message: "departmentId is required" });
      }

      const client = await getTenantClient(request.tenantSlug);
      try {
        // Determine week bounds (Mon–Sun) for the shift's week
        const shiftStart = startDatetime
          ? new Date(startDatetime)
          : new Date();
        const dayOfWeek = shiftStart.getDay(); // 0=Sun
        const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(shiftStart);
        weekStart.setDate(weekStart.getDate() - daysFromMon);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const {
          dayOfWeekEnum: shiftDayOfWeek,
          period: shiftPeriod,
          localCalendarDate: shiftLocalDate,
        } = shiftInstantInTimezone(shiftStart, env.APP_TIMEZONE);

        const params: unknown[] = [
          departmentId,
          weekStart,
          weekEnd,
          shiftStart,
          shiftDayOfWeek,
        ];
        let pIdx = 6;

        let specialtyClause = "";
        if (requiredSpecialty) {
          specialtyClause = `AND u.specialty = $${pIdx++}`;
          params.push(requiredSpecialty);
        }

        let conflictClause = "";
        if (startDatetime && endDatetime) {
          conflictClause = `
            AND NOT EXISTS (
              SELECT 1 FROM shift_assignments sa_c
              JOIN shifts s_c ON s_c.id = sa_c.shift_id
              WHERE sa_c.user_id = u.id
                AND sa_c.status = 'ASSIGNED'
                AND s_c.start_datetime < $${pIdx}
                AND s_c.end_datetime > $${pIdx + 1}
            )`;
          params.push(endDatetime, startDatetime);
          pIdx += 2;
        }

        params.push(shiftPeriod);
        const periodParam = pIdx++;
        params.push(shiftLocalDate);
        const leaveDateParam = pIdx++;

        const availabilityLeaveClause = `
             AND (
               NOT EXISTS (
                 SELECT 1 FROM availability av_skip WHERE av_skip.user_id = u.id
               )
               OR EXISTS (
                 SELECT 1 FROM availability av
                 WHERE av.user_id = u.id
                   AND av.day_of_week = $5
                   AND (av.period IS NULL OR av.period::text = $${periodParam})
               )
             )
             AND NOT EXISTS (
               SELECT 1 FROM user_leave_blocks lb
               WHERE lb.user_id = u.id
                 AND lb.status = 'APPROVED'
                 AND lb.starts_on <= $${leaveDateParam}::date
                 AND lb.ends_on >= $${leaveDateParam}::date
             )`;

        const { rows } = await client.query(
          `SELECT
             u.id,
             u.name,
             u.specialty,
             CAST(u.contract_hours_week AS float) AS contract_hours_week,
             COALESCE(wh.worked_hours, 0) AS worked_hours_week,
             COALESCE(ws.shift_count, 0) AS shifts_this_week,
             COALESCE(
               EXTRACT(EPOCH FROM (NOW() - ls.last_end)) / 3600,
               168
             ) AS hours_since_last_shift
           FROM users u
           LEFT JOIN (
             SELECT sa2.user_id,
                    SUM(EXTRACT(EPOCH FROM (s2.end_datetime - s2.start_datetime)) / 3600) AS worked_hours
             FROM shift_assignments sa2
             JOIN shifts s2 ON s2.id = sa2.shift_id
             WHERE sa2.status = 'ASSIGNED'
               AND s2.start_datetime >= $2
               AND s2.start_datetime < $3
             GROUP BY sa2.user_id
           ) wh ON wh.user_id = u.id
           LEFT JOIN (
             SELECT sa3.user_id, COUNT(*) AS shift_count
             FROM shift_assignments sa3
             JOIN shifts s3 ON s3.id = sa3.shift_id
             WHERE sa3.status = 'ASSIGNED'
               AND s3.start_datetime >= $2
               AND s3.start_datetime < $3
             GROUP BY sa3.user_id
           ) ws ON ws.user_id = u.id
           LEFT JOIN (
             SELECT sa4.user_id, MAX(s4.end_datetime) AS last_end
             FROM shift_assignments sa4
             JOIN shifts s4 ON s4.id = sa4.shift_id
             WHERE sa4.status = 'ASSIGNED'
               AND s4.end_datetime < $4
             GROUP BY sa4.user_id
           ) ls ON ls.user_id = u.id
           WHERE u.active = TRUE
             AND u.role = 'COLLABORATOR'
             AND (u.department_id = $1 OR u.department_id IS NULL)
             ${specialtyClause}
             ${availabilityLeaveClause}
             ${conflictClause}
           ORDER BY CASE WHEN u.department_id = $1 THEN 0 ELSE 1 END, u.name`,
          params,
        );

        const buildReasons = (opts: {
          contractH: number;
          workedH: number;
          remainingH: number;
          ratio: number;
          sinceLastH: number;
          shiftsThisWeek: number;
        }): string[] => {
          const out: string[] = [];
          const { contractH, workedH, remainingH, ratio, sinceLastH, shiftsThisWeek } =
            opts;

          if (remainingH >= contractH * 0.35) {
            out.push("Margem confortável de horas esta semana — boa capacidade para este turno.");
          } else if (remainingH > 8) {
            out.push("Ainda há horas disponíveis no contrato semanal.");
          } else if (remainingH > 0) {
            out.push("Poucas horas restantes na semana — usar com critério.");
          } else {
            out.push("Limite semanal de horas praticamente atingido.");
          }

          if (sinceLastH >= 72) {
            out.push("Sem turnos há vários dias — descanso adequado.");
          } else if (sinceLastH >= 36) {
            out.push("Último turno há tempo suficiente.");
          } else if (sinceLastH < 14) {
            out.push("Turno recente — verificar fadiga e sequência.");
          }

          if (shiftsThisWeek <= 1) {
            out.push("Poucos turnos agendados esta semana — distribuição favorável.");
          } else if (shiftsThisWeek >= 5) {
            out.push("Já tem vários turnos esta semana.");
          }

          if (ratio >= 0.9 && workedH > 0) {
            out.push("Próximo do teto semanal — não recomendado para sobrecarga extra.");
          }

          return [...new Set(out)].slice(0, 5);
        };

        // Calculate score and status in TypeScript (MVP ranking)
        const candidates = rows
          .map((r) => {
            const contractH = Number(r.contract_hours_week) || 40;
            const workedH = Number(r.worked_hours_week) || 0;
            const sinceLastH = Math.min(Number(r.hours_since_last_shift), 168);
            const shiftsThisWeek = Number(r.shifts_this_week) || 0;

            const score =
              (contractH - workedH) * 2 + sinceLastH - shiftsThisWeek * 3;

            const ratio = contractH > 0 ? workedH / contractH : 0;
            const remainingH = Math.max(0, contractH - workedH);
            const status =
              ratio < 0.7 ? "ideal" : ratio < 0.9 ? "warning" : "critical";

            const reasons = buildReasons({
              contractH,
              workedH,
              remainingH,
              ratio,
              sinceLastH,
              shiftsThisWeek,
            });

            return {
              id: r.id,
              name: r.name,
              specialty: r.specialty ?? null,
              contractHoursWeek: contractH,
              workedHoursWeek: Math.round(workedH * 10) / 10,
              shiftsThisWeek,
              hoursSinceLastShift: Math.round(sinceLastH),
              score: Math.round(score),
              status,
              reasons,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, resultLimit);

        return reply.send({ data: candidates });
      } finally {
        client.release();
      }
    },
  );

  // PATCH /shifts/:shiftId/assignments/:assignmentId/attendance — presença manual (gestor)
  fastify.patch(
    "/:shiftId/assignments/:assignmentId/attendance",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const { shiftId, assignmentId } = request.params as {
        shiftId: string;
        assignmentId: string;
      };
      const parsed = MarkShiftAttendanceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Bad Request", message: parsed.error.flatten() });
      }

      const client = await getTenantClient(request.tenantSlug);
      try {
        await client.query("BEGIN");

        const { rows: saRows } = await client.query<{
          id: string;
          user_id: string;
        }>(
          `SELECT id, user_id FROM shift_assignments WHERE id = $1 AND shift_id = $2`,
          [assignmentId, shiftId],
        );
        if (!saRows[0]) {
          await client.query("ROLLBACK");
          return reply.status(404).send({ error: "Not Found" });
        }
        const userId = saRows[0].user_id;

        const clearAbsenceIfAny = async () => {
          const { rows: absRows } = await client.query<{ id: string }>(
            `SELECT id FROM absences WHERE shift_assignment_id = $1`,
            [assignmentId],
          );
          const absenceId = absRows[0]?.id;
          if (!absenceId) return;
          await client.query(
            `DELETE FROM coverage_candidates WHERE coverage_request_id IN
              (SELECT id FROM coverage_requests WHERE absence_id = $1)`,
            [absenceId],
          );
          await client.query(
            `DELETE FROM coverage_requests WHERE absence_id = $1`,
            [absenceId],
          );
          await client.query(`DELETE FROM absences WHERE id = $1`, [
            absenceId,
          ]);
        };

        if (parsed.data.present) {
          await clearAbsenceIfAny();
          await client.query(
            `UPDATE shift_assignments
             SET attendance_present = TRUE, status = 'ASSIGNED'
             WHERE id = $1`,
            [assignmentId],
          );
        } else {
          await client.query(
            `UPDATE shift_assignments
             SET attendance_present = FALSE, status = 'ABSENT'
             WHERE id = $1`,
            [assignmentId],
          );
          const { rows: existingAbs } = await client.query(
            `SELECT id FROM absences WHERE shift_assignment_id = $1`,
            [assignmentId],
          );
          if (!existingAbs[0]) {
            const { rows: ins } = await client.query(
              `INSERT INTO absences (shift_assignment_id, user_id, type, reason)
               VALUES ($1, $2, 'OTHER', NULL) RETURNING id`,
              [assignmentId, userId],
            );
            try {
              await fastify.coverageQueue.add("process", {
                absenceId: ins[0].id,
                tenantSlug: request.tenantSlug,
              });
            } catch (queueErr) {
              fastify.log.warn(
                { queueErr, absenceId: ins[0].id },
                "Coverage queue enqueue failed — falta registada na mesma.",
              );
            }
          }
        }

        await client.query("COMMIT");

        const wsPayload: WsMessage = {
          event: "shift_updated",
          data: { shiftId, assignmentId },
          timestamp: new Date().toISOString(),
        };
        fastify.broadcastToTenant(request.tenantSlug, wsPayload);

        return reply.send({ data: { ok: true } });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // GET /shifts/:id/detail — enriched assignments (before /:id)
  fastify.get("/:id/detail", async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT s.*, d.name AS department_name,
          COALESCE(
            json_agg(
              json_build_object(
                'id', sa.id,
                'user_id', sa.user_id,
                'status', sa.status,
                'user_name', u.name,
                'user_email', u.email,
                'attendance_present', sa.attendance_present
              )
            ) FILTER (WHERE sa.id IS NOT NULL),
            '[]'::json
          ) AS assignments
         FROM shifts s
         LEFT JOIN departments d ON d.id = s.department_id
         LEFT JOIN shift_assignments sa ON sa.shift_id = s.id
         LEFT JOIN users u ON u.id = sa.user_id
         WHERE s.id = $1
         GROUP BY s.id, d.name`,
        [id],
      );
      if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
      return reply.send({ data: rows[0] });
    } finally {
      client.release();
    }
  });

  // GET /shifts/:id
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT s.*, d.name as department_name FROM shifts s LEFT JOIN departments d ON d.id = s.department_id WHERE s.id = $1`,
        [id],
      );
      if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
      return reply.send({ data: rows[0] });
    } finally {
      client.release();
    }
  });

  // POST /shifts
  fastify.post(
    "/",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const body = CreateShiftSchema.safeParse(request.body);
      if (!body.success)
        return reply
          .status(400)
          .send({ error: "Bad Request", message: body.error.flatten() });

      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `INSERT INTO shifts (name, department_id, start_datetime, end_datetime, required_specialty, required_count, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            body.data.name,
            body.data.departmentId,
            body.data.startDatetime,
            body.data.endDatetime,
            body.data.requiredSpecialty ?? null,
            body.data.requiredCount,
            request.user.sub,
          ],
        );
        return reply.status(201).send({ data: rows[0] });
      } finally {
        client.release();
      }
    },
  );

  // PATCH /shifts/:id
  fastify.patch(
    "/:id",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const client = await getTenantClient(request.tenantSlug);
      try {
        const allowed = [
          "name",
          "start_datetime",
          "end_datetime",
          "required_specialty",
          "required_count",
        ];
        const setClauses: string[] = [];
        const values: unknown[] = [];
        let idx = 1;
        for (const [k, v] of Object.entries(body)) {
          const col = k.replace(/([A-Z])/g, "_$1").toLowerCase();
          if (allowed.includes(col)) {
            setClauses.push(`${col} = $${idx++}`);
            values.push(v);
          }
        }
        if (!setClauses.length)
          return reply.status(400).send({ error: "Nothing to update" });
        values.push(id);
        const { rows } = await client.query(
          `UPDATE shifts SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
          values,
        );
        if (!rows[0]) return reply.status(404).send({ error: "Not Found" });
        return reply.send({ data: rows[0] });
      } finally {
        client.release();
      }
    },
  );

  // DELETE /shifts/:id
  fastify.delete(
    "/:id",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = await getTenantClient(request.tenantSlug);
      try {
        await client.query(`DELETE FROM shifts WHERE id = $1`, [id]);
        return reply.send({ data: { message: "Shift deleted" } });
      } finally {
        client.release();
      }
    },
  );

  // POST /shifts/:id/assign
  fastify.post(
    "/:id/assign",
    {
      preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = AssignShiftSchema.safeParse(request.body);
      if (!body.success)
        return reply
          .status(400)
          .send({ error: "Bad Request", message: body.error.flatten() });

      const client = await getTenantClient(request.tenantSlug);
      try {
        await client.query("BEGIN");

        const shiftRes = await client.query(
          `SELECT start_datetime, end_datetime FROM shifts WHERE id = $1`,
          [id],
        );
        if (!shiftRes.rows[0]) {
          await client.query("ROLLBACK");
          return reply.status(404).send({ error: "Not Found" });
        }
        const { start_datetime, end_datetime } = shiftRes.rows[0] as {
          start_datetime: string;
          end_datetime: string;
        };
        const shiftStartLocal = localDateString(new Date(start_datetime));
        const shiftEndLocal = localDateString(new Date(end_datetime));

        for (const userId of body.data.userIds) {
          const { rows: leaveHit } = await client.query(
            `SELECT 1 FROM user_leave_blocks lb
             WHERE lb.user_id = $1 AND lb.status = 'APPROVED'
               AND lb.starts_on <= $3::date AND lb.ends_on >= $2::date`,
            [userId, shiftStartLocal, shiftEndLocal],
          );
          if (leaveHit.length > 0) {
            await client.query("ROLLBACK");
            return reply.status(409).send({
              error: "Conflict",
              message:
                "Um ou mais colaboradores têm indisponibilidade aprovada que coincide com este turno.",
            });
          }
        }

        const inserted = [];
        for (const userId of body.data.userIds) {
          const { rows } = await client.query(
            `INSERT INTO shift_assignments (shift_id, user_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING *`,
            [id, userId],
          );
          if (rows[0]) inserted.push(rows[0]);
        }
        await client.query("COMMIT");
        return reply.status(201).send({ data: inserted });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // GET /shifts/my — collaborator sees own shifts
  fastify.get("/my", async (request, reply) => {
    const userId = request.user.sub;
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT s.*, sa.id as assignment_id, sa.status as assignment_status
         FROM shift_assignments sa
         JOIN shifts s ON s.id = sa.shift_id
         WHERE sa.user_id = $1
         ORDER BY s.start_datetime`,
        [userId],
      );
      return reply.send({ data: rows });
    } finally {
      client.release();
    }
  });
};
