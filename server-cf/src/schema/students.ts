import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

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
  index("student_progress_user_id_idx").on(table.userId),
  index("student_progress_curriculum_id_idx").on(table.curriculumId),
  index("student_progress_grade_idx").on(table.grade),
  index("student_progress_chapter_id_idx").on(table.chapterId),
]);
