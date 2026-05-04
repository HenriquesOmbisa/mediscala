import {
  boolean,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums (tenant DB public schema) ──────────────────────────────────────────

export const roleEnum = pgEnum("user_role", [
  "HOSPITAL_ADMIN",
  "MANAGER",
  "COLLABORATOR",
]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "ASSIGNED",
  "ABSENT",
  "SWAPPED",
]);

export const absenceTypeEnum = pgEnum("absence_type", [
  "SICK",
  "PERSONAL",
  "EMERGENCY",
  "VACATION",
  "OTHER",
]);

export const coverageStatusEnum = pgEnum("coverage_status", [
  "OPEN",
  "FILLED",
  "EXPIRED",
  "CANCELLED",
]);

export const coverageResponseEnum = pgEnum("coverage_response", [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "COVERAGE_REQUEST",
  "COVERAGE_FILLED",
  "COVERAGE_EXPIRED",
  "SHIFT_ASSIGNED",
  "SHIFT_CHANGED",
  "ABSENCE_APPROVED",
  "ABSENCE_REJECTED",
  "GENERAL",
]);

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
]);

export const availabilityPeriodEnum = pgEnum("availability_period", [
  "MORNING",
  "AFTERNOON",
  "NIGHT",
]);

export const leaveBlockStatusEnum = pgEnum("leave_block_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

// ─── Tenant Tables (public schema of each per-tenant database) ─────────────────

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    specialty: text("specialty"),
    contractHoursWeek: text("contract_hours_week").notNull().default("40"),
    departmentId: uuid("department_id").references(() => departments.id),
    active: boolean("active").notNull().default(true),
    pushToken: text("push_token"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id),
    startDatetime: timestamp("start_datetime", {
      withTimezone: true,
    }).notNull(),
    endDatetime: timestamp("end_datetime", { withTimezone: true }).notNull(),
    requiredSpecialty: text("required_specialty"),
    requiredCount: text("required_count").notNull().default("1"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("shifts_start_idx").on(t.startDatetime)],
);

export const shiftAssignments = pgTable("shift_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  shiftId: uuid("shift_id")
    .notNull()
    .references(() => shifts.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  status: assignmentStatusEnum("status").notNull().default("ASSIGNED"),
  attendancePresent: boolean("attendance_present"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const absences = pgTable("absences", {
  id: uuid("id").primaryKey().defaultRandom(),
  shiftAssignmentId: uuid("shift_assignment_id")
    .notNull()
    .references(() => shiftAssignments.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: absenceTypeEnum("type").notNull(),
  reason: text("reason"),
  reportedAt: timestamp("reported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  approvedBy: uuid("approved_by").references(() => users.id),
});

export const coverageRequests = pgTable("coverage_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  absenceId: uuid("absence_id").references(() => absences.id),
  status: coverageStatusEnum("status").notNull().default("OPEN"),
  type: text("type").notNull().default("COVERAGE"),
  requestedBy: uuid("requested_by").references(() => users.id),
  sourceAssignmentId: uuid("source_assignment_id").references(
    () => shiftAssignments.id,
  ),
  targetAssignmentId: uuid("target_assignment_id").references(
    () => shiftAssignments.id,
  ),
  swapStatus: text("swap_status"),
  managerDecisionAt: timestamp("manager_decision_at", { withTimezone: true }),
  managerDecisionBy: uuid("manager_decision_by").references(() => users.id),
  managerDecisionReason: text("manager_decision_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const coverageCandidates = pgTable("coverage_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  coverageRequestId: uuid("coverage_request_id")
    .notNull()
    .references(() => coverageRequests.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  notifiedAt: timestamp("notified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  response: coverageResponseEnum("response").notNull().default("PENDING"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

export const availability = pgTable("availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  period: availabilityPeriodEnum("period"),
});

export const userLeaveBlocks = pgTable("user_leave_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  endsOn: date("ends_on", { mode: "string" }).notNull(),
  type: absenceTypeEnum("type").notNull(),
  status: leaveBlockStatusEnum("status").notNull().default("APPROVED"),
  reason: text("reason"),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.read)],
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Department = typeof departments.$inferSelect;
export type User = typeof users.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type ShiftAssignment = typeof shiftAssignments.$inferSelect;
export type Absence = typeof absences.$inferSelect;
export type CoverageRequest = typeof coverageRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
