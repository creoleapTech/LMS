import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { staff } from "./admin";

// ─── class_sessions ─────────────────────────────────
export const classSessions = sqliteTable("class_sessions", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").references(() => staff.id),
  institutionId: text("institution_id"),
  classId: text("class_id"),
  courseId: text("course_id"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  durationMinutes: integer("duration_minutes"),
  remarks: text("remarks"),
  status: text("status", { enum: ["ongoing", "completed"] }).default("ongoing"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── teaching_progress ──────────────────────────────
export const teachingProgress = sqliteTable("teaching_progress", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").references(() => staff.id),
  classId: text("class_id"),
  gradeBookId: text("grade_book_id"),
  institutionId: text("institution_id"),
  overallPercentage: real("overall_percentage").default(0),
  lastAccessedContentId: text("last_accessed_content_id"),
  lastAccessedAt: text("last_accessed_at"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("teaching_progress_staff_class_gradebook_idx").on(
    table.staffId,
    table.classId,
    table.gradeBookId,
  ),
]);
