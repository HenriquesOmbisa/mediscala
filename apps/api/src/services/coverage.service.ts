import { Queue, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import { getTenantClient } from "../db/client.js";
import { notificationService } from "./notification.service.js";
import { env } from "../config/env.js";
import { shiftInstantInTimezone } from "../lib/shift-zoned.js";

export const COVERAGE_QUEUE = "coverage";

export interface CoverageJobData {
  absenceId: string;
  tenantSlug: string;
}

export function createCoverageQueue(redis: Redis): Queue<CoverageJobData> {
  return new Queue(COVERAGE_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

export function startCoverageWorker(redis: Redis, fastify: any) {
  const worker = new Worker<CoverageJobData>(
    COVERAGE_QUEUE,
    async (job: Job<CoverageJobData>) => {
      const { absenceId, tenantSlug } = job.data;
      fastify.log.info({ absenceId, tenantSlug }, "Coverage job started");
      await processCoverageRequest(absenceId, tenantSlug, fastify);
    },
    { connection: redis, concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    fastify.log.error({ jobId: job?.id, err }, "Coverage job failed");
  });

  return worker;
}

async function processCoverageRequest(
  absenceId: string,
  tenantSlug: string,
  fastify: any,
) {
  const client = await getTenantClient(tenantSlug);
  try {

    // 1. Get absence + shift info
    const { rows: absenceRows } = await client.query(
      `SELECT a.*, sa.shift_id, sa.user_id as absent_user_id,
              s.start_datetime, s.end_datetime, s.required_specialty, s.department_id
       FROM absences a
       JOIN shift_assignments sa ON sa.id = a.shift_assignment_id
       JOIN shifts s ON s.id = sa.shift_id
       WHERE a.id = $1`,
      [absenceId],
    );

    if (!absenceRows[0]) throw new Error(`Absence ${absenceId} not found`);
    const absence = absenceRows[0];

    // 2. Create coverage_request record
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h expiry
    const { rows: reqRows } = await client.query(
      `INSERT INTO coverage_requests (absence_id, status, expires_at)
       VALUES ($1, 'OPEN', $2) RETURNING id`,
      [absenceId, expiresAt],
    );
    const coverageRequestId = reqRows[0].id;

    // 3. Find eligible candidates
    // Rules: same specialty (or no specialty required), not assigned same day, within weekly hours
    const shiftDate = new Date(absence.start_datetime);
    const weekStart = getMonday(shiftDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const {
      dayOfWeekEnum: shiftDayOfWeek,
      period: shiftPeriod,
      localCalendarDate: shiftLocalDateStr,
    } = shiftInstantInTimezone(shiftDate, env.APP_TIMEZONE);

    const { rows: candidates } = await client.query(
      `SELECT u.id, u.name, u.email, u.push_token, u.contract_hours_week,
              COALESCE(SUM(
                EXTRACT(EPOCH FROM (s2.end_datetime - s2.start_datetime)) / 3600
              ), 0) as hours_this_week
       FROM users u
       LEFT JOIN shift_assignments sa2 ON sa2.user_id = u.id AND sa2.status = 'ASSIGNED'
       LEFT JOIN shifts s2 ON s2.id = sa2.shift_id
         AND s2.start_datetime >= $1 AND s2.start_datetime < $2
       WHERE u.active = TRUE
         AND u.id != $3
         AND u.role = 'COLLABORATOR'
         AND ($4::text IS NULL OR u.specialty = $4)
         AND NOT EXISTS (
           SELECT 1 FROM shift_assignments sa3
           JOIN shifts s3 ON s3.id = sa3.shift_id
           WHERE sa3.user_id = u.id
             AND sa3.status = 'ASSIGNED'
             AND DATE(s3.start_datetime) = DATE($5::timestamptz)
         )
         AND EXISTS (
           SELECT 1 FROM availability av
           WHERE av.user_id = u.id AND av.day_of_week = $6
             AND (av.period IS NULL OR av.period::text = $9)
         )
         AND NOT EXISTS (
           SELECT 1 FROM user_leave_blocks lb
           WHERE lb.user_id = u.id
             AND lb.status = 'APPROVED'
             AND lb.starts_on <= $10::date
             AND lb.ends_on >= $10::date
         )
       GROUP BY u.id
       HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (s2.end_datetime - s2.start_datetime)) / 3600), 0)
              + EXTRACT(EPOCH FROM ($7::timestamptz - $8::timestamptz)) / 3600
              <= CAST(u.contract_hours_week AS FLOAT)
       ORDER BY hours_this_week ASC
       LIMIT 10`,
      [
        weekStart,
        weekEnd,
        absence.absent_user_id,
        absence.required_specialty,
        absence.start_datetime,
        shiftDayOfWeek,
        absence.end_datetime,
        absence.start_datetime,
        shiftPeriod,
        shiftLocalDateStr,
      ],
    );

    if (candidates.length === 0) {
      // No candidates — escalate to managers
      const { rows: managers } = await client.query(
        `SELECT id, push_token FROM users WHERE role IN ('MANAGER', 'HOSPITAL_ADMIN') AND active = TRUE`,
      );
      for (const mgr of managers) {
        await notificationService.sendToUser(fastify, tenantSlug, {
          userId: mgr.id,
          type: "COVERAGE_EXPIRED",
          title: "⚠️ Cobertura sem candidatos",
          message:
            "Um turno ficou sem substitutos disponíveis. Intervenção manual necessária.",
          metadata: { absenceId, coverageRequestId, shiftId: absence.shift_id },
          pushToken: mgr.push_token,
        });
      }
      await client.query(
        `UPDATE coverage_requests SET status = 'EXPIRED' WHERE id = $1`,
        [coverageRequestId],
      );
      return;
    }

    // 4. Insert candidates + notify
    for (const candidate of candidates) {
      await client.query(
        `INSERT INTO coverage_candidates (coverage_request_id, user_id) VALUES ($1, $2)`,
        [coverageRequestId, candidate.id],
      );
      await notificationService.sendToUser(fastify, tenantSlug, {
        userId: candidate.id,
        type: "COVERAGE_REQUEST",
        title: "🔔 Pedido de cobertura",
        message: `Tens um turno disponível para cobrir. Tens 2 horas para responder.`,
        metadata: {
          coverageRequestId,
          shiftId: absence.shift_id,
          startDatetime: absence.start_datetime,
          endDatetime: absence.end_datetime,
        },
        pushToken: candidate.push_token,
      });
    }

    fastify.log.info(
      { coverageRequestId, candidates: candidates.length },
      "Coverage candidates notified",
    );
  } finally {
    client.release();
  }
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
