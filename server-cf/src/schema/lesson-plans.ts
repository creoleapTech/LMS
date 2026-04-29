import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { staff, institutions } from "./admin";
import { gradeBooks, chapters } from "./books";

// ─── lesson_plans ────────────────────────────────────
export const lessonPlans = sqliteTable("lesson_plans", {
  id:               text("id").primaryKey(),
  staffId:          text("staff_id").notNull().references(() => staff.id),
  institutionId:    text("institution_id").notNull().references(() => institutions.id),

  // Required fields
  title:            text("title").notNull(),
  subject:          text("subject").notNull(),
  gradeOrClass:     text("grade_or_class").notNull(),
  date:             text("date").notNull(),
  durationMinutes:  integer("duration_minutes").notNull(),

  // Status lifecycle
  status:           text("status", {
                      enum: ["draft", "ready", "completed"],
                    }).notNull().default("draft"),

  // Optional pedagogical fields
  learningObjectives: text("learning_objectives"),
  materialsNeeded:    text("materials_needed"),
  introduction:       text("introduction"),
  mainActivity:       text("main_activity"),
  conclusion:         text("conclusion"),
  assessmentMethod:   text("assessment_method"),
  homeworkNotes:      text("homework_notes"),

  // Optional curriculum link
  gradeBookId:      text("grade_book_id").references(() => gradeBooks.id),
  chapterId:        text("chapter_id").references(() => chapters.id),

  // Soft delete + timestamps
  isDeleted:        integer("is_deleted").default(0),
  createdAt:        text("created_at"),
  updatedAt:        text("updated_at"),
});
