import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, departments } from "./users";
import { officeLocations, attendanceRecords, attendancePunches } from "./attendance";
import { leaveRequests, publicHolidays } from "./leaves";
import { payRuns, payslips } from "./payroll";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // e.g. "KBZG", "OMNI"
  currency: text("currency").default("MMK").notNull(),
  status: text("status").default("active").notNull(), // 'active' | 'suspended' | 'trial' | 'pending'
  plan: text("plan").default("standard").notNull(), // 'starter' | 'standard' | 'enterprise'
  maxEmployees: integer("max_employees").default(50).notNull(),
  taxId: text("tax_id"),
  phone: text("phone"),
  address: text("address"),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  departments: many(departments),
  branches: many(officeLocations),
  attendancePunches: many(attendancePunches),
  attendanceRecords: many(attendanceRecords),
  leaveRequests: many(leaveRequests),
  publicHolidays: many(publicHolidays),
  payRuns: many(payRuns),
  payslips: many(payslips),
}));
