import {
  pgTable,
  uuid,
  text,
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

export const payRuns = pgTable(
  "pay_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    cutoffDate: date("cutoff_date").notNull(),
    payDate: date("pay_date").notNull(),
    totalGross: numeric("total_gross", { precision: 14, scale: 2 }).default("0").notNull(),
    totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }).default("0").notNull(),
    totalNet: numeric("total_net", { precision: 14, scale: 2 }).default("0").notNull(),
    totalSsbEmployer: numeric("total_ssb_employer", { precision: 14, scale: 2 }).default("0").notNull(),
    totalSsbEmployee: numeric("total_ssb_employee", { precision: 14, scale: 2 }).default("0").notNull(),
    totalTax: numeric("total_tax", { precision: 14, scale: 2 }).default("0").notNull(),
    status: text("status").default("draft").notNull(), // 'draft' | 'approved' | 'disbursed'
    approvedBy: uuid("approved_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_payruns_org_year_month").on(table.orgId, table.year, table.month),
  ]
);

export const payslips = pgTable(
  "payslips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    payRunId: uuid("pay_run_id").references(() => payRuns.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    monthName: text("month_name").notNull(),
    payDate: date("pay_date").notNull(),
    baseSalary: numeric("base_salary", { precision: 12, scale: 2 }).default("0").notNull(),
    allowances: numeric("allowances", { precision: 12, scale: 2 }).default("0").notNull(),
    overtimeHours: numeric("overtime_hours", { precision: 5, scale: 2 }).default("0").notNull(),
    overtimePay: numeric("overtime_pay", { precision: 12, scale: 2 }).default("0").notNull(),
    claimsReimbursement: numeric("claims_reimbursement", { precision: 12, scale: 2 }).default("0").notNull(),
    performanceBonus: numeric("performance_bonus", { precision: 12, scale: 2 }).default("0").notNull(),
    grossEarnings: numeric("gross_earnings", { precision: 12, scale: 2 }).default("0").notNull(),
    lateDeduction: numeric("late_deduction", { precision: 12, scale: 2 }).default("0").notNull(),
    undertimeDeduction: numeric("undertime_deduction", { precision: 12, scale: 2 }).default("0").notNull(),
    unpaidLeaveDeduction: numeric("unpaid_leave_deduction", { precision: 12, scale: 2 }).default("0").notNull(),
    ssbEmployee: numeric("ssb_employee", { precision: 12, scale: 2 }).default("0").notNull(),
    ssbEmployer: numeric("ssb_employer", { precision: 12, scale: 2 }).default("0").notNull(),
    incomeTax: numeric("income_tax", { precision: 12, scale: 2 }).default("0").notNull(),
    loanInstallment: numeric("loan_installment", { precision: 12, scale: 2 }).default("0").notNull(),
    totalDeductions: numeric("total_deductions", { precision: 12, scale: 2 }).default("0").notNull(),
    netPay: numeric("net_pay", { precision: 12, scale: 2 }).default("0").notNull(),
    currency: text("currency").default("MMK").notNull(),
    status: text("status").default("Paid").notNull(), // 'Draft' | 'Approved' | 'Processing' | 'Disbursed' | 'Paid' | 'Held'
    bankName: text("bank_name"),
    bankAccountMasked: text("bank_account_masked"),
    taxNumberMasked: text("tax_number_masked"),
    downloadUrl: text("download_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_payslips_user_year_month").on(table.userId, table.year, table.month),
    index("idx_payslips_org_date").on(table.orgId, table.payDate),
  ]
);

export const payslipItems = pgTable(
  "payslip_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payslipId: uuid("payslip_id")
      .notNull()
      .references(() => payslips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    category: text("category").notNull(), // 'Earning' | 'Deduction'
  },
  (table) => [
    index("idx_payslip_items_payslip").on(table.payslipId),
  ]
);

export const employeeLoans = pgTable(
  "employee_loans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    loanType: text("loan_type").notNull(), // 'Salary Advance' | 'Company Loan' | 'Emergency Aid'
    principalAmount: numeric("principal_amount", { precision: 12, scale: 2 }).notNull(),
    monthlyInstallment: numeric("monthly_installment", { precision: 12, scale: 2 }).notNull(),
    remainingBalance: numeric("remaining_balance", { precision: 12, scale: 2 }).notNull(),
    termMonths: integer("term_months").notNull(),
    paidMonths: integer("paid_months").default(0).notNull(),
    disbursedDate: date("disbursed_date").notNull(),
    status: text("status").default("Active").notNull(), // 'Active' | 'Completed' | 'Suspended'
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_employee_loans_user").on(table.userId),
  ]
);

export const payRunsRelations = relations(payRuns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [payRuns.orgId],
    references: [organizations.id],
  }),
  payslips: many(payslips),
}));

export const payslipsRelations = relations(payslips, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [payslips.orgId],
    references: [organizations.id],
  }),
  payRun: one(payRuns, {
    fields: [payslips.payRunId],
    references: [payRuns.id],
  }),
  user: one(users, {
    fields: [payslips.userId],
    references: [users.id],
  }),
  items: many(payslipItems),
}));

export const payslipItemsRelations = relations(payslipItems, ({ one }) => ({
  payslip: one(payslips, {
    fields: [payslipItems.payslipId],
    references: [payslips.id],
  }),
}));

export const employeeLoansRelations = relations(employeeLoans, ({ one }) => ({
  organization: one(organizations, {
    fields: [employeeLoans.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [employeeLoans.userId],
    references: [users.id],
  }),
}));
