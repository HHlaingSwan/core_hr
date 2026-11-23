import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  date,
  time,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

export const officeLocations = pgTable(
  "office_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"), // e.g. "YGN-HQ", "MDY-01", "NPT-CC", "OPS-DEV"
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    radiusMeters: integer("radius_meters").default(200).notNull(),
    address: text("address"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_office_org_active").on(table.orgId, table.isActive),
  ]
);

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startTime: time("start_time").notNull(), // e.g. "09:00:00"
  endTime: time("end_time").notNull(), // e.g. "17:00:00"
  gracePeriodMinutes: integer("grace_period_minutes").default(15).notNull(),
  breakMinutes: integer("break_minutes").default(60).notNull(),
});

export const shiftAssignments = pgTable("shift_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
});

export const attendancePunches = pgTable(
  "attendance_punches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    punchType: text("punch_type").notNull(), // 'check_in' | 'check_out'
    punchTime: timestamp("punch_time").defaultNow().notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    accuracy: numeric("accuracy", { precision: 6, scale: 2 }),
    distanceMeters: integer("distance_meters"), // Distance in meters to closest branch
    branchId: uuid("branch_id").references(() => officeLocations.id, { onDelete: "set null" }),
    isOutsideGeofence: boolean("is_outside_geofence").default(false).notNull(),
    isMockLocation: boolean("is_mock_location").default(false).notNull(),
    deviceId: text("device_id"),
    photoUrl: text("photo_url"),
    note: text("note"), // Remote reason or remark from employee
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_punches_user_time").on(table.userId, table.punchTime),
    index("idx_punches_org_time").on(table.orgId, table.punchTime),
  ]
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => officeLocations.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    status: text("status").notNull().default("present"), // 'present' | 'remote' | 'late' | 'undertime' | 'absent' | 'on_leave'
    clockInTime: time("clock_in_time"),
    clockOutTime: time("clock_out_time"),
    workMinutes: integer("work_minutes").default(0),
    lateMinutes: integer("late_minutes").default(0),
    undertimeMinutes: integer("undertime_minutes").default(0),
    overtimeMinutes: integer("overtime_minutes").default(0),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    accuracy: numeric("accuracy", { precision: 6, scale: 2 }),
    locationName: text("location_name"),
    deviceId: text("device_id"),
    ipAddress: text("ip_address"),
    source: text("source").default("mobile_geo"), // 'mobile_geo' | 'web_geo' | 'biometric' | 'ip_office' | 'manual'
    isRegularized: boolean("is_regularized").default(false).notNull(),
    regularizedBy: uuid("regularized_by").references(() => users.id),
    regularizeReason: text("regularize_reason"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_attendance_user_date").on(table.userId, table.date),
    index("idx_attendance_org_date").on(table.orgId, table.date),
  ]
);

export const officeLocationsRelations = relations(officeLocations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [officeLocations.orgId],
    references: [organizations.id],
  }),
  punches: many(attendancePunches),
  records: many(attendanceRecords),
}));

export const attendancePunchesRelations = relations(attendancePunches, ({ one }) => ({
  user: one(users, {
    fields: [attendancePunches.userId],
    references: [users.id],
  }),
  branch: one(officeLocations, {
    fields: [attendancePunches.branchId],
    references: [officeLocations.id],
  }),
  organization: one(organizations, {
    fields: [attendancePunches.orgId],
    references: [organizations.id],
  }),
}));

export const attendanceRelations = relations(attendanceRecords, ({ one }) => ({
  user: one(users, {
    fields: [attendanceRecords.userId],
    references: [users.id],
  }),
  branch: one(officeLocations, {
    fields: [attendanceRecords.branchId],
    references: [officeLocations.id],
  }),
  organization: one(organizations, {
    fields: [attendanceRecords.orgId],
    references: [organizations.id],
  }),
}));

export const attendanceRegularizations = pgTable(
  "attendance_regularizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attendanceRecordId: uuid("attendance_record_id").references(() => attendanceRecords.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    requestedClockIn: time("requested_clock_in"),
    requestedClockOut: time("requested_clock_out"),
    reason: text("reason").notNull(),
    status: text("status").default("pending").notNull(), // 'pending' | 'approved' | 'rejected'
    approverId: uuid("approver_id").references(() => users.id, { onDelete: "set null" }),
    approverComment: text("approver_comment"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_att_reg_user").on(table.userId),
    index("idx_att_reg_org_status").on(table.orgId, table.status),
    index("idx_att_reg_date").on(table.date),
  ]
);

export const attendanceRegularizationsRelations = relations(attendanceRegularizations, ({ one }) => ({
  user: one(users, {
    fields: [attendanceRegularizations.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [attendanceRegularizations.approverId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [attendanceRegularizations.orgId],
    references: [organizations.id],
  }),
  attendanceRecord: one(attendanceRecords, {
    fields: [attendanceRegularizations.attendanceRecordId],
    references: [attendanceRecords.id],
  }),
}));

