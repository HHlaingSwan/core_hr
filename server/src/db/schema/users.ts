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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { roles } from "./permissions";


export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    parentDepartmentId: uuid("parent_department_id"),
    leadId: uuid("lead_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_departments_org").on(table.orgId),
  ]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    isOrgAdmin: boolean("is_org_admin").default(false).notNull(),
    branchId: uuid("branch_id"), // Base / Assigned Branch Location
    employeeCode: text("employee_code").notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("employee"), // 'employee' | 'manager' | 'hr' | 'payroll' | 'admin'
    roleId: uuid("role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    departmentName: text("department_name"),
    designation: text("designation"),
    managerId: uuid("manager_id"),
    managerName: text("manager_name"),
    employmentType: text("employment_type").default("Permanent"),
    startDate: date("start_date"),
    nrcNumber: text("nrc_number"),
    ssbNumber: text("ssb_number"),
    taxNumber: text("tax_number"),
    bankName: text("bank_name"),
    bankAccountNumber: text("bank_account_number"),
    baseSalary: numeric("base_salary", { precision: 12, scale: 2 }).default("0"),
    allowances: numeric("allowances", { precision: 12, scale: 2 }).default("0"),
    hourlyRate: numeric("hourly_rate", { precision: 12, scale: 2 }).default("0"),
    active: boolean("active").default(true).notNull(),
    permissions: text("permissions").array(),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
    tempPassword: text("temp_password"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_users_org_role").on(table.orgId, table.role),
    index("idx_users_role_id").on(table.roleId),
    index("idx_users_manager").on(table.managerId),
    index("idx_users_branch").on(table.branchId),
  ]
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    isRevoked: boolean("is_revoked").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_refresh_tokens_user").on(table.userId),
  ]
);

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [departments.orgId],
    references: [organizations.id],
  }),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  assignedRole: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
    relationName: "manager_subordinates",
  }),
  subordinates: many(users, {
    relationName: "manager_subordinates",
  }),
  refreshTokens: many(refreshTokens),
}));
