import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { admins, institutions, staff, classes, students } from "./admin";
import { curricula, gradeBooks, chapterContents } from "./books";
import { classSessions, teachingProgress } from "./staff";
import { studentProgress } from "./students";
import { institutionSettings, academicYears, periodConfigs, timetableEntries } from "./settings";

// ═══════════════════════════════════════════════════
// Junction tables for embedded arrays
// ═══════════════════════════════════════════════════

// ─── staff_subjects ─────────────────────────────────
export const staffSubjects = sqliteTable("staff_subjects", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
});

// ─── staff_assigned_classes ─────────────────────────
export const staffAssignedClasses = sqliteTable("staff_assigned_classes", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
});

// ─── institution_admin_ids ──────────────────────────
export const institutionAdminIds = sqliteTable("institution_admin_ids", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().references(() => institutions.id, { onDelete: "cascade" }),
  adminId: text("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
});

// ─── institution_staff_ids ──────────────────────────
export const institutionStaffIds = sqliteTable("institution_staff_ids", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().references(() => institutions.id, { onDelete: "cascade" }),
  staffId: text("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
});

// ─── institution_curriculum_access ──────────────────
export const institutionCurriculumAccess = sqliteTable("institution_curriculum_access", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().references(() => institutions.id, { onDelete: "cascade" }),
  curriculumId: text("curriculum_id").notNull().references(() => curricula.id, { onDelete: "cascade" }),
});

// ─── institution_accessible_gradebooks ──────────────
export const institutionAccessibleGradebooks = sqliteTable("institution_accessible_gradebooks", {
  id: text("id").primaryKey(),
  accessId: text("access_id").notNull().references(() => institutionCurriculumAccess.id, { onDelete: "cascade" }),
  gradeBookId: text("grade_book_id").notNull().references(() => gradeBooks.id, { onDelete: "cascade" }),
});

// ─── class_student_ids ──────────────────────────────
export const classStudentIds = sqliteTable("class_student_ids", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
});

// ─── class_teacher_ids ──────────────────────────────
export const classTeacherIds = sqliteTable("class_teacher_ids", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  staffId: text("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
});

// ─── curriculum_tags ────────────────────────────────
export const curriculumTags = sqliteTable("curriculum_tags", {
  id: text("id").primaryKey(),
  curriculumId: text("curriculum_id").notNull().references(() => curricula.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});

// ─── curriculum_levels ──────────────────────────────
export const curriculumLevels = sqliteTable("curriculum_levels", {
  id: text("id").primaryKey(),
  curriculumId: text("curriculum_id").notNull().references(() => curricula.id, { onDelete: "cascade" }),
  level: text("level").notNull(),
});

// ─── curriculum_grades ──────────────────────────────
export const curriculumGrades = sqliteTable("curriculum_grades", {
  id: text("id").primaryKey(),
  curriculumId: text("curriculum_id").notNull().references(() => curricula.id, { onDelete: "cascade" }),
  grade: integer("grade").notNull(),
});

// ─── academic_year_terms ────────────────────────────
export const academicYearTerms = sqliteTable("academic_year_terms", {
  id: text("id").primaryKey(),
  academicYearId: text("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  label: text("label"),
  startDate: text("start_date"),
  endDate: text("end_date"),
});

// ─── period_config_periods ──────────────────────────
export const periodConfigPeriods = sqliteTable("period_config_periods", {
  id: text("id").primaryKey(),
  periodConfigId: text("period_config_id").notNull().references(() => periodConfigs.id, { onDelete: "cascade" }),
  periodNumber: integer("period_number").notNull(),
  label: text("label"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  isBreak: integer("is_break").default(0),
});

// ─── period_config_working_days ─────────────────────
export const periodConfigWorkingDays = sqliteTable("period_config_working_days", {
  id: text("id").primaryKey(),
  periodConfigId: text("period_config_id").notNull().references(() => periodConfigs.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
});

// ─── timetable_topics_covered ───────────────────────
export const timetableTopicsCovered = sqliteTable("timetable_topics_covered", {
  id: text("id").primaryKey(),
  timetableEntryId: text("timetable_entry_id").notNull().references(() => timetableEntries.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
});

// ─── class_session_topics ───────────────────────────
export const classSessionTopics = sqliteTable("class_session_topics", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => classSessions.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
});

// ─── grading_scale_entries ──────────────────────────
export const gradingScaleEntries = sqliteTable("grading_scale_entries", {
  id: text("id").primaryKey(),
  settingsId: text("settings_id").notNull().references(() => institutionSettings.id, { onDelete: "cascade" }),
  grade: text("grade"),
  label: text("label"),
  minPercentage: real("min_percentage"),
  maxPercentage: real("max_percentage"),
});

// ─── quiz_questions ─────────────────────────────────
export const quizQuestions = sqliteTable("quiz_questions", {
  id: text("id").primaryKey(),
  contentId: text("content_id").notNull().references(() => chapterContents.id, { onDelete: "cascade" }),
  questionText: text("question_text"),
  questionMedia: text("question_media"),
  answerType: text("answer_type"),
  correctAnswer: text("correct_answer"),
  explanation: text("explanation"),
  points: integer("points").default(1),
  order: integer("order"),
});

// ─── quiz_question_options ──────────────────────────
export const quizQuestionOptions = sqliteTable("quiz_question_options", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  label: text("label"),
  value: text("value"),
  order: integer("order"),
});

// ─── quiz_match_pairs ───────────────────────────────
export const quizMatchPairs = sqliteTable("quiz_match_pairs", {
  id: text("id").primaryKey(),
  questionId: text("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  leftItem: text("left_item"),
  rightItem: text("right_item"),
  order: integer("order"),
});

// ─── teaching_progress_contents ─────────────────────
export const teachingProgressContents = sqliteTable("teaching_progress_contents", {
  id: text("id").primaryKey(),
  teachingProgressId: text("teaching_progress_id").notNull().references(() => teachingProgress.id, { onDelete: "cascade" }),
  contentId: text("content_id"),
  chapterId: text("chapter_id"),
  isCompleted: integer("is_completed").default(0),
  completedAt: text("completed_at"),
  videoTimestamp: real("video_timestamp"),
  pdfPage: integer("pdf_page"),
  lastAccessedAt: text("last_accessed_at"),
});

// ─── student_completed_contents ─────────────────────
export const studentCompletedContents = sqliteTable("student_completed_contents", {
  id: text("id").primaryKey(),
  progressId: text("progress_id").notNull().references(() => studentProgress.id, { onDelete: "cascade" }),
  contentId: text("content_id").notNull(),
});

// ─── student_quiz_scores ────────────────────────────
export const studentQuizScores = sqliteTable("student_quiz_scores", {
  id: text("id").primaryKey(),
  progressId: text("progress_id").notNull().references(() => studentProgress.id, { onDelete: "cascade" }),
  quizId: text("quiz_id"),
  score: real("score"),
  maxScore: real("max_score"),
  attemptedAt: text("attempted_at"),
});
