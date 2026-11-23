import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

export const overtimeRecords = pgTable("overtime_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
  rateMultiplier: numeric("rate_multiplier", { precision: 3, scale: 2 }).default("2.00").notNull(),
  reason: text("reason").notNull(),
  status: text("status").default("pending_manager").notNull(), // 'pending_manager' | 'approved' | 'rejected' | 'payroll_ready' | 'paid'
  approvedBy: uuid("approved_by").references(() => users.id),
  rejectReason: text("reject_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenseClaims = pgTable("expense_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(), // 'Travel' | 'Meals' | 'Medical' | 'OfficeSupplies' | 'Training' | 'Other'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("MMK").notNull(),
  expenseDate: date("expense_date").notNull(),
  receiptUrl: text("receipt_url"),
  status: text("status").default("Submitted").notNull(), // 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Reimbursed'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenseClaimsRelations = relations(expenseClaims, ({ one }) => ({
  user: one(users, {
    fields: [expenseClaims.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [expenseClaims.orgId],
    references: [organizations.id],
  }),
}));

export const overtimeRecordsRelations = relations(overtimeRecords, ({ one }) => ({
  user: one(users, {
    fields: [overtimeRecords.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [overtimeRecords.orgId],
    references: [organizations.id],
  }),
}));
