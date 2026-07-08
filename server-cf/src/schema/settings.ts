import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { institutions, staff } from "./admin";

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
  index("academic_years_institution_id_idx").on(table.institutionId),
]);

// ─── period_configs ─────────────────────────────────
export const periodConfigs = sqliteTable("period_configs", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().unique().references(() => institutions.id),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("period_configs_institution_id_idx").on(table.institutionId),
  index("period_configs_is_deleted_idx").on(table.isDeleted),
]);

// ─── timetable_entries ──────────────────────────────
export const timetableEntries = sqliteTable("timetable_entries", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").references(() => institutions.id),
  staffId: text("staff_id"),
  classId: text("class_id"),
  additionalClassId: text("additional_class_id"),
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
}, (table) => [
  index("timetable_entries_staff_id_idx").on(table.staffId),
  index("timetable_entries_institution_id_idx").on(table.institutionId),
  index("timetable_entries_is_deleted_idx").on(table.isDeleted),
  index("timetable_entries_is_recurring_idx").on(table.isRecurring),
  index("timetable_entries_day_of_week_idx").on(table.dayOfWeek),
  index("timetable_entries_specific_date_idx").on(table.specificDate),
]);

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
  generateStudentCredentials: integer("generate_student_credentials").default(0),
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
}, (table) => [
  index("institution_settings_institution_id_idx").on(table.institutionId),
]);

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

// ─── report_submissions ─────────────────────────────
export const reportSubmissions = sqliteTable("report_submissions", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staff.id),
  institutionId: text("institution_id").notNull().references(() => institutions.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  status: text("status", { enum: ["draft", "submitted"] }).default("submitted"),
  reportData: text("report_data"),
  docxKey: text("docx_key"),
  submittedAt: text("submitted_at"),
  adminApproval: text("admin_approval", { enum: ["pending", "verified", "rejected"] }).default("pending"),
  adminComment: text("admin_comment"),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("report_submissions_staff_year_month_idx").on(table.staffId, table.year, table.month),
  index("report_submissions_institution_id_idx").on(table.institutionId),
  index("report_submissions_staff_id_idx").on(table.staffId),
]);
