import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { getTenantClient } from "../../db/client.js";
import { notificationService } from "../../services/notification.service.js";

type CoverageType = "COVERAGE" | "SWAP";
type SwapStatus =
  | "PENDING_TARGET"
  | "PENDING_MANAGER"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

const MIN_REST_HOURS = 11;

interface RawClient {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

interface SwapRiskFlags {
  REST_VIOLATION_SOURCE: boolean;
  REST_VIOLATION_TARGET: boolean;
  HOURS_EXCEEDED_SOURCE: boolean;
  HOURS_EXCEEDED_TARGET: boolean;
  SPECIALTY_MISMATCH_SOURCE: boolean;
  SPECIALTY_MISMATCH_TARGET: boolean;
  LEAVE_CONFLICT_SOURCE: boolean;
  LEAVE_CONFLICT_TARGET: boolean;
  EXPIRED: boolean;
}

type SwapRecommendation = "APPROVE" | "REVIEW" | "BLOCK";

interface SwapRiskResult {
  flags: SwapRiskFlags;
  recommendation: SwapRecommendation;
  reasons: string[];
}

async function computeSwapRisk(
  client: RawClient,
  opts: {
    sourceUserId: string;
    targetUserId: string;
    sourceAssignmentId: string;
    targetAssignmentId: string;
    sourceShiftStart: string;
    sourceShiftEnd: string;
    targetShiftStart: string;
    targetShiftEnd: string;
    sourceRequiredSpecialty: string | null;
    targetRequiredSpecialty: string | null;
    sourceUserSpecialty: string | null;
    targetUserSpecialty: string | null;
    sourceContractHours: number;
    targetContractHours: number;
    expiresAt: string | null;
  },
): Promise<SwapRiskResult> {
  const {
    sourceUserId, targetUserId,
    sourceAssignmentId, targetAssignmentId,
    sourceShiftStart, sourceShiftEnd,
    targetShiftStart, targetShiftEnd,
    sourceRequiredSpecialty, targetRequiredSpecialty,
    sourceUserSpecialty, targetUserSpecialty,
    sourceContractHours, targetContractHours,
    expiresAt,
  } = opts;

  // 1. Rest: last shift end for source user before target shift
  const { rows: srcRestRows } = await client.query<{ last_end: string | null }>(
    `SELECT MAX(s.end_datetime) AS last_end
     FROM shift_assignments sa
     JOIN shifts s ON s.id = sa.shift_id
     WHERE sa.user_id = $1
       AND sa.id != $2
       AND s.end_datetime <= $3::timestamptz`,
    [sourceUserId, sourceAssignmentId, targetShiftStart],
  );
  const srcRestMs = srcRestRows[0]?.last_end
    ? new Date(targetShiftStart).getTime() - new Date(srcRestRows[0].last_end).getTime()
    : null;
  const restViolationSource = srcRestMs !== null && srcRestMs / 3_600_000 < MIN_REST_HOURS;

  // 2. Rest: last shift end for target user before source shift
  const { rows: tgtRestRows } = await client.query<{ last_end: string | null }>(
    `SELECT MAX(s.end_datetime) AS last_end
     FROM shift_assignments sa
     JOIN shifts s ON s.id = sa.shift_id
     WHERE sa.user_id = $1
       AND sa.id != $2
       AND s.end_datetime <= $3::timestamptz`,
    [targetUserId, targetAssignmentId, sourceShiftStart],
  );
  const tgtRestMs = tgtRestRows[0]?.last_end
    ? new Date(sourceShiftStart).getTime() - new Date(tgtRestRows[0].last_end).getTime()
    : null;
  const restViolationTarget = tgtRestMs !== null && tgtRestMs / 3_600_000 < MIN_REST_HOURS;

  // 3. Weekly hours: source user in target shift's week
  const { rows: srcHrsRows } = await client.query<{ hours: string }>(
    `SELECT COALESCE(SUM(
       EXTRACT(EPOCH FROM (s.end_datetime - s.start_datetime)) / 3600
     ), 0)::text AS hours
     FROM shift_assignments sa
     JOIN shifts s ON s.id = sa.shift_id
     WHERE sa.user_id = $1
       AND sa.id != $2
       AND DATE_TRUNC('week', s.start_datetime AT TIME ZONE 'UTC') =
           DATE_TRUNC('week', $3::timestamptz AT TIME ZONE 'UTC')`,
    [sourceUserId, sourceAssignmentId, targetShiftStart],
  );
  const srcWeekHrs = Number.parseFloat(srcHrsRows[0]?.hours ?? '0');
  const tgtShiftDuration =
    (new Date(targetShiftEnd).getTime() - new Date(targetShiftStart).getTime()) / 3_600_000;
  const hoursExceededSource = srcWeekHrs + tgtShiftDuration > sourceContractHours;

  // 4. Weekly hours: target user in source shift's week
  const { rows: tgtHrsRows } = await client.query<{ hours: string }>(
    `SELECT COALESCE(SUM(
       EXTRACT(EPOCH FROM (s.end_datetime - s.start_datetime)) / 3600
     ), 0)::text AS hours
     FROM shift_assignments sa
     JOIN shifts s ON s.id = sa.shift_id
     WHERE sa.user_id = $1
       AND sa.id != $2
       AND DATE_TRUNC('week', s.start_datetime AT TIME ZONE 'UTC') =
           DATE_TRUNC('week', $3::timestamptz AT TIME ZONE 'UTC')`,
    [targetUserId, targetAssignmentId, sourceShiftStart],
  );
  const tgtWeekHrs = Number.parseFloat(tgtHrsRows[0]?.hours ?? '0');
  const srcShiftDuration =
    (new Date(sourceShiftEnd).getTime() - new Date(sourceShiftStart).getTime()) / 3_600_000;
  const hoursExceededTarget = tgtWeekHrs + srcShiftDuration > targetContractHours;

  // 5. Leave conflict: source user on target shift dates
  const { rows: srcLeaveRows } = await client.query<{ id: string }>(
    `SELECT id FROM user_leave_blocks
     WHERE user_id = $1
       AND status = 'APPROVED'
       AND starts_on <= $2::date
       AND ends_on >= $3::date
     LIMIT 1`,
    [sourceUserId, targetShiftEnd, targetShiftStart],
  );
  const leaveConflictSource = srcLeaveRows.length > 0;

  // 6. Leave conflict: target user on source shift dates
  const { rows: tgtLeaveRows } = await client.query<{ id: string }>(
    `SELECT id FROM user_leave_blocks
     WHERE user_id = $1
       AND status = 'APPROVED'
       AND starts_on <= $2::date
       AND ends_on >= $3::date
     LIMIT 1`,
    [targetUserId, sourceShiftEnd, sourceShiftStart],
  );
  const leaveConflictTarget = tgtLeaveRows.length > 0;

  // Specialty mismatch (only flagged when shift requires a specific specialty)
  const specialtyMismatchSource =
    !!targetRequiredSpecialty && sourceUserSpecialty !== targetRequiredSpecialty;
  const specialtyMismatchTarget =
    !!sourceRequiredSpecialty && targetUserSpecialty !== sourceRequiredSpecialty;

  const expired = !!expiresAt && new Date(expiresAt) < new Date();

  const flags: SwapRiskFlags = {
    REST_VIOLATION_SOURCE: restViolationSource,
    REST_VIOLATION_TARGET: restViolationTarget,
    HOURS_EXCEEDED_SOURCE: hoursExceededSource,
    HOURS_EXCEEDED_TARGET: hoursExceededTarget,
    SPECIALTY_MISMATCH_SOURCE: specialtyMismatchSource,
    SPECIALTY_MISMATCH_TARGET: specialtyMismatchTarget,
    LEAVE_CONFLICT_SOURCE: leaveConflictSource,
    LEAVE_CONFLICT_TARGET: leaveConflictTarget,
    EXPIRED: expired,
  };

  const reasons: string[] = [];
  if (flags.REST_VIOLATION_SOURCE)
    reasons.push(`Solicitante tem menos de ${MIN_REST_HOURS}h de descanso antes do turno destino`);
  if (flags.REST_VIOLATION_TARGET)
    reasons.push(`Colega tem menos de ${MIN_REST_HOURS}h de descanso antes do turno origem`);
  if (flags.HOURS_EXCEEDED_SOURCE)
    reasons.push('Solicitante excederá as horas contratuais semanais com o turno destino');
  if (flags.HOURS_EXCEEDED_TARGET)
    reasons.push('Colega excederá as horas contratuais semanais com o turno origem');
  if (flags.SPECIALTY_MISMATCH_SOURCE)
    reasons.push(`Especialidade do solicitante não corresponde ao turno destino (requer: ${targetRequiredSpecialty})`);
  if (flags.SPECIALTY_MISMATCH_TARGET)
    reasons.push(`Especialidade do colega não corresponde ao turno origem (requer: ${sourceRequiredSpecialty})`);
  if (flags.LEAVE_CONFLICT_SOURCE)
    reasons.push('Solicitante tem licença aprovada no período do turno destino');
  if (flags.LEAVE_CONFLICT_TARGET)
    reasons.push('Colega tem licença aprovada no período do turno origem');
  if (flags.EXPIRED)
    reasons.push('O pedido de troca expirou');

  const isBlock =
    flags.REST_VIOLATION_SOURCE ||
    flags.REST_VIOLATION_TARGET ||
    flags.LEAVE_CONFLICT_SOURCE ||
    flags.LEAVE_CONFLICT_TARGET;

  const isReview =
    !isBlock &&
    (flags.HOURS_EXCEEDED_SOURCE ||
      flags.HOURS_EXCEEDED_TARGET ||
      flags.SPECIALTY_MISMATCH_SOURCE ||
      flags.SPECIALTY_MISMATCH_TARGET ||
      flags.EXPIRED);

  const recommendation: SwapRecommendation = isBlock ? 'BLOCK' : isReview ? 'REVIEW' : 'APPROVE';

  return { flags, recommendation, reasons };
}

async function notifyManagersForSwapApproval(
  fastify: FastifyInstance,
  tenantSlug: string,
  sourceAssignmentId: string,
  coverageRequestId: string,
) {
  const client = await getTenantClient(tenantSlug);
  try {
    const { rows: managerRows } = await client.query(
      `SELECT DISTINCT u.id
       FROM users u
       JOIN shift_assignments sa ON sa.id = $1
       JOIN shifts s ON s.id = sa.shift_id
       WHERE u.role IN ('MANAGER', 'HOSPITAL_ADMIN')
         AND (u.department_id = s.department_id OR u.role = 'HOSPITAL_ADMIN')
         AND u.active = TRUE`,
      [sourceAssignmentId],
    );

    for (const manager of managerRows) {
      await notificationService.sendToUser(fastify, tenantSlug, {
        userId: manager.id,
        type: "GENERAL",
        title: "Swap pendente de aprovação",
        message: "Um pedido de troca foi aceite e aguarda decisão da gestão.",
        metadata: {
          coverageRequestId,
          flow: "SWAP",
          stage: "PENDING_MANAGER",
        },
      });
    }
  } finally {
    client.release();
  }
}

export const coverageRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /coverage/swaps — collaborator proposes a directed swap
  fastify.post("/swaps", async (request, reply) => {
    const userId = request.user.sub;
    const { sourceAssignmentId, targetAssignmentId } = request.body as {
      sourceAssignmentId: string;
      targetAssignmentId: string;
    };

    if (!sourceAssignmentId || !targetAssignmentId) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "sourceAssignmentId and targetAssignmentId are required",
      });
    }

    if (sourceAssignmentId === targetAssignmentId) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "sourceAssignmentId and targetAssignmentId must be different",
      });
    }

    const client = await getTenantClient(request.tenantSlug);
    try {
      await client.query("BEGIN");

      const { rows: sourceRows } = await client.query(
        `SELECT sa.id, sa.user_id, sa.shift_id, sa.status
         FROM shift_assignments sa
         WHERE sa.id = $1
         LIMIT 1`,
        [sourceAssignmentId],
      );

      if (!sourceRows[0]) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Source assignment not found",
        });
      }

      if (sourceRows[0].user_id !== userId) {
        return reply.status(403).send({
          error: "Forbidden",
          message: "You can only request swaps for your own assignments",
        });
      }

      if (sourceRows[0].status !== "ASSIGNED") {
        return reply.status(409).send({
          error: "Conflict",
          message: "Source assignment is not in ASSIGNED status",
        });
      }

      const { rows: targetRows } = await client.query(
        `SELECT sa.id, sa.user_id, sa.shift_id, sa.status
         FROM shift_assignments sa
         WHERE sa.id = $1
         LIMIT 1`,
        [targetAssignmentId],
      );

      if (!targetRows[0]) {
        return reply.status(404).send({
          error: "Not Found",
          message: "Target assignment not found",
        });
      }

      if (targetRows[0].user_id === userId) {
        return reply.status(409).send({
          error: "Conflict",
          message: "Cannot request a swap with your own assignment",
        });
      }

      if (targetRows[0].status !== "ASSIGNED") {
        return reply.status(409).send({
          error: "Conflict",
          message: "Target assignment is not in ASSIGNED status",
        });
      }

      const { rows: duplicateRows } = await client.query(
        `SELECT id
         FROM coverage_requests
         WHERE type = 'SWAP'
           AND status = 'OPEN'
           AND swap_status IN ('PENDING_TARGET', 'PENDING_MANAGER')
           AND source_assignment_id = $1
           AND target_assignment_id = $2
         LIMIT 1`,
        [sourceAssignmentId, targetAssignmentId],
      );

      if (duplicateRows[0]) {
        return reply.status(409).send({
          error: "Conflict",
          message: "A pending swap request already exists for this pair",
        });
      }

      const { rows: requestRows } = await client.query(
        `INSERT INTO coverage_requests (
           absence_id,
           status,
           expires_at,
           type,
           requested_by,
           source_assignment_id,
           target_assignment_id,
           swap_status
         )
         VALUES (
           NULL,
           'OPEN',
           NOW() + INTERVAL '24 hours',
           'SWAP',
           $1,
           $2,
           $3,
           'PENDING_TARGET'
         )
         RETURNING id`,
        [userId, sourceAssignmentId, targetAssignmentId],
      );

      const coverageRequestId = requestRows[0].id as string;

      await client.query(
        `INSERT INTO coverage_candidates (coverage_request_id, user_id)
         VALUES ($1, $2)`,
        [coverageRequestId, targetRows[0].user_id],
      );

      await client.query("COMMIT");

      await notificationService.sendToUser(fastify, request.tenantSlug, {
        userId: targetRows[0].user_id,
        type: "COVERAGE_REQUEST",
        title: "Pedido de troca de turno",
        message: "Recebeste um pedido de troca. Aceita ou recusa na app.",
        metadata: {
          coverageRequestId,
          flow: "SWAP",
          stage: "PENDING_TARGET",
        },
      });

      return reply.status(201).send({
        data: {
          id: coverageRequestId,
          type: "SWAP",
          swapStatus: "PENDING_TARGET",
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // GET /coverage/swaps/pending-approval — manager/admin queue for swap decisions
  fastify.get(
    "/swaps/pending-approval",
    { preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]) },
    async (request, reply) => {
      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `SELECT cr.id, cr.created_at, cr.expires_at, cr.swap_status,
                  requester.id AS requester_id, requester.name AS requester_name,
                  requester.specialty AS requester_specialty,
                  CAST(requester.contract_hours_week AS FLOAT) AS requester_contract_hours,
                  target_user.id AS target_user_id, target_user.name AS target_user_name,
                  target_user.specialty AS target_user_specialty,
                  CAST(target_user.contract_hours_week AS FLOAT) AS target_user_contract_hours,
                  source_sa.id AS source_assignment_id, target_sa.id AS target_assignment_id,
                  source_shift.id AS source_shift_id, source_shift.name AS source_shift_name,
                  source_shift.start_datetime AS source_start_datetime,
                  source_shift.end_datetime AS source_end_datetime,
                  source_shift.department_id AS source_dept_id,
                  source_shift.required_specialty AS source_required_specialty,
                  target_shift.id AS target_shift_id, target_shift.name AS target_shift_name,
                  target_shift.start_datetime AS target_start_datetime,
                  target_shift.end_datetime AS target_end_datetime,
                  target_shift.department_id AS target_dept_id,
                  target_shift.required_specialty AS target_required_specialty
           FROM coverage_requests cr
           JOIN shift_assignments source_sa ON source_sa.id = cr.source_assignment_id
           JOIN shift_assignments target_sa ON target_sa.id = cr.target_assignment_id
           JOIN users requester ON requester.id = cr.requested_by
           JOIN users target_user ON target_user.id = target_sa.user_id
           JOIN shifts source_shift ON source_shift.id = source_sa.shift_id
           JOIN shifts target_shift ON target_shift.id = target_sa.shift_id
           WHERE cr.type = 'SWAP'
             AND cr.status = 'OPEN'
             AND cr.swap_status = 'PENDING_MANAGER'
           ORDER BY cr.created_at DESC`,
        );

        const enriched = await Promise.all(
          rows.map(async (row) => {
            const risk = await computeSwapRisk(client, {
              sourceUserId: row.requester_id as string,
              targetUserId: row.target_user_id as string,
              sourceAssignmentId: row.source_assignment_id as string,
              targetAssignmentId: row.target_assignment_id as string,
              sourceShiftStart: row.source_start_datetime as string,
              sourceShiftEnd: row.source_end_datetime as string,
              targetShiftStart: row.target_start_datetime as string,
              targetShiftEnd: row.target_end_datetime as string,
              sourceRequiredSpecialty: row.source_required_specialty as string | null,
              targetRequiredSpecialty: row.target_required_specialty as string | null,
              sourceUserSpecialty: row.requester_specialty as string | null,
              targetUserSpecialty: row.target_user_specialty as string | null,
              sourceContractHours: row.requester_contract_hours as number,
              targetContractHours: row.target_user_contract_hours as number,
              expiresAt: row.expires_at as string | null,
            });
            return { ...row, risk };
          }),
        );

        return reply.send({ data: enriched });
      } finally {
        client.release();
      }
    },
  );

  // PATCH /coverage/:id/swaps/approve — manager/admin approves an accepted swap
  fastify.patch(
    "/:id/swaps/approve",
    { preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const managerId = request.user.sub;
      const managerRole = request.user.role;
      const { force } = request.body as { force?: boolean };

      const client = await getTenantClient(request.tenantSlug);
      try {
        await client.query("BEGIN");

        // Get manager's department for scope check
        const { rows: managerRows } = await client.query<{ department_id: string | null }>(
          'SELECT department_id FROM users WHERE id = $1 LIMIT 1',
          [managerId],
        );
        const managerDeptId = managerRows[0]?.department_id ?? null;

        const { rows: requestRows } = await client.query(
          `SELECT id, type, status, swap_status, requested_by,
                  source_assignment_id, target_assignment_id, expires_at
           FROM coverage_requests
           WHERE id = $1
           FOR UPDATE`,
          [id],
        );

        const swapRequest = requestRows[0];
        if (!swapRequest) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Swap request not found",
          });
        }

        if (swapRequest.type !== "SWAP") {
          return reply.status(409).send({
            error: "Conflict",
            message: "Coverage request is not a swap",
          });
        }

        if (
          swapRequest.status !== "OPEN" ||
          swapRequest.swap_status !== "PENDING_MANAGER"
        ) {
          return reply.status(409).send({
            error: "Conflict",
            message: "Swap is not pending manager approval",
          });
        }

        const { rows: assignmentRows } = await client.query(
          `SELECT sa.id, sa.user_id, sa.shift_id, sa.status,
                  s.start_datetime, s.end_datetime,
                  s.department_id AS shift_dept_id,
                  s.required_specialty,
                  u.specialty AS user_specialty,
                  CAST(u.contract_hours_week AS FLOAT) AS contract_hours
           FROM shift_assignments sa
           JOIN shifts s ON s.id = sa.shift_id
           JOIN users u ON u.id = sa.user_id
           WHERE sa.id IN ($1, $2)
           ORDER BY sa.id`,
          [swapRequest.source_assignment_id, swapRequest.target_assignment_id],
        );

        if (assignmentRows.length !== 2) {
          return reply.status(409).send({
            error: "Conflict",
            message: "Swap assignments no longer valid",
          });
        }

        const source = assignmentRows.find(
          (row) => row.id === swapRequest.source_assignment_id,
        );
        const target = assignmentRows.find(
          (row) => row.id === swapRequest.target_assignment_id,
        );

        if (!source || !target) {
          return reply.status(409).send({
            error: "Conflict",
            message: "Unable to resolve swap assignments",
          });
        }

        if (source.status !== "ASSIGNED" || target.status !== "ASSIGNED") {
          return reply.status(409).send({
            error: "Conflict",
            message: "Only ASSIGNED shifts can be swapped",
          });
        }

        // Dept scope: MANAGER must belong to at least one of the involved departments
        if (managerRole === "MANAGER" && managerDeptId !== null) {
          const involvedDepts = [source.shift_dept_id as string, target.shift_dept_id as string];
          if (!involvedDepts.includes(managerDeptId)) {
            await client.query("ROLLBACK");
            return reply.status(403).send({
              error: "Forbidden",
              message: "You can only approve swaps involving your department",
            });
          }
        }

        // Expiry check
        if (swapRequest.expires_at && new Date(swapRequest.expires_at as string) < new Date()) {
          await client.query(
            `UPDATE coverage_requests
             SET status = 'CANCELLED', swap_status = 'REJECTED',
                 manager_decision_at = NOW(), manager_decision_by = $1,
                 manager_decision_reason = 'Expired before manager decision'
             WHERE id = $2`,
            [managerId, id],
          );
          await client.query("COMMIT");
          return reply.status(409).send({
            error: "Conflict",
            message: "Swap request expired before it could be approved",
          });
        }

        // Overlap check
        const { rows: sourceConflictRows } = await client.query(
          `SELECT sa.id
           FROM shift_assignments sa
           JOIN shifts s ON s.id = sa.shift_id
           WHERE sa.user_id = $1
             AND sa.id != $2
             AND (s.start_datetime, s.end_datetime) OVERLAPS ($3::timestamptz, $4::timestamptz)
           LIMIT 1`,
          [source.user_id, source.id, target.start_datetime, target.end_datetime],
        );

        if (sourceConflictRows[0]) {
          return reply.status(409).send({
            error: "Conflict",
            message: "Requester has a schedule conflict with target shift",
          });
        }

        const { rows: targetConflictRows } = await client.query(
          `SELECT sa.id
           FROM shift_assignments sa
           JOIN shifts s ON s.id = sa.shift_id
           WHERE sa.user_id = $1
             AND sa.id != $2
             AND (s.start_datetime, s.end_datetime) OVERLAPS ($3::timestamptz, $4::timestamptz)
           LIMIT 1`,
          [target.user_id, target.id, source.start_datetime, source.end_datetime],
        );

        if (targetConflictRows[0]) {
          return reply.status(409).send({
            error: "Conflict",
            message: "Target user has a schedule conflict with source shift",
          });
        }

        // Clinical adequacy check
        const risk = await computeSwapRisk(client, {
          sourceUserId: source.user_id as string,
          targetUserId: target.user_id as string,
          sourceAssignmentId: source.id as string,
          targetAssignmentId: target.id as string,
          sourceShiftStart: source.start_datetime as string,
          sourceShiftEnd: source.end_datetime as string,
          targetShiftStart: target.start_datetime as string,
          targetShiftEnd: target.end_datetime as string,
          sourceRequiredSpecialty: source.required_specialty as string | null,
          targetRequiredSpecialty: target.required_specialty as string | null,
          sourceUserSpecialty: source.user_specialty as string | null,
          targetUserSpecialty: target.user_specialty as string | null,
          sourceContractHours: source.contract_hours as number,
          targetContractHours: target.contract_hours as number,
          expiresAt: swapRequest.expires_at as string | null,
        });

        // BLOCK: only HOSPITAL_ADMIN with force=true can override
        if (risk.recommendation === "BLOCK") {
          const canForce = managerRole === "HOSPITAL_ADMIN" && force === true;
          if (!canForce) {
            await client.query("ROLLBACK");
            return reply.status(422).send({
              error: "Unprocessable Entity",
              message: "Swap bloqueado por violações de política clínica",
              risk,
            });
          }
        }

        await client.query(
          `UPDATE shift_assignments
           SET user_id = $1, status = 'SWAPPED'
           WHERE id = $2`,
          [target.user_id, source.id],
        );

        await client.query(
          `UPDATE shift_assignments
           SET user_id = $1, status = 'SWAPPED'
           WHERE id = $2`,
          [source.user_id, target.id],
        );

        await client.query(
          `UPDATE coverage_requests
           SET status = 'FILLED',
               swap_status = 'APPROVED',
               manager_decision_at = NOW(),
               manager_decision_by = $1
           WHERE id = $2`,
          [managerId, id],
        );

        await client.query("COMMIT");

        await notificationService.sendToUser(fastify, request.tenantSlug, {
          userId: source.user_id as string,
          type: "SHIFT_CHANGED",
          title: "Swap aprovado",
          message: "A tua troca de turno foi aprovada pela gestão.",
          metadata: { coverageRequestId: id, flow: "SWAP", decision: "APPROVED" },
        });

        await notificationService.sendToUser(fastify, request.tenantSlug, {
          userId: target.user_id as string,
          type: "SHIFT_CHANGED",
          title: "Swap aprovado",
          message: "A troca de turno foi aprovada pela gestão.",
          metadata: { coverageRequestId: id, flow: "SWAP", decision: "APPROVED" },
        });

        return reply.send({ data: { id, status: "FILLED", swapStatus: "APPROVED", risk } });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  );

  // PATCH /coverage/:id/swaps/reject — manager/admin rejects an accepted swap
  fastify.patch(
    "/:id/swaps/reject",
    { preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const managerId = request.user.sub;
      const managerRole = request.user.role;
      const { reason } = request.body as { reason?: string };

      const client = await getTenantClient(request.tenantSlug);
      try {
        await client.query("BEGIN");

        // Get manager's department for scope check
        const { rows: managerRows } = await client.query<{ department_id: string | null }>(
          'SELECT department_id FROM users WHERE id = $1 LIMIT 1',
          [managerId],
        );
        const managerDeptId = managerRows[0]?.department_id ?? null;

        const { rows: requestRows } = await client.query(
          `SELECT id, type, status, swap_status,
                  source_assignment_id, target_assignment_id
           FROM coverage_requests
           WHERE id = $1
           FOR UPDATE`,
          [id],
        );

        const swapRequest = requestRows[0];
        if (!swapRequest) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Swap request not found",
          });
        }

        if (swapRequest.type !== "SWAP") {
          return reply.status(409).send({
            error: "Conflict",
            message: "Coverage request is not a swap",
          });
        }

        if (
          swapRequest.status !== "OPEN" ||
          swapRequest.swap_status !== "PENDING_MANAGER"
        ) {
          return reply.status(409).send({
            error: "Conflict",
            message: "Swap is not pending manager approval",
          });
        }

        const { rows: participantRows } = await client.query(
          `SELECT sa.id, sa.user_id, s.department_id AS shift_dept_id
           FROM shift_assignments sa
           JOIN shifts s ON s.id = sa.shift_id
           WHERE sa.id IN ($1, $2)`,
          [swapRequest.source_assignment_id, swapRequest.target_assignment_id],
        );

        // Dept scope: MANAGER must belong to at least one of the involved departments
        if (managerRole === "MANAGER" && managerDeptId !== null) {
          const involvedDepts = participantRows.map((r) => r.shift_dept_id as string);
          if (!involvedDepts.includes(managerDeptId)) {
            await client.query("ROLLBACK");
            return reply.status(403).send({
              error: "Forbidden",
              message: "You can only reject swaps involving your department",
            });
          }
        }

        await client.query(
          `UPDATE coverage_requests
           SET status = 'CANCELLED',
               swap_status = 'REJECTED',
               manager_decision_at = NOW(),
               manager_decision_by = $1,
               manager_decision_reason = $2
           WHERE id = $3`,
          [managerId, reason ?? null, id],
        );

        await client.query("COMMIT");

        for (const participant of participantRows) {
          await notificationService.sendToUser(fastify, request.tenantSlug, {
            userId: participant.user_id,
            type: "GENERAL",
            title: "Swap rejeitado",
            message: "A gestão rejeitou o pedido de troca.",
            metadata: {
              coverageRequestId: id,
              flow: "SWAP",
              decision: "REJECTED",
              reason: reason ?? null,
            },
          });
        }

        return reply.send({
          data: { id, status: "CANCELLED", swapStatus: "REJECTED" },
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  );

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
        `SELECT cc.*, cr.status as request_status, cr.absence_id,
                cr.type, cr.swap_status, cr.source_assignment_id
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
        'UPDATE coverage_candidates SET response = $1, responded_at = NOW() WHERE id = $2',
        [response, candidate.id],
      );

      const coverageType = (candidate.type ?? "COVERAGE") as CoverageType;

      if (coverageType === "SWAP") {
        if (response === "DECLINED") {
          await client.query(
            `UPDATE coverage_requests
             SET status = 'CANCELLED',
                 swap_status = 'REJECTED',
                 manager_decision_at = NOW(),
                 manager_decision_reason = 'Declined by target user'
             WHERE id = $1`,
            [id],
          );
        } else {
          await client.query(
            `UPDATE coverage_requests
             SET swap_status = 'PENDING_MANAGER'
             WHERE id = $1`,
            [id],
          );
        }

        await client.query("COMMIT");

        if (response === "ACCEPTED") {
          await notifyManagersForSwapApproval(
            fastify,
            request.tenantSlug,
            candidate.source_assignment_id,
            id,
          );
        }

        return reply.send({
          data: {
            message:
              response === "ACCEPTED"
                ? "Swap accepted and pending manager approval"
                : "Swap declined",
            status:
              response === "ACCEPTED"
                ? ("PENDING_MANAGER" as SwapStatus)
                : ("REJECTED" as SwapStatus),
          },
        });
      }

      if (response === "ACCEPTED") {
        // Get shift info from absence
        const { rows: absRows } = await client.query(
          'SELECT sa.shift_id FROM absences a JOIN shift_assignments sa ON sa.id = a.shift_assignment_id WHERE a.id = $1',
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

  // PATCH /coverage/:id/cancel — admin/manager cancels an OPEN coverage request
  fastify.patch(
    "/:id/cancel",
    { preHandler: fastify.requireRole(["MANAGER", "HOSPITAL_ADMIN"]) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const client = await getTenantClient(request.tenantSlug);
      try {
        const { rows } = await client.query(
          `UPDATE coverage_requests SET status = 'CANCELLED'
           WHERE id = $1 AND status = 'OPEN'
           RETURNING id`,
          [id],
        );
        if (!rows[0]) {
          return reply.status(409).send({
            error: "Conflict",
            message: "Coverage request is not open or does not exist",
          });
        }
        return reply.send({ data: { id: rows[0].id, status: "CANCELLED" } });
      } finally {
        client.release();
      }
    },
  );

  // GET /coverage/swaps/my — collaborator sees swaps they initiated
  fastify.get("/swaps/my", async (request, reply) => {
    const userId = request.user.sub;
    const client = await getTenantClient(request.tenantSlug);
    try {
      const { rows } = await client.query(
        `SELECT cr.id, cr.status, cr.swap_status, cr.created_at, cr.expires_at,
                source_shift.name AS source_shift_name,
                source_shift.start_datetime AS source_start_datetime,
                source_shift.end_datetime AS source_end_datetime,
                target_shift.name AS target_shift_name,
                target_shift.start_datetime AS target_start_datetime,
                target_shift.end_datetime AS target_end_datetime,
                target_user.name AS target_user_name
         FROM coverage_requests cr
         JOIN shift_assignments source_sa ON source_sa.id = cr.source_assignment_id
         JOIN shift_assignments target_sa ON target_sa.id = cr.target_assignment_id
         JOIN shifts source_shift ON source_shift.id = source_sa.shift_id
         JOIN shifts target_shift ON target_shift.id = target_sa.shift_id
         JOIN users target_user ON target_user.id = target_sa.user_id
         WHERE cr.type = 'SWAP'
           AND cr.requested_by = $1
         ORDER BY cr.created_at DESC
         LIMIT 50`,
        [userId],
      );
      return reply.send({ data: rows });
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
                COALESCE(cr.type, 'COVERAGE') as request_type,
                cr.swap_status,
                s.name as shift_name, s.start_datetime, s.end_datetime
         FROM coverage_candidates cc
         JOIN coverage_requests cr ON cr.id = cc.coverage_request_id
         LEFT JOIN absences a ON a.id = cr.absence_id
         LEFT JOIN shift_assignments sa ON sa.id = a.shift_assignment_id OR sa.id = cr.target_assignment_id
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
