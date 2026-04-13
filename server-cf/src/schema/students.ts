import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

// ─── student_progress ───────────────────────────────
export const studentProgress = sqliteTable("student_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  curriculumId: text("curriculum_id"),
  grade: integer("grade"),
  chapterId: text("chapter_id"),
  lastWatchedAt: text("last_watched_at"),
  progressPercentage: real("progress_percentage").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("student_progress_user_curriculum_grade_idx").on(
    table.userId,
    table.curriculumId,
    table.grade,
  ),
]);
