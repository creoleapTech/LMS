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
    isUnlimited: integer("is_unlimited").default(0),
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

export const leaplabProjects = sqliteTable(
  "leaplab_projects",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id").notNull().references(() => institutions.id),
    credentialId: text("credential_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    mode: text("mode").notNull(),
    fileKey: text("file_key"),
    thumbnailKey: text("thumbnail_key"),
    metadata: text("metadata"),
    isShared: integer("is_shared").default(0),
    shareId: text("share_id"),
    sharePermission: text("share_permission"),
    isActive: integer("is_active").default(1),
    isDeleted: integer("is_deleted").default(0),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (table) => [
    index("leaplab_projects_institution_id_idx").on(table.institutionId),
    index("leaplab_projects_credential_id_idx").on(table.credentialId),
    index("leaplab_projects_mode_idx").on(table.mode),
    index("leaplab_projects_is_deleted_idx").on(table.isDeleted),
    uniqueIndex("leaplab_projects_share_id_idx")
      .on(table.shareId)
      .where(sql`"share_id" IS NOT NULL`),
  ],
);
