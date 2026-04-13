import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { institutions } from "./admin";

// ─── academic_years ─────────────────────────────────
export const academicYears = sqliteTable("academic_years", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().references(() => institutions.id),
  label: text("label"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: integer("is_active").default(0),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("academic_years_institution_label_idx").on(table.institutionId, table.label),
]);

// ─── period_configs ─────────────────────────────────
export const periodConfigs = sqliteTable("period_configs", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().unique().references(() => institutions.id),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── timetable_entries ──────────────────────────────
export const timetableEntries = sqliteTable("timetable_entries", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").references(() => institutions.id),
  staffId: text("staff_id"),
  classId: text("class_id"),
  gradeBookId: text("grade_book_id"),
  periodNumber: integer("period_number"),
  dayOfWeek: integer("day_of_week"),
  isRecurring: integer("is_recurring").default(1),
  specificDate: text("specific_date"),
  notes: text("notes"),
  status: text("status", { enum: ["scheduled", "completed", "cancelled"] }).default("scheduled"),
  completedAt: text("completed_at"),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── institution_settings ───────────────────────────
export const institutionSettings = sqliteTable("institution_settings", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").unique().references(() => institutions.id),
  language: text("language").default("en"),
  timezone: text("timezone"),
  dateFormat: text("date_format"),
  currency: text("currency").default("INR"),
  enableStudentPortal: integer("enable_student_portal").default(0),
  enableParentPortal: integer("enable_parent_portal").default(0),
  passingMarks: integer("passing_marks"),
  notifyEmail: integer("notify_email").default(1),
  notifySms: integer("notify_sms").default(0),
  notifyPush: integer("notify_push").default(1),
  notifyAttendanceAlerts: integer("notify_attendance_alerts").default(1),
  notifyGradeUpdates: integer("notify_grade_updates").default(1),
  sessionTimeout: integer("session_timeout").default(30),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── user_preferences ───────────────────────────────
export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userModel: text("user_model", { enum: ["Admin", "Staff"] }).notNull(),
  institutionId: text("institution_id").references(() => institutions.id),
  language: text("language"),
  theme: text("theme", { enum: ["light", "dark", "system"] }).default("system"),
  notifyEmail: integer("notify_email").default(1),
  notifySms: integer("notify_sms").default(0),
  notifyPush: integer("notify_push").default(1),
  notifyAttendanceAlerts: integer("notify_attendance_alerts").default(1),
  notifyGradeUpdates: integer("notify_grade_updates").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("user_preferences_user_model_idx").on(table.userId, table.userModel),
]);

// ─── otp_counts ─────────────────────────────────────
export const otpCounts = sqliteTable("otp_counts", {
  id: text("id").primaryKey(),
  month: integer("month"),
  year: integer("year"),
  count: integer("count").default(0),
});
