import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const leapblocksVersions = sqliteTable(
  "leapblocks_versions",
  {
    id: text("id").primaryKey(),
    version: text("version").notNull(),
    exeKey: text("exe_key").notNull(),
    latestYmlKey: text("latest_yml_key"),
    blockmapKey: text("blockmap_key"),
    sha512: text("sha512"),
    releaseNotes: text("release_notes"),
    isLatest: integer("is_latest").default(1),
    createdAt: text("created_at"),
  },
  (table) => [
    index("leapblocks_versions_is_latest_idx").on(table.isLatest),
  ],
);
