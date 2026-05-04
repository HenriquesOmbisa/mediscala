import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const UserRole = z.enum([
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
  "MANAGER",
  "COLLABORATOR",
]);
export type UserRole = z.infer<typeof UserRole>;

export const ShiftAssignmentStatus = z.enum(["ASSIGNED", "ABSENT", "SWAPPED"]);
export type ShiftAssignmentStatus = z.infer<typeof ShiftAssignmentStatus>;

export const AbsenceType = z.enum([
  "SICK",
  "PERSONAL",
  "EMERGENCY",
  "VACATION",
  "OTHER",
]);
export type AbsenceType = z.infer<typeof AbsenceType>;

export const CoverageRequestStatus = z.enum([
  "OPEN",
  "FILLED",
  "EXPIRED",
  "CANCELLED",
]);
export type CoverageRequestStatus = z.infer<typeof CoverageRequestStatus>;

export const CoverageResponse = z.enum(["PENDING", "ACCEPTED", "DECLINED"]);
export type CoverageResponse = z.infer<typeof CoverageResponse>;

export const TenantStatus = z.enum(["ACTIVE", "SUSPENDED", "TRIAL"]);
export type TenantStatus = z.infer<typeof TenantStatus>;

export const TenantPlan = z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE"]);
export type TenantPlan = z.infer<typeof TenantPlan>;

export const NotificationType = z.enum([
  "COVERAGE_REQUEST",
  "COVERAGE_FILLED",
  "COVERAGE_EXPIRED",
  "SHIFT_ASSIGNED",
  "SHIFT_CHANGED",
  "ABSENCE_APPROVED",
  "ABSENCE_REJECTED",
  "GENERAL",
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const DayOfWeek = z.enum([
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
]);
export type DayOfWeek = z.infer<typeof DayOfWeek>;

// ─── Auth Schemas ──────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    role: UserRole,
    specialty: z.string().nullable(),
    tenantSlug: z.string(),
    avatarUrl: z.string().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ─── Tenant Schemas ────────────────────────────────────────────────────────────

// ─── Tenant Schemas (updated for DB-per-tenant) ───────────────────────────────

export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens",
    ),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  planCode: z.string().optional(),
  notes: z.string().optional(),
  contactEmail: z.string().email().optional(),
});
export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: TenantStatus,
  dbName: z.string(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  nif: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  areaOfActivity: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  brandDisplayMode: z.enum(["LOGO_AND_NAME", "LOGO_ONLY"]).nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const UpdateInstitutionSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  nif: z.string().max(30).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  areaOfActivity: z.string().max(140).nullable().optional(),
  brandDisplayMode: z.enum(["LOGO_AND_NAME", "LOGO_ONLY"]).optional(),
  notes: z.string().max(1500).nullable().optional(),
});
export type UpdateInstitutionInput = z.infer<typeof UpdateInstitutionSchema>;

// ─── User Schemas ──────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: UserRole,
  specialty: z.string().max(100).nullable().optional(),
  contractHoursWeek: z.number().int().min(0).max(80).default(40),
  departmentId: z.string().uuid().nullable().optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial().omit({
  password: true,
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/** Self-service profile update (collaborators / own account). */
export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  specialty: z.string().max(100).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: UserRole,
  specialty: z.string().nullable(),
  contractHoursWeek: z.number(),
  departmentId: z.string().uuid().nullable(),
  avatarUrl: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// ─── Department Schemas ────────────────────────────────────────────────────────

export const CreateDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
});
export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;

export const DepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
});
export type Department = z.infer<typeof DepartmentSchema>;

// ─── Shift Schemas ─────────────────────────────────────────────────────────────

export const CreateShiftSchema = z.object({
  name: z.string().min(2).max(100),
  departmentId: z.string().uuid(),
  startDatetime: z.string().datetime(),
  endDatetime: z.string().datetime(),
  requiredSpecialty: z.string().max(100).nullable().optional(),
  requiredCount: z.number().int().min(1).default(1),
});
export type CreateShiftInput = z.infer<typeof CreateShiftSchema>;

export const ShiftSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  departmentId: z.string().uuid(),
  startDatetime: z.string().datetime(),
  endDatetime: z.string().datetime(),
  requiredSpecialty: z.string().nullable(),
  requiredCount: z.number(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Shift = z.infer<typeof ShiftSchema>;

export const AssignShiftSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});
export type AssignShiftInput = z.infer<typeof AssignShiftSchema>;

/** Gestor marca presença no turno (sem fluxo de motivo / RH). */
export const MarkShiftAttendanceSchema = z.object({
  present: z.boolean(),
});
export type MarkShiftAttendanceInput = z.infer<
  typeof MarkShiftAttendanceSchema
>;

// ─── Absence Schemas ───────────────────────────────────────────────────────────

export const CreateAbsenceSchema = z.object({
  shiftAssignmentId: z.string().uuid(),
  type: AbsenceType,
  reason: z.string().max(500).optional(),
});
export type CreateAbsenceInput = z.infer<typeof CreateAbsenceSchema>;

export const AbsenceSchema = z.object({
  id: z.string().uuid(),
  shiftAssignmentId: z.string().uuid(),
  userId: z.string().uuid(),
  type: AbsenceType,
  reason: z.string().nullable(),
  reportedAt: z.string().datetime(),
  approvedBy: z.string().uuid().nullable(),
});
export type Absence = z.infer<typeof AbsenceSchema>;

// ─── Coverage Schemas ──────────────────────────────────────────────────────────

export const CoverageRespondSchema = z.object({
  response: z.enum(["ACCEPTED", "DECLINED"]),
});
export type CoverageRespondInput = z.infer<typeof CoverageRespondSchema>;

export const CoverageRequestSchema = z.object({
  id: z.string().uuid(),
  absenceId: z.string().uuid(),
  status: CoverageRequestStatus,
  createdAt: z.string().datetime(),
});
export type CoverageRequest = z.infer<typeof CoverageRequestSchema>;

// ─── Availability Schemas ──────────────────────────────────────────────────────

export const AvailabilityPeriodEnum = z.enum([
  "MORNING",
  "AFTERNOON",
  "NIGHT",
]);
export type AvailabilityPeriod = z.infer<typeof AvailabilityPeriodEnum>;

export const AvailabilitySlotSchema = z.object({
  dayOfWeek: DayOfWeek,
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  period: AvailabilityPeriodEnum.optional(),
});
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

export const SetAvailabilitySchema = z.object({
  slots: z.array(AvailabilitySlotSchema),
});
export type SetAvailabilityInput = z.infer<typeof SetAvailabilitySchema>;

export const LeaveBlockStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
export type LeaveBlockStatus = z.infer<typeof LeaveBlockStatusEnum>;

export const CreateLeaveBlockSchema = z.object({
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: AbsenceType,
  status: LeaveBlockStatusEnum.optional().default("APPROVED"),
  reason: z.string().max(500).optional(),
});
export type CreateLeaveBlockInput = z.infer<typeof CreateLeaveBlockSchema>;

export const UpdateLeaveBlockSchema = z.object({
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: AbsenceType.optional(),
  status: LeaveBlockStatusEnum.optional(),
  reason: z.string().max(500).nullable().optional(),
});
export type UpdateLeaveBlockInput = z.infer<typeof UpdateLeaveBlockSchema>;

// ─── Notification Schemas ──────────────────────────────────────────────────────

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: NotificationType,
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// ─── WebSocket Events ──────────────────────────────────────────────────────────

export type WsEventType =
  | "notification"
  | "coverage_request"
  | "coverage_filled"
  | "shift_updated"
  | "ping";

export interface WsMessage<T = unknown> {
  event: WsEventType;
  data: T;
  timestamp: string;
}

// ─── API Response Wrapper ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// ─── Pagination Query ──────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationSchema>;

// ─── Admin / Master Schemas ────────────────────────────────────────────────────

export const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

export const SubscriptionStatus = z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const PaymentStatus = z.enum(["PENDING", "PAID", "OVERDUE"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  priceMonthly: z.string(),
  maxUsers: z.number(),
  maxDepartments: z.number(),
  maxShiftsPerMonth: z.number(),
  features: z.record(z.unknown()).nullable().optional(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
  status: SubscriptionStatus,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  autoRenew: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  subscriptionId: z.string().uuid().nullable().optional(),
  amount: z.string(),
  currency: z.string(),
  status: PaymentStatus,
  method: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const RecordPaymentSchema = z.object({
  tenantId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  amount: z.string(),
  currency: z.string().default("AOA"),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  markPaid: z.boolean().default(false),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

export interface AdminDashboardStats {
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
  };
  payments: {
    pending: number;
    overdue: number;
  };
  recentTenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
  }>;
}
