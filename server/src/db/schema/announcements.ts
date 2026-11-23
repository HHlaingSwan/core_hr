import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  authorityGroup: text("authority_group").notNull(),
  authorityCode: text("authority_code").notNull(), // 'MD' | 'HR' | 'ENG'
  directiveNo: text("directive_no").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  fullBody: text("full_body").notNull(),
  date: text("date").notNull(),
  issuer: text("issuer").notNull(),
  priority: text("priority").default("Standard").notNull(), // 'Urgent' | 'Standard'
  status: text("status").default("Published").notNull(), // 'Draft' | 'Published' | 'Archived'
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcementReads = pgTable("announcement_reads", {
  id: uuid("id").defaultRandom().primaryKey(),
  announcementId: uuid("announcement_id")
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").defaultNow().notNull(),
});

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [announcements.orgId],
    references: [organizations.id],
  }),
  reads: many(announcementReads),
}));

export const announcementReadsRelations = relations(announcementReads, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcementReads.announcementId],
    references: [announcements.id],
  }),
  user: one(users, {
    fields: [announcementReads.userId],
    references: [users.id],
  }),
}));
