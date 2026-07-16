import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
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
  status: text("status", { enum: ["ongoing", "paused", "in_progress", "completed"] }).default("ongoing"),
  pausedAt: text("paused_at"),
  totalPausedMs: integer("total_paused_ms").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("class_sessions_staff_id_idx").on(table.staffId),
  index("class_sessions_institution_id_idx").on(table.institutionId),
  index("class_sessions_class_id_idx").on(table.classId),
  index("class_sessions_status_updated_at_idx").on(table.status, table.updatedAt),
]);

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
  index("teaching_progress_institution_id_idx").on(table.institutionId),
  index("teaching_progress_staff_id_idx").on(table.staffId),
  index("teaching_progress_class_id_idx").on(table.classId),
  index("teaching_progress_grade_book_id_idx").on(table.gradeBookId),
]);

// ─── class_session_logs ──────────────────────────────
export const classSessionLogs = sqliteTable("class_session_logs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  staffId: text("staff_id").references(() => staff.id),
  action: text("action").notNull(),
  statusFrom: text("status_from"),
  statusTo: text("status_to"),
  timestamp: text("timestamp").notNull(),
  durationMinutes: integer("duration_minutes"),
  remarks: text("remarks"),
  topicsCovered: text("topics_covered"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => [
  index("class_session_logs_session_id_idx").on(table.sessionId),
  index("class_session_logs_staff_id_idx").on(table.staffId),
]);

