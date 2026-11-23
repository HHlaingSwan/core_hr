import { pgTable, text, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    key: text("key").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    responseBody: text("response_body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("idx_idempotency_user").on(table.userId),
    index("idx_idempotency_expires").on(table.expiresAt),
  ]
);
