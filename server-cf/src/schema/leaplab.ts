import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { institutions } from "./admin";

export const leaplabCredentials = sqliteTable(
  "leaplab_credentials",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id").notNull().references(() => institutions.id),
    username: text("username").notNull(),
    password: text("password").notNull(),
    isActive: integer("is_active").default(1),
    isDeleted: integer("is_deleted").default(0),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (table) => [
    uniqueIndex("leaplab_credentials_institution_username_idx")
      .on(table.institutionId, table.username)
      .where(sql`"is_deleted" = 0`),
    index("leaplab_credentials_institution_id_idx").on(table.institutionId),
    index("leaplab_credentials_is_deleted_idx").on(table.isDeleted),
    index("leaplab_credentials_is_active_idx").on(table.isActive),
  ],
);
