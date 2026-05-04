import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const tenantStatusEnum = pgEnum("tenant_status", [
  "ACTIVE",
  "SUSPENDED",
  "TRIAL",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "OVERDUE",
]);

export const paymentSubmissionStatusEnum = pgEnum("payment_submission_status", [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
]);

// ─── Plans ─────────────────────────────────────────────────────────────────────

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // FREE | STARTER | PRO | ENTERPRISE
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  maxUsers: integer("max_users").notNull().default(5),
  maxDepartments: integer("max_departments").notNull().default(2),
  maxShiftsPerMonth: integer("max_shifts_per_month").notNull().default(50),
  features: jsonb("features").default("{}"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

// ─── Tenants ────────────────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: tenantStatusEnum("status").notNull().default("TRIAL"),
  dbName: text("db_name").notNull().unique(), // mediscala_{slug}
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  nif: text("nif"),
  address: text("address"),
  areaOfActivity: text("area_of_activity"),
  logoUrl: text("logo_url"),
  brandDisplayMode: text("brand_display_mode").notNull().default("LOGO_AND_NAME"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

// ─── Super Admins ───────────────────────────────────────────────────────────────

export const superAdmins = pgTable("super_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SuperAdmin = typeof superAdmins.$inferSelect;
export type NewSuperAdmin = typeof superAdmins.$inferInsert;

// ─── Subscriptions ──────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  autoRenew: boolean("auto_renew").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

// ─── Payments ───────────────────────────────────────────────────────────────────

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  requestedPlanId: uuid("requested_plan_id").references(() => plans.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("AOA"),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  submissionStatus: paymentSubmissionStatusEnum("submission_status")
    .notNull()
    .default("APPROVED"),
  method: text("method"), // transfer, cash, mpesa, etc.
  reference: text("reference"),
  proofUrl: text("proof_url"),
  submittedByUserId: uuid("submitted_by_user_id"),
  reviewedBySuperAdminId: uuid("reviewed_by_super_admin_id").references(
    () => superAdmins.id,
  ),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewReason: text("review_reason"),
  notes: text("notes"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// ─── User Lookups ────────────────────────────────────────────────────────────────
// Fast cross-tenant lookup: email → tenant slug, user id → tenant slug

export const userLookups = pgTable("user_lookups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  userId: uuid("user_id").notNull(),
  tenantSlug: text("tenant_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserLookup = typeof userLookups.$inferSelect;
export type NewUserLookup = typeof userLookups.$inferInsert;
