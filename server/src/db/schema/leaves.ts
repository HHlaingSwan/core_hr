import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

export const publicHolidays = pgTable(
  "public_holidays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Thingyan Water Festival", "Thadingyut Full Moon"
    date: date("date").notNull(),
    year: integer("year").notNull(),
    isSubstitute: boolean("is_substitute").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_holidays_org_date").on(table.orgId, table.date),
  ]
);

export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leaveType: text("leave_type").notNull(), // 'casual' | 'medical' | 'earned' | 'maternity' | 'paternity' | 'unpaid' | 'compassionate' | 'study'
    year: integer("year").notNull(),
    allocatedDays: numeric("allocated_days", { precision: 5, scale: 2 }).default("0").notNull(),
    usedDays: numeric("used_days", { precision: 5, scale: 2 }).default("0").notNull(),
    pendingDays: numeric("pending_days", { precision: 5, scale: 2 }).default("0").notNull(),
    carriedOverDays: numeric("carried_over_days", { precision: 5, scale: 2 }).default("0").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_leave_user_type_year").on(table.userId, table.leaveType, table.year),
    index("idx_leave_balances_org").on(table.orgId),
  ]
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leaveType: text("leave_type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isHalfDay: boolean("is_half_day").default(false).notNull(),
    halfDayPeriod: text("half_day_period"), // 'Morning' | 'Afternoon' | 'am' | 'pm'
    daysCount: numeric("days_count", { precision: 5, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending_manager"), // 'draft' | 'pending_manager' | 'approved' | 'pending_hr' | 'sent_payroll' | 'rejected' | 'cancelled'
    approverId: uuid("approver_id").references(() => users.id),
    managerComment: text("manager_comment"),
    hrVerified: boolean("hr_verified").default(false).notNull(),
    hrVerifiedBy: uuid("hr_verified_by").references(() => users.id),
    hrComment: text("hr_comment"),
    hrOverrideById: uuid("hr_override_by_id").references(() => users.id), // Option C emergency override
    hrOverrideReason: text("hr_override_reason"),
    attachmentUrl: text("attachment_url"),
    rejectReason: text("reject_reason"),
    version: integer("version").default(1).notNull(),
    appliedOn: timestamp("applied_on").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_leave_approver_status").on(table.approverId, table.status),
    index("idx_leave_user_applied").on(table.userId, table.appliedOn),
    index("idx_leave_org_status").on(table.orgId, table.status),
  ]
);

export const leaveAuditLogs = pgTable(
  "leave_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => leaveRequests.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(), // 'SUBMIT' | 'APPROVE' | 'REJECT' | 'HR_OVERRIDE_APPROVE' | 'CANCEL'
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_leave_audit_request").on(table.requestId),
  ]
);

export const publicHolidaysRelations = relations(publicHolidays, ({ one }) => ({
  organization: one(organizations, {
    fields: [publicHolidays.orgId],
    references: [organizations.id],
  }),
}));

export const leaveBalancesRelations = relations(leaveBalances, ({ one }) => ({
  user: one(users, {
    fields: [leaveBalances.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [leaveBalances.orgId],
    references: [organizations.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [leaveRequests.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [leaveRequests.approverId],
    references: [users.id],
  }),
  hrOverrideBy: one(users, {
    fields: [leaveRequests.hrOverrideById],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [leaveRequests.orgId],
    references: [organizations.id],
  }),
  auditLogs: many(leaveAuditLogs),
}));

export const leaveAuditLogsRelations = relations(leaveAuditLogs, ({ one }) => ({
  request: one(leaveRequests, {
    fields: [leaveAuditLogs.requestId],
    references: [leaveRequests.id],
  }),
  actor: one(users, {
    fields: [leaveAuditLogs.actorId],
    references: [users.id],
  }),
}));
