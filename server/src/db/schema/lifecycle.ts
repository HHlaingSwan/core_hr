import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

export const performanceReviews = pgTable("performance_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cycle: text("cycle").notNull(), // e.g. "2026-Q3"
  kpiScore: integer("kpi_score").notNull(), // 0-100
  rating: text("rating").notNull(), // 'Exceeds Expectations' | 'Meets Expectations' | 'Needs Improvement'
  bonusPercentage: numeric("bonus_percentage", { precision: 5, scale: 2 }).default("0").notNull(),
  feedback: text("feedback"),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
});

export const disciplinaryRecords = pgTable("disciplinary_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  incidentDate: date("incident_date").notNull(),
  severity: text("severity").notNull(), // 'Verbal Warning' | 'First Written Warning' | 'Second Written Warning' | 'Final Warning'
  title: text("title").notNull(),
  description: text("description").notNull(),
  actionTaken: text("action_taken").notNull(),
  issuedBy: text("issued_by").notNull(),
  acknowledged: boolean("acknowledged").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const finalSettlements = pgTable("final_settlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  resignationDate: date("resignation_date").notNull(),
  lastWorkingDate: date("last_working_date").notNull(),
  noticePeriodDays: integer("notice_period_days").default(30).notNull(),
  baseSalary: numeric("base_salary", { precision: 12, scale: 2 }).notNull(),
  proratedSalary: numeric("prorated_salary", { precision: 12, scale: 2 }).default("0").notNull(),
  unusedLeaveDays: numeric("unused_leave_days", { precision: 5, scale: 2 }).default("0").notNull(),
  leaveEncashmentPay: numeric("leave_encashment_pay", { precision: 12, scale: 2 }).default("0").notNull(),
  outstandingLoanDeduction: numeric("outstanding_loan_deduction", { precision: 12, scale: 2 }).default("0").notNull(),
  assetClearanceDeduction: numeric("asset_clearance_deduction", { precision: 12, scale: 2 }).default("0").notNull(),
  severancePay: numeric("severance_pay", { precision: 12, scale: 2 }).default("0").notNull(),
  netFinalSettlement: numeric("net_final_settlement", { precision: 12, scale: 2 }).notNull(),
  status: text("status").default("Draft").notNull(), // 'Draft' | 'Approved' | 'Disbursed'
  settledAt: timestamp("settled_at"),
});

export const performanceReviewsRelations = relations(performanceReviews, ({ one }) => ({
  user: one(users, {
    fields: [performanceReviews.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [performanceReviews.orgId],
    references: [organizations.id],
  }),
}));

export const disciplinaryRecordsRelations = relations(disciplinaryRecords, ({ one }) => ({
  user: one(users, {
    fields: [disciplinaryRecords.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [disciplinaryRecords.orgId],
    references: [organizations.id],
  }),
}));

export const finalSettlementsRelations = relations(finalSettlements, ({ one }) => ({
  user: one(users, {
    fields: [finalSettlements.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [finalSettlements.orgId],
    references: [organizations.id],
  }),
}));
