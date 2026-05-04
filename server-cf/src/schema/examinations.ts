import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { staff, institutions } from "./admin";

// ─── examinations ────────────────────────────────────
export const examinations = sqliteTable("examinations", {
  id:               text("id").primaryKey(),
  name:             text("name").notNull(),
  createdBy:        text("created_by").notNull().references(() => staff.id),
  institutionId:    text("institution_id").notNull().references(() => institutions.id),

  // JSON array of class IDs selected for this examination
  selectedClassIds: text("selected_class_ids").notNull().default("[]"),

  isDeleted:        integer("is_deleted").default(0),
  createdAt:        text("created_at"),
  updatedAt:        text("updated_at"),
});

// ─── examination_columns ─────────────────────────────
// User-defined columns for an examination (number, text, or formula)
export const examinationColumns = sqliteTable("examination_columns", {
  id:             text("id").primaryKey(),
  examinationId:  text("examination_id").notNull().references(() => examinations.id),
  name:           text("name").notNull(),
  type:           text("type", { enum: ["number", "text", "formula"] }).notNull(),
  formula:        text("formula"),   // Only populated when type === "formula"
  order:          integer("order").notNull().default(0),
  createdAt:      text("created_at"),
  updatedAt:      text("updated_at"),
});

// ─── examination_cells ───────────────────────────────
// Per-student cell values for user-defined columns
export const examinationCells = sqliteTable("examination_cells", {
  id:             text("id").primaryKey(),
  examinationId:  text("examination_id").notNull().references(() => examinations.id),
  studentId:      text("student_id").notNull(),
  columnId:       text("column_id").notNull().references(() => examinationColumns.id),
  value:          text("value").notNull().default(""),
  createdAt:      text("created_at"),
  updatedAt:      text("updated_at"),
});
